// <copyright file="MlrBossInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

/// <summary>
/// Mu La Ronda: a boss that comes on a timetable to one of a few places of its map, chosen at
/// random on every run, and says where it is. A place that is not walkable (or is in a safe zone)
/// moves to the nearest one that is, so a wrong coordinate never leaves the boss in a wall.
/// </summary>
public abstract class MlrBossInvasionPlugIn : SimpleInvasionPlugIn
{
    private const int SearchRadius = 15;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrBossInvasionPlugIn"/> class.
    /// </summary>
    /// <param name="defaultConfigFactory">Factory that returns the default configuration.</param>
    protected MlrBossInvasionPlugIn(Func<PeriodicInvasionConfiguration> defaultConfigFactory)
        : base(defaultConfigFactory)
    {
    }

    /// <summary>Gets the monster number of the boss.</summary>
    protected abstract ushort BossNumber { get; }

    /// <summary>Gets the name the start message calls the boss by.</summary>
    protected abstract string BossName { get; }

    /// <summary>Gets the places the boss may come to; one of them, at random, every run.</summary>
    protected abstract IReadOnlyList<(byte X, byte Y)> Places { get; }

    /// <inheritdoc />
    protected override ushort? AnnouncedMonsterId => this.BossNumber;

    /// <inheritdoc />
    protected override async ValueTask OnPrepareEventAsync(InvasionGameServerState state)
    {
        await base.OnPrepareEventAsync(state).ConfigureAwait(false);

        var configuration = this.Configuration;
        if (configuration?.Mobs.FirstOrDefault(m => m.MonsterId == this.BossNumber) is not { } boss
            || this.Places.Count == 0
            || !state.SelectedMaps.TryGetValue(this.BossNumber, out var mapId))
        {
            return;
        }

        var (x, y) = this.Places[Rand.NextInt(0, this.Places.Count)];
        if (await state.Context.GetMapAsync(mapId).ConfigureAwait(false) is { } map)
        {
            (x, y) = NearestFreeCell(map.Terrain, x, y);
        }

        boss.X = x;
        boss.Y = y;
        configuration.StartMessage = $"[{{mapName}}] ¡{this.BossName} apareció en {x}, {y}!";
    }

    private static (byte X, byte Y) NearestFreeCell(GameMapTerrain terrain, byte x, byte y)
    {
        for (var radius = 0; radius <= SearchRadius; radius++)
        {
            for (var dx = -radius; dx <= radius; dx++)
            {
                for (var dy = -radius; dy <= radius; dy++)
                {
                    if (Math.Max(Math.Abs(dx), Math.Abs(dy)) != radius)
                    {
                        continue;
                    }

                    var cx = x + dx;
                    var cy = y + dy;
                    if (cx is < 0 or > 255 || cy is < 0 or > 255)
                    {
                        continue;
                    }

                    if (terrain.WalkMap[cx, cy] && !terrain.SafezoneMap[cx, cy])
                    {
                        return ((byte)cx, (byte)cy);
                    }
                }
            }
        }

        return (x, y);
    }
}
