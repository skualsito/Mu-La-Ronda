// <copyright file="WidePointsLine.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameServer.RemoteView.Character;

using MUnique.OpenMU.GameLogic;

/// <summary>
/// Mu La Ronda: the level and stats packets carry the free points in 16 bits, so past
/// 65 535 the client saw them wrap around (and "lose" them on a reset). The real number
/// follows each of those packets as a blue line the client reads and does not show
/// (src/common/widePoints.ts) - always, so the client also hears when they drop back
/// under 65 536.
/// </summary>
internal static class WidePointsLine
{
    /// <summary>Sends "Puntos libres: N".</summary>
    /// <param name="player">The player.</param>
    public static async ValueTask SendAsync(RemotePlayer player)
    {
        if (player.SelectedCharacter is { } character)
        {
            await player.ShowBlueMessageAsync($"Puntos libres: {Math.Max(0, character.LevelUpPoints)}").ConfigureAwait(false);
        }
    }
}
