// <copyright file="GrandReset.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.GrandReset;

using System.Globalization;
using System.Runtime.InteropServices;
using MUnique.OpenMU.AttributeSystem;
using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.GameLogic.PlayerActions;
using MUnique.OpenMU.GameLogic.Resets;
using MUnique.OpenMU.GameLogic.Views.Character;
using MUnique.OpenMU.GameLogic.Views.Login;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.Pathfinding;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the grand reset. A character with enough resets talks to the Grand Reset NPC and
/// goes back to how it started - level 1, no resets, the class's base stats, no free points -
/// and gets one grand reset more and coins for the grand reset shop (GrandShop.cs). Both are
/// stat attributes of the character whose definitions only this code uses
/// (deploy/config/39-vip-grand-reset.sql); the coins are not an item, they live on the character.
/// </summary>
public static class GrandReset
{
    /// <summary>The NPC: a new monster number, rendered by the client as a geared player (src/common/npcs/playerNpcTables.ts).</summary>
    public const short NpcNumber = 760;

    /// <summary>How close to the NPC the commands work.</summary>
    public const int NpcRange = 8;

    /// <summary>How many grand resets the character has.</summary>
    public static readonly Guid CountAttributeId = new("4d1c7b2a-9e3f-4a58-8c61-2b7e0f9a3d51");

    /// <summary>The coins of the grand reset shop the character has.</summary>
    public static readonly Guid CoinsAttributeId = new("4d1c7b2a-9e3f-4a58-8c61-2b7e0f9a3d52");

    /// <summary>The character's grand resets.</summary>
    /// <param name="character">The character.</param>
    /// <returns>The count.</returns>
    public static int Count(Character character) => (int)Value(character, CountAttributeId);

    /// <summary>The character's coins.</summary>
    /// <param name="character">The character.</param>
    /// <returns>The coins.</returns>
    public static int Coins(Character character) => (int)Value(character, CoinsAttributeId);

    /// <summary>Whether the player stands by the Grand Reset NPC.</summary>
    /// <param name="player">The player.</param>
    /// <returns>True when the NPC is within <see cref="NpcRange"/>.</returns>
    public static bool IsNearNpc(Player player) =>
        player.CurrentMap?.GetNpcsInRange(player.Position, NpcRange).Any(n => n.Definition.Number == NpcNumber) ?? false;

    /// <summary>The configuration, or the defaults when the plugin has none.</summary>
    /// <param name="player">The player.</param>
    /// <returns>The configuration; null when the grand reset is off.</returns>
    public static GrandResetConfiguration? ConfigurationOf(Player player) =>
        player.GameContext.FeaturePlugIns.GetPlugIn<GrandResetFeaturePlugIn>() is { } plugIn
            ? plugIn.Configuration ?? new GrandResetConfiguration()
            : null;

    /// <summary>The line the client reads the grand reset window from (src/common/grandReset.ts).</summary>
    /// <param name="player">The player.</param>
    /// <returns>The line.</returns>
    public static string StatusLine(Player player)
    {
        if (player.SelectedCharacter is not { } character || ConfigurationOf(player) is not { } configuration)
        {
            return "Grand Reset: no esta habilitado.";
        }

        var money = configuration.RequiredMoney > 0 ? $" y {configuration.RequiredMoney.ToString("N0", CultureInfo.InvariantCulture)} zen" : string.Empty;
        return $"Grand Reset: {Count(character)} hechos, {Coins(character)} monedas. Pide nivel {configuration.RequiredLevel} y {configuration.RequiredResets} resets{money}; da {configuration.CoinsPerGrandReset} monedas.";
    }

    /// <summary>Changes the character's coins by <paramref name="delta"/>.</summary>
    /// <param name="player">The player.</param>
    /// <param name="delta">How many coins to add (negative to take).</param>
    /// <returns>False when the attribute definitions are missing.</returns>
    public static bool AddCoins(Player player, int delta) => Add(player, CoinsAttributeId, delta);

    /// <summary>Adds one grand reset and its coins.</summary>
    /// <param name="player">The player.</param>
    /// <param name="coins">The coins.</param>
    /// <returns>False when the attribute definitions are missing.</returns>
    internal static bool Count(Player player, int coins) => Add(player, CountAttributeId, 1) && Add(player, CoinsAttributeId, coins);

    private static bool Add(Player player, Guid definitionId, int delta)
    {
        if (player.SelectedCharacter is not { } character)
        {
            return false;
        }

        var definition = player.GameContext.Configuration.Attributes.FirstOrDefault(a => a.Id == definitionId);
        if (definition is null)
        {
            player.Logger.LogError("The grand reset attribute definitions are missing; deploy/config/39-vip-grand-reset.sql was not applied.");
            return false;
        }

        var attribute = character.Attributes.FirstOrDefault(a => a.Definition?.Id == definitionId);
        if (attribute is null)
        {
            character.Attributes.Add(player.PersistenceContext.CreateNew<StatAttribute>(definition, Math.Max(0, delta)));
        }
        else
        {
            attribute.Value = Math.Max(0, attribute.Value + delta);
        }

        return true;
    }

    private static float Value(Character character, Guid definitionId) =>
        character.Attributes.FirstOrDefault(a => a.Definition?.Id == definitionId)?.Value ?? 0;
}

