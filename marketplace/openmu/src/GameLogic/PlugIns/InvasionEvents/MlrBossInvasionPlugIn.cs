// <copyright file="MlrBossInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Collections.Concurrent;
using MUnique.OpenMU.GameLogic.Views;
using MUnique.OpenMU.Interfaces;

/// <summary>
/// Mu La Ronda: a boss that comes on a timetable to one of a few places of its map, chosen at
/// random on every run, and says where it is. A place that is not walkable (or is in a safe zone)
/// moves to the nearest one that is, so a wrong coordinate never leaves the boss in a wall.
/// Every game server (channel) draws its own place: the plugin and its configuration are shared by
/// all of them, so the place is kept per server, never written into the configuration.
/// </summary>
public abstract class MlrBossInvasionPlugIn : SimpleInvasionPlugIn
{
    private const int SearchRadius = 15;

    private readonly ConcurrentDictionary<IGameContext, (byte X, byte Y)> _spots = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrBossInvasionPlugIn"/> class.
    /// </summary>
    /// <param name="defaultConfigFactory">Factory that returns the default configuration.</param>
    protected MlrBossInvasionPlugIn(Func<PeriodicInvasionConfiguration> defaultConfigFactory)
        : base(defaultConfigFactory)
    {
    }

    /// <summary>Gets the places the boss may come to, for the admin panel's event details.</summary>
    public IReadOnlyList<(byte X, byte Y)> SpawnPlaces => this.Places;

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

        this._spots.TryRemove(state.Context, out _);
        if (this.Places.Count == 0 || !state.SelectedMaps.TryGetValue(this.BossNumber, out var mapId))
        {
            return;
        }

        var (x, y) = this.Places[Rand.NextInt(0, this.Places.Count)];
        if (await state.Context.GetMapAsync(mapId).ConfigureAwait(false) is { } map)
        {
            (x, y) = NearestFreeCell(map.Terrain, x, y);
        }

        this._spots[state.Context] = (x, y);
    }

    /// <inheritdoc />
    protected override async ValueTask OnPreparedAsync(InvasionGameServerState state)
    {
        if (!this._spots.TryGetValue(state.Context, out var spot) || state.MapId is not { } mapId)
        {
            await base.OnPreparedAsync(state).ConfigureAwait(false);
            return;
        }

        // Mu La Ronda: the players get the map, never the coordinates: those are for the admins
        // (the event's details in the panel show them), so the boss has to be looked for.
        var mapName = state.Context.Configuration.Maps.FirstOrDefault(m => m.Number == mapId)?.Name;
        await state.Context.ForEachPlayerAsync(player =>
        {
            var message = $"[{mapName?.GetTranslation(player.Culture)}] ¡{this.BossName} apareció!";
            return player.InvokeViewPlugInAsync<IShowMessagePlugIn>(p => p.ShowMessageAsync(message, MessageType.GoldenCenter)).AsTask();
        }).ConfigureAwait(false);
    }

    /// <inheritdoc />
    protected override async ValueTask SpawnMobsOnMapsAsync(InvasionGameServerState state)
    {
        if (!this._spots.TryGetValue(state.Context, out var spot) || this.Configuration?.Mobs is not { Count: > 0 } mobs)
        {
            await base.SpawnMobsOnMapsAsync(state).ConfigureAwait(false);
            return;
        }

        foreach (var spawn in mobs)
        {
            if (!state.SelectedMaps.TryGetValue(spawn.MonsterId, out var mapId))
            {
                continue;
            }

            var placed = spawn.MonsterId == this.BossNumber
                ? new InvasionSpawnConfiguration(spawn.MonsterId, spawn.Count, spawn.MapIds, spawn.MapStrategy, spot.X, spot.Y, spawn.AnnounceDeath)
                : spawn;
            await this.SpawnMobsAsync(state.Context, mapId, [placed]).ConfigureAwait(false);
        }
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
