import './style.less';
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
import { markVipBuying, VIP_TIERS, vipState, type VipTierInfo } from '../../../../../common/vip';
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

const VipWindow = observer(() => {
  const [confirm, setConfirm] = useState<VipTierInfo | null>(null);
  const [months, setMonths] = useState(1);
  const [code, setCode] = useState('');
  const money = Store.playerData.money;
  const current = vipState.name;
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  // What the account has comes from the server's answer to /vip.
  useEffect(() => {
    if (!vipState.known) Social.sendChat('/vip');
  }, []);

  return (
    <Panel
      id="ronda-vip"
      title="VIP"
      width={620}
      height={490}
      headerHeight={44}
      noScroll
      contentKey={`${current}-${vipState.until}-${vipState.buying}`}
      header={
        <p className="ronda-note ronda-vip-head">
          {!vipState.known
            ? 'Consultando tu VIP…'
            : current
              ? <>Tenés <b className="ronda-vip-name">VIP {current}</b> hasta el {vipState.until}. Lo que compres se suma: los días que te quedan no se pierden.</>
              : 'No tenés VIP. Es de la cuenta: vale para todos tus personajes, 30 días por mes que compres.'}
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
      <div className="ronda-vip-tiers">
        {VIP_TIERS.map(tier => {
          const total = tier.price * months;
          // With a code the server works out the discount, so the price only stops the button without one.
          const short = !cleanCode && money < total;
          return (
            <div key={tier.tier} className={`ronda-vip-tier tier-${tier.tier} ${current === tier.name ? 'is-current' : ''}`}>
              <h3>{tier.name}</h3>
              <p className="ronda-vip-bonus">+{tier.bonus}% experiencia</p>
              <p className="ronda-vip-bonus">+{tier.bonus}% zen</p>
              <p className="ronda-vip-price">{zen(total)} zen</p>
              <p className="ronda-vip-days">{months * 30} días{cleanCode ? ' · menos el descuento' : ''}</p>
              <OptionsButton
                label={vipState.buying ? '…' : current === tier.name ? 'Renovar' : 'Comprar'}
                width={110}
                disabled={short || vipState.buying}
                onClick={() => {
                  playUiSound('click');
                  setConfirm(tier);
                }}
                style={{ position: 'relative', marginTop: 6 }}
              />
              {short && <p className="ronda-vip-short">Te faltan {zen(total - money)} zen</p>}
            </div>
          );
        })}
      </div>
      <p className="ronda-note ronda-vip-foot">
        Durante la beta el VIP se paga con zen. Más adelante se va a poder pagar con Mercado Pago.
      </p>

      {confirm && (
        <ConfirmBox
          text={
            cleanCode
              ? `¿Comprar ${months} mes(es) de VIP ${confirm.name} con el código ${cleanCode}? Sin descuento son ${zen(confirm.price * months)} zen.`
              : `¿Comprar ${months} mes(es) de VIP ${confirm.name} por ${zen(confirm.price * months)} zen?`
          }
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

const EventsWindow = observer(() => {
  // The fixed ones count down on the client: re-render once a second.
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel id="ronda-events" title="Eventos" width={420} height={420} contentKey="events" noScroll>
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
              <td className="ronda-events-clock">{clockText(secondsToNext(event.times, now))}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
