import { useState } from 'react';
import { api, type Me, type PanelUser, type SectionKey } from '../api';
import { Badge, Card, Confirm, ErrorBox, Loading, PageHeader, Toggle, formatDate, useLoad, useToast } from '../ui';

/**
 * Panel users: people who can sign in to this panel and see only the sections
 * ticked for them - say someone who looks after the shops and spots. Only the
 * main administrator (deploy/.env) manages them.
 */

function SectionChecks({
  sections,
  value,
  onChange,
}: {
  sections: Me['sections'];
  value: SectionKey[];
  onChange: (v: SectionKey[]) => void;
}) {
  return (
    <div className="section-checks">
      {sections.map(s => (
        <label key={s.key} className="check">
          <input
            type="checkbox"
            checked={value.includes(s.key)}
            onChange={e => onChange(e.target.checked ? [...value, s.key] : value.filter(k => k !== s.key))}
          />
          <span>{s.label}</span>
        </label>
      ))}
    </div>
  );
}

function UserRow({
  user,
  sections,
  onSave,
  onDelete,
}: {
  user: PanelUser;
  sections: Me['sections'];
  onSave: (patch: Partial<PanelUser> & { password?: string }) => Promise<void>;
  onDelete: () => void;
}) {
  const [permissions, setPermissions] = useState(user.permissions);
  const [source, setSource] = useState(user);
  const [password, setPassword] = useState('');
  if (source !== user) {
    setSource(user);
    setPermissions(user.permissions);
  }
  const dirty = permissions.join() !== user.permissions.join();

  return (
    <div className={`user-row ${user.enabled ? '' : 'is-off'}`}>
      <div className="user-head">
        <strong>{user.username}</strong>
        {!user.enabled && <Badge tone="bad">Deshabilitado</Badge>}
        <span className="muted small">Último ingreso: {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'nunca'}</span>
      </div>
      <SectionChecks sections={sections} value={permissions} onChange={setPermissions} />
      <div className="user-actions">
        {dirty && (
          <button className="btn btn-primary btn-small" onClick={() => onSave({ permissions })}>
            Guardar permisos
          </button>
        )}
        <input type="password" placeholder="Nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
        <button
          className="btn btn-small"
          disabled={password.length < 8}
          title="8 caracteres o más"
          onClick={() => onSave({ password }).then(() => setPassword(''))}
        >
          Cambiar contraseña
        </button>
        <Toggle label="Habilitado" checked={user.enabled} onChange={v => onSave({ enabled: v })} />
        <button className="btn btn-ghost btn-small" onClick={onDelete}>
          Borrar
        </button>
      </div>
    </div>
  );
}

export function UsersPage({ me }: { me: Me }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<PanelUser[]>('/admin-users'), []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<SectionKey[]>(['shops', 'spots']);
  const [deleting, setDeleting] = useState<PanelUser | null>(null);

  if (!me.superuser) return <ErrorBox error="Solo el administrador principal puede manejar usuarios." />;

  const run = async (call: Promise<PanelUser[]>, done: string) => {
    try {
      setData(await call);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
      throw err;
    }
  };

  const create = () =>
    run(api('/admin-users', { method: 'POST', body: { username, password, permissions } }), `Usuario ${username} creado`).then(
      () => {
        setUsername('');
        setPassword('');
      },
      () => {}
    );

  return (
    <>
      <PageHeader
        title="Usuarios del panel"
        subtitle="Gente que puede entrar a este panel y ver solo las secciones que marques. Vos (el usuario de deploy/.env) seguís viendo todo."
      />

      <Card title="Nuevo usuario">
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Usuario</span>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ej. tienda" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caracteres o más" autoComplete="new-password" />
          </label>
        </div>
        <span className="field-label">Puede ver</span>
        <SectionChecks sections={me.sections} value={permissions} onChange={setPermissions} />
        <button className="btn btn-primary" disabled={!username.trim() || password.length < 8} onClick={create}>
          Crear usuario
        </button>
      </Card>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <Card title={`Usuarios (${data.length})`}>
          {data.length === 0 ? (
            <p className="muted">Todavía no creaste ninguno.</p>
          ) : (
            <div className="user-list">
              {data.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  sections={me.sections}
                  onSave={patch => run(api(`/admin-users/${u.id}`, { method: 'PATCH', body: patch }), 'Guardado').catch(() => {})}
                  onDelete={() => setDeleting(u)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {deleting && (
        <Confirm
          title="Borrar usuario"
          text={`${deleting.username} ya no va a poder entrar al panel.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            const u = deleting;
            setDeleting(null);
            if (yes) void run(api(`/admin-users/${u.id}`, { method: 'DELETE' }), 'Usuario borrado').catch(() => {});
          }}
        />
      )}
    </>
  );
}
