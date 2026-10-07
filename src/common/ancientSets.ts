import type { TextKey } from '../i18n/recipes';

/**
 * Mu La Ronda: the ancient sets as OpenMU has them
 * (Persistence/Initialization/VersionSeasonSix/Items/AncientSets.cs), for the
 * item tooltip - the set name in front of the item's, the stat its +5 / +10
 * bonus goes to, and the set's options. Generated from that file; change the
 * two together.
 *
 * An item belongs to a set by its definition and the ancient discriminator
 * the server sends (1 or 2: the two sets a piece can come in). The options
 * work as `ItemPowerUpFactory.GetSetPowerUps`: with N distinct pieces of the
 * set worn (N >= 2) the first N - 1 apply, and a complete set gets them all.
 */

/** A stat the set options and the item bonuses raise. */
export type AncientStat =
  | 'TotalStrength' | 'TotalAgility' | 'TotalVitality' | 'TotalEnergy' | 'TotalLeadership'
  | 'SkillDamageBonus' | 'DoubleDamageChance' | 'CriticalDamageChance' | 'ExcellentDamageChance'
  | 'WizardryBaseDmgIncrease' | 'DefenseBase' | 'MaximumMana' | 'MaximumHealth' | 'DefenseIgnoreChance'
  | 'ExcellentDamageBonus' | 'MaximumPhysBaseDmg' | 'MinimumPhysBaseDmg' | 'MaximumAbility'
  | 'CriticalDamageBonus' | 'FinalDamageBonus' | 'AttackRatePvm' | 'DefenseIncreaseWithEquippedShield'
  | 'TwoHandedWeaponDamageIncrease' | 'AbilityRecoveryAbsolute';

/** One option: the stat, the value, and `true` when it multiplies (1.05 = +5%). */
type SetOption = readonly [stat: AncientStat, value: number, multiplies?: true];

/** One piece: item group, item number, ancient discriminator, the stat of its bonus. */
type SetPiece = readonly [group: number, number: number, discriminator: number, bonus: AncientStat | null];

export type AncientSet = {
  readonly name: string;
  readonly options: readonly SetOption[];
  readonly items: readonly SetPiece[];
};

