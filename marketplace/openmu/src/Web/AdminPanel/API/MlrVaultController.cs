// <copyright file="MlrVaultController.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Web.AdminPanel.API;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MUnique.OpenMU.DataModel;
using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.DataModel.Entities;
using MUnique.OpenMU.GameLogic;
using MUnique.OpenMU.GameServer;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Persistence;
using MUnique.OpenMU.Web.AdminPanel.Auth;

/// <summary>
/// Mu La Ronda: edits the vault (baúl) of an account that is in the game, for the own admin panel
/// (admin/server). While a player is online, OpenMU holds the account's vault in memory and saves
/// it from there, so the panel can't write it to the database - it would be overwritten, or make
/// the player's next save fail. Here the change is made on that in-memory vault (with the game's
/// own slot logic) and saved right away. Answers 404 when the account isn't online; the panel then
/// writes the database itself.
/// </summary>
[Route("api/mlr/vault/")]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationDefaults.ApiSchemes, Policy = AdminPolicies.Operator)]
public class MlrVaultController : Controller
{
    private readonly IDictionary<int, IGameServer> _gameServers;

    /// <summary>
    /// Initializes a new instance of the <see cref="MlrVaultController"/> class.
    /// </summary>
    /// <param name="gameServers">The game servers.</param>
    public MlrVaultController(IDictionary<int, IGameServer> gameServers) => this._gameServers = gameServers;

    /// <summary>
    /// Applies one change to the vault of the online account: "add", "update", "delete", "money",
    /// or "save" (just writes the in-memory state, so the panel can read it from the database).
    /// </summary>
    /// <param name="accountId">The account id.</param>
    /// <param name="operation">The change.</param>
    /// <returns>200 when applied, 404 when the account is not online, 409 with the reason when refused.</returns>
    [HttpPost("{accountId:guid}")]
    public async Task<IActionResult> ApplyAsync(Guid accountId, [FromBody] VaultOperation operation)
    {
        if (await this.FindPlayerAsync(accountId).ConfigureAwait(false) is not { } player)
        {
            return this.NotFound(new { online = false });
        }

        string? error = null;
        await player.RunPersistenceExclusiveAsync(async () =>
        {
            error = await ApplyCoreAsync(player, operation).ConfigureAwait(false);
            if (error is null)
            {
                await player.PersistenceContext.SaveChangesAsync().ConfigureAwait(false);
            }
        }).ConfigureAwait(false);

        return error is null ? this.Ok(new { applied = true }) : this.Conflict(new { error });
    }

    private static async ValueTask<string?> ApplyCoreAsync(Player player, VaultOperation operation)
    {
        if (player.Account is not { } account)
        {
            return "La cuenta no esta cargada.";
        }

        if (operation.Op == "save")
        {
            return null;
        }

        var context = player.PersistenceContext;
        account.Vault ??= context.CreateNew<ItemStorage>();
        var vault = account.Vault;

        // The open vault window has its own slot map; otherwise one is made like TalkNpcAction does.
        var size = account.IsVaultExtended ? InventoryConstants.WarehouseSize * 2 : InventoryConstants.WarehouseSize;
        var storage = player.Vault is { } open && ReferenceEquals(open.ItemStorage, vault)
            ? open
            : new Storage(size, vault);

        switch (operation.Op)
        {
            case "money":
                vault.Money = Math.Clamp(operation.Money ?? 0, 0, 2_000_000_000);
                return null;

            case "add":
                return await AddAsync(player, storage, operation).ConfigureAwait(false);

            case "update":
                return await UpdateAsync(player, storage, vault, operation).ConfigureAwait(false);

            case "delete":
                if (vault.Items.FirstOrDefault(i => i.GetId() == operation.ItemId) is not { } toDelete)
                {
                    return "Ese item no esta en el baul.";
                }

                await storage.RemoveItemAsync(toDelete).ConfigureAwait(false);
                await context.DeleteAsync(toDelete).ConfigureAwait(false);
                return null;

            default:
                return $"Operacion desconocida: {operation.Op}";
        }
    }

    private static async ValueTask<string?> AddAsync(Player player, IStorage storage, VaultOperation operation)
    {
        var definition = player.GameContext.Configuration.Items.FirstOrDefault(d => d.GetId() == operation.DefinitionId);
        if (definition is null)
        {
            return "Item inexistente.";
        }

        var context = player.PersistenceContext;
        var item = context.CreateNew<Item>();
        item.Definition = definition;
        item.Level = (byte)Math.Clamp(operation.Level ?? 0, 0, definition.MaximumItemLevel > 0 ? definition.MaximumItemLevel : 15);
        item.HasSkill = (operation.HasSkill ?? false) && definition.Skill is not null;
        if (SetOptions(context, item, operation.Options) is { } optionError)
        {
            await context.DeleteAsync(item).ConfigureAwait(false);
            return optionError;
        }

        // Potions' durability is the stack size: one, unless asked.
        item.Durability = operation.Durability is { } durability
            ? Math.Clamp(durability, 0, 255)
            : definition.Group == 14 && definition.Durability > 1 ? 1 : item.GetMaximumDurabilityOfOnePiece();

        var added = operation.Slot is { } slot
            ? await storage.AddItemAsync((byte)slot, item).ConfigureAwait(false)
            : await storage.AddItemAsync(item).ConfigureAwait(false);
        if (!added)
        {
            await context.DeleteAsync(item).ConfigureAwait(false);
            return operation.Slot is null ? "El baul esta lleno." : "El item no entra en ese lugar.";
        }

        return null;
    }

