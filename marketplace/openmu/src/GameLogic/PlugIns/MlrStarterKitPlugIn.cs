// <copyright file="MlrStarterKitPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Collections.Concurrent;
using System.ComponentModel;
using System.Runtime.InteropServices;
using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.GameLogic.Views;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Pathfinding;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: what a new character starts with - a basic set of its class and its first wings
/// (or cape), worn, which last <see cref="MlrStarterKitConfiguration.KitDays"/> days, and the
/// zen of <see cref="MlrStarterKitConfiguration.StartingZen"/> (for the beta; the own admin panel
/// turns it off). The kit's items are marked in <see cref="Item.StorePrice"/> - a negative value,
/// minutes since 1970 of their end - which no other item can hold: a price is only ever set in the
/// personal store, where these never go. They can't go to the vault, a trade, the personal store,
/// the chaos machine or the marketplace, nor be dropped or sold (<see cref="IsKitItem"/>), and are
/// taken away when they run out.
/// </summary>
[PlugIn]
[Display(Name = "Mu La Ronda starter kit", Description = "New characters start with a basic set and wings for a week, and zen.")]
[Guid("6F4C2E1A-8B3D-4F5E-9A7C-2D1E0F3B4A5C")]
public class MlrStarterKitPlugIn : ICharacterCreatedPlugIn, IItemMovingPlugIn, IItemDropPlugIn, IPeriodicTaskPlugIn,
    ISupportCustomConfiguration<MlrStarterKitConfiguration>, ISupportDefaultCustomConfiguration
{
    /// <summary>How often the expired kits are looked for.</summary>
    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(1);

    /// <summary>The set (helm, armor, pants, gloves, boots) and wings of each class that can be created.</summary>
    private static readonly Dictionary<int, (short Set, bool Helm, byte WingsGroup, short Wings)> Kits = new()
    {
        [0] = (2, true, 12, 1),    // Dark Wizard: Pad, Wings of Heaven
        [4] = (5, true, 12, 2),    // Dark Knight: Leather, Wings of Satan
        [8] = (10, true, 12, 0),   // Fairy Elf: Vine, Wings of Elf
        [12] = (2, false, 12, 2),  // Magic Gladiator: Pad without helm, Wings of Satan
        [16] = (5, true, 13, 30),  // Dark Lord: Leather, Cape of Lord
        [20] = (39, true, 12, 41), // Summoner: Mistery, Wings of Curse
        [24] = (5, true, 12, 49),  // Rage Fighter: Leather, Cape of Fighter
    };

    private readonly ConcurrentDictionary<GameContext, DateTime> _lastSweep = new();

    /// <inheritdoc/>
    public MlrStarterKitConfiguration? Configuration { get; set; }

    /// <summary>Whether the item is part of a starter kit.</summary>
    /// <param name="item">The item.</param>
    /// <returns>True for a kit item.</returns>
    public static bool IsKitItem(Item item) => item.StorePrice is < 0;

    /// <summary>When the kit item runs out.</summary>
    /// <param name="item">The item.</param>
    /// <returns>The end, in UTC; null for an item of no kit.</returns>
    public static DateTime? EndOf(Item item) => item.StorePrice is < 0 and var minutes ? DateTime.UnixEpoch.AddMinutes(-minutes) : null;

    /// <inheritdoc />
    public object CreateDefaultConfig() => new MlrStarterKitConfiguration();

    /// <inheritdoc />
    public void CharacterCreated(Player player, Character createdCharacter)
    {
        var configuration = this.Configuration ?? new MlrStarterKitConfiguration();
        if (createdCharacter.Inventory is not { } inventory)
        {
            return;
        }

        if (configuration.StartingZen > 0)
        {
            inventory.Money = Math.Max(inventory.Money, configuration.StartingZen);
        }

        if (!configuration.KitEnabled || createdCharacter.CharacterClass is not { } characterClass
            || !Kits.TryGetValue(characterClass.Number, out var kit))
        {
            return;
        }

        var end = DateTime.UtcNow.AddDays(Math.Max(1, configuration.KitDays));
        var marker = -(int)Math.Min((end - DateTime.UnixEpoch).TotalMinutes, int.MaxValue);
        var items = player.GameContext.Configuration.Items;

        void Add(byte group, short number, byte slot)
        {
            if (items.FirstOrDefault(d => d.Group == group && d.Number == number) is not { } definition)
            {
                return;
            }

            var item = player.PersistenceContext.CreateNew<Item>();
            item.Definition = definition;
            item.ItemSlot = slot;
            item.Durability = item.GetMaximumDurabilityOfOnePiece();
            item.StorePrice = marker;
            inventory.Items.Add(item);
        }

        if (kit.Helm)
        {
            Add(7, kit.Set, InventoryConstants.HelmSlot);
        }

        Add(8, kit.Set, InventoryConstants.ArmorSlot);
        Add(9, kit.Set, InventoryConstants.PantsSlot);
        // The Rage Fighter wears no gloves (deploy/config/41-rf-gloves.sql): it fights with glove weapons.
        if (characterClass.Number != 24)
        {
            Add(10, kit.Set, InventoryConstants.GlovesSlot);
        }
        Add(11, kit.Set, InventoryConstants.BootsSlot);
        Add(kit.WingsGroup, kit.Wings, InventoryConstants.WingsSlot);
    }

    /// <inheritdoc />
    public void ItemMoving(Player player, Item item, Storages targetStorage, int slot, CancelEventArgs eventArgs)
    {
        if (!IsKitItem(item) || targetStorage == Storages.Inventory)
        {
            return;
        }

        eventArgs.Cancel = true;
        _ = player.ShowBlueMessageAsync("Los ítems de inicio no se pueden guardar en el baúl, comerciar ni combinar.").AsTask();
    }

    /// <inheritdoc />
    public async ValueTask HandleItemDropAsync(Player player, Item item, Point target, IItemDropPlugIn.ItemDropArguments dropArgs)
    {
        if (!IsKitItem(item))
        {
            return;
        }

        dropArgs.Cancel = true;
        dropArgs.Success = false;
        await player.ShowBlueMessageAsync("Los ítems de inicio no se pueden tirar.").ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async ValueTask ExecuteTaskAsync(GameContext gameContext)
    {
        var now = DateTime.UtcNow;
        if (this._lastSweep.TryGetValue(gameContext, out var last) && now - last < SweepInterval)
        {
            return;
        }

        this._lastSweep[gameContext] = now;
        foreach (var player in await gameContext.GetPlayersAsync().ConfigureAwait(false))
        {
            if (player.PlayerState.CurrentState != PlayerState.EnteredWorld || player.Inventory is not { } inventory)
            {
                continue;
            }

            var expired = inventory.Items.Where(i => EndOf(i) is { } end && end <= now).ToList();
            if (expired.Count == 0)
            {
                continue;
            }

            try
            {
                await player.RunPersistenceExclusiveAsync(async () =>
                {
                    foreach (var item in expired)
                    {
                        await player.DestroyInventoryItemAsync(item).ConfigureAwait(false);
                    }
                }).ConfigureAwait(false);
                await player.ShowBlueMessageAsync("Tu set de inicio venció y se fue del inventario.").ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                player.Logger.LogError(ex, "Could not take the expired starter kit of {Name}.", player.Name);
            }
        }
    }

    /// <inheritdoc />
    public void ForceStart()
    {
        // Nothing to start: it runs all the time.
    }
}

/// <summary>The configuration of <see cref="MlrStarterKitPlugIn"/>.</summary>
public class MlrStarterKitConfiguration
{
    /// <summary>Gets or sets the zen a new character starts with (0 for none).</summary>
    public int StartingZen { get; set; } = 500_000_000;

    /// <summary>Gets or sets a value indicating whether new characters get the set and wings.</summary>
    public bool KitEnabled { get; set; } = true;

    /// <summary>Gets or sets how many days the kit lasts.</summary>
    public int KitDays { get; set; } = 7;
}
