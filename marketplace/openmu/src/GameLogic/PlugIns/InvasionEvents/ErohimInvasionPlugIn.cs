// <copyright file="ErohimInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: Erohim (295) at the end of Kanturu Relics. OpenMU only has him in the Land of
/// Trials, which opens to the guild that holds the castle; this brings him to Kanturu every twelve
/// hours, for an hour, for everybody.
/// </summary>
[PlugIn]
[Display(Name = "Erohim", Description = "Erohim appears at the end of Kanturu Relics.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E0295")]
public sealed class ErohimInvasionPlugIn : MlrBossInvasionPlugIn
{
    /// <summary>The monster number of Erohim.</summary>
    public const ushort Erohim = 295;

    /// <summary>Kanturu Relics (Kanturu III).</summary>
    public const ushort KanturuRelics = 38;

    private static readonly (byte X, byte Y)[] Spots = [(190, 90)];

    /// <summary>
    /// Initializes a new instance of the <see cref="ErohimInvasionPlugIn"/> class.
    /// </summary>
    public ErohimInvasionPlugIn()
        : base(CreateDefaultConfiguration)
    {
    }

    /// <inheritdoc />
    protected override ushort BossNumber => Erohim;

    /// <inheritdoc />
    protected override string BossName => "Erohim";

    /// <inheritdoc />
    protected override IReadOnlyList<(byte X, byte Y)> Places => Spots;

    private static PeriodicInvasionConfiguration CreateDefaultConfiguration() => new()
    {
        TaskDuration = TimeSpan.FromHours(1),
        PreStartMessageDelay = TimeSpan.FromSeconds(3),
        StartMessage = "[{mapName}] ¡Erohim apareció!",
        EndMessage = "[{mapName}] Erohim se fue.",
        Timetable = [new TimeOnly(8, 25), new TimeOnly(20, 25)],
        Mobs =
        [
            new(Erohim, 1, [KanturuRelics], SpawnMapStrategy.RandomMap, 190, 90, announceDeath: true),
        ],
    };
}