export const ANCIENT_SETS: readonly AncientSet[] = [
  { name: 'Warrior', options: [['TotalStrength', 10], ['SkillDamageBonus', 10], ['MaximumAbility', 20], ['AbilityRecoveryAbsolute', 5], ['DefenseBase', 20], ['TotalAgility', 10], ['CriticalDamageChance', 0.05], ['ExcellentDamageChance', 0.05], ['TotalStrength', 25]], items: [[11, 5, 1, 'TotalVitality'], [10, 5, 1, 'TotalVitality'], [7, 5, 1, 'TotalVitality'], [9, 5, 1, 'TotalVitality'], [8, 5, 1, 'TotalVitality'], [2, 1, 1, 'TotalStrength'], [13, 8, 1, 'TotalAgility']] },
  { name: 'Anonymous', options: [['MaximumHealth', 50], ['TotalAgility', 50], ['DefenseIncreaseWithEquippedShield', 0.25], ['FinalDamageBonus', 30]], items: [[11, 5, 2, 'TotalVitality'], [7, 5, 2, 'TotalVitality'], [9, 5, 2, 'TotalVitality'], [6, 0, 1, 'TotalVitality']] },
  { name: 'Hyperion', options: [['TotalEnergy', 15], ['TotalAgility', 15], ['SkillDamageBonus', 20], ['MaximumMana', 30]], items: [[11, 0, 1, 'TotalVitality'], [9, 0, 1, 'TotalVitality'], [8, 0, 1, 'TotalVitality']] },
  { name: 'Mist', options: [['TotalVitality', 20], ['SkillDamageBonus', 30], ['DoubleDamageChance', 0.1], ['TotalAgility', 20]], items: [[10, 0, 1, 'TotalVitality'], [9, 0, 2, 'TotalVitality'], [7, 0, 1, 'TotalVitality']] },
  { name: 'Eplete', options: [['SkillDamageBonus', 15], ['AttackRatePvm', 50], ['WizardryBaseDmgIncrease', 1.05, true], ['MaximumHealth', 50], ['MaximumAbility', 30], ['CriticalDamageChance', 0.1], ['ExcellentDamageChance', 0.1]], items: [[9, 6, 1, 'TotalVitality'], [8, 6, 1, 'TotalVitality'], [7, 6, 1, 'TotalVitality'], [6, 9, 1, 'TotalVitality'], [13, 12, 1, 'TotalEnergy']] },
  { name: 'Berserker', options: [['MaximumPhysBaseDmg', 10], ['MaximumPhysBaseDmg', 20], ['MaximumPhysBaseDmg', 30], ['MaximumPhysBaseDmg', 40], ['SkillDamageBonus', 50], ['TotalStrength', 40]], items: [[9, 6, 2, 'TotalVitality'], [8, 6, 2, 'TotalVitality'], [7, 6, 2, 'TotalVitality'], [10, 6, 1, 'TotalVitality'], [11, 6, 1, 'TotalVitality']] },
  { name: 'Garuda', options: [['MaximumAbility', 30], ['DoubleDamageChance', 0.05], ['TotalEnergy', 15], ['MaximumHealth', 50], ['SkillDamageBonus', 25], ['WizardryBaseDmgIncrease', 1.15, true]], items: [[9, 8, 1, 'TotalVitality'], [8, 8, 1, 'TotalVitality'], [10, 8, 1, 'TotalVitality'], [11, 8, 1, 'TotalVitality'], [13, 13, 1, 'TotalStrength']] },
  { name: 'Cloud', options: [['CriticalDamageChance', 0.2], ['CriticalDamageBonus', 50]], items: [[9, 8, 2, 'TotalVitality'], [7, 8, 1, 'TotalVitality']] },
  { name: 'Kantata', options: [['TotalEnergy', 15], ['TotalVitality', 30], ['WizardryBaseDmgIncrease', 1.1, true], ['TotalStrength', 15], ['SkillDamageBonus', 25], ['ExcellentDamageChance', 10], ['ExcellentDamageBonus', 20]], items: [[11, 9, 1, 'TotalVitality'], [10, 9, 1, 'TotalVitality'], [8, 9, 1, 'TotalVitality'], [13, 23, 1, 'TotalAgility'], [13, 9, 1, 'TotalVitality']] },
  { name: 'Rave', options: [['SkillDamageBonus', 20], ['DoubleDamageChance', 0.1], ['TwoHandedWeaponDamageIncrease', 0.3], ['DefenseIgnoreChance', 0.05]], items: [[7, 9, 1, 'TotalVitality'], [9, 9, 1, 'TotalVitality'], [8, 9, 2, 'TotalVitality']] },
  { name: 'Hyon', options: [['DoubleDamageChance', 0.1], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['CriticalDamageBonus', 20], ['ExcellentDamageBonus', 20]], items: [[0, 14, 1, 'TotalStrength'], [7, 1, 1, 'TotalVitality'], [11, 1, 1, 'TotalVitality'], [10, 1, 1, 'TotalVitality']] },
  { name: 'Vicious', options: [['SkillDamageBonus', 15], ['FinalDamageBonus', 15], ['DoubleDamageChance', 0.1], ['MinimumPhysBaseDmg', 20], ['MaximumPhysBaseDmg', 30], ['DefenseIgnoreChance', 0.05]], items: [[13, 22, 2, 'TotalStrength'], [7, 1, 2, 'TotalVitality'], [9, 1, 2, 'TotalVitality'], [8, 1, 2, 'TotalVitality']] },
  { name: 'Apollo', options: [['TotalEnergy', 10], ['WizardryBaseDmgIncrease', 1.05, true], ['SkillDamageBonus', 10], ['MaximumMana', 30], ['MaximumHealth', 30], ['MaximumAbility', 20], ['CriticalDamageChance', 0.1], ['ExcellentDamageChance', 0.1], ['TotalEnergy', 30]], items: [[5, 0, 1, 'TotalEnergy'], [7, 2, 1, 'TotalVitality'], [8, 2, 1, 'TotalVitality'], [9, 2, 1, 'TotalVitality'], [10, 2, 1, 'TotalVitality'], [13, 25, 1, 'TotalStrength'], [13, 24, 1, 'TotalEnergy']] },
  { name: 'Barnake', options: [['WizardryBaseDmgIncrease', 1.1, true], ['TotalEnergy', 20], ['SkillDamageBonus', 30], ['MaximumMana', 100]], items: [[7, 2, 2, 'TotalVitality'], [9, 2, 2, 'TotalVitality'], [11, 2, 1, 'TotalVitality']] },
  { name: 'Evis', options: [['SkillDamageBonus', 15], ['TotalVitality', 20], ['WizardryBaseDmgIncrease', 1.1, true], ['DoubleDamageChance', 0.05], ['AttackRatePvm', 50], ['AbilityRecoveryAbsolute', 5]], items: [[8, 4, 1, 'TotalVitality'], [9, 4, 1, 'TotalVitality'], [11, 4, 1, 'TotalVitality'], [13, 26, 1, 'TotalAgility']] },
  { name: 'Sylion', options: [['DoubleDamageChance', 0.05], ['CriticalDamageChance', 0.05], ['DefenseBase', 20], ['TotalStrength', 50], ['TotalAgility', 50], ['TotalVitality', 50], ['TotalEnergy', 50]], items: [[8, 4, 2, 'TotalVitality'], [10, 4, 1, 'TotalVitality'], [11, 4, 2, 'TotalVitality'], [7, 4, 1, 'TotalVitality']] },
  { name: 'Heras', options: [['TotalStrength', 15], ['WizardryBaseDmgIncrease', 1.1, true], ['DefenseIncreaseWithEquippedShield', 0.05], ['TotalEnergy', 15], ['AttackRatePvm', 50], ['CriticalDamageChance', 0.1], ['ExcellentDamageChance', 0.1], ['MaximumHealth', 50], ['MaximumMana', 50]], items: [[6, 6, 1, 'TotalVitality'], [9, 7, 1, 'TotalVitality'], [8, 7, 1, 'TotalVitality'], [7, 7, 1, 'TotalVitality'], [10, 7, 1, 'TotalVitality'], [11, 7, 1, 'TotalVitality']] },
  { name: 'Minet', options: [['TotalEnergy', 30], ['DefenseBase', 30], ['MaximumMana', 100], ['SkillDamageBonus', 15]], items: [[9, 7, 2, 'TotalVitality'], [8, 7, 2, 'TotalVitality'], [11, 7, 2, 'TotalVitality']] },
  { name: 'Anubis', options: [['DoubleDamageChance', 0.1], ['MaximumMana', 50], ['WizardryBaseDmgIncrease', 1.1, true], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['CriticalDamageBonus', 20], ['ExcellentDamageBonus', 20]], items: [[8, 3, 1, 'TotalVitality'], [7, 3, 1, 'TotalVitality'], [10, 3, 1, 'TotalVitality'], [13, 21, 1, 'TotalEnergy']] },
  { name: 'Enis', options: [['SkillDamageBonus', 10], ['DoubleDamageChance', 0.1], ['TotalEnergy', 30], ['WizardryBaseDmgIncrease', 1.1, true], ['DefenseIgnoreChance', 0.05]], items: [[8, 3, 2, 'TotalVitality'], [7, 3, 2, 'TotalVitality'], [11, 3, 2, 'TotalVitality'], [9, 3, 2, 'TotalVitality']] },
  { name: 'Ceto', options: [['TotalAgility', 10], ['MaximumHealth', 50], ['DefenseBase', 20], ['DefenseIncreaseWithEquippedShield', 0.05], ['TotalEnergy', 10], ['MaximumHealth', 50], ['TotalStrength', 20]], items: [[11, 10, 1, 'TotalVitality'], [10, 10, 1, 'TotalVitality'], [7, 10, 1, 'TotalVitality'], [9, 10, 1, 'TotalVitality'], [0, 2, 1, 'TotalStrength'], [13, 22, 1, 'TotalStrength']] },
  { name: 'Drake', options: [['TotalAgility', 20], ['FinalDamageBonus', 25], ['DoubleDamageChance', 0.2], ['DefenseBase', 40], ['CriticalDamageChance', 0.1]], items: [[11, 10, 2, 'TotalVitality'], [8, 10, 1, 'TotalVitality'], [7, 10, 2, 'TotalVitality'], [9, 10, 2, 'TotalVitality']] },
  { name: 'Gaia', options: [['SkillDamageBonus', 10], ['MaximumMana', 25], ['TotalStrength', 10], ['DoubleDamageChance', 0.05], ['TotalAgility', 30], ['ExcellentDamageChance', 0.1], ['ExcellentDamageBonus', 10]], items: [[8, 11, 1, 'TotalVitality'], [10, 11, 1, 'TotalVitality'], [7, 11, 1, 'TotalVitality'], [9, 11, 1, 'TotalVitality'], [4, 9, 1, 'TotalAgility']] },
  { name: 'Fase', options: [['MaximumHealth', 100], ['MaximumMana', 100], ['DefenseBase', 100]], items: [[10, 11, 2, 'TotalVitality'], [9, 11, 2, 'TotalVitality'], [11, 11, 1, 'TotalVitality']] },
  { name: 'Odin', options: [['TotalEnergy', 15], ['MaximumHealth', 50], ['AttackRatePvm', 50], ['TotalAgility', 30], ['MaximumMana', 50], ['DefenseIgnoreChance', 0.05], ['MaximumAbility', 50]], items: [[8, 12, 1, 'TotalVitality'], [10, 12, 1, 'TotalVitality'], [7, 12, 1, 'TotalVitality'], [9, 12, 1, 'TotalVitality'], [11, 12, 1, 'TotalVitality']] },
  { name: 'Elvian', options: [['TotalAgility', 30], ['DefenseIgnoreChance', 0.05]], items: [[9, 12, 2, 'TotalVitality'], [11, 12, 2, 'TotalVitality']] },
  { name: 'Argo', options: [['MaximumPhysBaseDmg', 20], ['SkillDamageBonus', 25], ['MaximumAbility', 50], ['DoubleDamageChance', 0.05]], items: [[8, 13, 1, 'TotalVitality'], [10, 13, 1, 'TotalVitality'], [9, 13, 1, 'TotalVitality']] },
  { name: 'Karis', options: [['SkillDamageBonus', 15], ['DoubleDamageChance', 0.1], ['CriticalDamageChance', 0.1], ['TotalAgility', 40]], items: [[7, 13, 2, 'TotalVitality'], [11, 13, 2, 'TotalVitality'], [9, 13, 2, 'TotalVitality']] },
  { name: 'Gywen', options: [['TotalAgility', 30], ['MinimumPhysBaseDmg', 20], ['DefenseBase', 20], ['MaximumPhysBaseDmg', 20], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['CriticalDamageBonus', 20], ['ExcellentDamageBonus', 20]], items: [[11, 14, 1, 'TotalVitality'], [10, 14, 1, 'TotalVitality'], [8, 14, 1, 'TotalVitality'], [4, 5, 1, 'TotalAgility'], [13, 28, 1, null]] },
  { name: 'Aruan', options: [['FinalDamageBonus', 10], ['DoubleDamageChance', 0.1], ['SkillDamageBonus', 20], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['DefenseIgnoreChance', 0.05]], items: [[11, 14, 2, 'TotalVitality'], [9, 14, 2, 'TotalVitality'], [8, 14, 2, 'TotalVitality'], [7, 14, 2, 'TotalVitality']] },
  { name: 'Gaion', options: [['DefenseIgnoreChance', 0.05], ['DoubleDamageChance', 0.15], ['SkillDamageBonus', 15], ['ExcellentDamageChance', 0.15], ['ExcellentDamageBonus', 30], ['WizardryBaseDmgIncrease', 1.1, true], ['TotalStrength', 30]], items: [[11, 15, 1, 'TotalVitality'], [9, 15, 1, 'TotalVitality'], [8, 15, 1, 'TotalVitality'], [13, 27, 1, 'TotalVitality']] },
  { name: 'Muren', options: [['SkillDamageBonus', 10], ['WizardryBaseDmgIncrease', 1.1, true], ['DoubleDamageChance', 0.1], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['DefenseBase', 25], ['TwoHandedWeaponDamageIncrease', 0.2]], items: [[10, 15, 2, 'TotalVitality'], [9, 15, 2, 'TotalVitality'], [8, 15, 2, 'TotalVitality'], [13, 21, 2, 'TotalVitality']] },
  { name: 'Agnis', options: [['DoubleDamageChance', 0.1], ['DefenseBase', 40], ['SkillDamageBonus', 20], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['CriticalDamageBonus', 20], ['ExcellentDamageBonus', 20]], items: [[8, 26, 1, 'TotalVitality'], [9, 26, 1, 'TotalVitality'], [7, 26, 1, 'TotalVitality'], [13, 9, 2, 'TotalVitality']] },
  { name: 'Broy', options: [['FinalDamageBonus', 20], ['SkillDamageBonus', 20], ['TotalEnergy', 30], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['DefenseIgnoreChance', 0.05], ['TotalLeadership', 30]], items: [[9, 26, 2, 'TotalVitality'], [10, 26, 2, 'TotalVitality'], [11, 26, 2, 'TotalVitality'], [13, 25, 2, 'TotalStrength']] },
  { name: 'Chrono', options: [['DoubleDamageChance', 0.2], ['DefenseBase', 60], ['SkillDamageBonus', 30], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['CriticalDamageBonus', 20], ['ExcellentDamageBonus', 20]], items: [[7, 40, 1, 'TotalVitality'], [9, 40, 1, 'TotalVitality'], [10, 40, 1, 'TotalVitality'], [13, 24, 2, 'TotalEnergy']] },
  { name: 'Semeden', options: [['WizardryBaseDmgIncrease', 1.15, true], ['SkillDamageBonus', 25], ['TotalEnergy', 30], ['CriticalDamageChance', 0.15], ['ExcellentDamageChance', 0.15], ['DefenseIgnoreChance', 0.05]], items: [[11, 40, 2, 'TotalVitality'], [10, 40, 2, 'TotalVitality'], [8, 40, 2, 'TotalVitality'], [7, 40, 2, 'TotalVitality']] },
];

