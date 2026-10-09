// <copyright file="MuLaRondaRates.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic;

using System.Threading;
using MUnique.OpenMU.DataModel.Configuration.Items;
using MUnique.OpenMU.GameLogic.PlayerActions.Items;

/// <summary>
/// Mu La Ronda: the server's own success rates for the chaos machine and the jewels.
/// </summary>
/// <remarks>
/// OpenMU computes most chaos mixes from the value of the items in the tray (the
/// 2nd level wings start at 0% and only grow with what is added, so with the
/// wing and the feather alone they "never came out"). Here every combination in
/// the tables has a fixed chance, a VIP one and, for the +10..+15 upgrades and
/// the Jewel of Soul, one with luck on the item.
/// The crafting being mixed and the player using a jewel are not passed down to
/// the code that rolls the chance, so they are noted around the call
/// (<see cref="ItemCraftAction"/>, ItemModifyConsumeHandlerPlugIn).
/// </remarks>
public static class MuLaRondaRates
{
    /// <summary>
    /// The +10..+15 upgrades by crafting number: normal, with luck, VIP with luck.
    /// A VIP without luck on the item gets the normal rate.
    /// </summary>
    private static readonly Dictionary<int, (byte Normal, byte Luck, byte VipLuck)> Upgrades = new()
    {
        [3] = (80, 95, 100), // +10
        [4] = (75, 90, 95), // +11
        [22] = (70, 85, 90), // +12
        [23] = (65, 80, 85), // +13
        [49] = (55, 70, 75), // +14
        [50] = (45, 60, 65), // +15
    };

    /// <summary>
    /// The other combinations by crafting number: normal and VIP. Luck does not change them.
    /// </summary>
    private static readonly Dictionary<int, (byte Normal, byte Vip)> Combinations = new()
    {
        [1] = (90, 95), // Chaos Weapon
        [11] = (85, 90), // 1st level wings
        [7] = (75, 80), // 2nd level wings
        [24] = (75, 80), // Cape of Lord / Fighter
        [38] = (60, 65), // 3rd level wings stage 1: Condor Feather
        [39] = (50, 55), // 3rd level wings stage 2
        [13] = (85, 90), // Dark Horse (Pet Trainer)
        [14] = (85, 90), // Dark Raven (Pet Trainer)
        [25] = (75, 80), // Fenrir stage 1: fragment of horn
        [26] = (65, 70), // Fenrir stage 2: broken horn
        [27] = (55, 60), // Fenrir stage 3: Horn of Fenrir
        [28] = (50, 55), // Fenrir upgrade: black, blue, gold
        [42] = (80, 85), // Seed extraction (Seed Master)
        [43] = (75, 80), // Seed sphere (Seed Master)
        [36] = (70, 75), // Option 380 (Guardian)
    };

    private static readonly AsyncLocal<int?> CraftingNumber = new();

    private static readonly AsyncLocal<Player?> ConsumingPlayer = new();

    /// <summary>
    /// Notes the crafting being mixed until the returned scope is disposed.
    /// </summary>
    /// <param name="number">The crafting number.</param>
    /// <returns>The scope.</returns>
    public static IDisposable Crafting(int number) => new Scope<int?>(CraftingNumber, number);

    /// <summary>
    /// Notes the player consuming a jewel until the returned scope is disposed.
    /// </summary>
    /// <param name="player">The player.</param>
    /// <returns>The scope.</returns>
    public static IDisposable Consuming(Player player) => new Scope<Player?>(ConsumingPlayer, player);

    /// <summary>
    /// The success rate of the crafting being mixed: the table's, or the one OpenMU computed.
    /// </summary>
    /// <param name="player">The player mixing.</param>
    /// <param name="items">The items of the mix.</param>
    /// <param name="computed">The rate OpenMU computed.</param>
    /// <returns>The rate to roll.</returns>
    public static byte CraftingSuccessRate(Player player, IList<CraftingRequiredItemLink> items, byte computed)
    {
        if (CraftingNumber.Value is not { } number)
        {
            return computed;
        }

        var vip = IsVip(player);
        if (Upgrades.TryGetValue(number, out var upgrade))
        {
            var luck = items.SelectMany(link => link.Items).Any(HasLuck);
            return !luck ? upgrade.Normal : vip ? upgrade.VipLuck : upgrade.Luck;
        }

        if (Combinations.TryGetValue(number, out var combination))
        {
            return vip ? combination.Vip : combination.Normal;
        }

        return computed;
    }

    /// <summary>
    /// The Jewel of Soul: 70%, 95% with luck, 100% for a VIP with luck.
    /// </summary>
    /// <param name="luck">Whether the item has luck.</param>
    /// <returns>The rate in percent.</returns>
    public static int JewelOfSoulRate(bool luck)
    {
        if (!luck)
        {
            return 70;
        }

        return ConsumingPlayer.Value is { } player && IsVip(player) ? 100 : 95;
    }

    /// <summary>
    /// The Jewel of Life: 70%, 75% for a VIP (luck does not change it).
    /// </summary>
    /// <returns>The chance between 0 and 1.</returns>
    public static double JewelOfLifeChance() => ConsumingPlayer.Value is { } player && IsVip(player) ? 0.75 : 0.70;

    /// <summary>
    /// The Jewel of Harmony: 75%, 80% for a VIP (luck does not change it).
    /// </summary>
    /// <returns>The chance between 0 and 1.</returns>
    public static double JewelOfHarmonyChance() => ConsumingPlayer.Value is { } player && IsVip(player) ? 0.80 : 0.75;

    private static bool IsVip(Player player) => VipSystem.Vip.Of(player).Tier.Number > 0;

    private static bool HasLuck(Item item)
        => item.ItemOptions.Any(o => o.ItemOption?.OptionType == ItemOptionTypes.Luck);

    private sealed class Scope<T> : IDisposable
    {
        private readonly AsyncLocal<T> _slot;
        private readonly T? _previous;

        public Scope(AsyncLocal<T> slot, T value)
        {
            this._slot = slot;
            this._previous = slot.Value;
            slot.Value = value;
        }

        public void Dispose() => this._slot.Value = this._previous!;
    }
}
