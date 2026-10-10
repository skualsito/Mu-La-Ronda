import { useEffect, useRef, useState } from 'react';
import { api, type ServerStatus } from '../api';
import { Card, Confirm, ErrorBox, Loading, PageHeader, Stat, useLoad, useToast } from '../ui';

/** openmu.<domain>: OpenMU's own (Blazor) panel, for what this one does not cover. */
const openmuPanel = () => `https://${location.hostname.replace(/^admin\./, 'openmu.')}/`;

export function ServerPage() {
  const toast = useToast();
  const status = useLoad(() => api<ServerStatus>('/server'), []);
  const logs = useLoad(() => api<{ lines: string[] }>('/server/logs'), []);
  const [confirm, setConfirm] = useState(false);
  const [confirmStop, setConfirmStop] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // The countdown of a stop with a warning, and the state while it changes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [filter, setFilter] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs.data]);

  const restart = async () => {
    try {
      await api('/server/restart', { method: 'POST' });
      toast('OpenMU se está reiniciando');
      setTimeout(() => {
        status.reload();
        logs.reload();
      }, 4000);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const call = async (path: string, body: unknown, done: string) => {
    try {
      await api(path, { method: 'POST', body });
      toast(done);
      status.reload();
      setTimeout(() => {
        status.reload();
        logs.reload();
      }, 4000);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const running = status.data?.state === 'running';
  const stopAt = status.data?.stopAt ? new Date(status.data.stopAt).getTime() : null;
  const left = stopAt ? Math.max(0, Math.round((stopAt - now) / 1000)) : 0;
  const lines = (logs.data?.lines ?? []).filter(l => !filter || l.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Servidor"
        subtitle="Estado de OpenMU, reinicio y registro"
        actions={
          <a className="btn btn-ghost" href={openmuPanel()} target="_blank" rel="noreferrer">
            Panel de OpenMU ↗
          </a>
        }
      />

      <div className="stats-grid">
        {status.error ? (
          <ErrorBox error={status.error} onRetry={status.reload} />
        ) : !status.data ? (
          <Loading />
        ) : (
          <Stat
            label="OpenMU"
            value={status.data.available ? (running ? 'En línea' : status.data.state) : 'Sin acceso a Docker'}
            hint={status.data.status ?? status.data.error}
            tone={running ? 'ok' : 'bad'}
          />
        )}
      </div>

      <Card title="Apagar y prender">
        {!status.data?.available ? (
          <p className="muted">Sin acceso a Docker.</p>
        ) : running ? (
          <>
            <p className="muted">
              Apaga el servidor del juego para hacer cambios sin gente adentro: guarda y desconecta a todos, y nadie puede
              entrar hasta que lo prendas. Con aviso, los jugadores ven un mensaje dorado antes.
            </p>
            {stopAt ? (
              <div className="row-actions">
                <span>
                  Se apaga en <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b>
                </span>
                <button className="btn btn-ghost" onClick={() => call('/server/stop/cancel', {}, 'Apagado cancelado')}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="row-actions">
                <button className="btn" onClick={() => setConfirmStop(5)}>
                  Apagar en 5 min (con aviso)
                </button>
                <button className="btn" onClick={() => setConfirmStop(1)}>
                  Apagar en 1 min (con aviso)
                </button>
                <button className="btn btn-danger" onClick={() => setConfirmStop(0)}>
                  Apagar ya
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted">El servidor del juego está apagado: nadie puede entrar.</p>
            <div className="row-actions">
              <button className="btn btn-primary" onClick={() => call('/server/start', {}, 'OpenMU se está prendiendo (tarda un minuto)')}>
                Prender OpenMU
              </button>
            </div>
          </>
        )}
      </Card>

      <Card
        title="Reiniciar"
        actions={
          <button className="btn btn-danger" onClick={() => setConfirm(true)} disabled={!status.data?.available}>
            Reiniciar OpenMU
          </button>
        }
      >
        <p className="muted">
          Necesario para que se apliquen los cambios de Configuración. Desconecta a todos los jugadores unos 30 segundos.
        </p>
      </Card>

      <Card
        title="Registro (últimas 300 líneas)"
        actions={
          <div className="inline">
            <input className="search search-small" placeholder="Filtrar…" value={filter} onChange={e => setFilter(e.target.value)} />
            <button className="btn btn-ghost btn-small" onClick={logs.reload}>
              Actualizar
            </button>
          </div>
        }
      >
        {logs.error && <ErrorBox error={logs.error} onRetry={logs.reload} />}
        <pre className="logs" ref={logRef}>
          {lines.map((line, i) => (
            <div key={i} className={/error|exception|fail/i.test(line) ? 'log-error' : /warn/i.test(line) ? 'log-warn' : ''}>
              {line}
            </div>
          ))}
          {!lines.length && <div className="muted">Sin líneas.</div>}
        </pre>
      </Card>

      {confirmStop !== null && (
        <Confirm
          title="Apagar OpenMU"
          text={
            confirmStop === 0
              ? 'Se desconecta a todos ahora y nadie puede entrar hasta que lo prendas.'
              : `Los jugadores ven el aviso ahora y el servidor se apaga en ${confirmStop} ${confirmStop === 1 ? 'minuto' : 'minutos'}. Nadie puede entrar hasta que lo prendas.`
          }
          confirmLabel="Apagar"
          danger
          onAnswer={yes => {
            const minutes = confirmStop;
            setConfirmStop(null);
            if (yes) void call('/server/stop', { minutes }, minutes ? 'Aviso enviado' : 'OpenMU se está apagando');
          }}
        />
      )}

      {confirm && (
        <Confirm
          title="Reiniciar OpenMU"
          text="Se desconecta a todos los jugadores unos 30 segundos."
          confirmLabel="Reiniciar"
          danger
          onAnswer={yes => {
            setConfirm(false);
            if (yes) restart();
          }}
        />
      )}
    </>
  );
}
