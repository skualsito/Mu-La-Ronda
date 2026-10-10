import type { TextKey } from '../i18n';

/**
 * Mu La Ronda: what a pair of wings (and the Lord's and Fighter's capes) carry
 * besides their own damage and absorb - as OpenMU defines and sends them
 * (`VersionSeasonSix/Items/Wings.cs`, ItemSerializer):
 *
 * - The wing options, one bit each in the excellent byte (`1 << (number - 1)`):
 *   max HP / max mana / ignore defense on the second wings, ignore defense /
 *   return damage / full HP / full mana on the third, and command on the
 *   Cape of Lord. They were read as excellent options and shown as nothing
 *   (excellent lines are for weapons and armour), so wings given every option
 *   read "option and luck" and no more.
 * - Which kind the +4-a-level option is (`(byte3 >> 4) & 3`): a wing may carry
 *   damage, wizardry, curse, defense or HP recovery there, and it always read
 *   "Additional Defense".
 */

export type WingOptionKind = 'damage' | 'wizardry' | 'curse' | 'defense' | 'hpRecovery';

const key = (group: number, index: number) => `${group}/${index}`;

/** The kinds of the additional option, by its number (0, 2, 3), per item. */
const OPTION_KINDS: Record<string, Partial<Record<number, WingOptionKind>>> = {
  [key(12, 0)]: { 0: 'hpRecovery' }, // Wings of Elf
  [key(12, 1)]: { 0: 'wizardry' }, // Wings of Heaven
  [key(12, 2)]: { 0: 'damage' }, // Wings of Satan
  [key(12, 41)]: { 0: 'wizardry' }, // Wings of Curse
  [key(12, 3)]: { 0: 'damage', 2: 'hpRecovery' }, // Wings of Spirits
  [key(12, 4)]: { 0: 'hpRecovery', 2: 'wizardry' }, // Wings of Soul
  [key(12, 5)]: { 0: 'hpRecovery', 2: 'damage' }, // Wings of Dragon
  [key(12, 6)]: { 0: 'wizardry', 2: 'damage' }, // Wings of Darkness
  [key(12, 42)]: { 0: 'curse', 2: 'wizardry' }, // Wings of Despair
  [key(12, 49)]: { 0: 'hpRecovery', 2: 'damage' }, // Cape of Fighter
  [key(13, 30)]: { 0: 'damage' }, // Cape of Lord
  [key(12, 36)]: { 0: 'hpRecovery', 2: 'defense', 3: 'damage' }, // Wing of Storm
  [key(12, 37)]: { 0: 'hpRecovery', 2: 'defense', 3: 'wizardry' }, // Wing of Eternal
  [key(12, 38)]: { 0: 'hpRecovery', 2: 'defense', 3: 'damage' }, // Wing of Illusion
  [key(12, 39)]: { 0: 'hpRecovery', 2: 'wizardry', 3: 'damage' }, // Wing of Ruin
  [key(12, 40)]: { 0: 'hpRecovery', 2: 'defense', 3: 'damage' }, // Cape of Emperor
  [key(12, 43)]: { 0: 'hpRecovery', 2: 'curse', 3: 'wizardry' }, // Wing of Dimension
  [key(12, 50)]: { 0: 'hpRecovery', 2: 'defense', 3: 'damage' }, // Cape of Overrule
};

const SECOND = new Set([key(12, 3), key(12, 4), key(12, 5), key(12, 6), key(12, 42), key(12, 49), key(13, 30)]);
const THIRD = new Set([key(12, 36), key(12, 37), key(12, 38), key(12, 39), key(12, 40), key(12, 43), key(12, 50)]);

/** Wings (and capes) whose excellent byte carries wing options and the option's kind, not excellent options. */
export function isOptionWing(group: number, index: number): boolean {
  return key(group, index) in OPTION_KINDS;
}

/** The kind of the item's additional option; damage when the item has no table entry. */
export function wingOptionKind(group: number, index: number, kind: number): WingOptionKind {
  return OPTION_KINDS[key(group, index)]?.[kind] ?? OPTION_KINDS[key(group, index)]?.[0] ?? 'damage';
}

export type WingOptionLine = { key: TextKey; value: number };

/** The wing option lines of an item, in bit order, with their values at the item's level. */
export function wingOptionLines(group: number, index: number, flags: number, level: number): WingOptionLine[] {
  const id = key(group, index);
  const lines: WingOptionLine[] = [];
  if (SECOND.has(id)) {
    if (flags & 0x01) lines.push({ key: 'item.wing.maxHp', value: 50 + level * 5 });
    if (flags & 0x02) lines.push({ key: 'item.wing.maxMana', value: 50 + level * 5 });
    if (flags & 0x04) lines.push({ key: 'item.wing.ignoreDefense', value: 3 });
    if (flags & 0x08 && group === 13) lines.push({ key: 'item.wing.command', value: 10 + level * 5 });
  } else if (THIRD.has(id)) {
    if (flags & 0x01) lines.push({ key: 'item.wing.ignoreDefense', value: 5 });
    if (flags & 0x02) lines.push({ key: 'item.wing.returnDamage', value: 5 });
    if (flags & 0x04) lines.push({ key: 'item.wing.fullLife', value: 5 });
    if (flags & 0x08) lines.push({ key: 'item.wing.fullMana', value: 5 });
  }
  return lines;
}