/// <summary>
/// Mu La Ronda: turns the grand reset on and holds its configuration (the own admin panel edits it,
/// Configuración > Resets).
/// </summary>
[PlugIn]
[Display(Name = "Mu La Ronda grand reset", Description = "The grand reset NPC: back to level 1 and base stats for coins of the grand reset shop.")]
[Guid("E2B7C4D1-6A3F-4E58-9B0C-1D2E3F4A5B6C")]
public class GrandResetFeaturePlugIn : IFeaturePlugIn, ISupportCustomConfiguration<GrandResetConfiguration>, ISupportDefaultCustomConfiguration
{
    /// <inheritdoc/>
    public GrandResetConfiguration? Configuration { get; set; }

    /// <inheritdoc />
    public object CreateDefaultConfig() => new GrandResetConfiguration();
}

/// <summary>The configuration of <see cref="GrandResetFeaturePlugIn"/>.</summary>
public class GrandResetConfiguration
{
    /// <summary>Gets or sets the level the character needs.</summary>
    public int RequiredLevel { get; set; } = 400;

    /// <summary>Gets or sets the resets the character needs.</summary>
    public int RequiredResets { get; set; } = 10;

    /// <summary>Gets or sets the zen it costs.</summary>
    public int RequiredMoney { get; set; }

    /// <summary>Gets or sets the coins one grand reset gives.</summary>
    public int CoinsPerGrandReset { get; set; } = 100;
}

/// <summary>Mu La Ronda: the grand reset itself.</summary>
public static class GrandResetAction
{
    /// <summary>Does the grand reset, or tells the player why not.</summary>
    /// <param name="player">The player.</param>
    /// <returns>Whether it was done.</returns>
    public static async ValueTask<bool> TryAsync(Player player)
    {
        if (GrandReset.ConfigurationOf(player) is not { } configuration)
        {
            await player.ShowBlueMessageAsync("Grand Reset: no esta habilitado.").ConfigureAwait(false);
            return false;
        }

        if (player.SelectedCharacter is not { } character || player.Attributes is not { } attributes || character.CharacterClass is not { } characterClass)
        {
            return false;
        }

        if (player.PlayerState.CurrentState != PlayerState.EnteredWorld)
        {
            await player.ShowBlueMessageAsync("Grand Reset: cerra las ventanas abiertas y proba de nuevo.").ConfigureAwait(false);
            return false;
        }

        if (!GrandReset.IsNearNpc(player))
        {
            await player.ShowBlueMessageAsync("Grand Reset: habla con el NPC de Grand Reset.").ConfigureAwait(false);
            return false;
        }

        var resets = (int)attributes[Stats.Resets];
        if (player.Level < configuration.RequiredLevel || resets < configuration.RequiredResets)
        {
            await player.ShowBlueMessageAsync($"Grand Reset: necesitas nivel {configuration.RequiredLevel} y {configuration.RequiredResets} resets (tenes nivel {player.Level} y {resets}).").ConfigureAwait(false);
            return false;
        }

        if (configuration.RequiredMoney > 0 && !player.TryRemoveMoney(configuration.RequiredMoney))
        {
            await player.ShowBlueMessageAsync($"Grand Reset: te faltan zen, cuesta {configuration.RequiredMoney.ToString("N0", CultureInfo.InvariantCulture)}.").ConfigureAwait(false);
            return false;
        }

        if (!GrandReset.Count(player, configuration.CoinsPerGrandReset))
        {
            if (configuration.RequiredMoney > 0)
            {
                player.TryAddMoney(configuration.RequiredMoney);
            }

            await player.ShowBlueMessageAsync("Grand Reset: no se pudo hacer, avisale a un GM.").ConfigureAwait(false);
            return false;
        }

        // Back to how the character started: level 1, no resets, the class's base stats, no free points.
        attributes[Stats.Resets] = 0;
        attributes[Stats.Level] = 1;
        character.Experience = 0;
        characterClass.StatAttributes
            .Where(s => s.IncreasableByPlayer)
            .ForEach(s => attributes[s.Attribute] = s.BaseValue);
        character.LevelUpPoints = 0;

        player.Logger.LogInformation("Grand reset {Count} of {Character} ({Account}), {Coins} coins.", GrandReset.Count(character), character.Name, player.Account?.LoginName, configuration.CoinsPerGrandReset);
        await player.ShowBlueMessageAsync($"Grand Reset {GrandReset.Count(character)} hecho: +{configuration.CoinsPerGrandReset} monedas (tenes {GrandReset.Coins(character)}).").ConfigureAwait(false);

        // As a reset does (ResetCharacterAction.MoveHomeAsync): to the center of the home spawn gate,
        // and back to the character selection so the client shows it all anew.
        await player.StopWalkingAsync().ConfigureAwait(false);
        if (characterClass.HomeMap is { } homeMapDefinition
            && await player.GameContext.GetMapAsync((ushort)homeMapDefinition.Number).ConfigureAwait(false) is { SafeZoneSpawnGate: { } spawnGate } homeMap)
        {
            var target = new Point((byte)((spawnGate.X1 + spawnGate.X2) / 2), (byte)((spawnGate.Y1 + spawnGate.Y2) / 2));
            if (!homeMap.Terrain.WalkMap[target.X, target.Y] && homeMap.Terrain.GetWalkableCoordinate(spawnGate) is { } walkable)
            {
                target = walkable;
            }

            character.PositionX = target.X;
            character.PositionY = target.Y;
            character.CurrentMap = spawnGate.Map;
            player.Rotation = spawnGate.Direction;
        }

        await new LogoutAction().LogoutAsync(player, LogoutType.BackToCharacterSelection).ConfigureAwait(false);
        return true;
    }
}