const byPiece = new Map<string, { set: AncientSet; piece: SetPiece }>();
for (const set of ANCIENT_SETS) {
  for (const piece of set.items) byPiece.set(`${piece[0]}:${piece[1]}:${piece[2]}`, { set, piece });
}

/** The set an ancient item belongs to, with its own entry; null if the server sent a pair we do not know. */
export function ancientSetOf(group: number, index: number, discriminator: number) {
  return byPiece.get(`${group}:${index}:${discriminator}`) ?? null;
}

/** How many distinct pieces of `set` are among `worn` (the equipped items). */
export function wornPiecesOf(
  set: AncientSet,
  worn: readonly ({ group: number; num: number; isAncient?: boolean; ancientDiscriminator?: number } | null)[]
): number {
  const seen = new Set<string>();
  for (const item of worn) {
    if (!item?.isAncient) continue;
    const entry = ancientSetOf(item.group, item.num, item.ancientDiscriminator ?? 0);
    if (entry?.set === set) seen.add(`${item.group}:${item.num}`);
  }
  return seen.size;
}

/** Whether option `index` (0-based) applies with `pieces` distinct pieces worn. */
export function setOptionActive(set: AncientSet, index: number, pieces: number): boolean {
  if (pieces >= set.items.length) return true;
  return pieces >= 2 && index < pieces - 1;
}

