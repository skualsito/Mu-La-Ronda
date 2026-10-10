// <copyright file="MlrVipController.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Web.AdminPanel.API;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MUnique.OpenMU.DataModel.Entities;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameLogic.VipSystem;
using MUnique.OpenMU.GameServer;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Persistence;
using MUnique.OpenMU.Web.AdminPanel.Auth;

/// <summary>
/// Mu La Ronda: grants a paid VIP (Mercado Pago, marketplace/server/vipPayments.ts) to an account
/// that is in the game. OpenMU holds the account in memory while it plays, so the VIP is added
/// there - with the same rules as a purchase (Vip.AddMonths) - its bonuses put on, and saved.
/// Answers 404 when the account isn't online; the caller then writes the database itself.
/// </summary>
[Route("api/mlr/vip/")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationDefaults.ApiSchemes, Policy = AdminPolicies.Operator)]
public class MlrVipController : Controller
{
    private readonly IDictionary<int, IGameServer> _gameServers;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrVipController"/> class.
    /// </summary>
    /// <param name="gameServers">The game servers.</param>
    public MlrVipController(IDictionary<int, IGameServer> gameServers) => this._gameServers = gameServers;

    /// <summary>Adds months of a tier to the online account.</summary>
    /// <param name="accountId">The account id.</param>
    /// <param name="request">The tier and months.</param>
    /// <returns>200 when granted, 404 when the account is not online, 409 with the reason when refused.</returns>
    [HttpPost("{accountId:guid}/grant")]
    public async Task<IActionResult> GrantAsync(Guid accountId, [FromBody] GrantRequest request)
    {
        if (request.Tier is < 1 or > 3 || request.Months is < 1 or > 12)
        {
            return this.BadRequest(new { error = "Nivel o meses invalidos." });
        }

        if (await this.FindPlayerAsync(accountId).ConfigureAwait(false) is not { } player)
        {
            return this.NotFound(new { online = false });
        }

        var tier = Vip.Tiers[request.Tier];
        string? refusal = null;
        await player.RunPersistenceExclusiveAsync(async () =>
        {
            refusal = Vip.AddMonths(player, tier, request.Months);
            if (refusal is null)
            {
                await player.PersistenceContext.SaveChangesAsync().ConfigureAwait(false);
            }
        }).ConfigureAwait(false);

        if (refusal is not null)
        {
            return this.Conflict(new { error = refusal });
        }

        Vip.Apply(player);
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            await player.ShowBlueMessageAsync(request.Message).ConfigureAwait(false);
        }

        await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
        return this.Ok(new { applied = true });
    }

    /// <summary>
    /// Mu La Ronda: the panel's "Dar VIP" / "Quitar VIP" for an account in the game. Written to the
    /// player's own account object, which the game saves on logout - the database alone would be
    /// overwritten then. 404 when the account is not in the game: the panel writes the database.
    /// </summary>
    /// <param name="accountId">The account.</param>
    /// <param name="request">The tier (0 takes it away) and for how many days from now.</param>
    /// <returns>The result.</returns>
    [HttpPost("{accountId:guid}/set")]
    public async Task<IActionResult> SetAsync(Guid accountId, [FromBody] SetRequest request)
    {
        if (request.Tier is < 0 or > 3 || request.Days is < 0 or > 3650)
        {
            return this.BadRequest(new { error = "Nivel o dias invalidos." });
        }

        if (await this.FindPlayerAsync(accountId).ConfigureAwait(false) is not { } player)
        {
            return this.NotFound(new { online = false });
        }

        var tier = Vip.Tiers[request.Tier];
        var expires = request.Tier == 0 ? DateTime.UnixEpoch : DateTime.UtcNow.AddDays(request.Days);
        var granted = false;
        await player.RunPersistenceExclusiveAsync(async () =>
        {
            granted = Vip.Grant(player, tier, expires) && Vip.SetNext(player, Vip.Tiers[0], 0);
            if (granted)
            {
                await player.PersistenceContext.SaveChangesAsync().ConfigureAwait(false);
            }
        }).ConfigureAwait(false);

        if (!granted)
        {
            return this.Conflict(new { error = "No se pudo cambiar el VIP en el juego." });
        }

        Vip.Apply(player);
        await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
        return this.Ok(new { applied = true });
    }

    private async ValueTask<Player?> FindPlayerAsync(Guid accountId)
    {
        foreach (var server in this._gameServers.Values.OfType<GameServer>())
        {
            var players = await server.Context.GetPlayersAsync().ConfigureAwait(false);
            if (players.FirstOrDefault(p => p.Account is { } account && account.GetId() == accountId) is { } player)
            {
                return player;
            }
        }

        return null;
    }

    /// <summary>The body of <see cref="GrantAsync"/>.</summary>
    /// <param name="Tier">1 bronze, 2 silver, 3 gold.</param>
    /// <param name="Months">How many months (1-12).</param>
    /// <param name="Message">A line to show the player, if any.</param>
    public record GrantRequest(int Tier, int Months, string? Message = null);

    /// <summary>The panel's VIP for an account: tier 0-3 and days from now.</summary>
    /// <param name="Tier">The tier.</param>
    /// <param name="Days">The days.</param>
    public record SetRequest(int Tier, double Days);
}
