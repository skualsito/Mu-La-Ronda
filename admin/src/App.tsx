import { useEffect, useState, type FormEvent } from 'react';
import { api, setOnUnauthorized, type Me } from './api';
import { Boundary, ToastProvider, useToast } from './ui';
import { DashboardPage } from './pages/dashboard';
import { CharactersPage, CharacterPage } from './pages/characters';
import { AccountsPage, AccountPage } from './pages/accounts';
import { ConfigPage } from './pages/config';
import { SpotsPage } from './pages/spots';
import { MessagesPage } from './pages/messages';
import { VipCodesPage } from './pages/vipCodes';
import { GrandShopPage } from './pages/grandShop';
import { ShopsPage } from './pages/shops';
import { DropsPage } from './pages/drops';
import { MonstersPage } from './pages/monsters';
import { EventsPage } from './pages/events';
import { UsersPage } from './pages/users';
import { ServerPage } from './pages/server';
import { SurveyPage } from './pages/survey';

/** Hash routes: #/, #/personajes, #/personajes/<id>, #/cuentas, #/cuentas/<id>, #/config, #/servidor. */
function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** `key` is the permission each entry needs (server/users.ts SECTIONS); 'usuarios' is the superuser's. */
const NAV = [
  { path: '', key: 'inicio', label: 'Inicio', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { path: 'personajes', key: 'personajes', label: 'Personajes', icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 9a8 8 0 0 1 16 0z' },
  { path: 'cuentas', key: 'cuentas', label: 'Cuentas', icon: 'M4 5h16v14H4zM8 9h8M8 13h5' },
  { path: 'spots', key: 'spots', label: 'Spots', icon: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { path: 'shops', key: 'shops', label: 'Shops', icon: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6' },
  { path: 'drops', key: 'drops', label: 'Drops', icon: 'M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11zM9.5 15a2.5 2.5 0 0 0 2.5 2.5' },
  { path: 'monstruos', key: 'monstruos', label: 'Monstruos', icon: 'M12 3c-4 0-7 3-7 7v4l-2 3h4l1 3h8l1-3h4l-2-3v-4c0-4-3-7-7-7zM9 11h.01M15 11h.01' },
  { path: 'eventos', key: 'eventos', label: 'Eventos', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3' },
  { path: 'mensajes', key: 'mensajes', label: 'Mensajes', icon: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5' },
  { path: 'tienda-gr', key: 'shops', label: 'Tienda Grand Reset', icon: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z' },
  { path: 'vip', key: 'vip', label: 'VIP', icon: 'M20 12l-8 8-9-9V4h7zM7.5 7.5h.01' },
  { path: 'encuesta', key: 'encuesta', label: 'Encuesta', icon: 'M9 4h6v3H9zM6 6h12v15H6zM9 11h6M9 15h4' },
  { path: 'config', key: 'config', label: 'Configuración', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 .5-1.5-1.5L16 4h-4l-.5 2L10 7.5 8 7 6 11l2 1-2 1 2 4 2-.5 1.5 1.5.5 2h4l.5-2 1.5-1.5 2 .5 2-4z' },
  { path: 'servidor', key: 'servidor', label: 'Servidor', icon: 'M4 4h16v6H4zm0 10h16v6H4zM8 7h.01M8 17h.01' },
  { path: 'usuarios', key: 'usuarios', label: 'Usuarios', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6' },
];

function navFor(me: Me) {
  return NAV.filter(item => (item.key === 'usuarios' ? me.superuser : me.permissions.includes(item.key as never)));
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/login', { method: 'POST', body: { user, password } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="./la-ronda.png" alt="Mu La Ronda" className="login-logo" />
        <h1>Panel de administración</h1>
        <label className="field">
          <span className="field-label">Usuario</span>
          <input value={user} onChange={e => setUser(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          <span className="field-label">Contraseña</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted small">El mismo usuario y contraseña que el panel de OpenMU (OPENMU_ADMIN_USER/PASSWORD en <code>deploy/.env</code>).</p>
      </form>
    </div>
  );
}

/** Mu La Ronda: the signed-in user's own password. */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('La contraseña nueva tiene que tener 8 caracteres o más');
    if (next !== repeat) return setError('Las contraseñas nuevas no coinciden');
    setBusy(true);
    setError('');
    try {
      await api('/me/password', { method: 'POST', body: { current, next } });
      toast('Contraseña cambiada');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Cambiar contraseña</h2>
        <label className="field">
          <span className="field-label">Contraseña actual</span>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Contraseña nueva</span>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="field">
          <span className="field-label">Repetir la nueva</span>
          <input type="password" value={repeat} onChange={e => setRepeat(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <div className="form-error">{error}</div>}
        <p className="muted small">Solo cambia la de este panel. El panel de OpenMU sigue con la de deploy/.env.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Cambiar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<'checking' | 'out' | Me>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const route = useRoute();

  useEffect(() => {
    setOnUnauthorized(() => setSession('out'));
    api<Me>('/me').then(
      me => setSession(me),
      () => setSession('out')
    );
  }, []);

  // A section this user may not see sends them to the first one they can.
  useEffect(() => {
    if (typeof session !== 'object') return;
    const nav = navFor(session);
    if (nav.length && !nav.some(item => item.path === (route[0] ?? ''))) location.hash = `#/${nav[0].path}`;
  }, [session, route]);

  if (session === 'checking') return <div className="loading full">Cargando…</div>;
  if (session === 'out') {
    return (
      <ToastProvider>
        <Login onDone={() => api<Me>('/me').then(me => setSession(me))} />
      </ToastProvider>
    );
  }

  const me = session;
  const nav = navFor(me);
  const [section, id] = route;
  const allowedHere = nav.some(item => item.path === (section ?? ''));
  let page;
  switch (allowedHere ? section ?? '' : 'none') {
    case 'none':
      page = nav.length ? null : <p className="muted">Tu usuario no tiene ninguna sección habilitada.</p>;
      break;
    case 'personajes':
      page = id ? <CharacterPage id={id} /> : <CharactersPage />;
      break;
    case 'cuentas':
      page = id ? <AccountPage id={id} /> : <AccountsPage />;
      break;
    case 'config':
      page = <ConfigPage tab={id} />;
      break;
    case 'spots':
      page = <SpotsPage map={id} />;
      break;
    case 'mensajes':
      page = <MessagesPage />;
      break;
    case 'encuesta':
      page = <SurveyPage tab={id} />;
      break;
    case 'vip':
      page = <VipCodesPage />;
      break;
    case 'tienda-gr':
      page = <GrandShopPage />;
      break;
    case 'shops':
      page = <ShopsPage shop={id} />;
      break;
    case 'drops':
      page = <DropsPage group={id} />;
      break;
    case 'monstruos':
      page = <MonstersPage monster={id} />;
      break;
    case 'eventos':
      page = <EventsPage />;
      break;
    case 'usuarios':
      page = <UsersPage me={me} />;
      break;
    case 'servidor':
      page = <ServerPage />;
      break;
    default:
      page = <DashboardPage />;
  }

  const logout = async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    setSession('out');
  };

  return (
    <ToastProvider>
      <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
        <aside className="sidebar">
          <div className="brand">
            <img src="./icon-192.png" alt="" />
            <div>
              <strong>Mu La Ronda</strong>
              <span>Admin</span>
            </div>
          </div>
          <nav>
            {nav.map(item => (
              <a key={item.path} href={`#/${item.path}`} className={(section ?? '') === item.path ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                <Icon d={item.icon} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="muted small">Sesión: {me.user}</span>
            <button className="btn btn-ghost btn-small" onClick={() => setChangingPassword(true)}>
              Contraseña
            </button>
            <button className="btn btn-ghost btn-small" onClick={logout}>
              Salir
            </button>
          </div>
        </aside>
        <div className="main">
          <div className="topbar">
            <button className="btn btn-ghost menu-button" onClick={() => setMenuOpen(o => !o)} aria-label="Menú">
              ☰
            </button>
            <span className="topbar-title">Mu La Ronda · Admin</span>
          </div>
          <main className="content">
            <Boundary resetKey={route.join('/')}>{page}</Boundary>
          </main>
        </div>
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      </div>
      {changingPassword && <PasswordDialog onClose={() => setChangingPassword(false)} />}
    </ToastProvider>
  );
}
