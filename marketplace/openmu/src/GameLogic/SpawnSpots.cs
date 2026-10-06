// <copyright file="SpawnSpots.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic;

using MUnique.OpenMU.Pathfinding;

/// <summary>
/// Mu La Ronda: turns the big monster spawn areas of a map into spots - small
/// squares of walkable ground with at most <see cref="MaxPerSpot"/> monsters
/// each, spread over the original area and apart from the spots of the other
/// areas of the map. MU's original areas cover whole zones, so their monsters
/// ended up scattered everywhere (and many of them with the "server fast"
/// multiplier). The spots are built from the map's own walk map when the map
/// starts, so they never land on walls, water or the safe zone.
/// </summary>
public static class SpawnSpots
{
    /// <summary>The most monsters a spot gets.</summary>
    public const int MaxPerSpot = 8;

    /// <summary>A spot is a square of (2 × radius + 1) cells.</summary>
    private const int SpotRadius = 2;

    /// <summary>Minimum distance (in cells, per axis) between the centers of two spots: two cells of air between them.</summary>
    private const int MinSpacing = (2 * SpotRadius) + 3;

    /// <summary>
    /// Splits the spawn area into spots, if it is a monster area worth splitting.
    /// </summary>
    /// <param name="map">The map the monsters spawn on.</param>
    /// <param name="area">The configured spawn area.</param>
    /// <param name="occupied">Centers of the spots already placed on this map; the new ones are added.</param>
    /// <returns>The areas to spawn instead of <paramref name="area"/>, or just <paramref name="area"/>.</returns>
    public static IReadOnlyList<MonsterSpawnArea> Split(GameMap map, MonsterSpawnArea area, List<Point> occupied)
    {
        if (area.MonsterDefinition?.ObjectKind != NpcObjectKind.Monster
            || area.SpawnTrigger != SpawnTrigger.Automatic
            || area.Quantity < 2
            || area.IsPoint())
        {
            return [area];
        }

        var wanted = (area.Quantity + MaxPerSpot - 1) / MaxPerSpot;
        var centers = new List<(Point Center, int Radius)>();
        for (var radius = SpotRadius; radius >= 0 && centers.Count == 0; radius--)
        {
            var candidates = Candidates(map.Terrain, area, radius);
            if (candidates.Count == 0)
            {
                continue;
            }

            foreach (var center in Pick(candidates, area, wanted, occupied))
            {
                centers.Add((center, radius));
            }

            // Everything near the area is taken by other spots: still one spot, so the
            // monster doesn't disappear from the map.
            if (centers.Count == 0)
            {
                centers.Add((Nearest(candidates, Center(area)), radius));
            }
        }

        if (centers.Count == 0)
        {
            // Not a single walkable cell: leave it as configured.
            return [area];
        }

        var total = Math.Min(area.Quantity, centers.Count * MaxPerSpot);
        var result = new List<MonsterSpawnArea>(centers.Count);
        for (var i = 0; i < centers.Count; i++)
        {
            var (center, radius) = centers[i];
            occupied.Add(center);
            var quantity = (total / centers.Count) + (i < total % centers.Count ? 1 : 0);
            if (quantity <= 0)
            {
                continue;
            }

            result.Add(new MonsterSpawnArea
            {
                MonsterDefinition = area.MonsterDefinition,
                GameMap = area.GameMap,
                X1 = (byte)(center.X - radius),
                Y1 = (byte)(center.Y - radius),
                X2 = (byte)(center.X + radius),
                Y2 = (byte)(center.Y + radius),
                Direction = area.Direction,
                Quantity = (short)quantity,
                SpawnTrigger = area.SpawnTrigger,
                WaveNumber = area.WaveNumber,
                MaximumHealthOverride = area.MaximumHealthOverride,
            });
        }

        return result;
    }

    private static Point Center(MonsterSpawnArea area)
        => new((byte)((area.X1 + area.X2) / 2), (byte)((area.Y1 + area.Y2) / 2));

    private static int Distance(Point a, Point b) => Math.Max(Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));

    /// <summary>
    /// Centers inside the area whose whole square is walkable and outside the safe zone.
    /// </summary>
    private static List<Point> Candidates(GameMapTerrain terrain, MonsterSpawnArea area, int radius)
    {
        var result = new List<Point>();
        var minX = Math.Min(area.X1, area.X2) + radius;
        var maxX = Math.Max(area.X1, area.X2) - radius;
        var minY = Math.Min(area.Y1, area.Y2) + radius;
        var maxY = Math.Max(area.Y1, area.Y2) - radius;
        for (var x = minX; x <= maxX; x++)
        {
            for (var y = minY; y <= maxY; y++)
            {
                if (IsFree(terrain, x, y, radius))
                {
                    result.Add(new Point((byte)x, (byte)y));
                }
            }
        }

        return result;
    }

    private static bool IsFree(GameMapTerrain terrain, int centerX, int centerY, int radius)
    {
        for (var x = centerX - radius; x <= centerX + radius; x++)
        {
            for (var y = centerY - radius; y <= centerY + radius; y++)
            {
                if (x < 0 || y < 0 || x > 255 || y > 255 || !terrain.WalkMap[x, y] || terrain.SafezoneMap[x, y])
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static Point Nearest(List<Point> candidates, Point target)
    {
        var best = candidates[0];
        foreach (var candidate in candidates)
        {
            if (Distance(candidate, target) < Distance(best, target))
            {
                best = candidate;
            }
        }

        return best;
    }

    /// <summary>
    /// Up to <paramref name="wanted"/> centers, never closer than <see cref="MinSpacing"/> to
    /// another spot. A single spot goes as close to the middle of the area as possible; for
    /// more, the first one goes to the corner farthest from the middle and each next one as
    /// far as possible from all the spots so far (farthest-point sampling), which fits the most
    /// spots in the area. Deterministic, so the spots stay in the same places after every restart.
    /// </summary>
    private static IEnumerable<Point> Pick(List<Point> candidates, MonsterSpawnArea area, int wanted, List<Point> occupied)
    {
        var chosen = new List<Point>();
        var middle = Center(area);
        while (chosen.Count < wanted)
        {
            Point? best = null;
            var bestScore = int.MinValue;
            foreach (var candidate in candidates)
            {
                var nearest = int.MaxValue;
                foreach (var other in occupied)
                {
                    nearest = Math.Min(nearest, Distance(candidate, other));
                }

                foreach (var other in chosen)
                {
                    nearest = Math.Min(nearest, Distance(candidate, other));
                }

                if (nearest < MinSpacing)
                {
                    continue;
                }

                var score = chosen.Count > 0 ? nearest
                    : wanted == 1 ? -Distance(candidate, middle)
                    : Distance(candidate, middle);
                if (score > bestScore)
                {
                    bestScore = score;
                    best = candidate;
                }
            }

            if (best is not { } point)
            {
                break;
            }

            chosen.Add(point);
            yield return point;
        }
    }
}
