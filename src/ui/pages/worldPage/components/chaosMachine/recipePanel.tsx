import { observer } from 'mobx-react-lite';
import { t } from '../../../../../i18n';
import { Economy, MIX_MENU } from '../../../../../economy';
import { itemBaseName } from '../../../../../common/itemsDatabase';
import { bestRecipe, matchRecipe, type RecipeMatch, type RequirementState } from '../../../../../common/chaosRecipeMatch';
import { CHAOS_RECIPES, type MixRecipe, type MixRequirement } from '../../../../../common/chaosRecipes';
import { CHAOS_RATES } from '../../../../../common/chaosRates';
import { MENU_HEIGHT, MENU_WIDTH, MENU_X, MENU_Y } from './layout';

/** How many item names one line lists before "or others". */
const NAMES_SHOWN = 2;

function requirementLabel(requirement: MixRequirement): string {
  let label: string;
  if (requirement.items.length) {
    const names = requirement.items.slice(0, NAMES_SHOWN).map(([group, index]) => itemBaseName(group, index));
    label = names.join(' / ');
    if (requirement.items.length > NAMES_SHOWN) label += ` ${t('chaos.orOthers')}`;
  } else {
    const options = requirement.options ?? [];
    label = options.includes('Excellent')
      ? t('chaos.excellentItem')
      : options.includes('AncientBonus')
        ? t('chaos.ancientItem')
        : t('chaos.anyItem');
  }

  const min = requirement.minLevel ?? 0;
  const max = requirement.maxLevel ?? 15;
  if (min > 0) label += max < 15 && max !== min ? ` +${min}~${max}` : ` +${min}`;
  if (!requirement.items.length && requirement.options?.includes('Option')) label += ` ${t('chaos.withOption')}`;
  return label;
}

function countText(state: RequirementState): string {
  const { min, max } = state.requirement;
  if (min === 0) return t('chaos.optional');
  return `${state.have}/${max !== undefined && max !== min ? `${min}-${max}` : min}`;
}

const zen = (value: number) => value.toLocaleString('es-AR');

/** Mu La Ronda: the recipe's name in the player's language (the old mix menu's labels). */
function recipeName(recipe: MixRecipe): string {
  const entry = MIX_MENU.find(e => (e.type as number) === recipe.number);
  if (entry) return t(entry.labelKey);
  // The recipes the old menu never listed: named here, or after what they make.
  switch (recipe.number) {
    case 15: return t('chaos.recipePotionBless');
    case 16: return t('chaos.recipePotionSoul');
    case 17: return t('chaos.recipeLifeStone');
    case 30: return itemBaseName(14, 35);
    case 31: return itemBaseName(14, 36);
    case 32: return itemBaseName(14, 37);
    default: return recipe.name;
  }
}

/** The chance line: the server's table when the recipe is in it, else OpenMU's own. */
function chanceLine(recipe: MixRecipe): string | null {
  const rate = CHAOS_RATES[recipe.number];
  if (rate?.kind === 'luck') return t('chaos.rateLuck', { normal: rate.normal, luck: rate.luck, vip: rate.vipLuck });
  if (rate?.kind === 'vip') return t('chaos.rateVip', { normal: rate.normal, vip: rate.vip });
  if (recipe.success === undefined) return null;
  return recipe.maxSuccess
    ? t('chaos.successUpTo', { value: recipe.maxSuccess })
    : t('chaos.successRate', { value: recipe.success });
}

/** The recipes in the order of the old mix menu, then any it did not list. */
function listedRecipes(): MixRecipe[] {
  const order = new Map(MIX_MENU.map((e, i) => [e.type as number, i]));
  return [...CHAOS_RECIPES].sort((a, b) => (order.get(a.number) ?? 999) - (order.get(b.number) ?? 999));
}

const Detail = ({ match, picked }: { match: RecipeMatch; picked: boolean }) => {
  const { recipe } = match;
  const chance = chanceLine(recipe);
  return (
    <>
      {picked && (
        <div className="back" onClick={() => Economy.pickMixRecipe(null)}>
          {t('chaos.backToList')}
        </div>
      )}
      <div className="title">{t('chaos.recipe', { name: recipeName(recipe) })}</div>
      {match.requirements.map((state, i) => (
        <div key={i} className={state.ok ? 'ok' : 'missing'}>
          <span className="count">{countText(state)}</span> {requirementLabel(state.requirement)}
        </div>
      ))}
      {match.extra > 0 && <div className="missing">{t('chaos.extraItems', { count: match.extra })}</div>}
      {chance && <div className="info">{chance}</div>}
      {recipe.money ? <div className="info">{t('chaos.cost', { zen: zen(recipe.money) })}</div> : null}
      {match.complete && <div className="ready">{t('chaos.recipeReady')}</div>}
    </>
  );
};

/**
 * Mu La Ronda: under the grid where the original lists it. With nothing in the
 * tray, the list of everything the goblin makes; a click on one shows what it
 * takes. With items in, the recipe they are heading for (or the picked one) -
 * every requirement with how many of it are in, met ones green and missing ones
 * red, then the chance and the cost.
 */
export const RecipePanel = observer(() => {
  if (Economy.mixKind === 'chaosCard' || Economy.mixResult) return null;

  const picked = Economy.mixRecipe !== null ? CHAOS_RECIPES.find(r => r.number === Economy.mixRecipe) : undefined;
  const match = picked ? matchRecipe(picked, Economy.mixItems) : bestRecipe(Economy.mixItems);

  return (
    // data-no-drag: a press here must not start dragging the window - the drag
    // captures the pointer, so the click landed on the window instead of the
    // recipe and the list never opened one.
    <div
      className="chaos-recipe-panel"
      data-no-drag
      style={{ left: MENU_X, top: MENU_Y, width: MENU_WIDTH, height: MENU_HEIGHT }}
    >
      {match ? (
        <Detail match={match} picked={!!picked} />
      ) : (
        <>
          <div className="title">{t('chaos.recipeList')}</div>
          <div className="hint-line">{t('chaos.pickHint')}</div>
          <div className="recipe-list">
            {listedRecipes().map(recipe => (
              <div key={recipe.number} className="recipe-entry" onClick={() => Economy.pickMixRecipe(recipe.number)}>
                {recipeName(recipe)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
