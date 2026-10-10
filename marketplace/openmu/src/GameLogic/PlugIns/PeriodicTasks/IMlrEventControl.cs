// <copyright file="IMlrEventControl.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;

/// <summary>
/// Mu La Ronda: what the own admin panel reads of a periodic event (an invasion, a mini game's
/// entrance) and how it ends one early. Implemented by <see cref="PeriodicTaskBasePlugIn{TConfiguration, TState}"/>.
/// </summary>
public interface IMlrEventControl
{
    /// <summary>
    /// Gets the state of the event on a game server.
    /// </summary>
    /// <param name="gameContext">The game context of the server.</param>
    /// <returns>The state, when the state step runs next, and when the event last started (UTC).</returns>
    (PeriodicTaskState State, DateTime NextRunUtc, DateTime LastRunUtc) GetStatus(IGameContext gameContext);

    /// <summary>
    /// Gets the next start of the timetable, in UTC, or null without a timetable.
    /// </summary>
    /// <param name="gameContext">The game context of the server (for its time zone).</param>
    /// <returns>The next scheduled start.</returns>
    DateTime? GetNextScheduledStartUtc(IGameContext gameContext);

    /// <summary>
    /// Ends a running event at its next step (within a second), as if its duration were over.
    /// </summary>
    /// <param name="gameContext">The game context of the server.</param>
    /// <returns>True when it was running.</returns>
    bool ForceFinish(IGameContext gameContext);

    /// <summary>
    /// Gets the monsters the running event put on the maps and are still alive, with where they are.
    /// </summary>
    /// <param name="gameContext">The game context of the server.</param>
    /// <returns>Monster number, name, map number and coordinates; empty for an event without monsters.</returns>
    IReadOnlyList<(short Number, string Name, ushort Map, byte X, byte Y)> GetLiveMonsters(IGameContext gameContext);
}
