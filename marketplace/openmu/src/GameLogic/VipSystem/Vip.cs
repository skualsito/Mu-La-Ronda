// <copyright file="Vip.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Globalization;
using System.Runtime.CompilerServices;
using MUnique.OpenMU.AttributeSystem;
using MUnique.OpenMU.GameLogic.Attributes;

/// <summary>
/// Mu La Ronda: the VIP tiers. A VIP belongs to the account and lasts 30 days;
/// it is kept as two stat attributes of the account (tier and expiry) whose
/// definitions only this code uses (deploy/config/10-vip.sql), so nothing else
/// adds elements to them. The bonuses themselves are elements on the
/// character's attribute system, added whenever it enters the world.
/// Bronze is bought with zen (/vip bronce); silver and gold are paid with Mercado Pago
/// (marketplace/server/vipPayments.ts), which grants them through Web/AdminPanel/API/MlrVipController.cs
/// or, with the account offline, writes the same attributes.
/// </summary>
public static class Vip
{
    /// <summary>The tier attribute: 0 none, 1 bronze, 2 silver, 3 gold.</summary>
    public static readonly Guid TierAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e81");

    /// <summary>The expiry attribute: days since 1970-01-01 (UTC), with fraction.</summary>
    public static readonly Guid ExpiresAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e82");

    /// <summary>
    /// The tier bought to follow the current one (a higher tier bought while a lower one lasts):
    /// it starts when the current one ends. 0 when there is none.
    /// </summary>
    public static readonly Guid NextTierAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e83");

    /// <summary>How many days the following tier lasts once it starts.</summary>
    public static readonly Guid NextDaysAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e84");

    /// <summary>How long one purchase lasts.</summary>
    public static readonly TimeSpan Duration = TimeSpan.FromDays(30);

    private static readonly ConditionalWeakTable<ItemAwareAttributeSystem, Applied> AppliedBonuses = new();

    /// <summary>The tiers, by number (index 0 is "none").</summary>
    public static IReadOnlyList<VipTier> Tiers { get; } =
    [
        new(0, "Sin VIP", 0, 0f),
        new(1, "Bronce", 1_500_000_000, 0.10f),
        new(2, "Plata", 0, 0.20f),
        new(3, "Oro", 0, 0.30f),
    ];

    /// <summary>Whether the tier is bought with zen in the game (bronze); the others are paid with Mercado Pago.</summary>
    /// <param name="tier">The tier.</param>
    /// <returns>True for a tier with a zen price.</returns>
    public static bool IsBoughtWithZen(VipTier tier) => tier.Price > 0;

    /// <summary>Whether the tier comes with /autoreset (silver and gold).</summary>
    /// <param name="tier">The tier.</param>
    /// <returns>True for silver and gold.</returns>
    public static bool CanAutoReset(VipTier tier) => tier.Number >= 2;

    /// <summary>
    /// Adds months of a tier the way a purchase does. The same tier adds to what is left of it.
    /// A higher one starts at once: from bronze (or nothing) to silver or gold it runs from now
    /// (what was left of bronze is replaced); from silver to gold it is an upgrade that keeps the
    /// end date of the silver (it was paid as the difference, the months are not used). A lower
    /// one than the current can't be added.
    /// </summary>
    /// <param name="player">The player of the account.</param>
    /// <param name="tier">The tier.</param>
    /// <param name="months">How many months.</param>
    /// <returns>Null when added; otherwise why not.</returns>
    public static string? AddMonths(Player player, VipTier tier, int months)
    {
        var (current, expires) = Of(player);
        if (current.Number > tier.Number)
        {
            return $"tenes VIP {current.Name}, no podes sumar uno mas bajo.";
        }

        var now = DateTime.UtcNow;
        var end = IsUpgrade(current, tier) ? expires
            : current.Number == tier.Number && expires > now ? expires + (Duration * months)
            : now + (Duration * months);

        // A tier that waited for the current one to end (the old way to go up) is not needed any more.
        var granted = Grant(player, tier, end) && SetNext(player, Tiers[0], 0);
        return granted ? null : "no se pudo activar, avisale a un GM.";
    }

    /// <summary>Whether buying <paramref name="tier"/> on top of <paramref name="current"/> is the silver to gold upgrade.</summary>
    /// <param name="current">The running tier.</param>
    /// <param name="tier">The tier bought.</param>
    /// <returns>True from silver to gold.</returns>
    public static bool IsUpgrade(VipTier current, VipTier tier) => current.Number == 2 && tier.Number == 3;

    /// <summary>The tier and expiry of the player's account; tier 0 when there is none or it ran out.</summary>
    public static (VipTier Tier, DateTime Expires) Of(Player player)
    {
        var attributes = player.Account?.Attributes;
        var tier = (int)Value(attributes, TierAttributeId);
        var expires = DateTime.UnixEpoch.AddDays(Value(attributes, ExpiresAttributeId));

        // The current tier ran out and another was bought to follow it: that one starts where
        // the old one ended (it was paid for while the old one lasted).
        var nextTier = (int)Value(attributes, NextTierAttributeId);
        var nextDays = Value(attributes, NextDaysAttributeId);
        if (expires <= DateTime.UtcNow && nextTier > 0 && nextTier < Tiers.Count && nextDays > 0)
        {
            var start = tier > 0 ? expires : DateTime.UtcNow;
            if (Grant(player, Tiers[nextTier], start.AddDays(nextDays)) && SetNext(player, Tiers[0], 0))
            {
                tier = nextTier;
                expires = start.AddDays(nextDays);
            }
        }

        if (tier <= 0 || tier >= Tiers.Count || expires <= DateTime.UtcNow)
        {
            return (Tiers[0], expires);
        }

        return (Tiers[tier], expires);
    }

