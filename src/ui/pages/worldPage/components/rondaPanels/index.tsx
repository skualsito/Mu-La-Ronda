import './style.less';
import { runningInvasions } from '../../../../../common/invasionTally';
import { monsterDisplayName } from '../../../../../common/monstersDatabase';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { tOptions } from '../../../../../i18n';
import { Store } from '../../../../../store';
import { CHAT_COMMANDS, type ChatCommand } from '../../../../../common/chatCommands';
import {
  closeRondaPanel,
  rondaPanels,
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
import { ConfirmBox } from '../../../../components/optionsWindow/dialogs';
import { Social } from '../../../../../social';
import {
  checkingVipCode,
  discounted,
  markVipBuying,
  VIP_TIERS,
  vipCode,
  vipState,
  type VipTierInfo,
} from '../../../../../common/vip';
import {
  bundlesIn,
  closeNpcRequest,
  JEWEL_MIXES,
  looseJewels,
  PACK_FEE_PER_TEN,
  PACK_SIZES,
  packRequest,
  UNPACK_FEE,
  unpackRequest,
} from '../../../../../common/lahap';
import { itemBaseName } from '../../../../../common/itemsDatabase';
import { eventSchedule, refreshEventSchedule, type EventScheduleRow } from '../../../../../events/schedule';
import { rowText } from '../../../../../events/scheduleClock';
import { EVENT_TEXT } from '../../../../../events/recipes';
import { clockText, FIXED_EVENTS, secondsToNext } from '../../../../../events/fixedSchedule';
import { serverNow } from '../../../../../common/serverTime';
import { events } from '../../../../../events';

/**
 * Mu La Ronda's own in-game windows: the command list (`/comandos`) and the
 * rankings (`/ranking` or the game menu). Plain HTML in the server's
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
  noScroll = false,
  rowsClassName,
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
  /** Content that always fits: no scroll bar, and the full width for the content (centred). */
  noScroll?: boolean;
  /** Mu La Ronda: an extra class on the rows box (the events window lays it out as a column). */
  rowsClassName?: string;
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
          className={rowsClassName ? `ronda-mu-rows ${rowsClassName}` : 'ronda-mu-rows'}
          style={{ left: innerLeft, top: rowsTop, width: noScroll ? innerWidth : innerWidth - SCROLL_WIDTH - 4, height: rowsHeight }}
        >
          {children}
        </div>
        {!noScroll && (
          <ScrollBar
            target={rowsRef}
            windowId={id}
            left={innerLeft + innerWidth - SCROLL_WIDTH}
            top={rowsTop}
            height={rowsHeight}
            contentKey={contentKey}
          />
        )}

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
// VIP (game menu → VIP, /vip)
// ---------------------------------------------------------------------------

const zen = (n: number) => n.toLocaleString('es-AR');

/** `OptionsButton` sits absolutely for the options grid; in the months row it takes its place in the line. */
const STEPPER_BUTTON = { position: 'relative', flexShrink: 0 } as const;

/** The most months one purchase takes (the server's MaximumMonths). */
const VIP_MAX_MONTHS = 12;

/** How long the window waits after the last key before asking the server about the code. */
const CODE_CHECK_DELAY_MS = 500;

const tierNumber = (name: string | null | undefined) => VIP_TIERS.find(t => t.name === name)?.tier ?? 0;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const VipWindow = observer(() => {
  const [confirm, setConfirm] = useState<VipTierInfo | null>(null);
  const [months, setMonths] = useState(1);
  const [code, setCode] = useState('');
  const money = Store.playerData.money;
  const current = vipState.name;
  const currentTier = tierNumber(current);
  const next = vipState.next;
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const checked = !!cleanCode && vipCode.code === cleanCode;
  const answered = checked && (vipCode.percent !== null || vipCode.refusal !== null);
  const percent = checked ? vipCode.percent : null;
  // A code that can't be used stops the purchase; one still being checked doesn't (the server checks it again).
  const badCode = checked && vipCode.refusal !== null;

  // What the account has comes from the server's answer to /vip.
  useEffect(() => {
    if (!vipState.known) Social.sendChat('/vip');
  }, []);

  // The code is checked once the typing stops: the prices then show with its discount.
  useEffect(() => {
    if (!cleanCode) {
      checkingVipCode('');
      return;
    }
    if (vipCode.code === cleanCode) return;
    const timer = setTimeout(() => {
      checkingVipCode(cleanCode);
      Social.sendWindowCommand(`/vip codigo ${cleanCode}`);
    }, CODE_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cleanCode]);

  return (
    <Panel
      id="ronda-vip"
      title="VIP"
      width={620}
      height={510}
      headerHeight={44}
      noScroll
      contentKey={`${current}-${vipState.until}-${next?.name}-${vipState.buying}`}
      header={
        <p className="ronda-note ronda-vip-head">
          {!vipState.known ? (
            'Consultando tu VIP…'
          ) : current ? (
            <>
              Tenés <b className="ronda-vip-name">VIP {current}</b> hasta el {vipState.until}.
              {next ? (
                <>
                  {' '}
                  Después sigue <b className="ronda-vip-name">VIP {next.name}</b> hasta el {next.until}.
                </>
              ) : (
                ' Lo que compres se suma: los días que te quedan no se pierden.'
              )}
            </>
          ) : (
            'No tenés VIP. Es de la cuenta: vale para todos tus personajes, 30 días por mes que compres.'
          )}
        </p>
      }
    >
      <div className="ronda-vip-options">
        <span>Meses</span>
        <OptionsButton label="-" width={28} style={STEPPER_BUTTON} disabled={months <= 1} onClick={() => setMonths(m => Math.max(1, m - 1))} />
        <b className="ronda-vip-months">{months}</b>
        <OptionsButton label="+" width={28} style={STEPPER_BUTTON} disabled={months >= VIP_MAX_MONTHS} onClick={() => setMonths(m => Math.min(VIP_MAX_MONTHS, m + 1))} />
        <span className="ronda-vip-code-label">Código de descuento</span>
        <input
          className="ronda-vip-code"
          value={code}
          maxLength={24}
          placeholder="opcional"
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
        />
      </div>
      <p className={`ronda-vip-code-line ${percent !== null ? 'is-ok' : badCode ? 'is-bad' : ''}`}>
        {!cleanCode
          ? ' '
          : !answered
            ? 'Verificando el código…'
            : percent !== null
              ? `Código ${cleanCode}: ${percent}% de descuento`
              : capitalize(vipCode.refusal ?? '')}
      </p>
      <div className="ronda-vip-tiers">
        {VIP_TIERS.map(tier => {
          const full = tier.price * months;
          const total = discounted(full, percent);
          // A lower tier than the one running can't be bought; a higher one waits for it to end,
          // and only one higher tier can wait at a time.
          const lower = tier.tier < currentTier;
          const waits = currentTier > 0 && tier.tier > currentTier;
          const blocked = waits && !!next && next.name !== tier.name;
          const short = money < total;
          const label = vipState.buying ? '…' : current === tier.name || next?.name === tier.name ? 'Sumar' : 'Comprar';
          return (
            <div
              key={tier.tier}
              className={`ronda-vip-tier tier-${tier.tier} ${current === tier.name ? 'is-current' : ''} ${lower ? 'is-lower' : ''}`}
            >
              <h3>{tier.name}</h3>
              <p className="ronda-vip-bonus">+{tier.bonus}% experiencia</p>
              <p className="ronda-vip-bonus">+{tier.bonus}% zen</p>
              <p className="ronda-vip-price">{zen(total)} zen</p>
              <p className="ronda-vip-days">
                {total !== full && <s className="ronda-vip-full">{zen(full)}</s>}
                {total !== full && ' · '}
                {months * 30} días
              </p>
              <OptionsButton
                label={label}
                width={110}
                disabled={lower || blocked || badCode || short || vipState.buying}
                onClick={() => {
                  playUiSound('click');
                  setConfirm(tier);
                }}
                style={{ position: 'relative', marginTop: 6 }}
              />
              {lower ? (
                <p className="ronda-vip-short">Ya tenés VIP {current}</p>
              ) : blocked ? (
                <p className="ronda-vip-short">Ya tenés {next!.name} en espera</p>
              ) : short ? (
                <p className="ronda-vip-short">Te faltan {zen(total - money)} zen</p>
              ) : waits ? (
                <p className="ronda-vip-days">Empieza cuando termine el {current}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="ronda-note ronda-vip-foot">
        Durante la beta el VIP se paga con zen. Más adelante se va a poder pagar con Mercado Pago.
      </p>

      {confirm && (
        <ConfirmBox
          text={(() => {
            const full = confirm.price * months;
            const price = percent
              ? `${zen(discounted(full, percent))} zen (${percent}% de descuento con ${cleanCode})`
              : `${zen(full)} zen`;
            const when =
              currentTier > 0 && confirm.tier > currentTier ? ` Empieza cuando termine tu VIP ${current}.` : '';
            return `¿Comprar ${months} mes(es) de VIP ${confirm.name} por ${price}?${when}`;
          })()}
          onAnswer={yes => {
            const tier = confirm;
            setConfirm(null);
            if (!yes) return;
            const command = `/vip ${tier.name.toLowerCase()} ${months}${cleanCode ? ` ${cleanCode}` : ''}`;
            if (Social.sendChat(command)) markVipBuying();
          }}
        />
      )}
    </Panel>
  );
});

// ---------------------------------------------------------------------------
// Lahap
// ---------------------------------------------------------------------------

const LahapWindow = observer(() => {
  // The bag with each item's own slot: unpacking names the slot.
  const bag = Store.playerData.items
    .map((item, slot) => ({ slot, item }))
    .filter(({ slot }) => slot >= 12 && slot < 12 + 64);
  const loose = looseJewels(bag);
  const bundles = bundlesIn(bag);
  const money = Store.playerData.money;

  // The dialog stays open on the server until it is told.
  useEffect(
    () => () => {
      if (!Store.isOffline) Store.sendToGS(closeNpcRequest());
    },
    []
  );

  const send = (packet: DataView) => {
    playUiSound('click');
    Store.sendToGS(packet);
  };

  return (
    <Panel
      id="ronda-lahap"
      title="Lahap"
      width={560}
      height={500}
      headerHeight={34}
      contentKey={`${[...loose.values()].join(',')}|${bundles.length}`}
      header={
        <p className="ronda-note">
          Empaqueta joyas de a 10, 20 o 30 ({zen(PACK_FEE_PER_TEN)} zen cada 10) y desarma
          paquetes ({zen(UNPACK_FEE)} zen).
        </p>
      }
    >
      <h3 className="ronda-section">Empaquetar</h3>
      <table className="ronda-table ronda-lahap">
        <tbody>
          {JEWEL_MIXES.map(mix => {
            const have = loose.get(mix.mix) ?? 0;
            return (
              <tr key={mix.mix}>
                <td>{itemBaseName(mix.group, mix.num)}</td>
                <td className="ronda-lahap-count">{have}</td>
                <td className="ronda-lahap-actions">
                  {PACK_SIZES.map(size => (
                    <OptionsButton
                      key={size}
                      label={`x${size}`}
                      width={52}
                      disabled={have < size || money < (size / 10) * PACK_FEE_PER_TEN}
                      onClick={() => send(packRequest(mix.mix, size))}
                      style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}
                    />
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="ronda-section">Desarmar</h3>
      {bundles.length === 0 ? (
        <p className="ronda-note">No tenés paquetes de joyas en el inventario.</p>
      ) : (
        <table className="ronda-table ronda-lahap">
          <tbody>
            {bundles.map(bundle => (
              <tr key={bundle.slot}>
                <td>{itemBaseName(12, bundle.mix.packed)}</td>
                <td className="ronda-lahap-count">{bundle.size}</td>
                <td className="ronda-lahap-actions">
                  <OptionsButton
                    label="Desarmar"
                    width={96}
                    disabled={money < UNPACK_FEE}
                    onClick={() => send(unpackRequest(bundle.mix.mix, bundle.slot))}
                    style={{ position: 'relative', display: 'inline-block' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
});

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

const SERVER_EVENT_LABEL: Record<EventScheduleRow['key'], () => string> = {
  bloodCastle: () => EVENT_TEXT.bloodCastle,
  devilSquare: () => EVENT_TEXT.devilSquare,
  chaosCastle: () => EVENT_TEXT.chaosCastle,
};

/** An open event's own entry, or ask the server again for a time not known yet. */
function openServerEvent(row: EventScheduleRow): void {
  playUiSound('click');
  if (!row.open) {
    refreshEventSchedule(row.key);
    return;
  }
  closeRondaPanel();
  if (row.key === 'bloodCastle') events.openBloodCastle();
  else if (row.key === 'devilSquare') events.openDevilSquare();
  else events.askChaosCastleOpening();
}

/** Mu La Ronda: the running invasions' names, by the server's tally key (common/invasionTally.ts). */
const INVASION_LABEL: Record<string, string> = {
  Golden: 'Invasión dorada',
  RedDragon: 'Invasión del Dragón Rojo',
  WhiteWizard: 'Invasión del Mago Blanco',
  Medusa: 'Medusa',
  SkeletonKing: 'Skeleton King',
  LordSilvester: 'Lord Silvester',
  Erohim: 'Erohim',
  LorenDeep: 'Loren Deep',
};

/** Mu La Ronda: every running invasion, each monster with how many are dead out of how many came. */
const InvasionCounts = observer(() => {
  const running = runningInvasions();
  if (!running.length) return null;
  return (
    <div className="ronda-invasions">
      {running.map(({ key, counts }) => {
        const killed = counts.reduce((sum, c) => sum + c.killed, 0);
        const total = counts.reduce((sum, c) => sum + c.total, 0);
        return (
          <div key={key} className="ronda-invasion">
            <div className="ronda-invasion-title">
              {INVASION_LABEL[key] ?? key} <span>{killed}/{total}</span>
            </div>
            <table className="ronda-table">
              <tbody>
                {counts.map(c => (
                  <tr key={c.monster} className={c.killed >= c.total ? 'is-done' : ''}>
                    <td>{monsterDisplayName(c.monster)}</td>
                    <td className="ronda-events-clock">
                      {c.killed}/{c.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
});

const EventsWindow = observer(() => {
  // The fixed ones count down on the client: re-render once a second.
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel id="ronda-events" title="Eventos" width={420} height={420} contentKey="events" noScroll rowsClassName="ronda-events-rows">
      <table className="ronda-table ronda-events">
        <tbody>
          {eventSchedule().map(row => (
            <tr key={row.key} className={row.open ? 'is-open' : ''} onClick={() => openServerEvent(row)}>
              <td>{SERVER_EVENT_LABEL[row.key]()}</td>
              <td className="ronda-events-clock">
                {row.seconds !== null && !row.open && !row.far ? clockText(row.seconds) : rowText(row)}
              </td>
            </tr>
          ))}
          {FIXED_EVENTS.map(event => (
            <tr key={event.key}>
              <td>{event.label}</td>
              <td className="ronda-events-clock">{clockText(secondsToNext(event.times, now, event.notOn))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <InvasionCounts />
      <p className="ronda-note">
        Blood Castle, Devil Square y Chaos Castle: tocá el evento cuando está abierto para entrar.
      </p>
    </Panel>
  );
});

export const RondaPanels = observer(() => (
  <>
    {rondaPanels.open === 'events' && <EventsWindow />}
    {rondaPanels.open === 'lahap' && <LahapWindow />}
    {rondaPanels.open === 'commands' && <CommandsWindow />}
    {rondaPanels.open === 'rankings' && <RankingsWindow />}
    {rondaPanels.open === 'vip' && <VipWindow />}
  </>
));