/** The text key naming a stat, `{value}` filled by `setOptionValue`. */
export const ANCIENT_STAT_KEYS: Readonly<Record<AncientStat, TextKey>> = {
  TotalStrength: 'ancient.stat.strength',
  TotalAgility: 'ancient.stat.agility',
  TotalVitality: 'ancient.stat.vitality',
  TotalEnergy: 'ancient.stat.energy',
  TotalLeadership: 'ancient.stat.command',
  SkillDamageBonus: 'ancient.stat.skillDamage',
  DoubleDamageChance: 'ancient.stat.doubleDamage',
  CriticalDamageChance: 'ancient.stat.criticalChance',
  ExcellentDamageChance: 'ancient.stat.excellentChance',
  WizardryBaseDmgIncrease: 'ancient.stat.wizardry',
  DefenseBase: 'ancient.stat.defense',
  MaximumMana: 'ancient.stat.maxMana',
  MaximumHealth: 'ancient.stat.maxLife',
  DefenseIgnoreChance: 'ancient.stat.ignoreDefense',
  ExcellentDamageBonus: 'ancient.stat.excellentDamage',
  MaximumPhysBaseDmg: 'ancient.stat.maxDamage',
  MinimumPhysBaseDmg: 'ancient.stat.minDamage',
  MaximumAbility: 'ancient.stat.maxAg',
  CriticalDamageBonus: 'ancient.stat.criticalDamage',
  FinalDamageBonus: 'ancient.stat.damage',
  AttackRatePvm: 'ancient.stat.attackRate',
  DefenseIncreaseWithEquippedShield: 'ancient.stat.shieldDefense',
  TwoHandedWeaponDamageIncrease: 'ancient.stat.twoHanded',
  AbilityRecoveryAbsolute: 'ancient.stat.agRecovery',
};

/** The number a stat line shows: chances and multipliers as percents. */
export function setOptionValue(option: SetOption): number {
  const [stat, value, multiplies] = option;
  if (multiplies) return Math.round((value - 1) * 100);
  const percent =
    stat.endsWith('Chance') || stat === 'DefenseIncreaseWithEquippedShield' || stat === 'TwoHandedWeaponDamageIncrease';
  // One OpenMU row writes a chance as 10 instead of 0.1 - it is still a percent.
  return percent && value <= 1 ? Math.round(value * 100) : value;
}
