// <copyright file="ResetCharacterAction.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.Resets;

using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.GameLogic.NPC;
using MUnique.OpenMU.GameLogic.PlayerActions;
using MUnique.OpenMU.GameLogic.Views.Character;
using MUnique.OpenMU.GameLogic.Views.Login;
using MUnique.OpenMU.GameLogic.Views.NPC;
using MUnique.OpenMU.Pathfinding;

/// <summary>
/// Action to reset a character.
/// </summary>
public class ResetCharacterAction
{
    private readonly Player _player;
    private readonly NonPlayerCharacter? _npc;
    private readonly bool _inPlace;
    private readonly LogoutAction _logoutAction = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="ResetCharacterAction"/> class.
    /// </summary>
    /// <param name="player">Player to reset.</param>
    /// <param name="npc">NPC which the player talks to to initiate the reset action.</param>
    /// <param name="inPlace">Mu La Ronda: /autoreset - neither moves the character home nor logs it out,
    /// whatever <see cref="ResetConfiguration.MoveHome"/> and <see cref="ResetConfiguration.LogOut"/> say.</param>
    public ResetCharacterAction(Player player, NonPlayerCharacter? npc = null, bool inPlace = false)
    {
        this._player = player;
        this._npc = npc;
        this._inPlace = inPlace;
    }

