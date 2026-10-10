import './style.less';
import { t } from '../../../../../i18n';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { Economy } from '../../../../../economy';
import { StorageKind } from '../../../../../common/itemStorage';
import { MuButton } from '../../../../components/muButton';
import { MuItemWindow } from '../../../../components/muWindow';
import { ItemGrid } from '../../../../components/itemGrid';
import { QuickItemActions } from '../../../../../common/quickItemActions';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { RecipePanel } from './recipePanel';
import {
  COLUMNS,
  GRID_X,
  GRID_Y,
  HEAD_CLOSE_HEIGHT,
  HEAD_CLOSE_WIDTH,
  HEAD_CLOSE_X,
  HEAD_CLOSE_Y,
  MIX_BUTTON_FRAMES,
  MIX_BUTTON_HEIGHT,
  MIX_BUTTON_WIDTH,
  MIX_BUTTON_X,
  MIX_BUTTON_Y,
  MIX_SPRITE,
  MIX_TOOLTIP,
  RECIPE_HEIGHT,
  RECIPE_WIDTH,
  RECIPE_X,
  RECIPE_Y,
  ROWS,
  SUBTITLE_Y,
  TITLE,
  TITLE_Y,
} from './layout';

const WINDOW_ID = 'chaos-machine';

/**
 * `CNewUIMixInventory`: the goblin's tray. Items go in from the inventory
 * and the button sends `ChaosMachineMixRequest`; as in the original there is
 * no recipe menu - the server works the combination out from the items
 * (see `Economy.mix`); the result comes back as `ItemCraftingResult`
 * and lands in the tray, where it has to be dragged out before the window
 * will close (`ClosingProcess`).
 */
export const ChaosMachine = observer(() => {
  if (!Economy.mixOpen) return null;

  const picked = Store.pickedItem;
  // The Chaos Card Master shares this window (`MIXTYPE_CHAOS_CARD` in the
  // original's CNewUIMixInventory): its own title and hint.
  const cardMode = Economy.mixKind === 'chaosCard';
  const title = cardMode ? t('chaosCard.title') : t(TITLE);

  const column = 1 + (Store.inventoryEnabled ? 1 : 0) + (Store.characterInfoEnabled ? 1 : 0);

  return (
    <MuItemWindow
      id={WINDOW_ID}
      dockLeftOf={Store.inventoryEnabled ? 'inventory' : undefined}
      className="chaos-machine"
      column={column}
      label={title}
      onClose={() => Economy.closeMix()}
    >
      <div className="window-title" style={{ top: TITLE_Y }}>
        {title}
      </div>
      <div className="chaos-subtitle" style={{ top: SUBTITLE_Y }}>
        {Economy.mixPending ? t('chaos.combining') : ''}
      </div>

      <div
        className="head-close"
        data-no-drag="true"
        style={{
          left: HEAD_CLOSE_X,
          top: HEAD_CLOSE_Y,
          width: HEAD_CLOSE_WIDTH,
          height: HEAD_CLOSE_HEIGHT,
        }}
        onClick={() => Economy.closeMix()}
      />

      <div
        className={`chaos-recipe${Economy.mixResult ? ` ${Economy.mixResult}` : ''}`}
        style={{
          left: RECIPE_X,
          top: RECIPE_Y,
          width: RECIPE_WIDTH,
          height: RECIPE_HEIGHT,
        }}
      >
        {Economy.mixResult === 'success' && <div>{t('chaos.succeeded')}</div>}
        {Economy.mixResult === 'failed' && <div>{t('chaos.failed')}</div>}
        {!Economy.mixResult && (
          <div className="hint">
            {cardMode
              ? `${t('chaosCard.hint1')} ${t('chaosCard.hint2')}`
              : t('chaos.putItemsIn')}
          </div>
        )}
      </div>

      <ItemGrid
        items={Economy.mixItems}
        columns={COLUMNS}
        rows={ROWS}
        left={GRID_X}
        top={GRID_Y}
        disabled={Economy.mixPending || !!Store.pendingItemMove}
        dropTint={picked ? 'ok' : 'none'}
        onPick={square => Store.pickItem(StorageKind.ChaosMachine, square)}
        onPlace={square => Store.placePickedItem(square, StorageKind.ChaosMachine)}
        onUse={square =>
          Store.autoMoveItem(
            StorageKind.ChaosMachine,
            square,
            StorageKind.Inventory
          )
        }
        onQuickAction={square =>
          QuickItemActions.toInventory(StorageKind.ChaosMachine, square)
        }
      />

      <RecipePanel />


      <div
        className="window-button"
        data-no-drag="true"
        style={{ left: MIX_BUTTON_X, top: MIX_BUTTON_Y }}
      >
        <MuButton
          file={MIX_SPRITE}
          width={MIX_BUTTON_WIDTH}
          height={MIX_BUTTON_HEIGHT}
          frames={MIX_BUTTON_FRAMES}
          disabled={Economy.mixPending}
          onClick={() => Economy.mix()}
        >
          <span className="button-tooltip">{t(MIX_TOOLTIP)}</span>
        </MuButton>
      </div>
    </MuItemWindow>
  );
});
