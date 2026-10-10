// <copyright file="MasterLevelUpEffectPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameServer.RemoteView.Character;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.GameLogic.Views;
using MUnique.OpenMU.Network.Packets.ServerToClient;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: a master level-up is shown with its own effect, the golden pillar of the original
/// (<c>MODEL_CHANGE_UP_EFF</c>), and not the level-up beam. OpenMU sends the same "level up" effect
/// for both, so the hero and everybody around get this one first, with an effect number of our own
/// (<see cref="MasterLevelUp"/>), and the client skips the level-up beam that follows it.
/// </summary>
[PlugIn]
[Display(Name = "Master level-up effect", Description = "Shows a master level-up with its own effect to the player and everybody around.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E0400")]
public class MasterLevelUpEffectPlugIn : ICharacterMasterLevelUpPlugIn
{
    /// <summary>
    /// The effect number on the wire (C1 48); the protocol only defines 3, 16 and 17
    /// (src/logic.ts, <c>ShowEffect</c>, in the client).
    /// </summary>
    public const byte MasterLevelUp = 32;

    /// <inheritdoc />
    public async ValueTask CharacterMasterLeveledUpAsync(Player player)
    {
        await player.ForEachObservingAsync<RemotePlayer>(
            observer => observer.Connection.SendShowEffectAsync(player.GetId(observer), (ShowEffect.EffectType)MasterLevelUp),
            true).ConfigureAwait(false);
    }
}
