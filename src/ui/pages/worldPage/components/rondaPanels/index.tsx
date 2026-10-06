import './style.less';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { tOptions } from '../../../../../i18n';
import { Store } from '../../../../../store';
import { CHAT_COMMANDS, type ChatCommand } from '../../../../../common/chatCommands';
import {
  closeRondaPanel,
  rondaPanels,
  toggleRondaPanel,
} from '../../../../../common/rondaPanels';
import {
  fetchRanking,
  type GuildRow,
  type PkRow,
  type RankingType,
  type ResetRow,
} from '../../../../../common/statsApi';
import { useWindowChrome } from '../../../../components/muWindow/useWindowChrome';
import { MuTableFrame } from '../../../../components/muWindow';
import { OptionsFrame } from '../../../../components/optionsWindow/frame';
import { OptionsButton } from '../../../../components/optionsWindow/controls';
import { ScrollBar } from '../../../../components/optionsWindow/scrollbar';
import { playUiSound } from '../../../../../libs/sfx';

/**
 * Mu La Ronda's own in-game windows: the command list (`/comandos`) and the
 * rankings (`/ranking` or the trophy button). Plain HTML in the server's
 * colours rather than MU sprite chrome - the original has neither window, so
 * there is no art to match.
 */

const PANEL_TOP = 36;
const PANEL_PAD = 8;
const FOOTER_SPACE = 52;
const SCROLL_WIDTH = 15;
const CLOSE_WIDTH = 108;

/**
 * The options window's chrome at another size: stone, rails, title bar, the
 * dark table frame for the content, the MU scroll bar and a Close button in
 * the foot - so these read as part of the game, not a web page on top of it.
 */
