import { useEffect, useState } from 'react';
import { api, type EventDetails, type EventList, type EventMonster, type EventStatus, type GameEventRow } from '../api';
import { Badge, Card, Confirm, ErrorBox, Loading, PageHeader, formatDate, useLoad, useToast } from '../ui';

/**
 * Events: every periodic event OpenMU runs, what it is doing now and when it
 * starts next, a start and a stop button to try it out, and the team's notes
 * on whether it works and when it was last tested (server/events.ts).
 */

const STATUS: Record<EventStatus, { label: string; tone: 'neutral' | 'ok' | 'bad' }> = {
  untested: { label: 'Sin probar', tone: 'neutral' },
  ok: { label: 'Funciona', tone: 'ok' },
  broken: { label: 'No funciona', tone: 'bad' },
};

const STATE: Record<GameEventRow['state'], string> = {
  NotStarted: 'Esperando su horario',
  Prepared: 'Por empezar',
  Started: 'En curso',
};

const inMinutes = (iso: string | null) => {
  if (!iso) return null;
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'ahora';
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `en ${hours} h ${minutes % 60} min`;
};

/** How often the page asks again while open: an event that was just started shows up running. */
const REFRESH_MS = 10_000;

/** Mu La Ronda: the list grew long enough to hide what runs; the running ones get a tab of their own. */
type EventsTab = 'activos' | 'todos';

