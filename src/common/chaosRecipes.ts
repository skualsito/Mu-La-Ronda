import type { TextKey } from '../i18n';

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

/** The level 380 items: the only ones the Guardian option goes on. */
const ITEMS_380: readonly (readonly [number, number])[] = [[0,22],[0,23],[0,35],[2,14],[4,21],[5,12],[5,19],[7,29],[7,30],[7,31],[7,33],[7,43],[7,73],[8,29],[8,30],[8,31],[8,32],[8,33],[8,43],[8,73],[9,29],[9,30],[9,31],[9,32],[9,33],[9,43],[9,73],[10,29],[10,30],[10,31],[10,32],[10,33],[10,43],[11,29],[11,30],[11,31],[11,32],[11,33],[11,43],[11,73]];

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
  /** Mu La Ronda: what the recipe panel calls it, instead of naming the items. */
  readonly labelKey?: TextKey;
};

export type MixRecipe = {
  readonly name: string;
  /**
   * OpenMU's crafting number. With no recipe named in the request the server
   * tries its combinations from the highest number down and takes the first
   * the tray satisfies (ItemCraftAction.FindAppropriateCraftingByItems).
   */
  readonly number: number;
  /** Fixed chance, or the base of a chance that grows with the items' value up to `maxSuccess`. */
  readonly success?: number;
  readonly maxSuccess?: number;
  /** Zen the combination costs, when it is fixed. */
  readonly money?: number;
  readonly requires: readonly MixRequirement[];
};

