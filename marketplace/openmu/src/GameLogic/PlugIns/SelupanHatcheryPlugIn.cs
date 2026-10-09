// <copyright file="SelupanHatcheryPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Extensions.Logging;
using MUnique.OpenMU.GameLogic.NPC;
using MUnique.OpenMU.Interfaces;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the Raklion Hatchery (Selupan's pit) opens and closes like a boss fight.
/// <list type="bullet">
/// <item>While Selupan is alive and nobody hit him, anyone may go in.</item>
/// <item>Once he takes a hit the fight has started: whoever is inside stays, nobody else gets in
/// (so a player he killed, who comes back in Raklion, cannot go back in). A fight nobody keeps up
/// for <see cref="AbandonedAfter"/> opens the pit again.</item>
/// <item>When he dies the whole server is told, and five minutes later everybody still inside is
/// sent to Raklion; the pit stays closed until he is back (his respawn delay after his death).</item>
/// </list>
/// The check is on arrival in the map, so it holds for the gate, a warp, a move or a login there.
/// Game masters are never kept out.
/// </summary>
[PlugIn]
[Display(Name = "Selupan's hatchery", Description = "Closes the Raklion Hatchery while Selupan is fought and after he dies, until he is back.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E0459")]
public class SelupanHatcheryPlugIn : IAttackableGotHitPlugIn, IAttackableGotKilledPlugIn, IObjectAddedToMapPlugIn
{
    /// <summary>The monster number of Selupan.</summary>
    public const short Selupan = 459;

    /// <summary>The Raklion Hatchery.</summary>
    public const ushort Hatchery = 58;

    private const ushort Raklion = 57;

    /// <summary>The enter gate of the hatchery that leads back to Raklion.</summary>
    private const short HatcheryExitGate = 292;

    private static readonly TimeSpan CloseAfterDeath = TimeSpan.FromMinutes(5);

    private static readonly TimeSpan AbandonedAfter = TimeSpan.FromMinutes(5);

    private readonly ConcurrentDictionary<IGameContext, Pit> _pits = new();

    private enum PitState
    {
        Open,
        Fighting,
        Won,
        Closed,
    }

    /// <inheritdoc />
    public void AttackableGotHit(IAttackable attackable, IAttacker attacker, HitInfo hitInfo)
    {
        if (attackable is not Monster { Definition.Number: Selupan } || OwnerOf(attacker) is not { } player)
        {
            return;
        }

        var pit = this.PitOf(player.GameContext);
        lock (pit)
        {
            if (pit.State is PitState.Open or PitState.Fighting)
            {
                pit.State = PitState.Fighting;
                pit.LastHitUtc = DateTime.UtcNow;
            }
        }
    }

    /// <inheritdoc />
    public async ValueTask AttackableGotKilledAsync(IAttackable killed, IAttacker? killer)
    {
        if (killed is not Monster { Definition.Number: Selupan, IsSummonedMonster: false } selupan
            || OwnerOf(killer) is not { } player)
        {
            return;
        }

        var context = player.GameContext;
        var pit = this.PitOf(context);
        var run = new CancellationTokenSource();
        CancellationTokenSource? previous;
        lock (pit)
        {
            pit.State = PitState.Won;
            previous = pit.Run;
            pit.Run = run;
        }

        if (previous is not null)
        {
            await previous.CancelAsync().ConfigureAwait(false);
        }

        await context.SendGlobalMessageAsync(
            $"{player.SelectedCharacter?.Name} mato a Selupan. La fosa de Raklion se cierra en 5 minutos.",
            MessageType.BlueNormal).ConfigureAwait(false);

        // He is back after his respawn delay from now; never before the pit closed.
        var back = selupan.Definition.RespawnDelay;
        _ = Task.Run(() => this.CloseAndReopenAsync(context, pit, run.Token, back < CloseAfterDeath ? CloseAfterDeath : back));
    }

    /// <inheritdoc />
    public async ValueTask ObjectAddedToMapAsync(GameMap map, ILocateable addedObject)
    {
        if (map.MapId != Hatchery || addedObject is not Player player || IsGameMaster(player))
        {
            return;
        }

        var pit = this.PitOf(player.GameContext);
        string? reason;
        lock (pit)
        {
            if (pit.State == PitState.Fighting && DateTime.UtcNow - pit.LastHitUtc > AbandonedAfter)
            {
                pit.State = PitState.Open;
            }

            reason = pit.State switch
            {
                PitState.Fighting => "La pelea con Selupan ya empezo: no se puede entrar a la fosa.",
                PitState.Won or PitState.Closed => "La fosa de Raklion esta cerrada hasta que Selupan vuelva a aparecer.",
                _ => null,
            };
        }

        if (reason is not null)
        {
            await SendOutAsync(player, reason).ConfigureAwait(false);
        }
    }

    private static Player? OwnerOf(IAttacker? attacker)
        => attacker as Player ?? (attacker as Monster)?.SummonedBy;

    private static bool IsGameMaster(Player player)
        => player.SelectedCharacter?.CharacterStatus == CharacterStatus.GameMaster;

    private static async ValueTask SendOutAsync(Player player, string reason)
    {
        var maps = player.GameContext.Configuration.Maps;
        var gate = maps.FirstOrDefault(m => m.Number == Hatchery)?.EnterGates.FirstOrDefault(g => g.Number == HatcheryExitGate)?.TargetGate
                   ?? maps.FirstOrDefault(m => m.Number == Raklion)?.ExitGates.FirstOrDefault(g => g.IsSpawnGate);
        if (gate is null)
        {
            return;
        }

        try
        {
            await player.ShowBlueMessageAsync(reason).ConfigureAwait(false);
            await player.WarpToAsync(gate).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            player.Logger.LogDebug(ex, "Could not send a player out of the Raklion Hatchery.");
        }
    }

    private Pit PitOf(IGameContext context) => this._pits.GetOrAdd(context, _ => new Pit());

    private async Task CloseAndReopenAsync(IGameContext context, Pit pit, CancellationToken token, TimeSpan back)
    {
        try
        {
            await Task.Delay(CloseAfterDeath - TimeSpan.FromMinutes(1), token).ConfigureAwait(false);
            await context.ForEachPlayerAsync(p => p.CurrentMap?.MapId == Hatchery
                ? p.ShowBlueMessageAsync("La fosa de Raklion se cierra en 1 minuto.").AsTask()
                : Task.CompletedTask).ConfigureAwait(false);

            await Task.Delay(TimeSpan.FromMinutes(1), token).ConfigureAwait(false);
            lock (pit)
            {
                pit.State = PitState.Closed;
            }

            await context.ForEachPlayerAsync(p => p.CurrentMap?.MapId == Hatchery && !IsGameMaster(p)
                ? SendOutAsync(p, "La fosa de Raklion se cerro.").AsTask()
                : Task.CompletedTask).ConfigureAwait(false);

            await Task.Delay(back - CloseAfterDeath, token).ConfigureAwait(false);
            lock (pit)
            {
                pit.State = PitState.Open;
            }

            await context.SendGlobalMessageAsync("Selupan volvio a aparecer: la fosa de Raklion esta abierta.", MessageType.BlueNormal).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Killed again before this run was over (a game master's spawn): the new run takes over.
        }
        catch (Exception ex)
        {
            context.LoggerFactory.CreateLogger(this.GetType()).LogError(ex, "Error closing the Raklion Hatchery.");
        }
    }

    private sealed class Pit
    {
        public PitState State { get; set; }

        public DateTime LastHitUtc { get; set; }

        public CancellationTokenSource? Run { get; set; }
    }
}
