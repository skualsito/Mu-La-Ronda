// <copyright file="MlrPlayersController.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Web.AdminPanel.API;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameServer;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Persistence;
using MUnique.OpenMU.Web.AdminPanel.Auth;

/// <summary>
/// Mu La Ronda: player actions for the own admin panel (admin/server). Disconnects the player of
/// an account: OpenMU saves the character on the way out, as on a normal log out.
/// </summary>
[Route("api/mlr/players/")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationDefaults.ApiSchemes, Policy = AdminPolicies.Operator)]
public class MlrPlayersController : Controller
{
    private readonly IDictionary<int, IGameServer> _gameServers;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrPlayersController"/> class.
    /// </summary>
    /// <param name="gameServers">The game servers.</param>
    public MlrPlayersController(IDictionary<int, IGameServer> gameServers) => this._gameServers = gameServers;

    /// <summary>The characters in the game right now: account, character name and map, one row per player.</summary>
    /// <returns>200 with the list (players still on the character list come with a null character).</returns>
    [HttpGet("online")]
    public async Task<IActionResult> OnlineAsync()
    {
        var rows = new List<object>();
        foreach (var server in this._gameServers.Values.OfType<GameServer>())
        {
            var players = await server.Context.GetPlayersAsync().ConfigureAwait(false);
            foreach (var player in players)
            {
                if (player.Account is not { } account)
                {
                    continue;
                }

                rows.Add(new
                {
                    accountId = account.GetId(),
                    login = account.LoginName,
                    characterId = player.SelectedCharacter?.GetId(),
                    character = player.SelectedCharacter?.Name,
                    // The name is a LocalizedString, which would go out as an object.
                    map = player.CurrentMap?.Definition.Name.ValueInNeutralLanguage,
                });
            }
        }

        return this.Ok(rows);
    }

    /// <summary>Disconnects every player of the account (there is one, unless it is mid-login).</summary>
    /// <param name="accountId">The account id.</param>
    /// <returns>200 with how many were disconnected, 404 when the account is not online.</returns>
    [HttpPost("{accountId:guid}/disconnect")]
    public async Task<IActionResult> DisconnectAsync(Guid accountId)
    {
        var count = 0;
        foreach (var server in this._gameServers.Values.OfType<GameServer>())
        {
            var players = await server.Context.GetPlayersAsync().ConfigureAwait(false);
            foreach (var player in players.Where(p => p.Account is { } account && account.GetId() == accountId).ToList())
            {
                await player.DisconnectAsync().ConfigureAwait(false);
                count++;
            }
        }

        return count > 0 ? this.Ok(new { disconnected = count }) : this.NotFound(new { online = false });
    }
}
