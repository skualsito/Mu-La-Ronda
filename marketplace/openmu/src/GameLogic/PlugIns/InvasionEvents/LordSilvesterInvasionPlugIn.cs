// <copyright file="LordSilvesterInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: Lord Silvester, a boss of Vulcanus. Neither OpenMU nor the client have him: the
/// monster (702) comes from deploy/config/35-bosses.sql, and the client draws him with the Dark
/// Iron Knight's model. Every six hours, for an hour, at one of two places of Vulcanus.
/// </summary>
[PlugIn]
[Display(Name = "Lord Silvester", Description = "Lord Silvester appears in Vulcanus.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E5702")]
public sealed class LordSilvesterInvasionPlugIn : MlrBossInvasionPlugIn
{
    /// <summary>The monster number of Lord Silvester.</summary>
    public const ushort LordSilvester = 702;

    /// <summary>Vulcanus.</summary>
    public const ushort Vulcanus = 63;

    private static readonly (byte X, byte Y)[] Spots = [(50, 20), (200, 100)];

    /// <summary>
    /// Initializes a new instance of the <see cref="LordSilvesterInvasionPlugIn"/> class.
    /// </summary>
    public LordSilvesterInvasionPlugIn()
        : base(CreateDefaultConfiguration)
    {
    }

    /// <inheritdoc />
    protected override ushort BossNumber => LordSilvester;

    /// <inheritdoc />
    protected override string BossName => "Lord Silvester";

    /// <inheritdoc />
    protected override IReadOnlyList<(byte X, byte Y)> Places => Spots;

    private static PeriodicInvasionConfiguration CreateDefaultConfiguration() => new()
    {
        TaskDuration = TimeSpan.FromHours(1),
        PreStartMessageDelay = TimeSpan.FromSeconds(3),
        StartMessage = "[{mapName}] ¡Lord Silvester apareció!",
        EndMessage = "[{mapName}] Lord Silvester se fue.",
        Timetable = PeriodicTaskConfiguration.GenerateTimeSequence(TimeSpan.FromHours(6), new TimeOnly(2, 5)).ToList(),
        Mobs =
        [
            new(LordSilvester, 1, [Vulcanus], SpawnMapStrategy.RandomMap, 50, 20, announceDeath: true),
        ],
    };
}
