// <copyright file="GrandShop.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.GrandReset;

using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.GameLogic.Views.Inventory;
using MUnique.OpenMU.GameLogic.VipSystem;

/// <summary>
/// Mu La Ronda: the grand reset shop. Its items and prices (in grand reset coins, never zen) are
/// made in the own admin panel (admin/server/grandShop.ts) and kept in mlr.grand_shop
/// (deploy/config/39-vip-grand-reset.sql); the client lists them from the marketplace service
/// (GET /api/market/grand-shop) and buys with /grandshop &lt;id&gt;, by the NPC.
/// </summary>
public static class GrandShop
{
    /// <summary>Buys the item of row <paramref name="id"/>, or tells the player why not.</summary>
    /// <param name="player">The player.</param>
    /// <param name="id">The row.</param>
    /// <returns>Whether it was bought.</returns>
    public static async ValueTask<bool> BuyAsync(Player player, int id)
    {
        if (player.SelectedCharacter is not { } character || player.Inventory is not { } inventory)
        {
            return false;
        }

        if (player.PlayerState.CurrentState != PlayerState.EnteredWorld)
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: cerra las ventanas abiertas y proba de nuevo.").ConfigureAwait(false);
            return false;
        }

        if (!GrandReset.IsNearNpc(player))
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: habla con el NPC de Grand Reset.").ConfigureAwait(false);
            return false;
        }

        if (await FindAsync(id).ConfigureAwait(false) is not { } row)
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: ese item ya no esta a la venta.").ConfigureAwait(false);
            return false;
        }

        var definition = player.GameContext.Configuration.Items.FirstOrDefault(d => d.Group == row.Group && d.Number == row.Number);
        if (definition is null)
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: ese item no existe, avisale a un GM.").ConfigureAwait(false);
            return false;
        }

        var coins = GrandReset.Coins(character);
        if (coins < row.Price)
        {
            await player.ShowBlueMessageAsync($"Tienda Grand Reset: te faltan monedas, cuesta {row.Price} y tenes {coins}.").ConfigureAwait(false);
            return false;
        }

        var bought = false;
        await player.RunPersistenceExclusiveAsync(async () =>
        {
            var item = Create(player, definition, row);
            if (!await inventory.AddItemAsync(item).ConfigureAwait(false))
            {
                await player.PersistenceContext.DeleteAsync(item).ConfigureAwait(false);
                return;
            }

            GrandReset.AddCoins(player, -row.Price);
            if (!await player.SaveProgressAsync().ConfigureAwait(false))
            {
                await inventory.RemoveItemAsync(item).ConfigureAwait(false);
                await player.PersistenceContext.DeleteAsync(item).ConfigureAwait(false);
                GrandReset.AddCoins(player, row.Price);
                return;
            }

            await player.InvokeViewPlugInAsync<IItemAppearPlugIn>(p => p.ItemAppearAsync(item)).ConfigureAwait(false);
            bought = true;
        }).ConfigureAwait(false);

        if (!bought)
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: no tenes lugar en el inventario.").ConfigureAwait(false);
            return false;
        }

        player.Logger.LogInformation("Grand shop: {Character} bought {Item} (row {Row}) for {Price} coins.", character.Name, definition.Name, id, row.Price);
        await player.ShowBlueMessageAsync($"Tienda Grand Reset: compraste {definition.Name} por {row.Price} monedas.").ConfigureAwait(false);
        await player.ShowBlueMessageAsync(GrandReset.StatusLine(player)).ConfigureAwait(false);
        return true;
    }

    private static Item Create(Player player, ItemDefinition definition, Row row)
    {
        var context = player.PersistenceContext;
        var item = context.CreateNew<Item>();
        item.Definition = definition;
        item.Level = (byte)Math.Clamp(row.Level, 0, definition.MaximumItemLevel);
        item.HasSkill = row.Skill && definition.Skill is not null;
        var options = definition.PossibleItemOptions.SelectMany(o => o.PossibleOptions).ToList();

        void Link(IncreasableItemOption option, int level)
        {
            var link = context.CreateNew<ItemOptionLink>();
            link.ItemOption = option;
            link.Level = level;
            item.ItemOptions.Add(link);
        }

        if (row.Luck && options.FirstOrDefault(o => o.OptionType == ItemOptionTypes.Luck) is { } luck)
        {
            Link(luck, 0);
        }

        if (row.OptionLevel > 0 && options.Where(o => o.OptionType == ItemOptionTypes.Option).OrderBy(o => o.Number).FirstOrDefault() is { } option)
        {
            Link(option, Math.Min(row.OptionLevel, option.LevelDependentOptions.Count > 0 ? option.LevelDependentOptions.Max(l => l.Level) : 4));
        }

        foreach (var excellent in options.Where(o => o.OptionType == ItemOptionTypes.Excellent && ((1 << (o.Number - 1)) & row.Excellent) != 0))
        {
            Link(excellent, 0);
        }

        if (row.Excellent != 0 && definition.Skill is not null)
        {
            item.HasSkill = true;
        }

        item.Durability = item.IsStackable() ? 1 : item.GetMaximumDurabilityOfOnePiece();
        return item;
    }

    private static async ValueTask<Row?> FindAsync(int id)
    {
        await using var connection = await VipDiscountCodes.OpenAsync().ConfigureAwait(false);
        if (connection is null)
        {
            return null;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT d."Group", d."Number", s.level, s.skill, s.luck, s.option_level, s.excellent, s.price
              FROM mlr.grand_shop s
              JOIN config."ItemDefinition" d ON d."Id" = s.definition_id
             WHERE s.id = @id AND s.active
            """;
        VipDiscountCodes.AddParameter(command, "id", id);
        await using var reader = await command.ExecuteReaderAsync().ConfigureAwait(false);
        if (!await reader.ReadAsync().ConfigureAwait(false))
        {
            return null;
        }

        return new Row(
            Convert.ToByte(reader.GetValue(0)),
            Convert.ToInt16(reader.GetValue(1)),
            Convert.ToInt32(reader.GetValue(2)),
            reader.GetBoolean(3),
            reader.GetBoolean(4),
            Convert.ToInt32(reader.GetValue(5)),
            Convert.ToInt32(reader.GetValue(6)),
            Convert.ToInt32(reader.GetValue(7)));
    }

    private sealed record Row(byte Group, short Number, int Level, bool Skill, bool Luck, int OptionLevel, int Excellent, int Price);
}