export function EventsPage({ tab: tabParam }: { tab?: string }) {
  const toast = useToast();
  const list = useLoad(() => api<EventList>('/events'), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<GameEventRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);
  const [details, setDetails] = useState<GameEventRow | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!busy && !editing) list.reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [busy, editing, list]);

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const running = list.data.events.filter(e => e.running);
  const tab: EventsTab = tabParam === 'activos' || tabParam === 'todos' ? tabParam : running.length ? 'activos' : 'todos';

  const act = async (event: GameEventRow, path: string, body: unknown, done: string) => {
    setBusy(event.id);
    try {
      list.setData(await api<EventList>(`/events/${event.id}/${path}`, { method: 'POST', body }));
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Eventos"
        subtitle="Qué eventos corre el servidor, si están en curso y cuándo arrancan. Empezar y Parar actúan en todos los servers al momento (sin reiniciar). El estado de prueba lo anotan ustedes."
      />
      {list.data.error && <div className="notice notice-warn">{list.data.error}</div>}
      <nav className="tabs">
        <a href="#/eventos/activos" className={tab === 'activos' ? 'active' : ''}>
          En curso ({running.length})
        </a>
        <a href="#/eventos/todos" className={tab === 'todos' ? 'active' : ''}>
          Todos los eventos ({list.data.events.length})
        </a>
      </nav>

      {tab === 'activos' && !running.length && (
        <Card>
          <p className="muted">No hay ningún evento en curso. Los podés arrancar desde la pestaña Todos los eventos.</p>
        </Card>
      )}
      {tab === 'activos' &&
        running.map(e => (
          <Card
            key={e.id}
            title={e.name}
            actions={
              <button className="btn btn-small btn-danger" disabled={busy === e.id} onClick={() => setConfirmStop(e)}>
                Parar
              </button>
            }
          >
            <EventDetailsBody event={e} />
          </Card>
        ))}

      {tab === 'todos' && (
        <Card>
          <div className="table-wrap">
            <table className="table events-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Ahora</th>
                  <th>Próximo</th>
                  <th>¿Funciona?</th>
                  <th>Nota</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.events.map(e => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                      <div className="muted small">{e.kind === 'minigame' ? 'minijuego' : 'periódico'}</div>
                    </td>
                    <td>
                      {e.running ? <Badge tone="ok">En curso</Badge> : <span className="muted">{STATE[e.state]}</span>}
                      {e.running && e.kind === 'minigame' && <div className="muted small">{e.players} jugador{e.players === 1 ? '' : 'es'}</div>}
                      {e.lastStartUtc && <div className="muted small">último: {formatDate(e.lastStartUtc)}</div>}
                    </td>
                    <td>{e.nextStartUtc ? <span title={formatDate(e.nextStartUtc)}>{inMinutes(e.nextStartUtc)}</span> : <span className="muted">sin horario</span>}</td>
                    <td>
                      <select
                        value={e.status}
                        disabled={busy === e.id}
                        onChange={ev => void act(e, 'note', { status: ev.target.value, tested: true }, 'Anotado')}
                      >
                        {(Object.keys(STATUS) as EventStatus[]).map(s => (
                          <option key={s} value={s}>
                            {STATUS[s].label}
                          </option>
                        ))}
                      </select>
                      {e.testedAt && (
                        <div className="muted small">
                          probado {formatDate(e.testedAt)}
                          {e.testedBy ? ` por ${e.testedBy}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="events-note">
                      {editing?.id === e.id ? (
                        <div className="events-note-edit">
                          <input
                            value={editing.note}
                            autoFocus
                            maxLength={500}
                            onChange={ev => setEditing({ id: e.id, note: ev.target.value })}
                            onKeyDown={ev => {
                              if (ev.key === 'Enter') {
                                void act(e, 'note', { note: editing.note }, 'Nota guardada');
                                setEditing(null);
                              } else if (ev.key === 'Escape') setEditing(null);
                            }}
                          />
                          <button
                            className="btn btn-small"
                            onClick={() => {
                              void act(e, 'note', { note: editing.note }, 'Nota guardada');
                              setEditing(null);
                            }}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <button className="link-button" onClick={() => setEditing({ id: e.id, note: e.note })}>
                          {e.note || <span className="muted">agregar nota…</span>}
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-small" onClick={() => setDetails(e)}>
                          Detalles
                        </button>
                        <button className="btn btn-small btn-primary" disabled={busy === e.id || e.running} onClick={() => void act(e, 'start', {}, `${e.name}: arranca en unos segundos`)}>
                          Empezar
                        </button>
                        <button className="btn btn-small btn-danger" disabled={busy === e.id || !e.running} onClick={() => setConfirmStop(e)}>
                          Parar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!list.data.events.length && !list.data.error && (
                  <tr>
                    <td colSpan={6} className="muted">
                      OpenMU no tiene eventos activos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {details && <EventDetailsModal event={details} onClose={() => setDetails(null)} />}

      {confirmStop && (
        <Confirm
          title={`Parar ${confirmStop.name}`}
          text="Termina el evento en todos los servers. Los que estén adentro de un minijuego vuelven a la ciudad."
          confirmLabel="Parar"
          danger
          onAnswer={yes => {
            const event = confirmStop;
            setConfirmStop(null);
            if (yes) void act(event, 'stop', {}, `${event.name}: parado`);
          }}
        />
      )}
    </>
  );
}

/** How often the details ask again while open: a boss that moves, monsters that die. */
const DETAILS_REFRESH_MS = 5_000;

/** The live monsters of one server: each one when they are few, else how many of each and where the first are. */
function LiveMonsters({ monsters }: { monsters: EventMonster[] }) {
  if (!monsters.length) return <div className="muted small">No quedan monstruos del evento vivos.</div>;
  if (monsters.length <= 12) {
    return (
      <ul className="events-monsters">
        {monsters.map((m, i) => (
          <li key={i}>
            <strong>{m.name}</strong> — {m.mapName} <code>{m.x}, {m.y}</code>
          </li>
        ))}
      </ul>
    );
  }
  const byName = new Map<string, EventMonster[]>();
  for (const m of monsters) byName.set(m.name, [...(byName.get(m.name) ?? []), m]);
  return (
    <ul className="events-monsters">
      {[...byName.entries()].map(([name, list]) => (
        <li key={name}>
          <strong>
            {name} ×{list.length}
          </strong>{' '}
          — {list[0].mapName}:{' '}
          {list.slice(0, 6).map((m, i) => (
            <code key={i}>
              {m.x}, {m.y}
            </code>
          ))}
          {list.length > 6 && <span className="muted"> …</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Everything about one event: its timetable, length and monsters, the places a boss may come to,
 * and on each server (channel) what it is doing now - while it runs, every monster it put on the
 * map still alive and where it is, so a boss can be found right after starting it.
 */
function EventDetailsModal({ event, onClose }: { event: GameEventRow; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <h2>{event.name}</h2>
        <EventDetailsBody event={event} />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/** The details themselves, asked again every few seconds: in the modal and on the running events' tab. */
function EventDetailsBody({ event }: { event: GameEventRow }) {
  const detail = useLoad(() => api<EventDetails>(`/events/${event.id}`), [event.id]);

  useEffect(() => {
    const timer = setInterval(() => detail.reload(), DETAILS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [detail]);

  const d = detail.data;
  return (
    <>
      {detail.error && !d && <ErrorBox error={detail.error} onRetry={detail.reload} />}
      {!d && !detail.error && <Loading />}
      {d && (
        <div className="events-details">
          {d.setup && (
            <section>
              <h3 className="subhead">Horario</h3>
              <div>
                {d.setup.timetable.length ? d.setup.timetable.join(' · ') : <span className="muted">sin horario</span>}
                <span className="muted small"> (hora del servidor, UTC)</span>
              </div>
              <div className="muted small">Dura {Math.round(d.setup.durationMinutes)} min, o hasta que mueren todos.</div>
            </section>
          )}
          {!!d.places?.length && (
            <section>
              <h3 className="subhead">Dónde puede aparecer</h3>
              <div>
                {d.places.map((p, i) => (
                  <code key={i}>
                    {p.x}, {p.y}
                  </code>
                ))}
              </div>
              <div className="muted small">Uno de estos lugares al azar cada vez (o la celda libre más cercana).</div>
            </section>
          )}
          {!!d.setup?.mobs?.length && (
            <section>
              <h3 className="subhead">Monstruos que trae</h3>
              <ul className="events-monsters">
                {d.setup.mobs.map(m => (
                  <li key={m.number}>
                    <strong>
                      {m.name} ×{m.count}
                    </strong>{' '}
                    — {m.maps.join(', ')}
                    {m.x !== null && m.y !== null && !d.places?.length && (
                      <>
                        {' '}
                        en <code>{m.x}, {m.y}</code>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="subhead">Ahora</h3>
            {d.servers.map(s => (
              <div key={s.server} className="events-server">
                <div>
                  <strong>Server {s.server}</strong>
                  {s.description && s.description !== `Server ${s.server}` && <span className="muted small"> — {s.description}</span>}{' '}
                  {s.running ? <Badge tone="ok">En curso</Badge> : <span className="muted">{STATE[s.state]}</span>}
                  {s.running && s.players > 0 && <span className="muted small"> · {s.players} jugador{s.players === 1 ? '' : 'es'}</span>}
                </div>
                {s.lastStartUtc && <div className="muted small">último: {formatDate(s.lastStartUtc)}</div>}
                {s.running && <LiveMonsters monsters={s.monsters} />}
                {!s.running && s.nextStartUtc && <div className="muted small">próximo: {inMinutes(s.nextStartUtc)} ({formatDate(s.nextStartUtc)})</div>}
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
