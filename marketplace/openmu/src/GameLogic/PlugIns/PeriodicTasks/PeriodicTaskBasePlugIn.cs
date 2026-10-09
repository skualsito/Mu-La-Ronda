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

    private bool _isStartForced = false;

    /// <summary>
    /// Gets or sets configuration for periodic invasion.
    /// </summary>
    public TConfiguration? Configuration { get; set; }

    /// <summary>
    /// Gets a value indicating whether an admin asked for the task to start now (Mu La Ronda: an
    /// event that skips days of its timetable still starts on demand).
    /// </summary>
    protected bool IsStartForced => this._isStartForced;

    /// <summary>
    /// Forces to start the task on the next start check.
    /// </summary>
    public void ForceStart()
    {
        this._isStartForced = true;
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
                        this._isStartForced = false;
                        return;
                    }

                    this._isStartForced = false;
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
        return this._isStartForced || (this.Configuration?.IsItTimeToStart(gameContext.ServerTimeZone) ?? false);
    }

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