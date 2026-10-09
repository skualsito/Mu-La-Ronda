import { useEffect, useState } from 'react';
import { api, type EventList, type EventStatus, type GameEventRow } from '../api';
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

export function EventsPage() {
  const toast = useToast();
  const list = useLoad(() => api<EventList>('/events'), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<GameEventRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!busy && !editing) list.reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [busy, editing, list]);

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

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