    private static async ValueTask<string?> UpdateAsync(Player player, IStorage storage, ItemStorage vault, VaultOperation operation)
    {
        if (vault.Items.FirstOrDefault(i => i.GetId() == operation.ItemId) is not { Definition: { } definition } item)
        {
            return "Ese item no esta en el baul.";
        }

        if (operation.Slot is { } slot && slot != item.ItemSlot)
        {
            var oldSlot = item.ItemSlot;
            await storage.RemoveItemAsync(item).ConfigureAwait(false);
            if (!await storage.AddItemAsync((byte)slot, item).ConfigureAwait(false))
            {
                await storage.AddItemAsync(oldSlot, item).ConfigureAwait(false);
                return "El item no entra en ese lugar.";
            }
        }

        if (operation.Level is { } level)
        {
            item.Level = (byte)Math.Clamp(level, 0, definition.MaximumItemLevel > 0 ? definition.MaximumItemLevel : 15);
        }

        if (operation.HasSkill is { } hasSkill)
        {
            item.HasSkill = hasSkill && definition.Skill is not null;
        }

        if (operation.Options is not null)
        {
            foreach (var link in item.ItemOptions.ToList())
            {
                item.ItemOptions.Remove(link);
                await player.PersistenceContext.DeleteAsync(link).ConfigureAwait(false);
            }

            if (SetOptions(player.PersistenceContext, item, operation.Options) is { } optionError)
            {
                return optionError;
            }
        }

        if (operation.ResetDurability)
        {
            item.Durability = item.GetMaximumDurabilityOfOnePiece();
        }
        else if (operation.Durability is { } durability)
        {
            item.Durability = Math.Clamp(durability, 0, 255);
        }

        return null;
    }

    private static string? SetOptions(IContext context, Item item, IList<VaultItemOption>? options)
    {
        if (options is null)
        {
            return null;
        }

        var possible = item.Definition!.PossibleItemOptions.SelectMany(o => o.PossibleOptions).ToList();
        var index = 0;
        foreach (var option in options)
        {
            if (possible.FirstOrDefault(o => o.GetId() == option.OptionId) is not { } itemOption)
            {
                return "Ese item no admite una de las opciones elegidas.";
            }

            var link = context.CreateNew<ItemOptionLink>();
            link.ItemOption = itemOption;
            link.Level = Math.Clamp(option.Level ?? 0, 0, 15);
            link.Index = index++;
            item.ItemOptions.Add(link);
        }

        return null;
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

    /// <summary>One change to a vault, as the admin panel sends it.</summary>
    public class VaultOperation
    {
        /// <summary>Gets or sets the operation: add, update, delete, money or save.</summary>
        public string Op { get; set; } = string.Empty;

        /// <summary>Gets or sets the item (update, delete).</summary>
        public Guid? ItemId { get; set; }

        /// <summary>Gets or sets the item definition (add).</summary>
        public Guid? DefinitionId { get; set; }

        /// <summary>Gets or sets the item level.</summary>
        public int? Level { get; set; }

        /// <summary>Gets or sets the durability; empty on add means the maximum.</summary>
        public int? Durability { get; set; }

        /// <summary>Gets or sets a value indicating whether an update puts the durability back to the maximum.</summary>
        public bool ResetDurability { get; set; }

        /// <summary>Gets or sets whether the item has its skill.</summary>
        public bool? HasSkill { get; set; }

        /// <summary>Gets or sets the options; on update they replace the item's options.</summary>
        public IList<VaultItemOption>? Options { get; set; }

        /// <summary>Gets or sets the vault slot (0-239).</summary>
        public int? Slot { get; set; }

        /// <summary>Gets or sets the vault money (money).</summary>
        public int? Money { get; set; }
    }

    /// <summary>An option of an item, by its <see cref="IncreasableItemOption"/> id.</summary>
    public class VaultItemOption
    {
        /// <summary>Gets or sets the option id.</summary>
        public Guid OptionId { get; set; }

        /// <summary>Gets or sets the option level.</summary>
        public int? Level { get; set; }
    }
}
