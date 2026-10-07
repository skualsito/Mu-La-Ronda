// <copyright file="GoldenInvasion.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;

/// <summary>
/// Mu La Ronda: the golden invasion as in MU - every map gets its own golden monsters each time
/// (OpenMU picked one map at random for the Golden Dragons), and every golden monster drops one
/// Box of Kundun whose level is the map's, not the monster's. The golden monsters from Season 4
/// on (493-502) are added by deploy/config/22-golden-monsters.sql.
/// </summary>
public static class GoldenInvasion
{
    private const ushort Dungeon = 1;
    private const ushort LostTower = 4;
    private const ushort Icarus = 10;
    private const ushort Aida = 33;
    private const ushort KanturuRuins = 37;
    private const ushort KanturuRelics = 38;
    private const ushort Elbeland = 51;
    private const ushort SwampOfPeace = 56;
    private const ushort LaCleon = 57;

    private const ushort GoldenKnight = 493;
    private const ushort GoldenDevil = 494;
    private const ushort GoldenStoneGolem = 495;
    private const ushort GoldenCrust = 496;
    private const ushort GoldenSatyros = 497;
    private const ushort GoldenTwinTail = 498;
    private const ushort GoldenIronKnight = 499;
    private const ushort GoldenNapin = 500;
    private const ushort GoldenGreatDragon = 501;
    private const ushort GoldenRabbit = 502;

    /// <summary>The Box of Kundun +N each map's golden monsters drop.</summary>
    private static readonly IReadOnlyDictionary<int, byte> BoxLevelByMap = new Dictionary<int, byte>
    {
        [InvasionMaps.Lorencia] = 1,
        [InvasionMaps.Noria] = 1,
        [Elbeland] = 1,
        [Dungeon] = 1,
        [InvasionMaps.Devias] = 2,
        [Aida] = 3,
        [Icarus] = 3,
        [LostTower] = 4,
        [InvasionMaps.Atlans] = 4,
        [KanturuRuins] = 4,
        [KanturuRelics] = 4,
        [InvasionMaps.Tarkan] = 5,
        [SwampOfPeace] = 5,
        [LaCleon] = 5,
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
        GoldenKnight,
        GoldenDevil,
        GoldenStoneGolem,
        GoldenCrust,
        GoldenSatyros,
        GoldenTwinTail,
        GoldenIronKnight,
        GoldenNapin,
        GoldenGreatDragon,
        GoldenRabbit,
    ];

    /// <summary>The monsters of one invasion, each on every map MU puts it on.</summary>
    public static List<InvasionSpawnConfiguration> Mobs() =>
    [
        Everywhere(InvasionMonsters.GoldenBudgeDragon, 20, InvasionMaps.Lorencia, InvasionMaps.Noria, InvasionMaps.Devias),
        Everywhere(InvasionMonsters.GoldenGoblin, 20, InvasionMaps.Noria),
        Everywhere(InvasionMonsters.GoldenSoldier, 20, InvasionMaps.Devias),
        Everywhere(InvasionMonsters.GoldenTitan, 10, InvasionMaps.Devias),
        Everywhere(InvasionMonsters.GoldenDragon, 5, InvasionMaps.Lorencia, InvasionMaps.Noria, InvasionMaps.Devias, Elbeland, LostTower),
        Everywhere(GoldenRabbit, 20, Elbeland),
        Everywhere(GoldenKnight, 20, Dungeon),
        Everywhere(GoldenDevil, 20, LostTower),
        Everywhere(InvasionMonsters.GoldenVepar, 20, InvasionMaps.Atlans),
        Everywhere(InvasionMonsters.GoldenLizardKing, 10, InvasionMaps.Atlans),
        Everywhere(InvasionMonsters.GoldenWheel, 20, InvasionMaps.Tarkan),
        Everywhere(InvasionMonsters.GoldenTantallos, 10, InvasionMaps.Tarkan),
        Everywhere(GoldenStoneGolem, 10, Aida),
        Everywhere(GoldenCrust, 10, Icarus),
        Everywhere(GoldenSatyros, 10, KanturuRuins),
        Everywhere(GoldenTwinTail, 10, KanturuRelics),
        Everywhere(GoldenNapin, 10, SwampOfPeace),
        Everywhere(GoldenIronKnight, 10, LaCleon),
        Everywhere(GoldenGreatDragon, 5, LaCleon, KanturuRuins),
    ];

    /// <summary>The level (+N) of the Box of Kundun a golden monster drops on a map; null for anything else.</summary>
    public static byte? BoxLevelFor(int monsterNumber, int mapNumber)
        => GoldenMonsters.Contains(monsterNumber) && BoxLevelByMap.TryGetValue(mapNumber, out var level) ? level : null;

    private static InvasionSpawnConfiguration Everywhere(ushort monster, ushort count, params ushort[] maps)
        => new(monster, count, maps.ToList(), SpawnMapStrategy.AllMaps);
}
