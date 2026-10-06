import './style.less';
import { useEffect, useState } from 'react';
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
import { useWindowStackEntry } from '../../../../components/muWindow/useWindowChrome';
import { playUiSound } from '../../../../../libs/sfx';

/**
 * Mu La Ronda's own in-game windows: the command list (`/comandos`) and the
 * rankings (`/ranking` or the trophy button). Plain HTML in the server's
 * colours rather than MU sprite chrome - the original has neither window, so
 * there is no art to match.
 */

const Panel = ({
  id,
  title,
  wide,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) => {
  useWindowStackEntry(id, true, () => {
    closeRondaPanel();
    playUiSound('click');
  });

  return (
    <div className="ronda-panel-backdrop" onMouseDown={closeRondaPanel}>
      <section
        className={`ronda-panel${wide ? ' is-wide' : ''}`}
        onMouseDown={e => e.stopPropagation()}
        onContextMenu={e => e.preventDefault()}
      >
        <header className="ronda-panel-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="ronda-panel-close"
            aria-label="Cerrar"
            onClick={() => {
              closeRondaPanel();
              playUiSound('click');
            }}
          >
            ×
          </button>
        </header>
        <div className="ronda-panel-body">{children}</div>
      </section>
    </div>
  );
};

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
    <Panel id="ronda-commands" title="Comandos" wide>
      <p className="ronda-note">
        Escribilos en el chat (Enter para abrirlo). Los que actúan sobre otro jugador usan el que
        tenés bajo el cursor.
      </p>
      <CommandRows commands={player} />
      {gm && (
        <>
          <h3 className="ronda-subtitle">Game Master</h3>
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
    <Panel id="ronda-rankings" title="Rankings" wide>
      <nav className="ronda-tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={type === tab.type}
            className={`ronda-tab${type === tab.type ? ' is-on' : ''}`}
            onClick={() => {
              setType(tab.type);
              playUiSound('click');
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="ronda-ranking">
        {loaded.state === 'loading' && <p className="ronda-empty">Cargando…</p>}
        {loaded.state === 'error' && (
          <p className="ronda-empty">No se pudo cargar el ranking. Probá de nuevo en un rato.</p>
        )}
        {loaded.state === 'ok' && loaded.type === type && (
          <RankingTable type={type} rows={loaded.rows} me={me} />
        )}
      </div>
      <p className="ronda-note">Se actualiza cada minuto. Los Game Masters no aparecen.</p>
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
