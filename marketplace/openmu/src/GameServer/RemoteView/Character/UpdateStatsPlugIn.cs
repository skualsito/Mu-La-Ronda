// <copyright file="UpdateStatsPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameServer.RemoteView.Character;

using System.Collections.Frozen;
using System.Runtime.InteropServices;
using MUnique.OpenMU.AttributeSystem;
using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.GameLogic.Views.Character;
using MUnique.OpenMU.Network.Packets.ServerToClient;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// The default implementation of the <see cref="IUpdateStatsPlugIn"/> which is forwarding everything to the game client with specific data packets.
/// </summary>
/// <remarks>
/// Mu La Ronda: health, mana, shield and ability go in the 32 bit packets (CurrentStatsExtended,
/// MaximumStatsExtended) instead of the 16 bit ones, which wrapped past 65535 - with about 32767
/// points of vitality or energy the client showed 100-300 of life. The web client reads both kinds;
/// once it got a 32 bit one it ignores those values in the older packets (level up, respawn...).
/// </remarks>
[PlugIn]
[Display(Name = nameof(PlugInResources.UpdateStatsPlugIn_Name), Description = nameof(PlugInResources.UpdateStatsPlugIn_Description), ResourceType = typeof(PlugInResources))]
[Guid("2A8BFB0C-2AFF-4A52-B390-5A68D5C5F26A")]
public class UpdateStatsPlugIn : UpdateStatsBasePlugIn
{
    private static readonly FrozenDictionary<AttributeDefinition, Func<RemotePlayer, ValueTask>> AttributeChangeActions = new Dictionary<AttributeDefinition, Func<RemotePlayer, ValueTask>>
    {
        { Stats.MaximumHealth, SendMaximumStatsAsync },
        { Stats.MaximumShield, SendMaximumStatsAsync },
        { Stats.MaximumMana, SendMaximumStatsAsync },
        { Stats.MaximumAbility, SendMaximumStatsAsync },
        { Stats.CurrentHealth, SendCurrentStatsAsync },
        { Stats.CurrentShield, SendCurrentStatsAsync },
        { Stats.CurrentMana, SendCurrentStatsAsync },
        { Stats.CurrentAbility, SendCurrentStatsAsync },
    }.ToFrozenDictionary();

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateStatsPlugIn"/> class.
    /// </summary>
    /// <param name="player">The player.</param>
    public UpdateStatsPlugIn(RemotePlayer player)
        : base(player, AttributeChangeActions)
    {
    }

    /// <summary>Sends the maximum health, shield, mana and ability as 32 bit values.</summary>
    /// <param name="player">The player.</param>
    /// <returns>The task.</returns>
    internal static async ValueTask SendMaximumStatsAsync(RemotePlayer player)
    {
        await player.Connection.SendMaximumStatsExtendedAsync(
            (uint)Math.Max(player.Attributes![Stats.MaximumHealth], 0f),
            (uint)Math.Max(player.Attributes[Stats.MaximumShield], 0f),
            (uint)Math.Max(player.Attributes[Stats.MaximumMana], 0f),
            (uint)Math.Max(player.Attributes[Stats.MaximumAbility], 0f)).ConfigureAwait(false);
    }

    /// <summary>Sends the current health, shield, mana and ability as 32 bit values.</summary>
    /// <param name="player">The player.</param>
    /// <returns>The task.</returns>
    internal static async ValueTask SendCurrentStatsAsync(RemotePlayer player)
    {
        await player.Connection.SendCurrentStatsExtendedAsync(
            (uint)Math.Max(player.Attributes![Stats.CurrentHealth], 0f),
            (uint)Math.Max(player.Attributes[Stats.CurrentShield], 0f),
            (uint)Math.Max(player.Attributes[Stats.CurrentMana], 0f),
            (uint)Math.Max(player.Attributes[Stats.CurrentAbility], 0f),
            (ushort)Math.Clamp(player.Attributes[Stats.AttackSpeed], 0f, ushort.MaxValue),
            (ushort)Math.Clamp(player.Attributes[Stats.MagicSpeed], 0f, ushort.MaxValue)).ConfigureAwait(false);
    }
}
