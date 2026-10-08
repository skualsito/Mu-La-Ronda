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

    /// <summary>
    /// The monsters of one invasion: a handful per map, as on the usual servers - 56 in all. They
    /// do not come back once killed, and the run ends with the last one (BaseInvasionPlugIn).
    /// The golden monsters MU has and OpenMU does not (Golden Dark Knight, Valkyrie, Balrog,
    /// Mutant, Blade Hunter, Berserker, Kentauros, Gigantis, Genocider, Derkon) are left out.
    /// </summary>
    public static List<InvasionSpawnConfiguration> Mobs() =>
    [
        Everywhere(InvasionMonsters.GoldenBudgeDragon, 6, InvasionMaps.Lorencia),
        Everywhere(InvasionMonsters.GoldenGoblin, 6, InvasionMaps.Noria),
        Everywhere(GoldenRabbit, 6, Elbeland),
        // OpenMU calls 79 the Golden Dragon; it is the Golden Derkon.
        Everywhere(InvasionMonsters.GoldenDragon, 1, Icarus, InvasionMaps.Tarkan, Aida),
        Everywhere(InvasionMonsters.GoldenSoldier, 3, InvasionMaps.Devias),
        Everywhere(InvasionMonsters.GoldenVepar, 3, InvasionMaps.Atlans),
        Everywhere(GoldenKnight, 3, Dungeon),
        Everywhere(InvasionMonsters.GoldenTitan, 3, InvasionMaps.Atlans),
        Everywhere(GoldenDevil, 3, LostTower),
        Everywhere(InvasionMonsters.GoldenWheel, 3, InvasionMaps.Tarkan),
        Everywhere(InvasionMonsters.GoldenLizardKing, 2, InvasionMaps.Atlans),
        Everywhere(InvasionMonsters.GoldenTantallos, 2, InvasionMaps.Tarkan),
        Everywhere(GoldenStoneGolem, 2, Aida),
        Everywhere(GoldenCrust, 2, Icarus),
        Everywhere(GoldenSatyros, 2, KanturuRuins),
        Everywhere(GoldenTwinTail, 2, KanturuRelics),
        Everywhere(GoldenNapin, 1, SwampOfPeace),
        Everywhere(GoldenIronKnight, 1, LaCleon),
        Everywhere(GoldenGreatDragon, 1, Icarus, InvasionMaps.Tarkan, Aida),
    ];

    /// <summary>The level (+N) of the Box of Kundun a golden monster drops on a map; null for anything else.</summary>
    public static byte? BoxLevelFor(int monsterNumber, int mapNumber)
        => GoldenMonsters.Contains(monsterNumber) && BoxLevelByMap.TryGetValue(mapNumber, out var level) ? level : null;

    private static InvasionSpawnConfiguration Everywhere(ushort monster, ushort count, params ushort[] maps)
        => new(monster, count, maps.ToList(), SpawnMapStrategy.AllMaps);
}
