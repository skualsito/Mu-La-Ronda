// <copyright file="MountSeedSphereCrafting.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlayerActions.Craftings;

using MUnique.OpenMU.DataModel.Configuration.ItemCrafting;
using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.GameLogic.PlayerActions.Items;
using MUnique.OpenMU.GameLogic.Views.NPC;

/// <summary>
/// Crafting to mount a seed sphere on a socket item.
/// </summary>
public class MountSeedSphereCrafting : SimpleItemCraftingHandler
{
    /// <summary>
    /// Initializes a new instance of the <see cref="MountSeedSphereCrafting"/> class.
    /// </summary>
    /// <param name="settings">The settings.</param>
    public MountSeedSphereCrafting(SimpleCraftingSettings settings)
        : base(settings)
    {
    }

    /// <summary>
    /// Gets the reference to the mounting seed sphere which must be specified in the <see cref="ItemCraftingRequiredItem.Reference"/>.
    /// </summary>
    public static byte SeedSphereReference { get; } = 0x77;

    /// <summary>
    /// Gets the reference to the socket item which must be specified in the <see cref="ItemCraftingRequiredItem.Reference"/>.
    /// </summary>
    public static byte SocketItemReference { get; } = 0x88;

    /// <summary>
    /// Mu La Ronda: the highest seed sphere level that can be mounted, for the game's balance
    /// (deploy/config/43-socket-limits.sql also keeps the higher ones out of the craftings).
    /// </summary>
    public const int MaximumSphereLevel = 3;

    /// <summary>The first seed sphere number (Seed Sphere (Fire) (1), group 12).</summary>
    private const int SeedSphereNumberStart = 100;

    /// <summary>The kinds of seeds: one seed sphere number per kind and level.</summary>
    private const int SeedTypes = 6;

    /// <summary>
    /// Mu La Ronda: the level (1-5) of a seed sphere, by its number: 100-105 are level 1, 106-111 level 2...
    /// The item's own level is not it - that is the seed's kind of option (SeedSphereCrafting).
    /// </summary>
    /// <param name="seedSphere">The seed sphere.</param>
    /// <returns>The level.</returns>
    public static int SphereLevelOf(Item seedSphere) => ((seedSphere.Definition?.Number ?? SeedSphereNumberStart) - SeedSphereNumberStart) / SeedTypes + 1;

    /// <inheritdoc />
    public override CraftingResult? TryGetRequiredItems(Player player, out IList<CraftingRequiredItemLink> items, out byte successRate)
    {
        var result = base.TryGetRequiredItems(player, out items, out successRate);
        if (result != default)
        {
            return result;
        }

        // We need to check, if the seed sphere can be mounted on the item.
        // Weapons: Fire, Lightning, Ice
        // Armors: Water, Earth, Wind
        var seedSphere = items.Single(i => i.ItemRequirement.Reference == SeedSphereReference).Items.Single();
        var socketItem = items.Single(i => i.ItemRequirement.Reference == SocketItemReference).Items.Single();
        seedSphere.ThrowNotInitializedProperty(seedSphere.Definition is null, nameof(seedSphere.Definition));
        socketItem.ThrowNotInitializedProperty(socketItem.Definition is null, nameof(socketItem.Definition));

        if (SphereLevelOf(seedSphere) > MaximumSphereLevel)
        {
            return CraftingResult.IncorrectMixItems;
        }

        var seedOption = seedSphere.Definition.PossibleItemOptions.Single();
        if (socketItem.Definition.PossibleItemOptions.All(iod => iod != seedOption))
        {
            return CraftingResult.IncorrectMixItems;
        }

        return null;
    }