    /// <summary>
    /// Reset specific character.
    /// </summary>
    public async ValueTask ResetCharacterAsync()
    {
        var resetFeature = this._player.GameContext.FeaturePlugIns.GetPlugIn<ResetFeaturePlugIn>();
        if (resetFeature is null)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.ResetNotEnabled)).ConfigureAwait(false);
            return;
        }

        if (this._player.PlayerState.CurrentState != PlayerState.EnteredWorld && this._npc is null)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.CantResetWithOpenedWindows)).ConfigureAwait(false);
            return;
        }

        if (this._player.Attributes is null || this._player.SelectedCharacter is null)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.NotEnteredTheGame)).ConfigureAwait(false);
            return;
        }

        var configuration = resetFeature.Configuration;
        if (configuration is null)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.ResetNotConfigured)).ConfigureAwait(false);
            return;
        }

        var resetProgression = ResetProgressionCalculator.Calculate(this.GetResetCount(), (int)this._player.Attributes[Stats.PointsPerReset], configuration);

        if (this._player.Level < configuration.RequiredLevel)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.RequiredLevelForReset), configuration.RequiredLevel).ConfigureAwait(false);
            return;
        }

        if (configuration.ResetLimit > 0 && resetProgression.NextResetCount > configuration.ResetLimit)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.MaximumResetsReached), configuration.ResetLimit).ConfigureAwait(false);
            return;
        }

        if (!await this.TryConsumeResetCostsAsync(configuration, resetProgression).ConfigureAwait(false))
        {
            return;
        }

        this._player.Attributes[Stats.Resets] = resetProgression.NextResetCount;
        this._player.Attributes[Stats.Level] = configuration.LevelAfterReset;
        this._player.SelectedCharacter.Experience = 0;
        this.UpdateStats(configuration, resetProgression);
        if (configuration.MoveHome && !this._inPlace)
        {
            await this.MoveHomeAsync().ConfigureAwait(false);
        }

        if (configuration.LogOut && !this._inPlace)
        {
            await this._logoutAction.LogoutAsync(this._player, LogoutType.BackToCharacterSelection).ConfigureAwait(false);
        }
        else
        {
            await this.UpdateClientStatsAsync(configuration).ConfigureAwait(false);
            if (this._inPlace)
            {
                await this._player.ShowBlueMessageAsync($"Auto reset: reset {resetProgression.NextResetCount} hecho.").ConfigureAwait(false);
            }
        }
    }

    private async ValueTask ShowMessageAsync(string messageKey, params object?[] args)
    {
        var message = this._player.GetLocalizedMessage(messageKey, args);

        if (this._npc is null)
        {
            await this._player.ShowBlueMessageAsync(message).ConfigureAwait(false);
            return;
        }

        await this._player.InvokeViewPlugInAsync<IShowMessageOfObjectPlugIn>(p => p.ShowMessageOfObjectAsync(message, this._npc)).ConfigureAwait(false);
    }

    private int GetResetCount()
    {
        return (int)this._player.Attributes![Stats.Resets];
    }

    private async ValueTask<bool> TryConsumeResetCostsAsync(ResetConfiguration configuration, ResetProgression resetProgression)
    {
        var requiredItems = await this.GetRequiredItemsToConsumeAsync(configuration, resetProgression.RequiredItemAmount).ConfigureAwait(false);
        if (requiredItems is null)
        {
            return false;
        }

        if (this._player.Money < resetProgression.RequiredZen)
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.NotEnoughMoneyForReset), resetProgression.RequiredZen).ConfigureAwait(false);
            return false;
        }

        if (resetProgression.RequiredZen > 0 && !this._player.TryRemoveMoney(resetProgression.RequiredZen))
        {
            await this.ShowMessageAsync(nameof(PlayerMessage.NotEnoughMoneyForReset), resetProgression.RequiredZen).ConfigureAwait(false);
            return false;
        }

        foreach (var item in requiredItems)
        {
            await this._player.DestroyInventoryItemAsync(item).ConfigureAwait(false);
        }

        return true;
    }

    private async ValueTask<IList<Item>?> GetRequiredItemsToConsumeAsync(ResetConfiguration configuration, int requiredItemAmount)
    {
        if (requiredItemAmount <= 0 || configuration.RequiredResetItem is null)
        {
            return [];
        }

        if (this._player.Inventory is null)
        {
            return null;
        }

        var requiredDefinition = configuration.RequiredResetItem;
        var requiredItems = this._player.Inventory.Items
            .Where(item => item.Definition is { } definition
                           && definition.Group == requiredDefinition.Group
                           && definition.Number == requiredDefinition.Number)
            .Take(requiredItemAmount)
            .ToList();
        if (requiredItems.Count < requiredItemAmount)
        {
            await this.ShowMessageAsync(
                nameof(PlayerMessage.NotEnoughItemsForReset),
                requiredItemAmount,
                configuration.RequiredResetItem.Name).ConfigureAwait(false);
            return null;
        }

        return requiredItems;
    }

    private void UpdateStats(ResetConfiguration configuration, ResetProgression resetProgression)
    {
        if (configuration.ResetStats)
        {
            this._player.SelectedCharacter!.CharacterClass!.StatAttributes
                .Where(s => s.IncreasableByPlayer)
                .ForEach(s => this._player.Attributes![s.Attribute] = s.BaseValue);
        }

        if (configuration.ReplacePointsPerReset)
        {
            this._player.SelectedCharacter!.LevelUpPoints = resetProgression.TotalPointsAfterReset;
        }
        else
        {
            this._player.SelectedCharacter!.LevelUpPoints += resetProgression.PointsForReset;
        }
    }

    private async ValueTask MoveHomeAsync()
    {
        // Mu La Ronda: a walk in progress keeps writing its next steps into the
        // character's position, so without stopping it first the character
        // ended up on the home map at the coordinates of the old one (e.g.
        // Lorencia at an Arena spot, stuck in the forest).
        await this._player.StopWalkingAsync().ConfigureAwait(false);

        var homeMapDef = this._player.SelectedCharacter!.CharacterClass!.HomeMap;
        if (homeMapDef is { }
            && await this._player.GameContext.GetMapAsync((ushort)homeMapDef.Number).ConfigureAwait(false) is { SafeZoneSpawnGate: { } spawnGate } homeMap)
        {
            // Mu La Ronda: a random cell of the gate as before, but never a blocked one.
            var target = new Point((byte)Rand.NextInt(spawnGate.X1, spawnGate.X2), (byte)Rand.NextInt(spawnGate.Y1, spawnGate.Y2));
            if (!homeMap.Terrain.WalkMap[target.X, target.Y] && homeMap.Terrain.GetWalkableCoordinate(spawnGate) is { } walkable)
            {
                target = walkable;
            }

            this._player.SelectedCharacter.PositionX = target.X;
            this._player.SelectedCharacter.PositionY = target.Y;
            this._player.SelectedCharacter.CurrentMap = spawnGate.Map;
            this._player.Rotation = spawnGate.Direction;
        }
    }

    private async ValueTask UpdateClientStatsAsync(ResetConfiguration configuration)
    {
        if (configuration.ResetStats)
        {
            await this._player.InvokeViewPlugInAsync<IUpdateCharacterBaseStatsPlugIn>(p => p.UpdateCharacterBaseStatsAsync()).ConfigureAwait(false);
        }

        await this._player.InvokeViewPlugInAsync<IUpdateLevelPlugIn>(p => p.UpdateLevelAsync()).ConfigureAwait(false);
    }
}