export const CHAOS_RECIPES: readonly MixRecipe[] = [
  {
    name: 'Chaos Weapon', number: 1,
    requires: [
      // Mu La Ronda: up to +8 (deploy/config/28-chaos-weapon-max-level.sql) - a +10 item
      // short of jewels for +11 was being turned into a chaos weapon.
      { items: [], min: 1, minLevel: 4, maxLevel: 8, options: ['Option'] },
      { items: [[12, 15]], min: 1 },
      { items: [[14, 13]], min: 0 },
      { items: [[14, 14]], min: 0 },
    ],
  },
  {
    name: 'Fruits', number: 6, success: 90, money: 3000000,
    requires: [
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 22]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Dinorant', number: 5, success: 70, money: 500000,
    requires: [
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 2]], min: 10, max: 10 },
    ],
  },
  {
    name: 'Potion of Bless', number: 15, success: 100, money: 100000,
    requires: [
      { items: [[14, 13]], min: 1 },
    ],
  },
  {
    name: 'Potion of Soul', number: 16, success: 100, money: 50000,
    requires: [
      { items: [[14, 14]], min: 1 },
    ],
  },
  {
    name: '+10 Item Combination', number: 3, success: 60, money: 2000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 9, maxLevel: 9 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 1 },
      { items: [[14, 14]], min: 1 },
    ],
  },
  {
    name: '+11 Item Combination', number: 4, success: 57, money: 4000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 10, maxLevel: 10 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 2 },
      { items: [[14, 14]], min: 2 },
    ],
  },
  {
    name: '+12 Item Combination', number: 22, success: 55, money: 6000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 11, maxLevel: 11 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 3 },
      { items: [[14, 14]], min: 3 },
    ],
  },
  {
    name: '+13 Item Combination', number: 23, success: 52, money: 8000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 12, maxLevel: 12 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 4 },
      { items: [[14, 14]], min: 4 },
    ],
  },
  {
    name: '+14 Item Combination', number: 49, success: 50, money: 10000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 13, maxLevel: 13 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 5 },
      { items: [[14, 14]], min: 5 },
    ],
  },
  {
    name: '+15 Item Combination', number: 50, success: 47, money: 12000000,
    requires: [
      { items: [], min: 1, max: 1, minLevel: 14, maxLevel: 14 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 13]], min: 6 },
      { items: [[14, 14]], min: 6 },
    ],
  },
  {
    name: 'Blood Castle Ticket', number: 8,
    requires: [
      { items: [[13, 16]], min: 1, max: 1 },
      { items: [[13, 17]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: "Devil's Square Ticket", number: 2,
    requires: [
      { items: [[14, 17]], min: 1, max: 1 },
      { items: [[14, 18]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Illusion Temple Ticket', number: 37,
    requires: [
      { items: [[13, 49]], min: 1, max: 1 },
      { items: [[13, 50]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Life Stone', number: 17, success: 100, money: 5000000,
    requires: [
      { items: [[14, 31]], min: 1, max: 1 },
      { items: [[14, 13]], min: 5, max: 5 },
      { items: [[14, 14]], min: 5, max: 5 },
      { items: [[12, 15]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Small Shield Potion', number: 30, success: 50, money: 100000,
    requires: [
      { items: [[14, 3]], min: 3, max: 3 },
    ],
  },
  {
    name: 'Medium Shield Potion', number: 31, success: 30, money: 500000,
    requires: [
      { items: [[14, 38]], min: 3, max: 3, maxLevel: 1 },
    ],
  },
  {
    name: 'Large Shield Potion', number: 32, success: 30, money: 1000000,
    requires: [
      { items: [[14, 39]], min: 3, max: 3, maxLevel: 1 },
    ],
  },
  {
    name: 'Fenrir Stage 1', number: 25, success: 70,
    requires: [
      { items: [[13, 33]], min: 20, max: 20 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 32]], min: 20, max: 20 },
    ],
  },
  {
    name: 'Fenrir Stage 2', number: 26, success: 50,
    requires: [
      { items: [[13, 35]], min: 5, max: 5 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 34]], min: 10, max: 10 },
    ],
  },
  {
    name: 'Fenrir Stage 3', number: 27, success: 30, money: 10000000,
    requires: [
      { items: [[13, 36]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 16]], min: 3, max: 3 },
    ],
  },
  {
    // Mu La Ronda: the black (weapon), blue (armour) or gold (excellent +11) Fenrir
    // (marketplace/openmu FenrirUpgradeCrafting.cs).
    name: 'Fenrir Upgrade', number: 28, money: 10000000,
    requires: [
      { items: [[13, 37]], min: 1, max: 1 },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 16]], min: 5, max: 5 },
      { items: [], min: 1, max: 1, minLevel: 4, options: ['Option'] },
    ],
  },
  {
    name: '1st Level Wings', number: 11,
    requires: [
      { items: [[4, 6], [2, 6], [5, 7]], min: 1, max: 1, minLevel: 4, options: ['Option'] },
      { items: [], min: 0, minLevel: 4, options: ['Option'] },
      { items: [[12, 15]], min: 1 },
      { items: [[14, 13]], min: 0 },
      { items: [[14, 14]], min: 0 },
    ],
  },
  {
    name: 'Cape of Lord/Fighter', number: 24, maxSuccess: 90, money: 5000000,
    requires: [
      { items: [[12, 0], [12, 1], [12, 2], [12, 41]], min: 1, max: 1 },
      { items: [], min: 0, minLevel: 4, options: ['Excellent'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 14]], min: 1, max: 1, minLevel: 1, maxLevel: 1 },
    ],
  },
  {
    name: '2nd Level Wings', number: 7, maxSuccess: 90, money: 5000000,
    requires: [
      { items: [[12, 0], [12, 1], [12, 2], [12, 41]], min: 1, max: 1 },
      { items: [], min: 0, minLevel: 4, options: ['Excellent'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[13, 14]], min: 1, max: 1 },
    ],
  },
  {
    name: '3rd Level Wings, Stage 1', number: 38, success: 1, maxSuccess: 60,
    requires: [
      { items: [[12, 3], [12, 4], [12, 5], [12, 6], [12, 42], [12, 49], [13, 30]], min: 1, max: 1, minLevel: 9, options: ['Option'] },
      { items: [], min: 1, minLevel: 7, options: ['AncientBonus', 'Option'] },
      { items: [[12, 15]], min: 1, max: 1 },
      { items: [[14, 22]], min: 1, max: 1 },
      { items: [[12, 31]], min: 1, max: 1 },
    ],
  },
  {
    name: '3rd Level Wings, Stage 2', number: 39, success: 1, maxSuccess: 40,
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
    // Mu La Ronda: ONE item, +4 or more with an option - the server's three
    // requirements (+4~6, +7~9, +10~15, 50/60/70 %) are alternatives, and a
    // second one is refused (GuardianOptionCrafting: TooManyItems). Only the
    // level 380 items take the option (the ones with a Guardian option in
    // their PossibleItemOptions).
    name: 'Guardian Option (Level 380)', number: 36, money: 10000000,
    requires: [
      { items: ITEMS_380, min: 1, max: 1, minLevel: 4, options: ['Option'], labelKey: 'chaos.item380' },
      { items: [[14, 42]], min: 1, max: 1 },
      { items: [[14, 31]], min: 1, max: 1 },
    ],
  },
  {
    name: 'Complete Secromicon', number: 46, success: 100, money: 1000000,
    requires: [
      { items: [[14, 103]], min: 1, max: 1 },
    ],
  },
];