const Panel = observer(({
  id,
  title,
  width,
  height,
  header,
  headerHeight = 0,
  contentKey,
  children,
}: {
  id: string;
  title: string;
  width: number;
  height: number;
  /** Fixed strip above the scrolling rows (tabs, a note). */
  header?: React.ReactNode;
  headerHeight?: number;
  /** Changes whenever the rows are refilled (for the scroll bar). */
  contentKey: string;
  children: React.ReactNode;
}) => {
  const rowsRef = useRef<HTMLDivElement>(null);
  const close = () => {
    closeRondaPanel();
    playUiSound('click');
  };
  const chrome = useWindowChrome(id, { width, height, onClose: close });

  const panelHeight = height - PANEL_TOP - FOOTER_SPACE;
  const rowsTop = PANEL_TOP + PANEL_PAD + headerHeight;
  const rowsHeight = panelHeight - PANEL_PAD * 2 - headerHeight;
  const innerLeft = 16 + PANEL_PAD;
  const innerWidth = width - 32 - PANEL_PAD * 2;

  return (
    <div className="ronda-mu-page">
      <div
        ref={chrome.ref as React.Ref<HTMLDivElement>}
        className="ronda-mu-window"
        style={{
          ...chrome.style,
          position: chrome.anchored ? 'relative' : 'absolute',
          transformOrigin: chrome.anchored ? 'center' : '0 0',
          width,
          height,
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <OptionsFrame width={width} height={height} />
        <div className="ronda-mu-titlebar" style={{ width }} onPointerDown={chrome.onPointerDown}>
          {title}
        </div>

        <MuTableFrame
          className="ronda-mu-panel"
          left={16}
          top={PANEL_TOP}
          width={width - 32}
          height={panelHeight}
        />
        {header && (
          <div
            className="ronda-mu-header"
            style={{ left: innerLeft, top: PANEL_TOP + PANEL_PAD, width: innerWidth, height: headerHeight }}
          >
            {header}
          </div>
        )}
        <div
          ref={rowsRef}
          className="ronda-mu-rows"
          style={{ left: innerLeft, top: rowsTop, width: innerWidth - SCROLL_WIDTH - 4, height: rowsHeight }}
        >
          {children}
        </div>
        <ScrollBar
          target={rowsRef}
          windowId={id}
          left={innerLeft + innerWidth - SCROLL_WIDTH}
          top={rowsTop}
          height={rowsHeight}
          contentKey={contentKey}
        />

        <OptionsButton
          label={tOptions('common.close')}
          width={CLOSE_WIDTH}
          onClick={close}
          style={{ left: width - 24 - CLOSE_WIDTH, top: height - 47 }}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// /comandos
// ---------------------------------------------------------------------------

const CommandRows = ({ commands }: { commands: readonly ChatCommand[] }) => (
  <table className="ronda-table ronda-commands">
    <tbody>
      {commands.map(command => (
        <tr key={command.name}>
          <td className="ronda-cmd">
            {command.name}
            {command.usage && <span className="ronda-usage"> {command.usage}</span>}
          </td>
          <td>{tOptions(command.helpKey)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const CommandsWindow = observer(() => {
  const gm = Store.playerData.isGameMaster;
  const player = CHAT_COMMANDS.filter(c => !c.gm);
  const master = CHAT_COMMANDS.filter(c => c.gm);

  return (
    <Panel
      id="ronda-commands"
      title="Comandos"
      width={600}
      height={540}
      headerHeight={34}
      contentKey={gm ? 'gm' : 'player'}
      header={
        <p className="ronda-note">
          Escribilos en el chat (Enter para abrirlo). Los que actúan sobre otro jugador usan el
          que tenés bajo el cursor.
        </p>
      }
    >
      <h3 className="ronda-section">Jugador</h3>
      <CommandRows commands={player} />
      {gm && (
        <>
          <h3 className="ronda-section">Game Master</h3>
          <CommandRows commands={master} />
        </>
      )}
    </Panel>
  );
});

// ---------------------------------------------------------------------------
// /ranking
// ---------------------------------------------------------------------------

const TABS: { type: RankingType; label: string }[] = [
  { type: 'resets', label: 'Resets' },
  { type: 'pk', label: 'PK' },
  { type: 'guilds', label: 'Guilds' },
];

type Loaded =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ok'; type: RankingType; rows: unknown[] };

const RankingTable = ({ type, rows, me }: { type: RankingType; rows: unknown[]; me: string }) => {
  if (!rows.length) return <p className="ronda-empty">Todavía no hay nadie en este ranking.</p>;

  const mine = (name: string | null | undefined) => (name && name === me ? 'is-me' : undefined);

  if (type === 'resets') {
    return (
      <table className="ronda-table">
        <thead>
          <tr><th>#</th><th>Personaje</th><th>Clase</th><th>Resets</th><th>Nivel</th><th>ML</th></tr>
        </thead>
        <tbody>
          {(rows as ResetRow[]).map((row, i) => (
            <tr key={row.name} className={mine(row.name)}>
              <td className="ronda-pos">{i + 1}</td><td>{row.name}</td><td>{row.class}</td>
              <td className="ronda-num ronda-strong">{row.resets}</td>
              <td className="ronda-num">{row.level}</td><td className="ronda-num">{row.masterLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === 'pk') {
    return (
      <table className="ronda-table">
        <thead>
          <tr><th>#</th><th>Personaje</th><th>Clase</th><th>Kills</th><th>Nivel</th></tr>
        </thead>
        <tbody>
          {(rows as PkRow[]).map((row, i) => (
            <tr key={row.name} className={mine(row.name)}>
              <td className="ronda-pos">{i + 1}</td><td>{row.name}</td><td>{row.class}</td>
              <td className="ronda-num ronda-strong">{row.kills}</td>
              <td className="ronda-num">{row.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="ronda-table">
      <thead>
        <tr><th>#</th><th>Guild</th><th>Master</th><th>Score</th><th>Miembros</th><th>Resets</th></tr>
      </thead>
      <tbody>
        {(rows as GuildRow[]).map((row, i) => (
          <tr key={row.name} className={mine(row.master)}>
            <td className="ronda-pos">{i + 1}</td><td>{row.name}</td><td>{row.master ?? '-'}</td>
            <td className="ronda-num ronda-strong">{row.score}</td>
            <td className="ronda-num">{row.members}</td><td className="ronda-num">{row.resets}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const RankingsWindow = observer(() => {
  const [type, setType] = useState<RankingType>('resets');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const me = Store.playerData.name;

  useEffect(() => {
    let live = true;
    setLoaded({ state: 'loading' });

    fetchRanking(type).then(
      rows => live && setLoaded({ state: 'ok', type, rows }),
      () => live && setLoaded({ state: 'error' })
    );

    return () => {
      live = false;
    };
  }, [type]);

  return (
    <Panel
      id="ronda-rankings"
      title="Rankings"
      width={600}
      height={540}
      headerHeight={60}
      contentKey={`${type}|${loaded.state}`}
      header={
        <>
          <div className="ronda-tabs" role="tablist">
            {TABS.map((tab, i) => (
              <OptionsButton
                key={tab.type}
                label={tab.label}
                width={110}
                checked={type === tab.type}
                onClick={() => {
                  setType(tab.type);
                  playUiSound('click');
                }}
                style={{ left: i * 116, top: 0 }}
              />
            ))}
          </div>
          <p className="ronda-note ronda-note-right">
            Se actualiza cada minuto. Los Game Masters no aparecen.
          </p>
        </>
      }
    >
      <div className="ronda-ranking">
        {loaded.state === 'loading' && <p className="ronda-empty">Cargando…</p>}
        {loaded.state === 'error' && (
          <p className="ronda-empty">No se pudo cargar el ranking. Probá de nuevo en un rato.</p>
        )}
        {loaded.state === 'ok' && loaded.type === type && (
          <RankingTable type={type} rows={loaded.rows} me={me} />
        )}
      </div>
    </Panel>
  );
});

// ---------------------------------------------------------------------------

/** The button that opens the rankings, at the right edge of the screen. */
const RankingsButton = observer(() => (
  <button
    type="button"
    className={`ronda-rank-button${rondaPanels.open === 'rankings' ? ' is-on' : ''}`}
    title="Rankings (/ranking)"
    onClick={() => {
      toggleRondaPanel('rankings');
      playUiSound('click');
    }}
  >
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <path
        fill="currentColor"
        d="M17 3V2H7v1H3v3a4 4 0 0 0 4 4h.3A5 5 0 0 0 11 13.9V17H8v2h8v-2h-3v-3.1A5 5 0 0 0 16.7 10H17a4 4 0 0 0 4-4V3h-4ZM5 6V5h2v3a2 2 0 0 1-2-2Zm14 0a2 2 0 0 1-2 2V5h2v1ZM6 20h12v2H6z"
      />
    </svg>
    <span>Rankings</span>
  </button>
));

export const RondaPanels = observer(() => (
  <>
    <RankingsButton />
    {rondaPanels.open === 'commands' && <CommandsWindow />}
    {rondaPanels.open === 'rankings' && <RankingsWindow />}
  </>
));
