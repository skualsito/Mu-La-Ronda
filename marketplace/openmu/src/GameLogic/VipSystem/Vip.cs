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
/// During the beta it is bought with zen (/vip); later with Mercado Pago, which
/// will only have to write the same two attributes (as the admin panel does).
/// </summary>
public static class Vip
{
    /// <summary>The tier attribute: 0 none, 1 bronze, 2 silver, 3 gold.</summary>
    public static readonly Guid TierAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e81");

    /// <summary>The expiry attribute: days since 1970-01-01 (UTC), with fraction.</summary>
    public static readonly Guid ExpiresAttributeId = new("8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e82");

    /// <summary>How long one purchase lasts.</summary>
    public static readonly TimeSpan Duration = TimeSpan.FromDays(30);

    private static readonly ConditionalWeakTable<ItemAwareAttributeSystem, Applied> AppliedBonuses = new();

    /// <summary>The tiers, by number (index 0 is "none").</summary>
    public static IReadOnlyList<VipTier> Tiers { get; } =
    [
        new(0, "Sin VIP", 0, 0f),
        new(1, "Bronce", 200_000_000, 0.10f),
        new(2, "Plata", 500_000_000, 0.20f),
        new(3, "Oro", 1_000_000_000, 0.30f),
    ];

    /// <summary>The tier and expiry of the player's account; tier 0 when there is none or it ran out.</summary>
    public static (VipTier Tier, DateTime Expires) Of(Player player)
    {
        var attributes = player.Account?.Attributes;
        var tier = (int)(attributes?.FirstOrDefault(a => a.Definition?.Id == TierAttributeId)?.Value ?? 0);
        var days = attributes?.FirstOrDefault(a => a.Definition?.Id == ExpiresAttributeId)?.Value ?? 0;
        var expires = DateTime.UnixEpoch.AddDays(days);
        if (tier <= 0 || tier >= Tiers.Count || expires <= DateTime.UtcNow)
        {
            return (Tiers[0], expires);
        }

        return (Tiers[tier], expires);
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
            return "VIP: no tenes VIP. Bronce, Plata u Oro con /vip bronce|plata|oro.";
        }

        var until = expires.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        return $"VIP {tier.Name} activo hasta {until}: +{tier.Bonus * 100:0}% experiencia y zen.";
    }

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
/// <param name="Price">Zen for 30 days, during the beta.</param>
/// <param name="Bonus">Added to the experience and zen rates (0.1 = +10%).</param>
public sealed record VipTier(int Number, string Name, int Price, float Bonus);