    /// <inheritdoc />
    protected override async ValueTask<List<Item>> CreateOrModifyResultItemsAsync(IList<CraftingRequiredItemLink> requiredItems, Player player, byte socketSlot, byte successRate)
    {
        var seedSphere = requiredItems.Single(i => i.ItemRequirement.Reference == SeedSphereReference).Items.Single();
        var socketItem = requiredItems.Single(i => i.ItemRequirement.Reference == SocketItemReference).Items.Single();

        if (socketItem.SocketCount <= socketSlot)
        {
            throw new ArgumentException($"The item has no socket at slot {socketSlot}.");
        }

        if (socketItem.ItemOptions.Any(link => link.Index == socketSlot && link.ItemOption?.OptionType == ItemOptionTypes.SocketOption))
        {
            throw new ArgumentException("The socket of the item is not free.");
        }

        seedSphere.ThrowNotInitializedProperty(seedSphere.Definition is null, nameof(seedSphere.Definition));

        var sphereOption = player.PersistenceContext.CreateNew<ItemOptionLink>();
        sphereOption.ItemOption = seedSphere.Definition.PossibleItemOptions
            .SelectMany(o => o.PossibleOptions)
            .Single(o => o.OptionType == ItemOptionTypes.SocketOption
                         && o.Number == seedSphere.Level);
        // Mu La Ronda: the link's level is the sphere's level (ItemSerializerHelper.SetSocketBytes
        // sends it as such, and the option's value is read at it); OpenMU put the seed's kind here,
        // so a level 1 sphere of the 4th kind of fire seed counted as level 4 (and the 1st kind as 0).
        sphereOption.Level = SphereLevelOf(seedSphere);
        sphereOption.Index = socketSlot;
        socketItem.ItemOptions.Add(sphereOption);

        var currentSocketOptionCount = socketItem.ItemOptions.Count(optionLink => optionLink.ItemOption?.OptionType == ItemOptionTypes.SocketOption);
        if (currentSocketOptionCount == 3
            && Rand.NextRandomBool(30)
            && this.GetPossibleBonusOption(socketItem) is { } bonusOption)
        {
            var bonusOptionLink = player.PersistenceContext.CreateNew<ItemOptionLink>();
            bonusOptionLink.ItemOption = bonusOption;
            socketItem.ItemOptions.Add(bonusOptionLink);
        }

        return new List<Item> { socketItem };
    }

    private IncreasableItemOption? GetPossibleBonusOption(Item socketItem)
    {
        socketItem.ThrowNotInitializedProperty(socketItem.Definition is null, nameof(socketItem.Definition));

        var possibleBonusOptions = socketItem.Definition.PossibleItemOptions
            .FirstOrDefault(p => p.PossibleOptions.Any(o => o.OptionType == ItemOptionTypes.SocketBonusOption));

        if (possibleBonusOptions is null)
        {
            return null;
        }

        var options = socketItem.ItemOptions
            .Where(link => link.ItemOption?.OptionType == ItemOptionTypes.SocketOption && link.Index < 3)
            .OrderBy(link => link.Index)
            .Select(link => link.ItemOption!)
            .Distinct()
            .ToList();

        if (options.Count < 3)
        {
            return null;
        }

        /* About the numbers:
            0   Attack +11
            1   Skill Attack Increase +11
            2   Attack/Wiz +5
            3   Skill Attack Increase +11
            4   Defense Increase +24
            5   Max Life +29
         */
        if (options[0].SubOptionType == (int)SocketSubOptionType.Fire
            && options[1].SubOptionType == (int)SocketSubOptionType.Lightning
            && options[2].SubOptionType == (int)SocketSubOptionType.Ice)
        {
            return possibleBonusOptions.PossibleOptions.OrderBy(p => p.Number).FirstOrDefault();
        }

        if (options[0].SubOptionType == (int)SocketSubOptionType.Lightning
            && options[1].SubOptionType == (int)SocketSubOptionType.Ice
            && options[2].SubOptionType == (int)SocketSubOptionType.Fire)
        {
            return possibleBonusOptions.PossibleOptions.OrderBy(p => p.Number).LastOrDefault();
        }

        if (options[0].SubOptionType == (int)SocketSubOptionType.Water
            && options[1].SubOptionType == (int)SocketSubOptionType.Earth
            && options[2].SubOptionType == (int)SocketSubOptionType.Wind)
        {
            return possibleBonusOptions.PossibleOptions.OrderBy(p => p.Number).FirstOrDefault();
        }

        if (options[0].SubOptionType == (int)SocketSubOptionType.Earth
            && options[1].SubOptionType == (int)SocketSubOptionType.Wind
            && options[2].SubOptionType == (int)SocketSubOptionType.Water)
        {
            return possibleBonusOptions.PossibleOptions.OrderBy(p => p.Number).LastOrDefault();
        }

        return null;
    }
}