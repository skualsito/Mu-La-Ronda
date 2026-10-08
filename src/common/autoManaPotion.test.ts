import { expect, test } from 'vitest';
import { manaPotionSlot, needsMana } from './autoManaPotion';

const potion = (num: number) => ({ group: 14, num });

test('drinks only with the mana nearly gone', () => {
  expect(needsMana(5, 100)).toBe(true);
  expect(needsMana(10, 100)).toBe(false);
  expect(needsMana(0, 0)).toBe(false);
});

test('takes the biggest mana potion, a complex one only without plain ones', () => {
  const bag = [potion(4), null, potion(1), potion(6), potion(40), potion(5)];
  expect(manaPotionSlot(bag, 0)).toBe(3);
  expect(manaPotionSlot([potion(1), potion(39), potion(38)], 0)).toBe(1);
  // Health potions never count.
  expect(manaPotionSlot([potion(1), potion(3)], 0)).toBe(-1);
  // The equipped slots are skipped.
  expect(manaPotionSlot([potion(6), potion(4)], 1)).toBe(1);
});
