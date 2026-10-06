import { useEffect, useState } from 'react';
import { api, type Account, type AccountRow } from '../api';
import {
  ACCOUNT_STATE,
  Badge,
  Card,
  Confirm,
  ErrorBox,
  Loading,
  PageHeader,
  SelectField,
  TextField,
  formatDate,
  useDraft,
  useLoad,
  useToast,
} from '../ui';

export function AccountsPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, reload } = useLoad(() => api<AccountRow[]>(`/accounts?q=${encodeURIComponent(query)}`), [query]);

  return (
    <>
      <PageHeader title="Cuentas" subtitle="Buscá por usuario o email" />
      <Card>
        <div className="toolbar">
          <input className="search" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <span className="muted small">{data ? `${data.length} resultados` : ''}</span>
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th className="num">Personajes</th>
                  <th>Creada</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id} onClick={() => (location.hash = `#/cuentas/${row.id}`)}>
                    <td>
                      <strong>{row.login}</strong> {row.online && <Badge tone="ok">online</Badge>}
                    </td>
                    <td className="muted">{row.email || '—'}</td>
                    <td className="num">{row.characters}</td>
                    <td className="muted">{formatDate(row.registeredAt)}</td>
                    <td>
                      <Badge tone={ACCOUNT_STATE[row.state]?.tone}>{ACCOUNT_STATE[row.state]?.label ?? row.state}</Badge>
                    </td>
                  </tr>
                ))}
                {!data.length && (
                  <tr>
                    <td colSpan={5} className="empty">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function AccountPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<Account>(`/accounts/${id}`), [id]);
  const [form, updateForm] = useDraft(data, a => ({ email: a.email ?? '', state: a.state }));
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; text: string; body: Record<string, unknown> }>(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !form) return <Loading />;

  const { email, state } = form;
  const setEmail = (v: string) => updateForm(f => ({ ...f, email: v }));
  const setState = (v: number) => updateForm(f => ({ ...f, state: v }));

  const patch = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      setData(await api<Account>(`/accounts/${id}`, { method: 'PATCH', body }));
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const banned = data.state === 4 || data.state === 5;

  return (
    <>
      <PageHeader
        title={data.login}
        subtitle={`Creada ${formatDate(data.registeredAt)}`}
        actions={
          <a className="btn btn-ghost" href="#/cuentas">
            ← Volver
          </a>
        }
      />

      {data.online && (
        <div className="notice notice-info">
          La cuenta está conectada. Los cambios de estado (baneo, GM) se aplican la próxima vez que entre.
        </div>
      )}

      <div className="grid-2">
        <Card title="Cuenta">
          <div className="form-grid">
            <SelectField
              label="Estado"
              value={state}
              options={[
                { value: 0, label: 'Normal' },
                { value: 2, label: 'Game Master' },
                { value: 4, label: 'Baneada' },
                { value: 5, label: 'Baneo temporal' },
              ]}
              onChange={setState}
            />
            <TextField label="Email" value={email} onChange={setEmail} />
          </div>
          <div className="row-actions">
            <button
              className="btn btn-primary"
              disabled={busy || (state === data.state && email === (data.email ?? ''))}
              onClick={() => patch({ state, email }, 'Cuenta guardada')}
            >
              Guardar
            </button>
            {banned && (
              <button className="btn" disabled={busy} onClick={() => patch({ state: 0 }, 'Cuenta desbaneada')}>
                Desbanear
              </button>
            )}
          </div>
        </Card>

        <Card title="Seguridad">
          <TextField
            label="Nueva contraseña"
            type="text"
            value={password}
            onChange={setPassword}
            placeholder="4 a 10 caracteres"
            hint="Para cuando un jugador se olvida la suya. No se muestra la actual."
          />
          <div className="row-actions">
            <button
              className="btn"
              disabled={busy || password.length < 4}
              onClick={() =>
                setConfirm({
                  title: 'Cambiar contraseña',
                  text: `La cuenta ${data.login} va a entrar con la contraseña nueva.`,
                  body: { password },
                })
              }
            >
              Cambiar contraseña
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy || !data.hasVaultPin}
              onClick={() => patch({ clearVaultPin: true }, 'PIN del baúl borrado')}
              title={data.hasVaultPin ? '' : 'No tiene PIN'}
            >
              Borrar PIN del baúl
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy || !data.chatBanUntil}
              onClick={() => patch({ clearChatBan: true }, 'Silencio de chat quitado')}
            >
              Quitar silencio de chat
            </button>
          </div>
        </Card>
      </div>

      <Card title={`Personajes (${data.characters.length})`}>
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Personaje</th>
              <th>Clase</th>
              <th className="num">Resets</th>
              <th className="num">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {data.characters.map(c => (
              <tr key={c.id} onClick={() => (location.hash = `#/personajes/${c.id}`)}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td className="muted">{c.class}</td>
                <td className="num accent">{c.resets}</td>
                <td className="num">{c.level}</td>
              </tr>
            ))}
            {!data.characters.length && (
              <tr>
                <td colSpan={4} className="empty">
                  Sin personajes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {confirm && (
        <Confirm
          title={confirm.title}
          text={confirm.text}
          onAnswer={yes => {
            const body = confirm.body;
            setConfirm(null);
            if (yes) {
              patch(body, 'Contraseña cambiada');
              setPassword('');
            }
          }}
        />
      )}
    </>
  );
}
