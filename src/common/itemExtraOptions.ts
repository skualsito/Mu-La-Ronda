import type { TextKey } from '../i18n';

/**
 * Mu La Ronda: the Jewel of Harmony option and the socket options of an item,
 * read off the bytes OpenMU sends (ItemSerializer: byte 6 is the harmony
 * option - option number << 4 | level - on an item without sockets, the
 * socket bonus on one with; bytes 7-11 are the sockets, sphere level * 50 +
 * option index, 0xFE empty, 0xFF no socket). The tables are OpenMU's
 * (Persistence/Initialization/VersionSeasonSix/Items/HarmonyOptions.cs and
 * SocketSystem.cs); the server applies the same values when the item is worn.
 */

// ---- Jewel of Harmony ------------------------------------------------------

export type HarmonyKind = 'physical' | 'wizardry' | 'defense';

type HarmonyOption = {
  key: TextKey;
  /** The harmony level of the first value; lower levels give nothing. */
  minLevel: number;
  values: readonly number[];
  percent?: boolean;
};

const HARMONY: Record<HarmonyKind, Record<number, HarmonyOption>> = {
  physical: {
    1: { key: 'harmony.minDamage', minLevel: 0, values: [2, 3, 4, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 20] },
    2: { key: 'harmony.maxDamage', minLevel: 0, values: [3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20, 23, 26, 29] },
    3: { key: 'harmony.strengthRequirement', minLevel: 0, values: [6, 8, 10, 12, 14, 16, 20, 23, 26, 29, 32, 35, 37, 40] },
    4: { key: 'harmony.agilityRequirement', minLevel: 0, values: [6, 8, 10, 12, 14, 16, 20, 23, 26, 29, 32, 35, 37, 40] },
    5: { key: 'harmony.damage', minLevel: 6, values: [7, 8, 9, 11, 12, 14, 16, 19] },
    6: { key: 'harmony.criticalDamage', minLevel: 6, values: [12, 14, 16, 18, 20, 22, 24, 30] },
    7: { key: 'harmony.skillDamage', minLevel: 9, values: [12, 14, 16, 18, 22] },
    8: { key: 'harmony.attackRatePvp', minLevel: 9, values: [5, 7, 9, 11, 14] },
    9: { key: 'harmony.shieldDecrease', minLevel: 9, values: [3, 5, 7, 9, 10] },
    10: { key: 'harmony.shieldBypass', minLevel: 13, values: [10], percent: true },
  },
  wizardry: {
    1: { key: 'harmony.wizardry', minLevel: 0, values: [6, 8, 10, 12, 14, 16, 17, 18, 19, 21, 23, 25, 27, 31] },
    2: { key: 'harmony.strengthRequirement', minLevel: 0, values: [6, 8, 10, 12, 14, 16, 20, 23, 26, 29, 32, 35, 37, 40] },
    3: { key: 'harmony.agilityRequirement', minLevel: 0, values: [6, 8, 10, 12, 14, 16, 20, 23, 26, 29, 32, 35, 37, 40] },
    4: { key: 'harmony.skillDamage', minLevel: 6, values: [7, 10, 13, 16, 19, 22, 25, 30] },
    5: { key: 'harmony.criticalDamage', minLevel: 6, values: [10, 12, 14, 16, 18, 20, 22, 28] },
    6: { key: 'harmony.shieldDecrease', minLevel: 9, values: [4, 6, 8, 10, 13] },
    7: { key: 'harmony.attackRatePvp', minLevel: 9, values: [5, 7, 9, 11, 14] },
    8: { key: 'harmony.shieldBypass', minLevel: 13, values: [15], percent: true },
  },
  defense: {
    1: { key: 'harmony.defense', minLevel: 0, values: [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 25] },
    2: { key: 'harmony.maxAg', minLevel: 3, values: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25] },
    3: { key: 'harmony.maxHp', minLevel: 3, values: [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 30] },
    4: { key: 'harmony.hpRecovery', minLevel: 6, values: [1, 2, 3, 4, 5, 6, 7, 8] },
    5: { key: 'harmony.manaRecovery', minLevel: 9, values: [1, 2, 3, 4, 5] },
    6: { key: 'harmony.defenseRatePvp', minLevel: 9, values: [3, 4, 5, 6, 8] },
    7: { key: 'harmony.damageDecrease', minLevel: 9, values: [3, 4, 5, 6, 7], percent: true },
    8: { key: 'harmony.shieldRate', minLevel: 13, values: [5], percent: true },
  },
};

