import { api, type Dashboard } from '../api';
import { Card, ErrorBox, Loading, PageHeader, Stat, formatDate, formatNumber, useLoad } from '../ui';

export function DashboardPage() {
  const { data, error, reload } = useLoad(() => api<Dashboard>('/dashboard'), []);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const running = data.server.state === 'running';

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Estado del servidor y actividad reciente"
        actions={
          <button className="btn btn-ghost" onClick={reload}>
            Actualizar
          </button>
        }
      />

      <div className="stats-grid">
        <Stat
          label="OpenMU"
          value={data.server.available ? (running ? 'En línea' : data.server.state) : 'Sin datos'}
          hint={data.server.status ?? data.server.error}
          tone={running ? 'ok' : 'bad'}
        />
        <Stat label="Jugadores conectados" value={formatNumber(data.online)} tone={data.online ? 'ok' : undefined} />
        <Stat label="Cuentas" value={formatNumber(data.accounts)} hint={`${data.newAccounts} nuevas en 24 h`} />
        <Stat label="Personajes" value={formatNumber(data.characters)} />
        <Stat label="Cuentas baneadas" value={formatNumber(data.banned)} tone={data.banned ? 'warn' : undefined} />
      </div>

      <div className="grid-2">
        <Card title="Top resets">
          <table className="table">
            <thead>
              <tr>
                <th>Personaje</th>
                <th>Clase</th>
                <th className="num">Resets</th>
                <th className="num">Nivel</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map(row => (
                <tr key={row.name}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td className="muted">{row.class}</td>
                  <td className="num accent">{row.resets}</td>
                  <td className="num">{row.level}</td>
                </tr>
              ))}
              {!data.top.length && (
                <tr>
                  <td colSpan={4} className="empty">
                    Todavía no hay personajes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title={`Conectados ahora (${data.onlineList.length})`}>
          {data.onlineList.length ? (
            <ul className="list online-list">
              {data.onlineList.map(entry =>
                entry.character ? (
                  <li key={entry.character.id}>
                    <a href={`#/personajes/${entry.character.id}`}>
                      <strong>{entry.character.name}</strong>
                    </a>
                    <span className="muted small">
                      {entry.character.class} · nivel {entry.character.level} · {entry.character.resets} resets
                      {entry.character.map ? ` · ${entry.character.map}` : ''}
                    </span>
                  </li>
                ) : (
                  <li key={entry.accountId}>
                    <a href={`#/cuentas/${entry.accountId}`}>{entry.login}</a>
                    <span className="muted small">eligiendo personaje</span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="empty">Nadie conectado.</p>
          )}
        </Card>
      </div>

      <Card title="Últimas cuentas creadas">
        <ul className="list recent-accounts">
          {data.recent.map(r => (
            <li key={r.login}>
              <span>{r.login}</span>
              <span className="muted small">{formatDate(r.registeredAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
