// <copyright file="RingKillAnnouncementPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.Views;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: a fight won in the Lorencia ring (<see cref="LorenciaRing"/>) is told to
/// everybody around it - the fighters and whoever stands by watching.
/// </summary>
[PlugIn]
[Display(Name = "Lorencia ring announcement", Description = "Tells the players around the Lorencia ring who won a fight in it.")]
[Guid("A6F0C2D4-5B71-4E8A-9C3F-0D2B7E61F4A9")]
public class RingKillAnnouncementPlugIn : IAttackableGotKilledPlugIn
{
    /// <summary>How far from the middle of the ring the message is heard (the ring is 8 cells wide).</summary>
    private const int Range = 18;

    /// <inheritdoc />
    public async ValueTask AttackableGotKilledAsync(IAttackable killed, IAttacker? killer)
    {
        if (killed is not Player { SelectedCharacter.Name: { } loser } killedPlayer
            || killer is not Player { SelectedCharacter.Name: { } winner } killerPlayer
            || !LorenciaRing.Contains(killedPlayer)
            || !LorenciaRing.Contains(killerPlayer)
            || killedPlayer.CurrentMap is not { } map)
        {
            return;
        }

        var message = $"[Ring] {winner} vencio a {loser}";
        foreach (var player in map.GetAttackablesInRange(LorenciaRing.Center, Range).OfType<Player>())
        {
            await player.InvokeViewPlugInAsync<IShowMessagePlugIn>(p => p.ShowMessageAsync(message, MessageType.BlueNormal)).ConfigureAwait(false);
        }
    }
}
