import type { Item } from '../ecs/world';

/**
 * Mu La Ronda: the Fenrir materials are one piece each in the original, but
 * OpenMU gives them a stack size (their `ItemDefinition.Durability`: 20, 20
 * and 10) and stacks them like potions, the durability byte holding the
 * number of pieces. The server's mix counts the pieces
 * (`SimpleItemCraftingHandler`: `IsStackable() ? Durability : 1`), so the
 * tooltip and the chaos machine's recipe list must too.
 */
const STACKED_MATERIALS: ReadonlyMap<string, number> = new Map([
  ['13/32', 20], // Splinter of Armor
  ['13/33', 20], // Bless of Guardian
  ['13/34', 10], // Claw of Beast
]);

const keyOf = (item: Pick<Item, 'group' | 'num'>) => `${item.group}/${item.num}`;

/** Whether this item is one of the stacked materials. */
export function isStackedMaterial(item: Pick<Item, 'group' | 'num'>): boolean {
  return STACKED_MATERIALS.has(keyOf(item));
}

/** How many pieces the item stands for: its stack for a stacked material, else 1. */
export function piecesOf(item: Pick<Item, 'group' | 'num' | 'durability'>): number {
  return isStackedMaterial(item) ? Math.max(1, item.durability ?? 1) : 1;
}
