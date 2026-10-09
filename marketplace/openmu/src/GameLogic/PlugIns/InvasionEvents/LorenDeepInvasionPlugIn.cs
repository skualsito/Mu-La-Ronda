// <copyright file="LorenDeepInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Extensions.Logging;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.GameLogic.Views;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Pathfinding;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: Loren Deep, an event of the Valley of Loren like a Devil Square in the open: three
/// waves of monsters, low, medium and high, each one when the last is dead or after ten minutes,
/// with the map's experience up by half while it runs. Its monsters drop the Star of Sacred Birth
/// (deploy/config/36-loren-deep.sql). Twice a day, never on Sundays (the day of the castle siege).
/// </summary>
[PlugIn]
[Display(Name = "Loren Deep", Description = "Waves of monsters in the Valley of Loren, with more experience.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E0030")]
public sealed class LorenDeepInvasionPlugIn : SimpleInvasionPlugIn
{
    /// <summary>The Valley of Loren.</summary>
    public const ushort ValleyOfLoren = 30;

    private const double ExperienceBonus = 1.5;

    /// <summary>The field below the castle, where the waves come.</summary>
    private const byte AreaX1 = 40;
    private const byte AreaY1 = 14;
    private const byte AreaX2 = 142;
    private const byte AreaY2 = 60;

    private static readonly TimeSpan WaveTime = TimeSpan.FromMinutes(10);

    /// <summary>The monsters of each wave, low to high; how many of each, the configuration says.</summary>
    private static readonly ushort[][] Waves =
    [
        [38, 48, 307], // Balrog, Lizard King, Forest Orc
        [353, 310, 311], // Satyros, Hammer Scout, Lance Scout
        [313, 489, 551], // Werewolf, Burning Lava Giant, Bloody Golem
    ];

    private readonly ConcurrentDictionary<IGameContext, Run> _runs = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="LorenDeepInvasionPlugIn"/> class.
    /// </summary>
    public LorenDeepInvasionPlugIn()
        : base(CreateDefaultConfiguration)
    {
    }