    /// <summary>The tier bought to follow the current one and how many days it lasts; tier 0 when none.</summary>
    public static (VipTier Tier, double Days) NextOf(Player player)
    {
        var attributes = player.Account?.Attributes;
        var tier = (int)Value(attributes, NextTierAttributeId);
        var days = Value(attributes, NextDaysAttributeId);
        return tier > 0 && tier < Tiers.Count && days > 0 ? (Tiers[tier], days) : (Tiers[0], 0);
    }

    /// <summary>Sets the tier that follows the current one (tier 0 clears it).</summary>
    public static bool SetNext(Player player, VipTier tier, double days)
    {
        if (player.Account is not { } account)
        {
            return false;
        }

        var configuration = player.GameContext.Configuration;
        var tierDefinition = configuration.Attributes.FirstOrDefault(a => a.Id == NextTierAttributeId);
        var daysDefinition = configuration.Attributes.FirstOrDefault(a => a.Id == NextDaysAttributeId);
        if (tierDefinition is null || daysDefinition is null)
        {
            player.Logger.LogError("The VIP queue attribute definitions are missing; deploy/config/10-vip.sql was not applied.");
            return false;
        }

        Set(player, account, tierDefinition, tier.Number);
        Set(player, account, daysDefinition, tier.Number == 0 ? 0 : (float)days);
        return true;
    }

    /// <summary>Finds a tier by its name, as typed after /vip.</summary>
    public static VipTier? Find(string name)
    {
        var key = name.Trim().ToLowerInvariant();
        return key switch
        {
            "bronce" or "bronze" or "1" => Tiers[1],
            "plata" or "silver" or "2" => Tiers[2],
            "oro" or "gold" or "3" => Tiers[3],
            _ => null,
        };
    }

    /// <summary>Gives the account a tier until the given time, creating its attributes the first time.</summary>
    public static bool Grant(Player player, VipTier tier, DateTime expires)
    {
        if (player.Account is not { } account)
        {
            return false;
        }

        var configuration = player.GameContext.Configuration;
        var tierDefinition = configuration.Attributes.FirstOrDefault(a => a.Id == TierAttributeId);
        var expiresDefinition = configuration.Attributes.FirstOrDefault(a => a.Id == ExpiresAttributeId);
        if (tierDefinition is null || expiresDefinition is null)
        {
            player.Logger.LogError("The VIP attribute definitions are missing; deploy/config/10-vip.sql was not applied.");
            return false;
        }

        Set(player, account, tierDefinition, tier.Number);
        Set(player, account, expiresDefinition, (float)(expires - DateTime.UnixEpoch).TotalDays);
        return true;
    }

    /// <summary>
    /// Puts the account's VIP bonuses on the character's current attribute system
    /// (each one is new when the character enters the world), replacing older ones.
    /// </summary>
    /// <returns>Whether bonuses were put on just now (not when they already were, or there is no VIP).</returns>
    public static bool Apply(Player player)
    {
        if (player.Attributes is not { } attributes)
        {
            return false;
        }

        var (tier, _) = Of(player);
        if (AppliedBonuses.TryGetValue(attributes, out var applied))
        {
            if (applied.Tier == tier.Number)
            {
                return false;
            }

            attributes.RemoveElement(applied.Experience, Stats.BonusExperienceRate);
            attributes.RemoveElement(applied.Money, Stats.MoneyAmountRate);
            AppliedBonuses.Remove(attributes);
        }

        if (tier.Number == 0)
        {
            return false;
        }

        var experience = new SimpleElement(tier.Bonus, AggregateType.AddRaw);
        var money = new SimpleElement(tier.Bonus, AggregateType.AddRaw);
        attributes.AddElement(experience, Stats.BonusExperienceRate);
        attributes.AddElement(money, Stats.MoneyAmountRate);
        AppliedBonuses.AddOrUpdate(attributes, new Applied(tier.Number, experience, money));
        return true;
    }

    /// <summary>The line the client reads its VIP state from (src/common/vip.ts).</summary>
    public static string StatusLine(Player player)
    {
        var (tier, expires) = Of(player);
        if (tier.Number == 0)
        {
            return "VIP: no tenes VIP. Bronce con zen (/vip bronce); Plata y Oro con Mercado Pago, desde la ventana VIP.";
        }

        var until = expires.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        var line = $"VIP {tier.Name} activo hasta {until}: +{tier.Bonus * 100:0}% experiencia y zen{(CanAutoReset(tier) ? " y /autoreset" : string.Empty)}.";
        var (next, days) = NextOf(player);
        if (next.Number > 0)
        {
            line += $" Despues sigue {next.Name} hasta {expires.AddDays(days).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)}.";
        }

        return line;
    }

    private static float Value(ICollection<StatAttribute>? attributes, Guid definition) =>
        attributes?.FirstOrDefault(a => a.Definition?.Id == definition)?.Value ?? 0;

    private static void Set(Player player, Account account, AttributeDefinition definition, float value)
    {
        var attribute = account.Attributes.FirstOrDefault(a => a.Definition?.Id == definition.Id);
        if (attribute is null)
        {
            account.Attributes.Add(player.PersistenceContext.CreateNew<StatAttribute>(definition, value));
        }
        else
        {
            attribute.Value = value;
        }
    }

    private sealed record Applied(int Tier, SimpleElement Experience, SimpleElement Money);
}

/// <summary>A VIP tier.</summary>
/// <param name="Number">1 bronze, 2 silver, 3 gold (0 none).</param>
/// <param name="Name">The name the players see.</param>
/// <param name="Price">Zen for 30 days; 0 for a tier paid with Mercado Pago.</param>
/// <param name="Bonus">Added to the experience and zen rates (0.1 = +10%).</param>
public sealed record VipTier(int Number, string Name, int Price, float Bonus);
