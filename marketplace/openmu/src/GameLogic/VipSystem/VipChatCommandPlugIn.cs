// <copyright file="VipChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /vip shows the account's VIP; /vip bronce|plata|oro buys 30 days
/// of it with the character's zen (the beta's way to pay). Buying the tier one
/// already has adds 30 days to it; another tier replaces it from now on.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C24")]
[PlugIn]
[Display(Name = "/vip", Description = "Shows or buys the account's VIP (bronze, silver, gold) with zen.")]
[ChatCommandHelp(Command, "Shows or buys a VIP.", null)]
public class VipChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/vip";

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

        if (Vip.Find(argument) is not { } tier)
        {
            await player.ShowBlueMessageAsync("VIP: elegi bronce, plata u oro (/vip oro).").ConfigureAwait(false);
            return;
        }

        if (player.PlayerState.CurrentState != PlayerState.EnteredWorld)
        {
            await player.ShowBlueMessageAsync("VIP: cerra las ventanas abiertas y proba de nuevo.").ConfigureAwait(false);
            return;
        }

        if (!player.TryRemoveMoney(tier.Price))
        {
            await player.ShowBlueMessageAsync($"VIP: te faltan zen, {tier.Name} cuesta {tier.Price:N0}.").ConfigureAwait(false);
            return;
        }

        var (current, expires) = Vip.Of(player);
        var from = current.Number == tier.Number && expires > DateTime.UtcNow ? expires : DateTime.UtcNow;
        if (!Vip.Grant(player, tier, from + Vip.Duration))
        {
            // Nothing was granted: the zen goes back.
            player.TryAddMoney(tier.Price);
            await player.ShowBlueMessageAsync("VIP: no se pudo activar, avisale a un GM.").ConfigureAwait(false);
            return;
        }

        Vip.Apply(player);
        player.Logger.LogInformation("VIP {Tier} bought by {Account} ({Character}) for {Price} zen.", tier.Name, player.Account?.LoginName, player.Name, tier.Price);
        await player.ShowBlueMessageAsync(Vip.StatusLine(player)).ConfigureAwait(false);
    }
}
