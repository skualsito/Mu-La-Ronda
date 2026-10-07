// <copyright file="GoldenInvasion.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

/// <summary>
/// Mu La Ronda: the golden invasion as in MU - every map gets its golden monsters each time
/// (OpenMU picked one map at random for the Golden Dragons), five Golden Dragons on each map,
/// and every golden monster drops one Box of Kundun whose level is the map's, not the monster's.
/// </summary>
public static class GoldenInvasion
{
    /// <summary>Elbeland, which OpenMU's invasion maps do not list.</summary>
    public const ushort Elbeland = 51;

    /// <summary>The Box of Kundun +N each map's golden monsters drop.</summary>
    private static readonly IReadOnlyDictionary<int, byte> BoxLevelByMap = new Dictionary<int, byte>
    {
        [InvasionMaps.Lorencia] = 1,
        [InvasionMaps.Noria] = 1,
        [Elbeland] = 1,
        [InvasionMaps.Devias] = 2,
        [InvasionMaps.Atlans] = 4,
        [InvasionMaps.Tarkan] = 5,
    };

    private static readonly HashSet<int> GoldenMonsters =
    [
        InvasionMonsters.GoldenBudgeDragon,
        InvasionMonsters.GoldenSoldier,
        InvasionMonsters.GoldenTitan,
        InvasionMonsters.GoldenGoblin,
        InvasionMonsters.GoldenDragon,
        InvasionMonsters.GoldenLizardKing,
        InvasionMonsters.GoldenVepar,
        InvasionMonsters.GoldenTantallos,
        InvasionMonsters.GoldenWheel,
    ];

    /// <summary>The monsters of one invasion: the maps' own golden ones, and Golden Dragons everywhere.</summary>
    public static List<InvasionSpawnConfiguration> Mobs() =>
    [
        new(InvasionMonsters.GoldenBudgeDragon, 20, [InvasionMaps.Lorencia], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenGoblin, 20, [InvasionMaps.Noria, Elbeland], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenSoldier, 20, [InvasionMaps.Devias], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenTitan, 10, [InvasionMaps.Devias], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenVepar, 20, [InvasionMaps.Atlans], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenLizardKing, 10, [InvasionMaps.Atlans], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenWheel, 20, [InvasionMaps.Tarkan], SpawnMapStrategy.AllMaps),
        new(InvasionMonsters.GoldenTantallos, 10, [InvasionMaps.Tarkan], SpawnMapStrategy.AllMaps),
        new(
            InvasionMonsters.GoldenDragon,
            5,
            [InvasionMaps.Lorencia, InvasionMaps.Noria, Elbeland, InvasionMaps.Devias, InvasionMaps.Atlans, InvasionMaps.Tarkan],
            SpawnMapStrategy.AllMaps),
    ];

    /// <summary>The level (+N) of the Box of Kundun a golden monster drops on a map; null for anything else.</summary>
    public static byte? BoxLevelFor(int monsterNumber, int mapNumber)
        => GoldenMonsters.Contains(monsterNumber) && BoxLevelByMap.TryGetValue(mapNumber, out var level) ? level : null;
}
