/**
 * Items that are another item at some level: the Box of Kundun +1 is a Box of Luck +8, the
 * Firecracker a Box of Luck +2 (the client's src/common/itemLevelLook.ts). OpenMU has one
 * definition for all of them, named after level 0, so searching "Kundun" found nothing.
 * The item searches look these names up too, and answer with the definition and its level.
 */

export type ItemAlias = { group: number; number: number; level: number; name: string };

const BOX_OF_LUCK: [number, string][] = [
  [1, 'Star of Sacred Birth'],
  [2, 'Firecracker'],
  [3, 'Heart of Love'],
  [5, 'Silver Medal'],
  [6, 'Gold Medal'],
  [7, 'Box of Heaven'],
  [8, 'Box of Kundun +1'],
  [9, 'Box of Kundun +2'],
  [10, 'Box of Kundun +3'],
  [11, 'Box of Kundun +4'],
  [12, 'Box of Kundun +5'],
  [13, 'Heart of Dark Lord'],
];

export const ITEM_ALIASES: readonly ItemAlias[] = BOX_OF_LUCK.map(([level, name]) => ({ group: 14, number: 11, level, name }));

/** The aliases whose name holds `q` (case-insensitive). */
export function aliasesMatching(q: string): ItemAlias[] {
  const needle = q.trim().toLowerCase();
  return needle ? ITEM_ALIASES.filter(a => a.name.toLowerCase().includes(needle)) : [];
}

/** The item's own name at that level, or null when it has none. */
export function aliasName(group: number, number: number, level: number): string | null {
  return ITEM_ALIASES.find(a => a.group === group && a.number === number && a.level === level)?.name ?? null;
}
