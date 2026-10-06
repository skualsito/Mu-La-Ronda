import './style.less';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { t, tOptions, type TextKey } from '../../../i18n';
import { Store, UIState } from '../../../store';
import { GameMenu } from '../../../common/gameMenu';
import { openRondaPanel } from '../../../common/rondaPanels';
import { SessionExit, type ExitKind } from '../../../common/sessionExit';
import { playUiSound } from '../../../libs/sfx';
import { useWindowChrome } from '../muWindow/useWindowChrome';
import { OptionsFrame } from '../optionsWindow/frame';
import { OptionsButton } from '../optionsWindow/controls';
import { ConfirmBox } from '../optionsWindow/dialogs';

const WINDOW_ID = 'game-menu';

const WIN_WIDTH = 230;
const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 30;
const BUTTON_GAP = 6;
const FIRST_BUTTON_Y = 46;
const FOOT = 34;

const CONFIRM_TEXT: Record<ExitKind, TextKey> = {
  quit: 'exit.confirmQuit',
  servers: 'exit.confirmServers',
  characters: 'exit.confirmCharacters',
};

type Entry = {
  labelKey: TextKey;
  run: () => void;
};

export const GameMenuWindow = observer(() => {
  const [confirming, setConfirming] = useState<ExitKind | null>(null);
  const open = GameMenu.open;

  const inWorld = Store.uiState === UIState.World;

  const entries: Entry[] = [
    {
      labelKey: 'options.gameSettings',
      run: () => {
        GameMenu.hide();
        runInAction(() => {
          Store.optionsEnabled = true;
        });
      },
    },
  ];
  if (inWorld) {
    entries.push(
      {
        labelKey: 'options.commands',
        run: () => {
          GameMenu.hide();
          openRondaPanel('commands');
        },
      },
      {
        labelKey: 'options.rankings',
        run: () => {
          GameMenu.hide();
          openRondaPanel('rankings');
        },
      }
    );
  }
  const exits: [ExitKind, TextKey][] = [
    ['characters', 'options.switchCharacter'],
    ['servers', 'options.selectServer'],
    ['quit', 'options.exitGame'],
  ];
  for (const [kind, labelKey] of exits) {
    if (SessionExit.available(kind)) entries.push({ labelKey, run: () => setConfirming(kind) });
  }

  const height = FIRST_BUTTON_Y + entries.length * (BUTTON_HEIGHT + BUTTON_GAP) + FOOT;

  const chrome = useWindowChrome(WINDOW_ID, {
    width: WIN_WIDTH,
    height,
    onClose: () => {
      GameMenu.hide();
      playUiSound('click');
    },
  });

  if (!open) return null;

  return (
    <div className="game-menu-page">
      <div
        ref={chrome.ref as React.Ref<HTMLDivElement>}
        className="game-menu"
        style={{
          ...chrome.style,
          position: chrome.anchored ? 'relative' : 'absolute',
          transformOrigin: chrome.anchored ? 'center' : '0 0',
          width: WIN_WIDTH,
          height,
        }}
      >
        <OptionsFrame width={WIN_WIDTH} height={height} />
        <div
          className="game-menu-titlebar"
          style={{ width: WIN_WIDTH }}
          onPointerDown={chrome.onPointerDown}
        >
          {tOptions('options.menuTitle')}
        </div>

        {entries.map((entry, i) => (
          <OptionsButton
            key={entry.labelKey}
            label={tOptions(entry.labelKey)}
            width={BUTTON_WIDTH}
            onClick={() => {
              playUiSound('click');
              entry.run();
            }}
            style={{
              left: (WIN_WIDTH - BUTTON_WIDTH) / 2,
              top: FIRST_BUTTON_Y + i * (BUTTON_HEIGHT + BUTTON_GAP),
            }}
          />
        ))}
      </div>

      {confirming && (
        <ConfirmBox
          text={t(CONFIRM_TEXT[confirming])}
          onAnswer={yes => {
            const kind = confirming;
            setConfirming(null);
            if (yes) {
              GameMenu.hide();
              SessionExit.request(kind);
            }
          }}
        />
      )}
    </div>
  );
});
