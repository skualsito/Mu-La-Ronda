// <copyright file="VipEnterWorldPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: puts the account's VIP bonuses on a character when it lands on
/// a map. By then the attribute system of its session exists; a character gets
/// a new one each time it enters the world, and <see cref="Vip.Apply"/> only
/// acts (and the player is told) the first time for each, so warps cost a lookup.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C25")]
[PlugIn]
[Display(Name = "VIP bonuses", Description = "Applies the account's VIP bonuses when a character enters the world.")]
public class VipEnterWorldPlugIn : IObjectAddedToMapPlugIn
{
    /// <inheritdoc />
    public async ValueTask ObjectAddedToMapAsync(GameMap map, ILocateable addedObject)
    {
        if (addedObject is not Player player)
        {
            return;
        }

        if (Vip.Apply(player))
        {
            await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
        }
    }
}
