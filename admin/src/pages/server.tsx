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

  const running = status.data?.state === 'running';
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
