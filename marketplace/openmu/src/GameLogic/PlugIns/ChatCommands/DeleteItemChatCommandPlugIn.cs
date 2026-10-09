// <copyright file="DeleteItemChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Runtime.InteropServices;
using MUnique.OpenMU.DataModel;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /borraritem &lt;slot&gt; destroys an item of the inventory instead of dropping it
/// on the floor - for what the helper picks up and nobody wants. The client sends it from the
/// inventory's delete button after the player confirms. Only the bag (not the equipped items, not
/// the personal shop), and only while nothing else is open: no trade, no NPC window, no open shop.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C2A")]
[PlugIn]
[Display(Name = "/borraritem", Description = "Destroys an item of the inventory.")]
public class DeleteItemChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/borraritem";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        if (player.SelectedCharacter is null
            || player.Inventory is null
            || player.IsTemplatePlayer
            || player.PlayerState.CurrentState != PlayerState.EnteredWorld
            || player.TradingPartner is not null
            || player.ShopStorage?.StoreOpen is true)
        {
            await player.ShowBlueMessageAsync("Borrar item: cerra las otras ventanas primero.").ConfigureAwait(false);
            return;
        }

        var argument = command.Length > Command.Length ? command[Command.Length..].Trim() : string.Empty;
        if (!byte.TryParse(argument, out var slot)
            || slot < InventoryConstants.EquippableSlotsCount
            || slot >= InventoryConstants.FirstStoreItemSlotIndex
            || player.Inventory.GetItem(slot) is not { } item)
        {
            return;
        }

        player.Logger.LogInformation("Item destroyed by {0} from slot {1}: {2}", player.SelectedCharacter.Name, slot, item);
        await player.DestroyInventoryItemAsync(item).ConfigureAwait(false);
    }
}
