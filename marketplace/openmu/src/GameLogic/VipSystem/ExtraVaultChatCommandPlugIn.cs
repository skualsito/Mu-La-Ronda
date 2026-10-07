// <copyright file="ExtraVaultChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.GameLogic.Views.Vault;
using MUnique.OpenMU.Persistence;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the VIP's extra vaults (baúles) - bronze 3, silver 6, gold 9, on top of the
/// account's own vault (number 0). With the vault open, /baul N shows vault N instead; the
/// client's vault window has a tab per vault that sends it. Items stay in an extra vault when the
/// VIP runs out, and are there again with the next VIP. The zen of the vault is the account's
/// own vault's, whichever is shown.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C26")]
[PlugIn]
[Display(Name = "/baul", Description = "Switches the open vault to one of the VIP's extra vaults.")]
[ChatCommandHelp(Command, "Shows one of the VIP's extra vaults.", null)]
public class ExtraVaultChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/baul";

    /// <summary>Extra vaults for each VIP tier.</summary>
    private const int VaultsPerTier = 3;

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <summary>How many extra vaults the player's VIP gives.</summary>
    public static int AllowedFor(Player player) => Vip.Of(player).Tier.Number * VaultsPerTier;

    /// <summary>The hidden line that tells the client which vault is shown and how many there are.</summary>
    public static string StateLine(int number, int allowed) => $"Baul {number}/{allowed}";

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var argument = command.Length > Command.Length ? command[Command.Length..].Trim() : string.Empty;
        var allowed = AllowedFor(player);
        if (player.Account is not { } account || player.Vault is null
            || player.OpenedNpc?.Definition.NpcWindow != NpcWindow.VaultStorage)
        {
            await player.ShowBlueMessageAsync("Baul: primero abri el baul.").ConfigureAwait(false);
            return;
        }

        if (!int.TryParse(argument, out var number) || number < 0)
        {
            await player.ShowBlueMessageAsync($"Baul: elegi un numero de 0 a {allowed}, por ejemplo /baul 1.").ConfigureAwait(false);
            return;
        }

        if (number > allowed)
        {
            var reason = allowed == 0
                ? "los baules extra son para VIP (bronce 3, plata 6, oro 9)."
                : $"tu VIP tiene {allowed} baules extra.";
            await player.ShowBlueMessageAsync($"Baul: {reason}").ConfigureAwait(false);
            return;
        }

        var storage = await player.RunPersistenceExclusiveAsync(async () =>
            number == 0
                ? account.Vault
                : await player.PersistenceContext.GetOrCreateExtraVaultAsync(account.GetId(), number).ConfigureAwait(false)).ConfigureAwait(false);
        if (storage is null)
        {
            await player.ShowBlueMessageAsync("Baul: no se pudo abrir ese baul.").ConfigureAwait(false);
            return;
        }

        var size = account.IsVaultExtended ? InventoryConstants.WarehouseSize * 2 : InventoryConstants.WarehouseSize;
        player.Vault = new Storage(size, storage);
        await player.InvokeViewPlugInAsync<IShowVaultPlugIn>(p => p.ShowVaultAsync()).ConfigureAwait(false);
        await player.ShowBlueMessageAsync(StateLine(number, allowed)).ConfigureAwait(false);
    }
}
