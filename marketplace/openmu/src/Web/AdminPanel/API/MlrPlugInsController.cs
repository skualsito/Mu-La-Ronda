// <copyright file="MlrPlugInsController.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Web.AdminPanel.API;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MUnique.OpenMU.GameServer;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.PlugIns;
using MUnique.OpenMU.Web.AdminPanel.Auth;

/// <summary>
/// Mu La Ronda: turns a plugin (a chat command, the speed hack detector...) on or off in the running
/// game servers, for the own admin panel (admin/server/game.ts setPlugin). The panel writes the
/// configuration too, so the change outlives a restart; this makes it count without one.
/// </summary>
[Route("api/mlr/plugins/")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationDefaults.ApiSchemes, Policy = AdminPolicies.Operator)]
public class MlrPlugInsController : Controller
{
    private readonly IDictionary<int, IGameServer> _gameServers;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrPlugInsController"/> class.
    /// </summary>
    /// <param name="gameServers">The game servers.</param>
    public MlrPlugInsController(IDictionary<int, IGameServer> gameServers) => this._gameServers = gameServers;

    /// <summary>Activates or deactivates the plugin on every game server.</summary>
    /// <param name="id">The plugin's type id.</param>
    /// <param name="request">Whether it should be active.</param>
    /// <returns>200 with the number of servers that took it.</returns>
    [HttpPost("{id:guid}")]
    public IActionResult Set(Guid id, [FromBody] SetRequest request)
    {
        var servers = 0;
        foreach (var server in this._gameServers.Values.OfType<GameServer>())
        {
            var manager = server.Context.PlugInManager;
            if (request.Active)
            {
                manager.ActivatePlugIn(id);
            }
            else
            {
                manager.DeactivatePlugIn(id);
            }

            servers++;
        }

        return this.Ok(new { servers });
    }

    /// <summary>
    /// Gives the plugin a new custom configuration (the JSON the panel also writes to the database)
    /// on every game server: the resets, the drop rates...
    /// </summary>
    /// <param name="id">The plugin's type id.</param>
    /// <param name="request">The configuration.</param>
    /// <returns>200 with the number of servers that took it.</returns>
    [HttpPost("{id:guid}/configuration")]
    public IActionResult Configure(Guid id, [FromBody] ConfigureRequest request)
    {
        var servers = 0;
        foreach (var server in this._gameServers.Values.OfType<GameServer>())
        {
            var configuration = new PlugInConfiguration
            {
                TypeId = id,
                IsActive = request.Active,
                CustomConfiguration = request.Configuration,
            };
            var manager = server.Context.PlugInManager;
            if (request.Active)
            {
                manager.ActivatePlugIn(id);
            }
            else
            {
                manager.DeactivatePlugIn(id);
            }

            try
            {
                manager.ConfigurePlugIn(id, configuration);
            }
            catch (Exception ex)
            {
                return this.BadRequest(new { error = $"La configuración no es válida: {ex.Message}" });
            }

            servers++;
        }

        return this.Ok(new { servers });
    }

    /// <summary>The body of <see cref="Set"/>.</summary>
    /// <param name="Active">Whether the plugin should be active.</param>
    public record SetRequest(bool Active);

    /// <summary>The body of <see cref="Configure"/>.</summary>
    /// <param name="Configuration">The plugin's custom configuration, as JSON.</param>
    /// <param name="Active">Whether the plugin should be active.</param>
    public record ConfigureRequest(string Configuration, bool Active = true);
}