/** Which harmony table an item uses: staffs cast, other weapons hit, the rest defend. */
export function harmonyKindOf(group: number): HarmonyKind | null {
  if (group === 5) return 'wizardry';
  if (group >= 0 && group <= 4) return 'physical';
  if (group >= 6 && group <= 11) return 'defense';
  return null;
}

export type HarmonyLine = { key: TextKey; value: number; percent: boolean; level: number; active: boolean };

/** The item's harmony option from byte 6, or null without one. */
export function harmonyOf(group: number, byte6: number): HarmonyLine | null {
  const number = byte6 >> 4;
  const level = byte6 & 0x0f;
  const kind = harmonyKindOf(group);
  if (!kind || number === 0) return null;
  const option = HARMONY[kind][number];
  if (!option) return null;
  const index = Math.min(level - option.minLevel, option.values.length - 1);
  // Below the option's first level the server finds no value and adds nothing.
  return {
    key: option.key,
    value: index >= 0 ? option.values[index] : option.values[0],
    percent: !!option.percent,
    level,
    active: index >= 0,
  };
}

/** The harmony levels an option gives something at, for the admin's picker. */
export function harmonyLevels(kind: HarmonyKind, number: number): number[] {
  const option = HARMONY[kind][number];
  if (!option) return [];
  return option.values.map((_, i) => option.minLevel + i);
}

// ---- Sockets ---------------------------------------------------------------

export type SocketElement = 'fire' | 'water' | 'ice' | 'wind' | 'lightning' | 'earth';

/** Where each element's options start in the socket byte (ItemSerializerHelper.SocketOptionIndexOffsets). */
const ELEMENT_OFFSETS: readonly [SocketElement, number][] = [
  ['fire', 0],
  ['water', 10],
  ['ice', 16],
  ['wind', 21],
  ['lightning', 29],
  ['earth', 36],
];

const SOCKET_OPTIONS: Record<SocketElement, readonly TextKey[]> = {
  fire: ['socket.fire0', 'socket.fire1', 'socket.fire2', 'socket.fire3', 'socket.fire4', 'socket.fire5'],
  water: ['socket.water0', 'socket.water1', 'socket.water2', 'socket.water3', 'socket.water4'],
  ice: ['socket.ice0', 'socket.ice1', 'socket.ice2', 'socket.ice3', 'socket.ice4'],
  wind: ['socket.wind0', 'socket.wind1', 'socket.wind2', 'socket.wind3', 'socket.wind4', 'socket.wind5'],
  lightning: ['socket.lightning0', 'socket.lightning1', 'socket.lightning2', 'socket.lightning3'],
  earth: ['socket.earth0'],
};

export const SOCKET_EMPTY = 0xfe;
const OPTIONS_PER_LEVEL = 50;

export type SocketLine =
  | { empty: true }
  | { empty: false; element: SocketElement; key: TextKey | null; level: number };

/** One socket byte, as sent: empty, or the element, option and sphere level. */
export function socketOf(byte: number): SocketLine {
  if (byte === SOCKET_EMPTY) return { empty: true };
  const level = Math.floor(byte / OPTIONS_PER_LEVEL);
  const index = byte % OPTIONS_PER_LEVEL;
  let element: SocketElement = 'fire';
  let start = 0;
  for (const [e, offset] of ELEMENT_OFFSETS) {
    if (index >= offset) {
      element = e;
      start = offset;
    }
  }
  return { empty: false, element, key: SOCKET_OPTIONS[element][index - start] ?? null, level };
}
