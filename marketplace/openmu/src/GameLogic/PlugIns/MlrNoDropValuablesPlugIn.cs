// <copyright file="MlrNoDropValuablesPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Runtime.InteropServices;
using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.Pathfinding;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the valuable gear can't be dropped on the floor - an excellent, ancient, +7 or
/// higher, socket, harmony or level 380 item, the wings, the pets and the transformation rings -
/// so a slip of the mouse loses nothing (and nothing is handed over on the floor, past the trade).
/// Only what is worn (an item with a slot): boxes, jewels and the other things that are dropped
/// to be used stay as they are.
/// </summary>
[PlugIn]
[Display(Name = "Mu La Ronda: no dropping valuables", Description = "Excellent, ancient, +7, socket, harmony and 380 items, wings, pets and transformation rings can't be dropped.")]
[Guid("8A4F2C19-6D3B-4E7A-9C51-0B2E7D6F3A84")]
public class MlrNoDropValuablesPlugIn : IItemDropPlugIn, ISupportCustomConfiguration<MlrNoDropValuablesConfiguration>, ISupportDefaultCustomConfiguration
{
    /// <summary>The transformation rings (group 13).</summary>
    private static readonly HashSet<short> TransformationRings = [10, 39, 40, 41, 42, 68, 76, 122];

    /// <inheritdoc/>
    public MlrNoDropValuablesConfiguration? Configuration { get; set; }

    /// <inheritdoc />
    public object CreateDefaultConfig() => new MlrNoDropValuablesConfiguration();

    /// <summary>Whether the item may not be dropped.</summary>
    /// <param name="item">The item.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>True when it stays in the inventory.</returns>
    public static bool IsKept(Item item, MlrNoDropValuablesConfiguration configuration)
    {
        if (item.Definition is not { } definition)
        {
            return false;
        }

        var ring = definition.Group == 13 && TransformationRings.Contains(definition.Number);
        if (definition.ItemSlot is null && !ring)
        {
            return false;
        }

        var slots = definition.ItemSlot?.ItemSlots ?? (ICollection<int>)Array.Empty<int>();
        bool HasOption(ItemOptionType type) => item.ItemOptions.Any(o => o.ItemOption?.OptionType == type);

        return (configuration.MinimumLevel > 0 && item.Level >= configuration.MinimumLevel)
               || (configuration.Excellent && HasOption(ItemOptionTypes.Excellent))
               || (configuration.Ancient && (HasOption(ItemOptionTypes.AncientOption) || HasOption(ItemOptionTypes.AncientBonus)))
               || (configuration.Sockets && item.SocketCount > 0)
               || (configuration.Harmony && (HasOption(ItemOptionTypes.HarmonyOption) || HasOption(ItemOptionTypes.GuardianOption)))
               || (configuration.Wings && slots.Contains(InventoryConstants.WingsSlot))
               || (configuration.Pets && slots.Contains(InventoryConstants.PetSlot))
               || (configuration.TransformationRings && ring);
    }

    /// <inheritdoc />
    public async ValueTask HandleItemDropAsync(Player player, Item item, Point target, IItemDropPlugIn.ItemDropArguments dropArgs)
    {
        // Another plugin already took the drop (a box opened, a ticket used): not ours to refuse.
        if (dropArgs.Cancel || !IsKept(item, this.Configuration ?? new MlrNoDropValuablesConfiguration()))
        {
            return;
        }

        dropArgs.Cancel = true;
        dropArgs.Success = false;
        await player.ShowBlueMessageAsync("Ese ítem es valioso: no se puede tirar al piso.").ConfigureAwait(false);
    }
}

/// <summary>The configuration of <see cref="MlrNoDropValuablesPlugIn"/>: what may not be dropped.</summary>
public class MlrNoDropValuablesConfiguration
{
    /// <summary>Gets or sets the item level from which an item can't be dropped (0: any level).</summary>
    public int MinimumLevel { get; set; } = 7;

    /// <summary>Gets or sets a value indicating whether excellent items can't be dropped.</summary>
    public bool Excellent { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether ancient items can't be dropped.</summary>
    public bool Ancient { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether socket items can't be dropped.</summary>
    public bool Sockets { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether items with a harmony or level 380 option can't be dropped.</summary>
    public bool Harmony { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether wings and capes can't be dropped.</summary>
    public bool Wings { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether pets and mounts can't be dropped.</summary>
    public bool Pets { get; set; } = true;

    /// <summary>Gets or sets a value indicating whether transformation rings can't be dropped.</summary>
    public bool TransformationRings { get; set; } = true;
}
