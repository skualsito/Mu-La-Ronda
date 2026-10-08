// <copyright file="BossKillAnnouncementPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.NPC;
using MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: tells the whole server who killed a boss, and where, so nobody keeps walking
/// the maps looking for one that is already dead. The big bosses (Kundun, the invasion bosses,
/// Selupan...) get the golden message in the middle of the screen. The golden invasion
/// monsters are not announced: the events window counts them (BaseInvasionPlugIn).
/// </summary>
[PlugIn]
[Display(Name = "Boss kill announcement", Description = "Announces to every player who killed a boss, and on which map.")]
[Guid("6C1F6A0E-3B8D-4F0B-9E57-2B7C1D4A9F31")]
public class BossKillAnnouncementPlugIn : IAttackableGotKilledPlugIn
{
    private static readonly HashSet<int> Bosses =
    [
        161, // Illusion of Kundun 1
        181, // Illusion of Kundun 2
        189, // Illusion of Kundun 3
        197, // Illusion of Kundun 4
        267, // Illusion of Kundun 5
        338, // Illusion of Kundun 6
        275, // Illusion of Kundun 7 (Kundun)
        InvasionMonsters.RedDragon,
        InvasionMonsters.WhiteWizard,
        295, // Erohim
        309, // Hell Maine
        459, // Selupan
    ];

    /// <inheritdoc />
    public async ValueTask AttackableGotKilledAsync(IAttackable killed, IAttacker? killer)
    {
        if (killed is not Monster { IsSummonedMonster: false } monster)
        {
            return;
        }

        if (!Bosses.Contains(monster.Definition.Number))
        {
            return;
        }

        var player = killer as Player ?? (killer as Monster)?.SummonedBy;
        if (player?.SelectedCharacter?.Name is not { } name)
        {
            return;
        }

        var monsterName = monster.Definition.Designation.ValueInNeutralLanguage;
        var mapName = monster.CurrentMap?.Definition.Name.ValueInNeutralLanguage ?? "?";
        var message = $"{name} mato a {monsterName} en {mapName}";
        await player.GameContext.SendGlobalMessageAsync(message, MessageType.GoldenCenter).ConfigureAwait(false);
    }
}
