// <copyright file="EndgameItemDrops.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic;

using MUnique.OpenMU.DataModel.Configuration.Items;

/// <summary>
/// Mu La Ronda: the items that MU's original item list (IGCN Season 6, ItemList.xml) marks with
/// "ReqLevel" 380 - the third class sets and weapons. OpenMU gives them no level requirement and
/// lets them drop from any monster near their drop level (87-140), so ordinary Kanturu monsters
/// (level 80-129) dropped them. Here they only drop from monsters of <see cref="MinimumMonsterLevel"/>
/// or more (Kalima 7, Swamp of Calmness, Raklion and the golden invasion bosses), with a wider drop
/// level window there (<see cref="DropLevelGap"/>). Wearing them still needs no level, so a reset keeps the gear.
/// </summary>
public static class EndgameItemDrops
{
    /// <summary>The lowest monster level that drops these items.</summary>
    public const int MinimumMonsterLevel = 130;

    /// <summary>
    /// How far below the monster level their drop level may be (12 for other items); wider, so that
    /// e.g. the boots (drop level 92-131) still drop, without them crowding out every other drop.
    /// </summary>
    public const int DropLevelGap = 40;

    private static readonly HashSet<(byte Group, short Number)> Items =
    [
        // Bone Blade, Explosion Blade, Flameberge, Sword Breaker, Rune Bastard Sword, Phoenix Soul Star
        (0, 22), (0, 23), (0, 26), (0, 27), (0, 28), (0, 35),
        // Soleil Scepter, Frost Mace, Absolute Scepter
        (2, 14), (2, 16), (2, 17),
        // Sylph Wind Bow, Dark Stinger
        (4, 21), (4, 23),
        // Grand Viper Staff, Storm Blitz Stick, Eternal Wing Stick, Deadly Staff, Inberial Staff
        (5, 12), (5, 19), (5, 20), (5, 30), (5, 31),
        // Crimson Glory, Salamander Shield, Frost Barrier, Guardian Shield
        (6, 17), (6, 18), (6, 19), (6, 20),
        // Dragon Knight Helm, Venom Mist Helm, Sylphid Ray Helm, Sunlight Mask, Storm Blitz Helm, Eternal Wing Helm, Titan  Helm, Brave Helm, Seraphim Helm, Divine Helm, Royal Mask, Hades Helm, Phoenix Soul Helmet
        (7, 29), (7, 30), (7, 31), (7, 33), (7, 43), (7, 44), (7, 45), (7, 46), (7, 49), (7, 50), (7, 51), (7, 52), (7, 73),
        // Dragon Knight Armor, Venom Mist Armor, Sylphid Ray Armor, Volcano Armor, Sunlight Armor, Storm Blitz Armor, Eternal Wing Armor, Titan  Armor, Brave Armor, Phantom  Armor, Destroy Armor, Seraphim Armor, Divine Armor, Royal Armor, Hades Armor, Phoenix Soul Armor
        (8, 29), (8, 30), (8, 31), (8, 32), (8, 33), (8, 43), (8, 44), (8, 45), (8, 46), (8, 47), (8, 48), (8, 49), (8, 50), (8, 51), (8, 52), (8, 73),
        // Dragon Knight Pants, Venom Mist Pants, Sylphid Ray Pants, Volcano Pants, Sunlight Pants, Storm Blitz Pants, Eternal Wing Pants, Titan  Pants, Brave Pants, Phantom  Pants, Destroy Pants, Seraphim Pants, Divine Pants, Royal Pants, Hades Pants, Phoenix Soul Pants
        (9, 29), (9, 30), (9, 31), (9, 32), (9, 33), (9, 43), (9, 44), (9, 45), (9, 46), (9, 47), (9, 48), (9, 49), (9, 50), (9, 51), (9, 52), (9, 73),
        // Dragon Knight Gloves, Venom Mist Gloves, Sylphid Ray Gloves, Volcano Gloves, Sunlight Gloves, Storm Blitz Gloves, Eternal Wing Gloves, Titan  Gloves, Brave Gloves, Phantom  Gloves, Destroy Gloves, Seraphim Gloves, Divine Gloves, Royal Gloves, Hades Gloves
        (10, 29), (10, 30), (10, 31), (10, 32), (10, 33), (10, 43), (10, 44), (10, 45), (10, 46), (10, 47), (10, 48), (10, 49), (10, 50), (10, 51), (10, 52),
        // Dragon Knight Boots, Venom Mist Boots, Sylphid Ray Boots, Volcano Boots, Sunlight Boots, Storm Blitz Boots, Eternal Wing Boots, Titan Boots, Brave Boots, Phantom Boots, Destroy Boots, Seraphim Boots, Divine Boots, Royal Boots, Hades Boots, Phoenix Soul Boots
        (11, 29), (11, 30), (11, 31), (11, 32), (11, 33), (11, 43), (11, 44), (11, 45), (11, 46), (11, 47), (11, 48), (11, 49), (11, 50), (11, 51), (11, 52), (11, 73),
    ];

    /// <summary>Whether the item is one of the level 380 items.</summary>
    /// <param name="definition">The item definition.</param>
    /// <returns><c>True</c>, if it is one of them.</returns>
    public static bool IsEndgame(ItemDefinition definition) => Items.Contains((definition.Group, definition.Number));
}
