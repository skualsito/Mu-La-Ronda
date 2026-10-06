// <copyright file="AutoResetChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.Resets;

using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /autoreset turns automatic resets on or off for the character.
/// While on, the character resets by itself as soon as it reaches the required
/// level - in place: it is neither logged out nor moved home, so it can keep
/// hunting (with the MU Helper, say). The usual costs and limits still apply.
/// It stays on until it is turned off or the character leaves the game.
/// </summary>
[Guid("5E0C2B7A-3D41-4F6B-9A28-7C1E4D9B0A53")]
[PlugIn]
[Display(Name = "/autoreset", Description = "Resets the character automatically at the required level, without logging out or moving it.")]
[ChatCommandHelp(Command, "Turns automatic resets on or off.", null)]
public class AutoResetChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/autoreset";

    /// <summary>How often a character with auto reset on is looked at.</summary>
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(5);

    /// <summary>After a reset that could not be done (zen, items, limit), the next try waits this long.</summary>
    private static readonly TimeSpan RetryAfterFailure = TimeSpan.FromSeconds(60);

    private static readonly ConcurrentDictionary<Player, CancellationTokenSource> Running = new();

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        if (Running.TryRemove(player, out var running))
        {
            await running.CancelAsync().ConfigureAwait(false);
            running.Dispose();
            await player.ShowBlueMessageAsync("Auto reset desactivado.").ConfigureAwait(false);
            return;
        }

        var configuration = player.GameContext.FeaturePlugIns.GetPlugIn<ResetFeaturePlugIn>()?.Configuration;
        if (configuration is null || player.SelectedCharacter is not { } character)
        {
            await player.ShowBlueMessageAsync("Los resets no estan habilitados.").ConfigureAwait(false);
            return;
        }

        var cancellation = new CancellationTokenSource();
        if (!Running.TryAdd(player, cancellation))
        {
            cancellation.Dispose();
            return;
        }

        await player.ShowBlueMessageAsync($"Auto reset activado: al llegar a nivel {configuration.RequiredLevel} el personaje se resetea solo, sin moverse ni desconectarse. /autoreset de nuevo para apagarlo.").ConfigureAwait(false);
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

                if (player.Level >= configuration.RequiredLevel)
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
                cts.Dispose();
            }
        }
    }
}
