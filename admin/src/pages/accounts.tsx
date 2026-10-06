import { useEffect, useState } from 'react';
import { api, type Account, type AccountRow, type InventoryItem } from '../api';
import { MuGrid } from '../muGrid';
import { ItemEditor } from './inventory';
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
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const picked = (data ?? []).filter(row => selected.has(row.id));
  const toggle = (id: string, on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const remove = async () => {
    try {
      const res = await api<{ deleted: string[] }>('/accounts/delete', { method: 'POST', body: { ids: picked.map(r => r.id) } });
      toast(`Borradas: ${res.deleted.join(', ') || 'ninguna'}`);
      setSelected(new Set());
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <>
      <PageHeader title="Cuentas" subtitle="Buscá por usuario o email" />
      <Card>
        <div className="toolbar">
          <input className="search" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <span className="muted small">{data ? `${data.length} resultados` : ''}</span>
          {picked.length > 0 && (
            <button className="btn btn-danger btn-small" onClick={() => setConfirmDelete(true)}>
              Borrar {picked.length} {picked.length === 1 ? 'cuenta' : 'cuentas'}
            </button>
          )}
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label="Elegir todas"
                      checked={data.some(r => !r.online) && data.every(r => r.online || selected.has(r.id))}
                      onChange={e => setSelected(e.target.checked ? new Set(data.filter(r => !r.online).map(r => r.id)) : new Set())}
                    />
                  </th>
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
                    <td className="check-col" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(row.id)} disabled={row.online} title={row.online ? 'Conectada' : undefined} onChange={e => toggle(row.id, e.target.checked)} />
                    </td>
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
                    <td colSpan={6} className="empty">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {confirmDelete && (
        <Confirm
          title={`Borrar ${picked.length} ${picked.length === 1 ? 'cuenta' : 'cuentas'}`}
          text={`Se borran para siempre, con sus personajes, items y baúl: ${picked.map(r => r.login).join(', ')}.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            setConfirmDelete(false);
            if (yes) void remove();
          }}
        />
      )}
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

      <VipCard accountId={id} locked={data.online} />

      <VaultCard accountId={id} locked={data.online} />

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

type Vault = { money: number; items: InventoryItem[] };

/** The account's baúl: 8x15 like the game's, items and zen. Only while the account is offline. */
export function VaultCard({ accountId, locked }: { accountId: string; locked: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<Vault>(`/accounts/${accountId}/vault`), [accountId]);
  const [editing, setEditing] = useState<InventoryItem | { slot: number } | 'new' | null>(null);
  const [money, setMoney] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const path = `/accounts/${accountId}/vault`;
  const run = async (call: Promise<Vault>, done: string) => {
    try {
      setData(await call);
      setEditing(null);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };
  const editingItem = editing && editing !== 'new' && 'id' in editing ? editing : null;
  const atSlot = editing && editing !== 'new' && !('id' in editing) ? editing.slot : undefined;

  return (
    <Card
      title={`Baúl (${data.items.length} items)`}
      actions={
        <button className="btn btn-small" disabled={locked} onClick={() => setEditing('new')}>
          + Agregar item
        </button>
      }
    >
      {locked && <p className="muted small">La cuenta está conectada: el baúl se puede ver pero no tocar.</p>}
      <div className="shop-body">
        <MuGrid
          items={data.items}
          first={0}
          columns={8}
          rows={15}
          disabled={locked}
          selectedId={editingItem?.id}
          onSelect={item => setEditing(item)}
          onEmptyClick={slot => setEditing({ slot })}
          onMove={(item, slot) => run(api(`${path}/items/${item.id}`, { method: 'PATCH', body: { slot } }), `${item.name} movido`)}
        />
        <div className="shop-side">
          <label className="field">
            <span className="field-label">Zen en el baúl</span>
            <input
              inputMode="numeric"
              disabled={locked}
              value={money ?? String(data.money)}
              onChange={e => setMoney(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </label>
          {money !== null && Number(money) !== data.money && (
            <button
              className="btn btn-primary btn-small"
              disabled={locked}
              onClick={() => run(api(`${path}/money`, { method: 'PATCH', body: { money: Number(money) } }), 'Zen guardado').then(() => setMoney(null))}
            >
              Guardar zen
            </button>
          )}
          <p className="muted small">Tocá un casillero vacío para poner un item ahí. Arrastrá un item para moverlo.</p>
        </div>
      </div>

      {editing && (
        <ItemEditor
          item={editingItem}
          locked={locked}
          onClose={() => setEditing(null)}
          onSave={(body, item) =>
            run(
              item
                ? api(`${path}/items/${item.id}`, { method: 'PATCH', body })
                : api(path, { method: 'POST', body: atSlot === undefined ? body : { ...(body as object), slot: atSlot } }),
              item ? 'Item guardado' : 'Item agregado'
            )
          }
          onDelete={item => run(api(`${path}/items/${item.id}`, { method: 'DELETE' }), 'Item borrado del baúl')}
          saveLabel={editingItem ? 'Guardar' : 'Agregar al baúl'}
        />
      )}
    </Card>
  );
}

type Vip = { tier: number; name: string; expiresAt: string | null; active: boolean };

const VIP_OPTIONS = [
  { value: 0, label: 'Sin VIP' },
  { value: 1, label: 'Bronce (+10% exp y zen)' },
  { value: 2, label: 'Plata (+20% exp y zen)' },
  { value: 3, label: 'Oro (+30% exp y zen)' },
];

/** The account's VIP: what it has and until when, and a way to give one by hand. */
function VipCard({ accountId, locked }: { accountId: string; locked: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<Vip>(`/accounts/${accountId}/vip`), [accountId]);
  const [tier, setTier] = useState<number | null>(null);
  const [days, setDays] = useState(30);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const chosen = tier ?? (data.active ? data.tier : 1);
  const save = async () => {
    try {
      setData(await api<Vip>(`/accounts/${accountId}/vip`, { method: 'PATCH', body: { tier: chosen, days } }));
      setTier(null);
      toast(chosen === 0 ? 'VIP quitado' : 'VIP guardado');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Card title="VIP">
      <p>
        {data.active ? (
          <>
            <Badge tone="ok">{data.name}</Badge> hasta {formatDate(data.expiresAt!)}
          </>
        ) : (
          <span className="muted">Sin VIP{data.expiresAt ? ` (el último venció ${formatDate(data.expiresAt)})` : ''}.</span>
        )}
      </p>
      <div className="form-grid">
        <SelectField label="Nivel" value={chosen} disabled={locked} options={VIP_OPTIONS} onChange={v => setTier(v)} />
        <label className="field">
          <span className="field-label">Días desde hoy</span>
          <input type="number" min={1} max={3650} value={days} disabled={locked || chosen === 0} onChange={e => setDays(Number(e.target.value) || 0)} />
        </label>
      </div>
      <div className="row-actions">
        <button className="btn btn-primary" disabled={locked || (chosen !== 0 && days < 1)} onClick={save}>
          {chosen === 0 ? 'Quitar VIP' : 'Dar VIP'}
        </button>
      </div>
      <p className="muted small">
        Los jugadores lo compran en el juego (menú Esc → VIP, o /vip oro). Se aplica cuando entra con un personaje.
        {locked && ' La cuenta está conectada: que salga primero.'}
      </p>
    </Card>
  );
}
