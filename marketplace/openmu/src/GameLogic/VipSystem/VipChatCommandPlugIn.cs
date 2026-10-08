// <copyright file="VipChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.Persistence;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /vip shows the account's VIP; /vip bronce|plata|oro buys 30 days
/// of it with the character's zen (the beta's way to pay). Buying the tier one
/// already has adds to it; a lower one can't be bought; a higher one waits and
/// starts when the current one ends (Vip.NextOf). /vip codigo X checks a discount
/// code for the VIP window, which shows the prices with it.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C24")]
[PlugIn]
[Display(Name = "/vip", Description = "Shows or buys the account's VIP (bronze, silver, gold) with zen.")]
[ChatCommandHelp(Command, "Shows or buys a VIP.", null)]
public class VipChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/vip";

    /// <summary>The most months one purchase may take.</summary>
    private const int MaximumMonths = 12;

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var argument = command.Length > Command.Length ? command[Command.Length..].Trim() : string.Empty;
        if (argument.Length == 0)
        {
            await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
            return;
        }

        // "/vip oro", "/vip oro 3", "/vip oro 3 CODIGO" or "/vip oro CODIGO": the tier, how many
        // months (1-12) and a discount code.
        var parts = argument.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts[0].Equals("codigo", StringComparison.OrdinalIgnoreCase))
        {
            await this.CheckCodeAsync(player, parts.Length > 1 ? parts[1] : string.Empty).ConfigureAwait(false);
            return;
        }

        var months = 1;
        string? code = null;
        foreach (var part in parts.Skip(1))
        {
            if (int.TryParse(part, out var number))
            {
                months = number;
            }
            else
            {
                code = part;
            }
        }

        if (Vip.Find(parts[0]) is not { } tier || months < 1 || months > MaximumMonths)
        {
            await player.ShowBlueMessageAsync($"VIP: elegi bronce, plata u oro y los meses (1 a {MaximumMonths}), por ejemplo /vip oro 3 (y un codigo de descuento al final, si tenes).").ConfigureAwait(false);
            return;
        }

        if (player.Account is not { } account)
        {
            return;
        }

        // Which part of the VIP this buys: more of the current tier (or a first one), or more of
        // the higher tier that waits for the current one to end.
        var (current, expires) = Vip.Of(player);
        var (next, nextDays) = Vip.NextOf(player);
        var queue = current.Number > 0 && tier.Number > current.Number;
        if (current.Number > tier.Number)
        {
            await player.ShowBlueMessageAsync($"VIP: tenes VIP {current.Name}, no podes comprar uno mas bajo.").ConfigureAwait(false);
            return;
        }

        if (queue && next.Number > 0 && next.Number != tier.Number)
        {
            await player.ShowBlueMessageAsync($"VIP: ya tenes VIP {next.Name} esperando a que termine el {current.Name}; podes sumarle meses a ese.").ConfigureAwait(false);
            return;
        }

        var accountId = account.GetId();
        VipDiscountCodes.Discount? discount = null;
        if (code is not null)
        {
            var (found, refusal) = await VipDiscountCodes.FindAsync(code, accountId).ConfigureAwait(false);
            if (found is null)
            {
                await player.ShowBlueMessageAsync($"VIP: {refusal}").ConfigureAwait(false);
                return;
            }

            discount = found;
        }

        var fullPrice = (long)tier.Price * months;
        var price = discount is null ? fullPrice : fullPrice * (100 - Math.Clamp(discount.Percent, 0, 100)) / 100;
        if (price > int.MaxValue)
        {
            await player.ShowBlueMessageAsync("VIP: son demasiados meses de una vez, compra menos.").ConfigureAwait(false);
            return;
        }

        if (player.PlayerState.CurrentState != PlayerState.EnteredWorld)
        {
            await player.ShowBlueMessageAsync("VIP: cerra las ventanas abiertas y proba de nuevo.").ConfigureAwait(false);
            return;
        }

        if (!player.TryRemoveMoney((int)price))
        {
            await player.ShowBlueMessageAsync($"VIP: te faltan zen, {months} mes(es) de {tier.Name} cuestan {price:N0}.").ConfigureAwait(false);
            return;
        }

        if (discount is not null && !await VipDiscountCodes.RedeemAsync(discount, accountId, price).ConfigureAwait(false))
        {
            // Someone else just took the code's last use: nothing bought.
            player.TryAddMoney((int)price);
            await player.ShowBlueMessageAsync("VIP: ese codigo ya no se puede usar, no se te cobro nada.").ConfigureAwait(false);
            return;
        }

        // The months add up: on top of what is left of the same tier, or - for a higher tier - on
        // top of what already waits for the current one to end.
        var now = DateTime.UtcNow;
        var granted = queue
            ? Vip.SetNext(player, tier, (next.Number == tier.Number ? nextDays : 0) + (Vip.Duration.TotalDays * months))
            : Vip.Grant(player, tier, (current.Number > 0 && expires > now ? expires : now) + (Vip.Duration * months));
        if (!granted)
        {
            // Nothing was granted: the zen goes back.
            player.TryAddMoney((int)price);
            await player.ShowBlueMessageAsync("VIP: no se pudo activar, avisale a un GM.").ConfigureAwait(false);
            return;
        }

        Vip.Apply(player);
        if (discount is not null)
        {
            await player.ShowBlueMessageAsync($"VIP: codigo {discount.Code} aplicado, {discount.Percent}% de descuento ({price:N0} zen en vez de {fullPrice:N0}).").ConfigureAwait(false);
        }

        if (queue)
        {
            await player.ShowBlueMessageAsync($"VIP: el {tier.Name} empieza cuando termine tu {current.Name}.").ConfigureAwait(false);
        }

        player.Logger.LogInformation("VIP {Tier} x{Months} bought by {Account} ({Character}) for {Price} zen.", tier.Name, months, player.Account?.LoginName, player.Name, price);
        await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
    }

    /// <summary>Answers the VIP window: the code's discount, or why it can't be used (src/common/vip.ts reads it).</summary>
    private async ValueTask CheckCodeAsync(Player player, string code)
    {
        if (player.Account is not { } account || code.Length is 0 or > 24)
        {
            return;
        }

        var (found, refusal) = await VipDiscountCodes.FindAsync(code, account.GetId()).ConfigureAwait(false);
        await player.ShowBlueMessageAsync(found is null
            ? $"VIP codigo {code}: {refusal}"
            : $"VIP codigo {code}: {Math.Clamp(found.Percent, 0, 100)}% de descuento.").ConfigureAwait(false);
    }
}
