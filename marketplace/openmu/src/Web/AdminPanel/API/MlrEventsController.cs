// <copyright file="MlrEventsController.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Web.AdminPanel.API;

using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.GameServer;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Web.AdminPanel.Auth;

/// <summary>
/// Mu La Ronda: the periodic events (mini games, invasions, happy hour) for the own admin panel
/// (admin/server/events.ts): how each one is doing, and a start and a stop button. An event runs on
/// every game server on its own; the state shown is the first server's, and start and stop act on all.
/// </summary>
[Route("api/mlr/events/")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationDefaults.ApiSchemes, Policy = AdminPolicies.Operator)]
public class MlrEventsController : Controller
{
    private readonly IDictionary<int, IGameServer> _gameServers;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrEventsController"/> class.
    /// </summary>
    /// <param name="gameServers">The game servers.</param>
    public MlrEventsController(IDictionary<int, IGameServer> gameServers) => this._gameServers = gameServers;

    private IEnumerable<GameServer> Servers => this._gameServers.OrderBy(s => s.Key).Select(s => s.Value).OfType<GameServer>();

    /// <summary>The active periodic events with their state.</summary>
    /// <returns>200 with one row per event.</returns>
    [HttpGet("")]
    public async Task<IActionResult> ListAsync()
    {
        var server = this.Servers.FirstOrDefault();
        if (server is null)
        {
            return this.Ok(Array.Empty<object>());
        }

        var context = server.Context;
        var rows = new List<object>();
        foreach (var plugIn in EventsOf(context))
        {
            var control = (IMlrEventControl)plugIn;
            var (state, nextRunUtc, lastRunUtc) = control.GetStatus(context);
            var running = state == PeriodicTaskState.Started;
            var players = 0;
            DateTime? nextStartUtc = control.GetNextScheduledStartUtc(context);

            if (plugIn is IPeriodicMiniGameStartPlugIn miniGame)
            {
                foreach (var definition in context.Configuration.MiniGameDefinitions.Where(d => d.Type == miniGame.Key))
                {
                    if (await miniGame.GetMiniGameContextAsync(context, definition).ConfigureAwait(false) is { } game)
                    {
                        running = true;
                        players += game.PlayerCount;
                    }
                }
            }

            var type = plugIn.GetType();
            rows.Add(new
            {
                id = type.GetCustomAttribute<GuidAttribute>()?.Value,
                type = type.Name,
                name = type.GetCustomAttribute<DisplayAttribute>()?.GetName() ?? type.Name,
                kind = plugIn is IPeriodicMiniGameStartPlugIn ? "minigame" : "periodic",
                state = state.ToString(),
                running,
                players,
                lastStartUtc = lastRunUtc == DateTime.MinValue ? (DateTime?)null : lastRunUtc,
                nextStepUtc = nextRunUtc,
                nextStartUtc,
            });
        }

        return this.Ok(rows);
    }

    /// <summary>
    /// Everything about one event: its timetable and setup, and on each game server (channel) its
    /// state and, while it runs, the monsters it put on the maps with where they are.
    /// </summary>
    /// <param name="id">The plugin's type id.</param>
    /// <returns>200, or 404 for an unknown or inactive event.</returns>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> DetailsAsync(Guid id)
    {
        object? setup = null;
        object? places = null;
        string? name = null;
        string? typeName = null;
        var servers = new List<object>();
        foreach (var server in this.Servers)
        {
            var context = server.Context;
            var configuration = context.Configuration;
            string MapName(ushort number) => configuration.Maps.FirstOrDefault(m => m.Number == number)?.Name.ValueInNeutralLanguage ?? $"Mapa {number}";
            string MonsterName(int number) => configuration.Monsters.FirstOrDefault(m => m.Number == number)?.Designation.ValueInNeutralLanguage ?? $"#{number}";

            foreach (var plugIn in EventsOf(context).Where(p => IdOf(p) == id))
            {
                var type = plugIn.GetType();
                name ??= type.GetCustomAttribute<DisplayAttribute>()?.GetName() ?? type.Name;
                typeName ??= type.Name;
                setup ??= Setup(type.GetProperty("Configuration")?.GetValue(plugIn), MapName, MonsterName);
                places ??= (plugIn as GameLogic.PlugIns.InvasionEvents.MlrBossInvasionPlugIn)?.SpawnPlaces.Select(p => new { x = p.X, y = p.Y });

                var control = (IMlrEventControl)plugIn;
                var (state, nextRunUtc, lastRunUtc) = control.GetStatus(context);
                var players = 0;
                var running = state == PeriodicTaskState.Started;
                if (plugIn is IPeriodicMiniGameStartPlugIn miniGame)
                {
                    foreach (var definition in configuration.MiniGameDefinitions.Where(d => d.Type == miniGame.Key))
                    {
                        if (await miniGame.GetMiniGameContextAsync(context, definition).ConfigureAwait(false) is { } game)
                        {
                            running = true;
                            players += game.PlayerCount;
                        }
                    }
                }

                servers.Add(new
                {
                    server = server.Id,
                    description = server.Description,
                    state = state.ToString(),
                    running,
                    players,
                    lastStartUtc = lastRunUtc == DateTime.MinValue ? (DateTime?)null : lastRunUtc,
                    nextStepUtc = nextRunUtc,
                    nextStartUtc = control.GetNextScheduledStartUtc(context),
                    monsters = control.GetLiveMonsters(context).Select(m => new
                    {
                        number = m.Number,
                        name = m.Name,
                        map = m.Map,
                        mapName = MapName(m.Map),
                        x = m.X,
                        y = m.Y,
                    }),
                });
            }
        }

        return name is null
            ? this.NotFound(new { error = "Ese evento no existe o no esta activo." })
            : this.Ok(new { id, type = typeName, name, setup, places, servers });
    }

