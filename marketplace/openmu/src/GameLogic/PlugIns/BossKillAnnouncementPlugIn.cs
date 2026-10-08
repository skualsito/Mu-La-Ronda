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
/// Selupan...) get the golden message in the middle of the screen; the golden invasion
/// monsters, of which there are a couple of hundred, a blue line in the chat.
/// </summary>
[PlugIn]
[Display(Name = "Boss kill announcement", Description = "Announces to every player who killed a boss or a golden invasion monster, and on which map.")]
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

    private static readonly HashSet<int> Goldens =
    [
        InvasionMonsters.GoldenBudgeDragon,
        InvasionMonsters.GoldenSoldier,
        InvasionMonsters.GoldenTitan,
        InvasionMonsters.GoldenGoblin,
        InvasionMonsters.GoldenDragon,
        InvasionMonsters.GoldenLizardKing,
        InvasionMonsters.GoldenVepar,
        InvasionMonsters.GoldenTantallos,
        InvasionMonsters.GoldenWheel,
        493, 494, 495, 496, 497, 498, 499, 500, 501, 502, // the Season 4+ golden monsters (GoldenInvasion.cs)
    ];

    /// <inheritdoc />
    public async ValueTask AttackableGotKilledAsync(IAttackable killed, IAttacker? killer)
    {
        if (killed is not Monster { IsSummonedMonster: false } monster)
        {
            return;
        }

        var number = monster.Definition.Number;
        var boss = Bosses.Contains(number);
        if (!boss && !Goldens.Contains(number))
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
        await player.GameContext.SendGlobalMessageAsync(message, boss ? MessageType.GoldenCenter : MessageType.BlueNormal).ConfigureAwait(false);
    }
}
