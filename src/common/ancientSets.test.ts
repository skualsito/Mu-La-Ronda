import { expect, test } from 'vitest';
import { ANCIENT_SETS, ancientSetOf, setOptionActive, setOptionValue, wornPiecesOf } from './ancientSets';

test('Legendary Gloves belong to their two sets', () => {
  // Legendary is item number 1 of the armour groups; gloves are group 10.
  expect(ancientSetOf(10, 1, 1)?.set.name).toBeTruthy();
  expect(ancientSetOf(10, 1, 9)).toBeNull();
});

test('options follow ItemPowerUpFactory: n-1 of them with n pieces, all with the full set', () => {
  const set = ANCIENT_SETS.find(s => s.items.length >= 4)!;
  expect(setOptionActive(set, 0, 1)).toBe(false);
  expect(setOptionActive(set, 0, 2)).toBe(true);
  expect(setOptionActive(set, 1, 2)).toBe(false);
  expect(setOptionActive(set, set.options.length - 1, set.items.length)).toBe(true);
});

test('pieces count distinct items of the same set only', () => {
  const set = ancientSetOf(10, 1, 1)!.set;
  const [g, n, d] = set.items[0];
  const piece = { group: g, num: n, isAncient: true, ancientDiscriminator: d };
  expect(wornPiecesOf(set, [piece, piece, null, { group: g, num: n }])).toBe(1);
});

test('chances and multipliers read as percents', () => {
  expect(setOptionValue(['CriticalDamageChance', 0.05])).toBe(5);
  expect(setOptionValue(['WizardryBaseDmgIncrease', 1.1, true])).toBe(10);
  expect(setOptionValue(['TotalStrength', 25])).toBe(25);
});
