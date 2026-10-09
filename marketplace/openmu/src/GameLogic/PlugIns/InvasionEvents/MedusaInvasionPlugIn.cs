// <copyright file="MedusaInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: Medusa, the boss of the Swamp of Calmness. OpenMU has neither the monster nor the
/// event; the monster (561) comes from deploy/config/34-medusa.sql, and this plugin puts her in one
/// of four places of the swamp every six hours, for an hour, announced with where she is. The time
/// it runs is changed in OpenMU's plugin configuration, and the admin panel starts it on demand.
/// </summary>
[PlugIn]
[Display(Name = "Medusa", Description = "Medusa appears in the Swamp of Calmness.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E5561")]
public sealed class MedusaInvasionPlugIn : MlrBossInvasionPlugIn
{
    /// <summary>The monster number of Medusa.</summary>
    public const ushort Medusa = 561;

    /// <summary>The Swamp of Calmness.</summary>
    public const ushort SwampOfCalmness = 56;

    private static readonly (byte X, byte Y)[] Spots = [(50, 110), (129, 164), (150, 15), (180, 120)];

    /// <summary>
    /// Initializes a new instance of the <see cref="MedusaInvasionPlugIn"/> class.
    /// </summary>
    public MedusaInvasionPlugIn()
        : base(CreateDefaultConfiguration)
    {
    }

    /// <inheritdoc />
    protected override ushort BossNumber => Medusa;

    /// <inheritdoc />
    protected override string BossName => "Medusa";

    /// <inheritdoc />
    protected override IReadOnlyList<(byte X, byte Y)> Places => Spots;

    private static PeriodicInvasionConfiguration CreateDefaultConfiguration() => new()
    {
        TaskDuration = TimeSpan.FromHours(1),
        PreStartMessageDelay = TimeSpan.FromSeconds(3),
        StartMessage = "[{mapName}] ¡Medusa apareció!",
        EndMessage = "[{mapName}] Medusa se fue.",
        Timetable = PeriodicTaskConfiguration.GenerateTimeSequence(TimeSpan.FromHours(6), new TimeOnly(2, 0)).ToList(),
        Mobs =
        [
            new(Medusa, 1, [SwampOfCalmness], SpawnMapStrategy.RandomMap, 129, 164, announceDeath: true),
        ],
    };
}
