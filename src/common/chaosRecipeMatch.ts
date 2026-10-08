import type { Item } from '../ecs/world';
import { CHAOS_RECIPES, type MixRecipe, type MixRequirement } from './chaosRecipes';

/**
 * Mu La Ronda: which Chaos Goblin combination the tray is heading for, and
 * how far along it is - the original's mix recipe panel (`CMixRecipeMgr`),
 * read from OpenMU's own recipes (`chaosRecipes.ts`) so it says what the
 * server will actually check.
 */

const JEWEL_OF_CHAOS: readonly [number, number] = [12, 15];

export type RequirementState = {
  readonly requirement: MixRequirement;
  /** Tray items counted for it. */
  readonly have: number;
  /** Within its minimum and maximum. */
  readonly ok: boolean;
};

export type RecipeMatch = {
  readonly recipe: MixRecipe;
  readonly requirements: readonly RequirementState[];
  /** Tray items no requirement took. */
  readonly extra: number;
  /** Every requirement met and nothing left over. */
  readonly complete: boolean;
};

function passes(item: Item, requirement: MixRequirement): boolean {
  const level = item.lvl ?? 0;
  if (level < (requirement.minLevel ?? 0) || level > (requirement.maxLevel ?? 15)) return false;
  for (const option of requirement.options ?? []) {
    if (option === 'Option' && !(item.optionLevel ?? 0)) return false;
    if (option === 'Excellent' && !item.isExcellent) return false;
    if (option === 'AncientBonus' && !item.isAncient) return false;
    if (option === 'Luck' && !item.luck) return false;
  }
  return true;
}

const listed = (item: Item, requirement: MixRequirement) =>
  requirement.items.some(([group, num]) => group === item.group && num === item.num);

/** The tray against one recipe: named items first, then "any item" requirements take what is left. */
export function matchRecipe(recipe: MixRecipe, tray: readonly (Item | null)[]): RecipeMatch {
  let left = tray.filter((item): item is Item => !!item);
  const have = new Map<MixRequirement, number>();

  for (const pass of ['listed', 'any'] as const) {
    for (const requirement of recipe.requires) {
      if ((requirement.items.length > 0) !== (pass === 'listed')) continue;
      const taken = left.filter(
        item => (pass === 'any' || listed(item, requirement)) && passes(item, requirement)
      );
      const limit = requirement.max ?? Infinity;
      const used = taken.slice(0, limit);
      have.set(requirement, used.length);
      left = left.filter(item => !used.includes(item));
    }
  }

  const requirements = recipe.requires.map(requirement => {
    const count = have.get(requirement) ?? 0;
    return { requirement, have: count, ok: count >= requirement.min && count <= (requirement.max ?? Infinity) };
  });
  return {
    recipe,
    requirements,
    extra: left.length,
    complete: left.length === 0 && requirements.every(r => r.ok),
  };
}

/**
 * A requirement only the Jewel of Chaos fills says nothing: most recipes take
 * one. Nor does one the recipe can do without (`min` 0): Chaos Weapon takes
 * Bless and Soul if they are there, and a +9 item with Chaos, Bless and Soul
 * - the +10 combination - read as a Chaos Weapon.
 */
function telling(state: RequirementState): boolean {
  if (state.requirement.min === 0) return false;
  const { items } = state.requirement;
  const onlyChaos = items.length === 1 && items[0][0] === JEWEL_OF_CHAOS[0] && items[0][1] === JEWEL_OF_CHAOS[1];
  return state.have > 0 && !onlyChaos;
}

/**
 * The recipe the tray looks most like, or null while nothing in it points to
 * one (empty, or a lone Jewel of Chaos). A tray that already satisfies a
 * recipe gets the one the server will make: of those it satisfies, the one
 * with the highest crafting number (`MixRecipe.number`).
 */
export function bestRecipe(tray: readonly (Item | null)[]): RecipeMatch | null {
  let complete: RecipeMatch | null = null;
  for (const recipe of CHAOS_RECIPES) {
    const match = matchRecipe(recipe, tray);
    if (match.complete && (!complete || recipe.number > complete.recipe.number)) complete = match;
  }
  if (complete) return complete;

  let best: RecipeMatch | null = null;
  let bestScore = 0;
  for (const recipe of CHAOS_RECIPES) {
    const match = matchRecipe(recipe, tray);
    const hits = match.requirements.filter(telling).length;
    if (!hits) continue;
    const met = match.requirements.filter(r => r.ok).length;
    const missing = match.requirements.length - met;
    const score = hits * 10 + met * 3 - missing - match.extra * 4;
    if (!best || score > bestScore || (score === bestScore && recipe.number > best.recipe.number)) {
      best = match;
      bestScore = score;
    }
  }
  return best;
}
