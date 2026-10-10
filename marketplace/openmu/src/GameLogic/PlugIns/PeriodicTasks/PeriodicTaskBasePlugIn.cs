// <copyright file="PeriodicTaskBasePlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;

using System.Collections.Concurrent;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Base class for periodic task plugins.
/// </summary>
/// <typeparam name="TConfiguration">Configuration type.</typeparam>
/// <typeparam name="TState">State type.</typeparam>
public abstract class PeriodicTaskBasePlugIn<TConfiguration, TState> : IPeriodicTaskPlugIn, ISupportCustomConfiguration<TConfiguration>, IMlrEventControl
    where TConfiguration : PeriodicTaskConfiguration
    where TState : PeriodicTaskGameServerState
{
    private static readonly ConcurrentDictionary<Type, ConcurrentDictionary<IGameContext, TState>> States = new();

    /// <summary>
    /// Mu La Ronda: how long a forced start waits for a game server to take it up.
    /// </summary>
    private static readonly TimeSpan ForcedStartValidity = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Mu La Ronda: one instance serves every game server (the channels), and a single flag was
    /// cleared by the first one to start - the others never did. Each server now takes up the
    /// latest forced start on its own.
    /// </summary>
    private readonly ConcurrentDictionary<IGameContext, DateTime> _forcedStartTaken = new();

    private DateTime _forcedStartUtc = DateTime.MinValue;

    /// <summary>Mu La Ronda: the game servers whose current run an admin started (not the timetable).</summary>
    private readonly ConcurrentDictionary<IGameContext, bool> _startedByAdmin = new();

    /// <summary>
    /// Gets or sets configuration for periodic invasion.
    /// </summary>
    public TConfiguration? Configuration { get; set; }

    /// <summary>
    /// Forces to start the task on the next start check, on every game server.
    /// </summary>
    public void ForceStart()
    {
        this._forcedStartUtc = DateTime.UtcNow;
    }

    /// <inheritdoc />
    public (PeriodicTaskState State, DateTime NextRunUtc, DateTime LastRunUtc) GetStatus(IGameContext gameContext)
    {
        var state = this.GetStateByGameContext(gameContext);
        return (state.State, state.NextRunUtc, state.LastRunUtc);
    }

    /// <inheritdoc />
    public DateTime? GetNextScheduledStartUtc(IGameContext gameContext)
    {
        if (this.Configuration is not { Timetable.Count: > 0 } configuration)
        {
            return null;
        }

        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, gameContext.ServerTimeZone);
        var today = nowLocal.Date;
        var next = configuration.Timetable
            .Select(t => today.Add(t.ToTimeSpan()))
            .Select(start => start <= nowLocal ? start.AddDays(1) : start)
            .Min();
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(next, DateTimeKind.Unspecified), gameContext.ServerTimeZone);
    }

    /// <inheritdoc />
    public virtual IReadOnlyList<(short Number, string Name, ushort Map, byte X, byte Y)> GetLiveMonsters(IGameContext gameContext) => [];

    /// <inheritdoc />
    public bool ForceFinish(IGameContext gameContext)
    {
        var state = this.GetStateByGameContext(gameContext);
        if (state.State != PeriodicTaskState.Started)
        {
            return false;
        }

        state.NextRunUtc = DateTime.UtcNow;
        return true;
    }

    /// <inheritdoc />
    public async ValueTask ExecuteTaskAsync(GameContext gameContext)
    {
        var logger = gameContext.LoggerFactory.CreateLogger(this.GetType().Name);
        using var scope = logger.BeginScope(gameContext);

        var state = this.GetStateByGameContext(gameContext);

        if (state.NextRunUtc > DateTime.UtcNow)
        {
            return;
        }

        var configuration = this.Configuration;

        if (configuration is null && this is ISupportDefaultCustomConfiguration defaultConfigSupporter)
        {
            logger.LogWarning("{description} ({gameContext}):configuration is not set. Using default configuration.", state.Description, gameContext);
            this.Configuration = configuration = defaultConfigSupporter.CreateDefaultConfig() as TConfiguration;
        }

        if (configuration is null)
        {
            logger.LogError("{description} ({gameContext}):no configuration available; can't execute task plugin.", state.Description, gameContext);
            return;
        }

        switch (state.State)
        {
            case PeriodicTaskState.NotStarted:
                {
                    if (!this.IsItTimeToStart(gameContext))
                    {
                        return;
                    }

                    if (this.IsPreviousEventStillRunning(state))
                    {
                        this._forcedStartTaken[gameContext] = this._forcedStartUtc;
                        return;
                    }

                    this._startedByAdmin[gameContext] = this.IsStartForced(gameContext);
                    this._forcedStartTaken[gameContext] = this._forcedStartUtc;
                    state.NextRunUtc = DateTime.UtcNow.Add(configuration.PreStartMessageDelay);
                    await this.OnPrepareEventAsync(state).ConfigureAwait(false);
                    state.State = PeriodicTaskState.Prepared;
                    await this.OnPreparedAsync(state).ConfigureAwait(false);

                    if (!string.IsNullOrWhiteSpace(state.Description))
                    {
                        logger.LogDebug("{description} ({gameContext}): event prepared", state.Description, gameContext);
                    }

                    break;
                }

            case PeriodicTaskState.Prepared:
                {
                    state.NextRunUtc = DateTime.UtcNow.Add(configuration.TaskDuration);
                    state.State = PeriodicTaskState.Started;
                    state.LastRunUtc = DateTime.UtcNow;

                    await this.OnStartedAsync(state).ConfigureAwait(false);

                    if (!string.IsNullOrWhiteSpace(state.Description))
                    {
                        logger.LogDebug("{description} ({gameContext}): event started", state.Description, gameContext);
                    }

                    break;
                }

            case PeriodicTaskState.Started:
                {
                    state.State = PeriodicTaskState.NotStarted;

                    await this.OnFinishedAsync(state).ConfigureAwait(false);

                    if (!string.IsNullOrWhiteSpace(state.Description))
                    {
                        logger.LogDebug("{description} ({gameContext}): event finished", state.Description, gameContext);
                    }

                    break;
                }

            default:
                throw new NotImplementedException("Unknown state.");
        }
    }

    /// <summary>
    /// Gets a value indicating whether if it's the right time to start the task.
    /// </summary>
    /// <param name="gameContext">The game context.</param>
    /// <returns>
    ///   <c>true</c> if it's the right time to start the task; otherwise, <c>false</c>.
    /// </returns>
    protected virtual bool IsItTimeToStart(IGameContext gameContext)
    {
        return this.IsStartForced(gameContext) || (this.Configuration?.IsItTimeToStart(gameContext.ServerTimeZone) ?? false);
    }

    /// <summary>
    /// Gets a value indicating whether the current (or last) run on this game server was started by
    /// an admin (the own panel's start button, a GM command) rather than by the timetable.
    /// </summary>
    /// <param name="gameContext">The game context of the server.</param>
    /// <returns><c>true</c> when an admin started it.</returns>
    protected bool WasStartedByAdmin(IGameContext gameContext) => this._startedByAdmin.GetValueOrDefault(gameContext);

    /// <summary>
    /// Gets a value indicating whether an admin asked for the task to start now on this game server
    /// (Mu La Ronda: an event that skips days of its timetable still starts on demand).
    /// </summary>
    /// <param name="gameContext">The game context of the server.</param>
    /// <returns><c>true</c> while a forced start is pending on this server.</returns>
    protected bool IsStartForced(IGameContext gameContext)
        => this._forcedStartUtc > this._forcedStartTaken.GetValueOrDefault(gameContext, DateTime.MinValue)
           && DateTime.UtcNow - this._forcedStartUtc < ForcedStartValidity;

    /// <summary>
    /// Determines whether the previous event run is still within its configured task duration.
    /// Prevents a new event from starting before the previous one has fully elapsed.
    /// </summary>
    /// <param name="state">The current task state.</param>
    /// <returns><c>true</c> if the previous event duration has not elapsed yet; otherwise <c>false</c>.</returns>
    protected virtual bool IsPreviousEventStillRunning(TState state)
        => state.LastRunUtc != DateTime.MinValue && state.LastRunUtc.Add(this.Configuration?.TaskDuration ?? TimeSpan.Zero) > DateTime.UtcNow;

    /// <summary>
    /// Called when the task should be prepared before starting it.
    /// </summary>
    /// <param name="state">The state.</param>
    protected abstract ValueTask OnPrepareEventAsync(TState state);

    /// <summary>
    /// Creates the state for the given context.
    /// </summary>
    /// <param name="gameContext">The game context.</param>
    /// <returns>The created state object.</returns>
    protected abstract TState CreateState(IGameContext gameContext);

    /// <summary>
    /// Get a unique state per GameContext.
    /// </summary>
    /// <param name="gameContext">GameContext.</param>
    protected TState GetStateByGameContext(IGameContext gameContext)
    {
        var type = this.GetType();

        var statesPerType = States.GetOrAdd(type, newType => new());

        return statesPerType.GetOrAdd(gameContext, _ => this.CreateState(gameContext));
    }

    /// <summary>
    /// Calls after the state changed to Prepared.
    /// </summary>
    /// <param name="state">The state.</param>
    protected abstract ValueTask OnPreparedAsync(TState state);

    /// <summary>
    /// Calls after the state changed to Started.
    /// </summary>
    /// <param name="state">State.</param>
    protected abstract ValueTask OnStartedAsync(TState state);

    /// <summary>
    /// Calls after the state changed to Finished.
    /// </summary>
    /// <param name="state">State.</param>
    protected abstract ValueTask OnFinishedAsync(TState state);
}