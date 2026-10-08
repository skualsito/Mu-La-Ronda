// <copyright file="AutoResetChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.Resets;

using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using MUnique.OpenMU.AttributeSystem;
using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.GameLogic.PlayerActions.Character;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /autoreset turns automatic resets on or off for the character.
/// While on, the character resets by itself as soon as it reaches the required
/// level - in place: it is neither logged out nor moved home, so it can keep
/// hunting (with the MU Helper, say). The usual costs and limits still apply.
/// It stays on until it is turned off or the character leaves the game.
/// With points after it (/autoreset str agi vit ene [cmd]) it also spends the free points
/// after each reset: that many in each stat, or the same proportions of what there is when
/// they ask for more (so /autoreset 1 0 1 0 puts half in strength and half in vitality).
/// </summary>
[Guid("5E0C2B7A-3D41-4F6B-9A28-7C1E4D9B0A53")]
[PlugIn]
[Display(Name = "/autoreset", Description = "Resets the character automatically at the required level, without logging out or moving it.")]
[ChatCommandHelp(Command, "Turns automatic resets on or off. Optional: /autoreset <str> <agi> <vit> <ene> [cmd] spends the free points after each reset.", null)]
public class AutoResetChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/autoreset";

    /// <summary>How often a character with auto reset on is looked at.</summary>
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(5);

    /// <summary>After a reset that could not be done (zen, items, limit), the next try waits this long.</summary>
    private static readonly TimeSpan RetryAfterFailure = TimeSpan.FromSeconds(60);

    private static readonly ConcurrentDictionary<Player, CancellationTokenSource> Running = new();

    /// <summary>The points each character spends after a reset, in the order of <see cref="StatOrder"/>.</summary>
    private static readonly ConcurrentDictionary<Player, long[]> Distributions = new();

    private static readonly AttributeDefinition[] StatOrder =
    [
        Stats.BaseStrength,
        Stats.BaseAgility,
        Stats.BaseVitality,
        Stats.BaseEnergy,
        Stats.BaseLeadership,
    ];

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var arguments = command.Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).ToArray();
        long[]? distribution = null;
        if (arguments.Length > 0)
        {
            distribution = new long[StatOrder.Length];
            if (arguments.Length < 4 || arguments.Length > StatOrder.Length
                || arguments.Where((a, i) => !long.TryParse(a, out distribution[i]) || distribution[i] < 0).Any())
            {
                await player.ShowBlueMessageAsync("Uso: /autoreset, o /autoreset <fuerza> <agilidad> <vitalidad> <energia> [comando] para que reparta los puntos solo despues de cada reset.").ConfigureAwait(false);
                return;
            }

            if (distribution.All(d => d == 0))
            {
                Distributions.TryRemove(player, out _);
            }
            else
            {
                Distributions[player] = distribution;
            }
        }

        if (distribution is not null && Running.ContainsKey(player))
        {
            await player.ShowBlueMessageAsync(DistributionText(distribution)).ConfigureAwait(false);
            return;
        }

        if (Running.TryRemove(player, out var running))
        {
            await running.CancelAsync().ConfigureAwait(false);
            running.Dispose();
            Distributions.TryRemove(player, out _);
            await player.ShowBlueMessageAsync("Auto reset desactivado.").ConfigureAwait(false);
            return;
        }

        var configuration = player.GameContext.FeaturePlugIns.GetPlugIn<ResetFeaturePlugIn>()?.Configuration;
        if (configuration is null || player.SelectedCharacter is not { } character)
        {
            Distributions.TryRemove(player, out _);
            await player.ShowBlueMessageAsync("Los resets no estan habilitados.").ConfigureAwait(false);
            return;
        }

        var cancellation = new CancellationTokenSource();
        if (!Running.TryAdd(player, cancellation))
        {
            cancellation.Dispose();
            return;
        }

        if (distribution is null)
        {
            Distributions.TryRemove(player, out _);
        }

        await player.ShowBlueMessageAsync($"Auto reset activado: al llegar a nivel {configuration.RequiredLevel} el personaje se resetea solo, sin moverse ni desconectarse. /autoreset de nuevo para apagarlo.").ConfigureAwait(false);
        if (distribution is not null)
        {
            await player.ShowBlueMessageAsync(DistributionText(distribution)).ConfigureAwait(false);
        }

        _ = Task.Run(() => RunAsync(player, character, cancellation.Token));
    }

    private static async Task RunAsync(Player player, Character character, CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(CheckInterval, cancellationToken).ConfigureAwait(false);

                // Logged out, or another character selected: this one's auto reset ends.
                if (!ReferenceEquals(player.SelectedCharacter, character)
                    || player.PlayerState.CurrentState == PlayerState.Disconnected
                    || player.PlayerState.CurrentState == PlayerState.CharacterSelection)
                {
                    break;
                }

                // Dead, warping, trading, in a dialog: the next round.
                if (player.PlayerState.CurrentState != PlayerState.EnteredWorld || player.Attributes is null)
                {
                    continue;
                }

                var configuration = player.GameContext.FeaturePlugIns.GetPlugIn<ResetFeaturePlugIn>()?.Configuration;
                if (configuration is null || player.Level < configuration.RequiredLevel)
                {
                    continue;
                }

                await player.RunPersistenceExclusiveAsync(
                    () => new ResetCharacterAction(player, null, inPlace: true).ResetCharacterAsync(),
                    cancellationToken).ConfigureAwait(false);

                if (player.Level < configuration.RequiredLevel)
                {
                    await SpendPointsAsync(player, character).ConfigureAwait(false);
                }
                else
                {
                    // Not done (the action told the player why): don't nag every few seconds.
                    await Task.Delay(RetryAfterFailure, cancellationToken).ConfigureAwait(false);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // turned off
        }
        catch (Exception ex)
        {
            player.Logger.LogError(ex, "Auto reset of {Name} stopped.", character.Name);
        }
        finally
        {
            if (Running.TryGetValue(player, out var cts) && cts.Token == cancellationToken)
            {
                Running.TryRemove(player, out _);
                Distributions.TryRemove(player, out _);
                cts.Dispose();
            }
        }
    }

    private static string DistributionText(long[] distribution)
    {
        var text = $"Despues de cada reset reparte: fuerza {distribution[0]}, agilidad {distribution[1]}, vitalidad {distribution[2]}, energia {distribution[3]}";
        if (distribution[4] > 0)
        {
            text += $", comando {distribution[4]}";
        }

        return text + " (si no alcanzan, en la misma proporcion).";
    }

    /// <summary>Spends the free points as the character asked, after a reset.</summary>
    private static async ValueTask SpendPointsAsync(Player player, Character character)
    {
        if (!Distributions.TryGetValue(player, out var distribution) || character.CharacterClass is not { } characterClass)
        {
            return;
        }

        var wanted = distribution
            .Select((amount, i) => characterClass.GetStatAttribute(StatOrder[i]) is { IncreasableByPlayer: true } ? amount : 0)
            .ToArray();
        long free = character.LevelUpPoints;
        var total = wanted.Sum();
        if (free <= 0 || total <= 0)
        {
            return;
        }

        var action = new IncreaseStatsAction();
        for (var i = 0; i < StatOrder.Length; i++)
        {
            var amount = total <= free ? wanted[i] : (long)((decimal)wanted[i] * free / total);
            amount = Math.Min(amount, character.LevelUpPoints);
            while (amount > 0)
            {
                var step = (ushort)Math.Min(amount, ushort.MaxValue);
                var before = character.LevelUpPoints;
                await action.IncreaseStatsAsync(player, StatOrder[i], step).ConfigureAwait(false);
                if (character.LevelUpPoints >= before)
                {
                    break; // the stat is at its maximum
                }

                amount -= before - character.LevelUpPoints;
            }
        }

        // The stat packets carry the free points in 16 bits; the real number for the client.
        await player.ShowBlueMessageAsync($"Puntos libres: {Math.Max(0, character.LevelUpPoints)}").ConfigureAwait(false);
    }
}
