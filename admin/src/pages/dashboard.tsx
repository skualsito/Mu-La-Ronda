import { api, type Dashboard } from '../api';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, formatDate, formatNumber, useLoad } from '../ui';

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

        <Card title="Conectados ahora">
          {data.onlineList.length ? (
            <ul className="list online-list">
              {data.onlineList.map(account => {
                // One character: the row goes straight to it; more: each name links to its own.
                const only = account.characters.length === 1 ? account.characters[0] : null;
                return (
                  <li key={account.accountId}>
                    <a href={only ? `#/personajes/${only.id}` : `#/cuentas/${account.accountId}`}>
                      <Badge tone="ok">{account.login}</Badge>
                    </a>
                    <span className="online-chars">
                      {account.characters.map(c => (
                        <a key={c.id} href={`#/personajes/${c.id}`} title={`${c.class} · nivel ${c.level} · ${c.resets} resets`}>
                          {c.name}
                        </a>
                      ))}
                      {!account.characters.length && <span className="muted small">sin personajes</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Nadie conectado.</p>
          )}
          <h3 className="subhead">Últimas cuentas creadas</h3>
          <ul className="list">
            {data.recent.map(r => (
              <li key={r.login}>
                <span>{r.login}</span>
                <span className="muted small">{formatDate(r.registeredAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
