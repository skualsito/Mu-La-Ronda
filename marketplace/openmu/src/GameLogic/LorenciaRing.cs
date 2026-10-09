// <copyright file="LorenciaRing.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic;

using MUnique.OpenMU.Pathfinding;

/// <summary>
/// Mu La Ronda: the ring in the middle of Lorencia, where the fountain was. Its cells are
/// walkable and outside the safezone (deploy/config/30-lorencia-ring.sql), so players can
/// fight there, and a kill inside it does not make the killer a PK (<see cref="Player"/>).
/// The client draws it and opens the same cells (src/common/terrain/lorenciaRing.ts):
/// keep the three in step.
/// </summary>
public static class LorenciaRing
{
    /// <summary>The map number of Lorencia.</summary>
    public const short MapNumber = 0;

    /// <summary>The first column of the ring.</summary>
    public const byte X1 = 137;

    /// <summary>The first row of the ring.</summary>
    public const byte Y1 = 124;

    /// <summary>The last column of the ring.</summary>
    public const byte X2 = 144;

    /// <summary>The last row of the ring.</summary>
    public const byte Y2 = 131;

    /// <summary>The cell in the middle of the ring.</summary>
    public static Point Center => new((byte)((X1 + X2) / 2), (byte)((Y1 + Y2) / 2));

    /// <summary>Whether the object stands inside the ring.</summary>
    /// <param name="obj">The object.</param>
    /// <returns><c>true</c> when it is on Lorencia, inside the ring.</returns>
    public static bool Contains(ILocateable obj)
        => obj.CurrentMap?.Definition.Number == MapNumber
           && obj.Position.X is >= X1 and <= X2
           && obj.Position.Y is >= Y1 and <= Y2;
}
