import { observer } from 'mobx-react-lite';
import { t } from '../../../../../i18n';
import { Economy } from '../../../../../economy';
import { itemBaseName } from '../../../../../common/itemsDatabase';
import { bestRecipe, type RequirementState } from '../../../../../common/chaosRecipeMatch';
import type { MixRequirement } from '../../../../../common/chaosRecipes';
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

/**
 * Mu La Ronda: the recipe the tray is heading for, under the grid where the
 * original lists it - every requirement with how many of it are in, met ones
 * green and missing ones red, then the chance and the cost.
 */
export const RecipePanel = observer(() => {
  if (Economy.mixKind === 'chaosCard' || Economy.mixResult) return null;
  const match = bestRecipe(Economy.mixItems);
  if (!match) return null;
  const { recipe } = match;

  return (
    <div className="chaos-recipe-panel" style={{ left: MENU_X, top: MENU_Y, width: MENU_WIDTH, height: MENU_HEIGHT }}>
      <div className="title">{t('chaos.recipe', { name: recipe.name })}</div>
      {match.requirements.map((state, i) => (
        <div key={i} className={state.ok ? 'ok' : 'missing'}>
          <span className="count">{countText(state)}</span> {requirementLabel(state.requirement)}
        </div>
      ))}
      {match.extra > 0 && <div className="missing">{t('chaos.extraItems', { count: match.extra })}</div>}
      {recipe.success !== undefined && (
        <div className="info">
          {recipe.maxSuccess
            ? t('chaos.successUpTo', { value: recipe.maxSuccess })
            : t('chaos.successRate', { value: recipe.success })}
        </div>
      )}
      {recipe.money ? <div className="info">{t('chaos.cost', { zen: zen(recipe.money) })}</div> : null}
      {match.complete && <div className="ready">{t('chaos.recipeReady')}</div>}
    </div>
  );
});
