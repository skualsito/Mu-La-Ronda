// <copyright file="VipStadium.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

/// <summary>
/// Mu La Ronda: the VIP stadium, a copy of Arena (map 6) with its own monster
/// spots, for VIP accounts only (deploy/config/20-vip-stadium.sql). Entering is
/// refused in <see cref="PlayerActions.GameMapDefinitionExtensions.TryGetRequirementError"/>,
/// which every warp, gate and party summon asks; a character whose VIP ran out
/// while inside is sent to Arena when it enters the world (<see cref="VipEnterWorldPlugIn"/>).
/// </summary>
public static class VipStadium
{
    /// <summary>The map number of the VIP stadium (the client draws it with Arena's World7).</summary>
    public const short MapNumber = 100;

    /// <summary>Arena, where a character without VIP is sent.</summary>
    public const short ArenaMapNumber = 6;

    /// <summary>What a player without VIP is told.</summary>
    public const string OnlyVipMessage = "El Stadium VIP es solo para cuentas VIP (/vip).";

    /// <summary>Whether the map is the VIP stadium.</summary>
    public static bool IsVipStadium(GameMapDefinition? map) => map?.Number == MapNumber;
}
