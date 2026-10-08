import { reaction } from 'mobx';
import { InventoryConstants } from './inventoryConstants';

/**
 * Mu La Ronda: running out of mana drinks a mana potion by itself, as long as
 * there is one in the bag - mana only; health stays the player's (or the
 * helper's) call. The biggest mana potion goes first, a complex potion
 * (which also fills mana) only when there is no plain one.
 */

/** Below this share of the maximum, one potion is drunk. */
export const MANA_SHARE = 0.1;
/** At most one potion this often, ms (the server's own potion cooldown is close to it). */
const COOLDOWN_MS = 1000;

type Bag = readonly ({ group: number; num: number } | null)[];

/** The slot of the potion to drink for mana, or -1: Large/Medium/Small Mana Potion, then a complex one. */
export function manaPotionSlot(items: Bag, firstBagSlot: number): number {
  let best = -1;
  let bestRank = -1;
  for (let slot = firstBagSlot; slot < items.length; slot++) {
    const item = items[slot];
    if (!item || item.group !== 14) continue;
    // 14/4..6 Small, Medium, Large Mana Potion; 14/38..40 the complex ones.
    const rank = item.num >= 4 && item.num <= 6 ? 10 + item.num : item.num >= 38 && item.num <= 40 ? item.num - 38 : -1;
    if (rank > bestRank) {
      bestRank = rank;
      best = slot;
    }
  }
  return best;
}

/** Whether `mana` of `max` is low enough to drink. */
export function needsMana(mana: number, max: number): boolean {
  return max > 0 && mana < max * MANA_SHARE;
}

let installed = false;
let lastDrink = 0;

/** What the watcher reads off the store (passed in, so this module stays importable on its own). */
type HeroStore = {
  playerData: { currentMP: number; maxMP: number; currentHP: number; items: Bag };
  world: { playerEntity?: unknown } | null;
  consumeItemRequest(slot: number): void;
};

/** Starts watching the hero's mana (boot). */
export function installAutoManaPotion(Store: HeroStore): void {
  if (installed) return;
  installed = true;
  reaction(
    () => [Store.playerData.currentMP, Store.playerData.maxMP] as const,
    ([mana, max]) => {
      if (!needsMana(mana, max)) return;
      if (!Store.world?.playerEntity || Store.playerData.currentHP <= 0) return;
      const now = performance.now();
      if (now - lastDrink < COOLDOWN_MS) return;
      const slot = manaPotionSlot(Store.playerData.items, InventoryConstants.EquippableSlotsCount);
      if (slot < 0) return;
      lastDrink = now;
      Store.consumeItemRequest(slot);
    }
  );
}
