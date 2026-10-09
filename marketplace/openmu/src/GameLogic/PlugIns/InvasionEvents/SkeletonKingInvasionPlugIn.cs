// <copyright file="SkeletonKingInvasionPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the Skeleton King mini bosses of Lorencia - ten kings and twenty-five Skeleton
/// Bones around the map every four hours, for an hour. Neither OpenMU nor the client have them:
/// the monsters (700, 701) come from deploy/config/35-bosses.sql, drawn with the skeletons'
/// models. The kings drop excellent rings and pendants, the bones Jewels of Bless and Soul.
/// </summary>
[PlugIn]
[Display(Name = "Skeleton King", Description = "Skeleton Kings and their bones invade Lorencia.")]
[Guid("6D3B9E21-4C7A-4E58-9F1D-2A6B8C0E0700")]
public sealed class SkeletonKingInvasionPlugIn : SimpleInvasionPlugIn
{
    /// <summary>The monster number of the Skeleton King.</summary>
    public const ushort SkeletonKing = 700;

    /// <summary>The monster number of the Skeleton Bone.</summary>
    public const ushort SkeletonBone = 701;

    private const ushort Lorencia = 0;

    /// <summary>
    /// Initializes a new instance of the <see cref="SkeletonKingInvasionPlugIn"/> class.
    /// </summary>
    public SkeletonKingInvasionPlugIn()
        : base(CreateDefaultConfiguration)
    {
    }

    /// <inheritdoc />
    protected override ushort? AnnouncedMonsterId => SkeletonKing;

    private static PeriodicInvasionConfiguration CreateDefaultConfiguration() => new()
    {
        TaskDuration = TimeSpan.FromHours(1),
        PreStartMessageDelay = TimeSpan.FromSeconds(3),
        StartMessage = "[{mapName}] ¡Los Skeleton King invadieron el mapa!",
        EndMessage = "[{mapName}] Los Skeleton King se fueron.",
        Timetable = PeriodicTaskConfiguration.GenerateTimeSequence(TimeSpan.FromHours(4), new TimeOnly(0, 45)).ToList(),
        Mobs =
        [
            new(SkeletonKing, 10, [Lorencia], SpawnMapStrategy.RandomMap, announceDeath: true),
            new(SkeletonBone, 25, [Lorencia], SpawnMapStrategy.RandomMap),
        ],
    };
}
