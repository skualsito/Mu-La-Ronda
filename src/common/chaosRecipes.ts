/**
 * Mu La Ronda: the Chaos Goblin's combinations as OpenMU checks them
 * (Persistence/Initialization/VersionSeasonSix/ChaosMixes.cs), so the window
 * can say which one the items in the tray are heading for and what is still
 * missing. Generated from that file; the three tickets (built by handler
 * classes there) are written out by hand.
 *
 * A requirement with no `items` takes any item that passes its level and
 * option checks (the wing's sacrifice, the item being upgraded).
 */

/** OpenMU item option types a requirement asks for. */
export type MixOption = 'Option' | 'Excellent' | 'AncientBonus' | 'Luck';

export type MixRequirement = {
  /** [group, number] of the items that count; empty = any item. */
  readonly items: readonly (readonly [number, number])[];
  readonly min: number;
  readonly max?: number;
  readonly minLevel?: number;
  readonly maxLevel?: number;
  readonly options?: readonly MixOption[];
};

export type MixRecipe = {
  readonly name: string;
  /** Fixed chance, or the base of a chance that grows with the items' value up to `maxSuccess`. */
  readonly success?: number;
  readonly maxSuccess?: number;
  /** Zen the combination costs, when it is fixed. */
  readonly money?: number;
  readonly requires: readonly MixRequirement[];
};

export const CHAOS_RECIPES: readonly MixRecipe[] = [
  {
    name: 'Chaos Weapon',
    requires: [
      { items: [], min: 1, minLevel: 4, options: ['Option'] },
      { items: [[12, 15]], min: 1 },
      { items: [[14, 13]], min: 0 },
      { items: [[14, 14]], min: 0 },
    ],
  },
  {
    name: 'Fruits', success: 90, money: 3000000,
    requires: [
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 22]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Dinorant', success: 70, money: 500000,
    requires: [
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 2]], min: 10, max: 10 },
    ],
  },
  {
    name: 'Potion of Bless', success: 100, money: 100000,
    requires: [
      { items: [[14, 13]], min: 1 },
    ],
  },
  {
    name: 'Potion of Soul', success: 100, money: 50000,
    requires: [
      { items: [[14, 14]], min: 1 },
    ],
  },
  {
    name: '+10 Item Combination', success: 60, money: 2000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 9, maxLevel: 9 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 1 },
      { items: [[14, 14]], min: 1 },
    ],
  },
  {
    name: '+11 Item Combination', success: 57, money: 4000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 10, maxLevel: 10 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 2 },
      { items: [[14, 14]], min: 2 },
    ],
  },
  {
    name: '+12 Item Combination', success: 55, money: 6000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 11, maxLevel: 11 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 3 },
      { items: [[14, 14]], min: 3 },
    ],
  },
  {
    name: '+13 Item Combination', success: 52, money: 8000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 12, maxLevel: 12 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 4 },
      { items: [[14, 14]], min: 4 },
    ],
  },
  {
    name: '+14 Item Combination', success: 50, money: 10000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 13, maxLevel: 13 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 5 },
      { items: [[14, 14]], min: 5 },
    ],
  },
  {
    name: '+15 Item Combination', success: 47, money: 12000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 14, maxLevel: 14 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 6 },
      { items: [[14, 14]], min: 6 },
    ],
  },
  {
    name: 'Blood Castle Ticket',
    requires: [
      { items: [[13, 16]], min: 1, max: 1 },
      { items: [[13, 17]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: "Devil's Square Ticket",
    requires: [
      { items: [[14, 17]], min: 1, max: 1 },
      { items: [[14, 18]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Illusion Temple Ticket',
    requires: [
      { items: [[13, 49]], min: 1, max: 1 },
      { items: [[13, 50]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Life Stone', success: 100, money: 5000000,
    requires: [
      { items: [[14, 31]], min: 1, max: 1 },
      { items: [[14, 13]], min: 5, max: 5 },
      { items: [[14, 14]], min: 5, max: 5 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Small Shield Potion', success: 50, money: 100000,
    requires: [
      { items: [[14, 3]], min: 3, max: 3 },
    ],
  },
  {
    name: 'Medium Shield Potion', success: 30, money: 500000,
    requires: [
      { items: [[14, 38]], min: 3, max: 3, maxLevel: 1 },
    ],
  },
  {
    name: 'Large Shield Potion', success: 30, money: 1000000,
    requires: [
      { items: [[14, 39]], min: 3, max: 3, maxLevel: 1 },
    ],
  },
  {
    name: 'Fenrir Stage 1', success: 70,
    requires: [
      { items: [[13, 33]], min: 20, max: 20 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 32]], min: 20, max: 20 },
    ],
  },
  {
    name: 'Fenrir Stage 2', success: 50,
    requires: [
      { items: [[13, 35]], min: 5, max: 5 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 34]], min: 10, max: 10 },
    ],
  },
  {
    name: 'Fenrir Stage 3', success: 30, money: 10000000,
    requires: [
      { items: [[13, 36]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 16]], min: 3, max: 3 },
    ],
  },
  {
    name: '1st Level Wings',
    requires: [
      { items: [[4, 6], [2, 6], [5, 7]], min: 1, max: 1, minLevel: 4, options: ['Option'] },
      { items: [], min: 0, minLevel: 4, options: ['Option'] },
      { items: [[12, 15]], min: 1 },
      { items: [[14, 13]], min: 0 },
      { items: [[14, 14]], min: 0 },
    ],
  },
  {
    name: 'Cape of Lord/Fighter', maxSuccess: 90, money: 5000000,
    requires: [
      { items: [[12, 0], [12, 1], [12, 2], [12, 41]], min: 1, max: 1 },
      { items: [], min: 0, minLevel: 4, options: ['Excellent'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 14]], min: 1, max: 1, minLevel: 1, maxLevel: 1 },
    ],
  },
  {
    name: '2nd Level Wings', maxSuccess: 90, money: 5000000,
    requires: [
      { items: [[12, 0], [12, 1], [12, 2], [12, 41]], min: 1, max: 1 },
      { items: [], min: 0, minLevel: 4, options: ['Excellent'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 14]], min: 1, max: 1 },
    ],
  },
  {
    name: '3rd Level Wings, Stage 1', success: 1, maxSuccess: 60,
    requires: [
      { items: [[12, 3], [12, 4], [12, 5], [12, 6], [12, 42], [12, 49], [13, 30]], min: 1, max: 1, minLevel: 9, options: ['Option'] },
      { items: [], min: 1, minLevel: 7, options: ['AncientBonus', 'Option'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 22]], min: 1, max: 1 },
      { items: [[12, 31]], min: 1, max: 1 },
    ],
  },
  {
    name: '3rd Level Wings, Stage 2', success: 1, maxSuccess: 40,
    requires: [
      { items: [], min: 1, minLevel: 9, options: ['Excellent', 'Option'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 22]], min: 1, max: 1 },
      { items: [[12, 31]], min: 1, max: 1 },
      { items: [[12, 30]], min: 1, max: 1 },
      { items: [[13, 53]], min: 1, max: 1 },
      { items: [[13, 52]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Guardian Option (Level 380)', money: 10000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 4, maxLevel: 6, options: ['Option'] },
      { items: [], min: 1, max: 1, minLevel: 7, maxLevel: 9, options: ['Option'] },
      { items: [], min: 1, max: 1, minLevel: 10, options: ['Option'] },
      { items: [[14, 42]], min: 1, max: 1 },
      { items: [[14, 31]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Complete Secromicon', success: 100, money: 1000000,
    requires: [
      { items: [[14, 103]], min: 1, max: 1 },
    ],
  },
];