    /// <inheritdoc />
    protected override bool IsItTimeToStart(IGameContext gameContext)
    {
        if (!base.IsItTimeToStart(gameContext))
        {
            return false;
        }

        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, gameContext.ServerTimeZone).DayOfWeek;
        return this.IsStartForced || today != DayOfWeek.Sunday;
    }

    /// <inheritdoc />
    protected override async ValueTask OnStartedAsync(InvasionGameServerState state)
    {
        var run = new Run();
        if (this._runs.TryRemove(state.Context, out var old))
        {
            old.Stop();
        }

        this._runs[state.Context] = run;
        if (state.Context.Configuration.Maps.FirstOrDefault(m => m.Number == ValleyOfLoren) is { } map)
        {
            run.Map = map;
            run.Experience = map.ExpMultiplier;
            map.ExpMultiplier = run.Experience * ExperienceBonus;
        }

        await base.OnStartedAsync(state).ConfigureAwait(false);
        _ = Task.Run(() => this.RunWavesAsync(state, run));
    }

    /// <inheritdoc />
    protected override ValueTask SpawnMobsOnMapsAsync(InvasionGameServerState state)
        => this.SpawnWaveAsync(state, 0);

    /// <inheritdoc />
    protected override ValueTask OnAllMonstersKilledAsync(InvasionGameServerState state)
    {
        if (this._runs.TryGetValue(state.Context, out var run) && run.Wave < Waves.Length - 1)
        {
            run.WaveCleared.Release();
            return ValueTask.CompletedTask;
        }

        return base.OnAllMonstersKilledAsync(state);
    }

    /// <inheritdoc />
    protected override async ValueTask OnFinishedAsync(InvasionGameServerState state)
    {
        if (this._runs.TryRemove(state.Context, out var run))
        {
            run.Stop();
        }

        await base.OnFinishedAsync(state).ConfigureAwait(false);
    }

    private static PeriodicInvasionConfiguration CreateDefaultConfiguration() => new()
    {
        TaskDuration = TimeSpan.FromMinutes(30),
        PreStartMessageDelay = TimeSpan.FromSeconds(3),
        StartMessage = "[{mapName}] ¡Empezó el Loren Deep! Experiencia +50% mientras dura.",
        EndMessage = "[{mapName}] Terminó el Loren Deep.",
        Timetable = [new TimeOnly(8, 0), new TimeOnly(20, 0)],
        Mobs = Waves.SelectMany(wave => wave)
            .Select(number => new InvasionSpawnConfiguration(number, 10, [ValleyOfLoren], SpawnMapStrategy.RandomMap))
            .ToList(),
    };

    private async Task RunWavesAsync(InvasionGameServerState state, Run run)
    {
        try
        {
            for (var wave = 1; wave < Waves.Length; wave++)
            {
                while (run.WaveCleared.CurrentCount > 0)
                {
                    await run.WaveCleared.WaitAsync(run.Cancel.Token).ConfigureAwait(false);
                }

                await run.WaveCleared.WaitAsync(WaveTime, run.Cancel.Token).ConfigureAwait(false);
                if (state.State != PeriodicTaskState.Started)
                {
                    return;
                }

                run.Wave = wave;
                var message = $"Loren Deep: ¡llega la oleada {wave + 1} de {Waves.Length}!";
                await state.Context.ForEachPlayerAsync(p => p.InvokeViewPlugInAsync<IShowMessagePlugIn>(v => v.ShowMessageAsync(message, MessageType.GoldenCenter)).AsTask()).ConfigureAwait(false);
                await this.SpawnWaveAsync(state, wave).ConfigureAwait(false);
                await this.SendTallyToAllAsync(state).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
            // The event finished.
        }
        catch (Exception ex)
        {
            state.Context.LoggerFactory.CreateLogger(this.GetType()).LogError(ex, "Error bringing a Loren Deep wave.");
        }
    }

    private async ValueTask SpawnWaveAsync(InvasionGameServerState state, int wave)
    {
        if (this.Configuration?.Mobs is not { Count: > 0 } mobs
            || await state.Context.GetMapAsync(ValleyOfLoren).ConfigureAwait(false) is not { } map)
        {
            return;
        }

        var logger = state.Context.LoggerFactory.CreateLogger(this.GetType());
        foreach (var mob in mobs.Where(m => Waves[wave].Contains(m.MonsterId)))
        {
            if (state.Context.Configuration.Monsters.FirstOrDefault(m => m.Number == mob.MonsterId) is not { } definition)
            {
                continue;
            }

            for (var i = 0; i < mob.Count; i++)
            {
                if (FieldCell(map.Terrain) is { } cell)
                {
                    await this.CreateMonstersAsync(state.Context, logger, map, definition, 1, false, (byte)cell.X, (byte)cell.Y).ConfigureAwait(false);
                }
            }
        }
    }

    private static Point? FieldCell(GameMapTerrain terrain)
    {
        for (var attempt = 0; attempt < 100; attempt++)
        {
            var x = Rand.NextInt(AreaX1, AreaX2 + 1);
            var y = Rand.NextInt(AreaY1, AreaY2 + 1);
            if (terrain.WalkMap[x, y] && !terrain.SafezoneMap[x, y])
            {
                return new Point((byte)x, (byte)y);
            }
        }

        return terrain.RandomWalkableCoordinate;
    }

    /// <summary>One run of the event: its wave, and the map's experience to put back.</summary>
    private sealed class Run
    {
        public int Wave { get; set; }

        public SemaphoreSlim WaveCleared { get; } = new(0);

        public CancellationTokenSource Cancel { get; } = new();

        public GameMapDefinition? Map { get; set; }

        public double Experience { get; set; }

        public void Stop()
        {
            this.Cancel.Cancel();
            if (this.Map is { } map)
            {
                map.ExpMultiplier = this.Experience;
                this.Map = null;
            }
        }
    }
}
