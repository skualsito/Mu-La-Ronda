import './style.less';
import { useEffect } from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { t } from '../../../../../i18n';
import { Social } from '../../../../../social';
import { Store } from '../../../../../store';
import { characterTotals, setCharacterTotalsOpen, totalsSections } from '../../../../../common/characterTotals';
import { MuButton } from '../../../../components/muButton';
import { MuItemWindow, MuTableFrame } from '../../../../components/muWindow';

/**
 * Mu La Ronda: the character's statistics (common/characterTotals.ts), opened from the character
 * sheet's second button: what all of the character adds up to - the reflect of every piece of a
 * set, the zen of the VIP and the panda, the damage with every buff - as the server counts it.
 * Asked for again on each open and with the button at the bottom.
 */

const WINDOW_ID = 'character-totals';
const TITLE_Y = 12;
const HEAD_CLOSE = { left: 169, top: 7, width: 13, height: 12 };
const LIST = { x: 12, y: 40, width: 166, height: 344 };
const EXIT_BUTTON = { x: 13, y: 392, width: 36, height: 29 };
const EXIT_SPRITE = 'newui_exit_00.OZT';

const refresh = () => {
  runInAction(() => {
    characterTotals.loading = true;
  });
  Social.sendWindowCommand('/estadisticas');
};

export const CharacterTotalsWindow = observer(() => {
  const { open, loading, values } = characterTotals;

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open || Store.isOffline) return null;

  const close = () => setCharacterTotalsOpen(false);
  const sections = totalsSections(values);

  return (
    <MuItemWindow id={WINDOW_ID} className="character-totals-window" column={1} label={t('totals.title')} onClose={close}>
      <div className="totals-title" style={{ top: TITLE_Y }}>
        {t('totals.title')}
      </div>
      <div className="head-close" data-no-drag="true" style={HEAD_CLOSE} onClick={close} />

      <MuTableFrame left={LIST.x} top={LIST.y} width={LIST.width} height={LIST.height} />
      <div
        className="totals-list"
        data-no-drag="true"
        style={{ left: LIST.x + 4, top: LIST.y + 4, width: LIST.width - 8, height: LIST.height - 8 }}
      >
        {loading && !sections.length ? (
          <div className="totals-loading">{t('totals.loading')}</div>
        ) : (
          sections.map(section => (
            <div key={section.title} className="totals-section">
              <div className="totals-section-title">{t(section.title)}</div>
              {section.rows.map(row => (
                <div key={row.label} className="totals-row">
                  <span>{t(row.label)}</span>
                  <span className="totals-value">{row.value}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="window-button" data-no-drag="true" style={{ left: EXIT_BUTTON.x, top: EXIT_BUTTON.y }}>
        <MuButton file={EXIT_SPRITE} width={EXIT_BUTTON.width} height={EXIT_BUTTON.height} frames={{ up: 0, down: 1 }} onClick={close}>
          <span className="button-tooltip">{t('common.close')}</span>
        </MuButton>
      </div>
    </MuItemWindow>
  );
});
