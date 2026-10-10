import { observer } from 'mobx-react-lite';
import { t, type TextKey } from '../../../../../i18n';
import { Economy } from '../../../../../economy';
import { socketOf } from '../../../../../common/itemExtraOptions';
import {
  MAX_SPHERE_LEVEL,
  isSeedSphere,
  seedSphereLevel,
  socketItemOf,
} from '../../../../../common/seedCrafting';
import { MENU_HEIGHT, MENU_WIDTH, MENU_X, MENU_Y } from './layout';

/**
 * Mu La Ronda: the seed NPCs' part of the tray window, where the goblin's shows its recipes:
 * what each of their mixes takes and, at the Seed Researcher, the item's sockets to pick the one
 * to mount on or take off (Economy.seedSocket, sent with the mix).
 */
export const SeedPanel = observer(() => {
  if (Economy.mixKind !== 'seedMaster' && Economy.mixKind !== 'seedResearcher') return null;

  const researcher = Economy.mixKind === 'seedResearcher';
  const item = researcher ? socketItemOf(Economy.mixItems) : null;
  const sphere = researcher ? Economy.mixItems.find(isSeedSphere) ?? null : null;
  const socketInUse = Economy.seedSocketInUse;
  const recipes: TextKey[] = researcher
    ? ['seed.recipeMount', 'seed.recipeRemove']
    : ['seed.recipeSeed', 'seed.recipeSphere'];

  return (
    <div
      className="chaos-recipe-panel seed-panel"
      data-no-drag
      style={{ left: MENU_X, top: MENU_Y, width: MENU_WIDTH, height: MENU_HEIGHT }}
    >
      {item ? (
        <>
          <div className="title">{t('seed.pickSocket')}</div>
          {Array.from({ length: item.socketCount ?? 0 }, (_, slot) => {
            const socket = socketOf(item.sockets?.[slot] ?? 0xfe);
            const label = socket.empty
              ? t('seed.socketEmpty', { slot: slot + 1 })
              : t('seed.socketFilled', {
                  slot: slot + 1,
                  element: t(`socket.element.${socket.element}` as TextKey),
                  level: socket.level,
                });
            return (
              <div
                key={slot}
                className={`recipe-entry seed-socket${slot === socketInUse ? ' active' : ''}${socket.empty ? '' : ' filled'}`}
                onClick={() => Economy.pickSeedSocket(slot)}
              >
                {label}
              </div>
            );
          })}
          <div className="hint-line">
            {sphere
              ? t('seed.mountOn', { slot: socketInUse + 1 })
              : t('seed.removeFrom', { slot: socketInUse + 1 })}
          </div>
          {sphere && seedSphereLevel(sphere) > MAX_SPHERE_LEVEL && (
            <div className="hint-line missing">{t('seed.sphereTooHigh')}</div>
          )}
        </>
      ) : (
        <>
          {recipes.map(key => (
            <div key={key} className="seed-recipe">
              {t(key)}
            </div>
          ))}
          <div className="hint-line">{t('seed.cost')}</div>
        </>
      )}
    </div>
  );
});