    /// <summary>Starts the event now on every game server (at the next check, within a second).</summary>
    /// <param name="id">The plugin's type id.</param>
    /// <returns>200, or 404 for an unknown or inactive event.</returns>
    [HttpPost("{id:guid}/start")]
    public IActionResult Start(Guid id)
    {
        var found = 0;
        foreach (var server in this.Servers)
        {
            foreach (var plugIn in EventsOf(server.Context).Where(p => IdOf(p) == id))
            {
                plugIn.ForceStart();
                found++;
            }
        }

        return found > 0 ? this.Ok(new { started = found }) : this.NotFound(new { error = "Ese evento no existe o no esta activo." });
    }

    /// <summary>Ends the event on every game server: its running games close and the players go to town.</summary>
    /// <param name="id">The plugin's type id.</param>
    /// <returns>200, or 404 for an unknown or inactive event.</returns>
    [HttpPost("{id:guid}/stop")]
    public async Task<IActionResult> StopAsync(Guid id)
    {
        var found = 0;
        var stopped = 0;
        foreach (var server in this.Servers)
        {
            var context = server.Context;
            foreach (var plugIn in EventsOf(context).Where(p => IdOf(p) == id))
            {
                found++;
                if (((IMlrEventControl)plugIn).ForceFinish(context))
                {
                    stopped++;
                }

                if (plugIn is IPeriodicMiniGameStartPlugIn miniGame)
                {
                    foreach (var definition in context.Configuration.MiniGameDefinitions.Where(d => d.Type == miniGame.Key))
                    {
                        if (await miniGame.GetMiniGameContextAsync(context, definition).ConfigureAwait(false) is { } game)
                        {
                            // Moves the players to the safe zone and removes the game.
                            await game.DisposeAsync().ConfigureAwait(false);
                            stopped++;
                        }
                    }
                }
            }
        }

        return found > 0 ? this.Ok(new { stopped }) : this.NotFound(new { error = "Ese evento no existe o no esta activo." });
    }

    /// <summary>The setup of an event as the admin panel shows it: timetable, length and monsters.</summary>
    private static object? Setup(object? configuration, Func<ushort, string> mapName, Func<int, string> monsterName)
    {
        if (configuration is not PeriodicTaskConfiguration periodic)
        {
            return null;
        }

        return new
        {
            timetable = periodic.Timetable.Order().Select(t => t.ToString("HH:mm")),
            durationMinutes = periodic.TaskDuration.TotalMinutes,
            mobs = (configuration as GameLogic.PlugIns.InvasionEvents.PeriodicInvasionConfiguration)?.Mobs.Select(m => new
            {
                number = m.MonsterId,
                name = monsterName(m.MonsterId),
                count = m.Count,
                maps = m.MapIds.Select(mapName),
                x = m.X,
                y = m.Y,
            }),
        };
    }

    private static IEnumerable<IPeriodicTaskPlugIn> EventsOf(IGameContext context)
        => context.PlugInManager.GetActivePlugInsOf<IPeriodicTaskPlugIn>().Where(p => p is IMlrEventControl);

    private static Guid? IdOf(IPeriodicTaskPlugIn plugIn)
        => plugIn.GetType().GetCustomAttribute<GuidAttribute>() is { } guid ? Guid.Parse(guid.Value) : null;
}
