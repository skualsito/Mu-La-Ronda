import { useEffect, useState, type FormEvent } from 'react';
import { api, setOnUnauthorized } from './api';
import { ToastProvider } from './ui';
import { DashboardPage } from './pages/dashboard';
import { CharactersPage, CharacterPage } from './pages/characters';
import { AccountsPage, AccountPage } from './pages/accounts';
import { ConfigPage } from './pages/config';
import { ServerPage } from './pages/server';

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

const NAV = [
  { path: '', label: 'Inicio', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { path: 'personajes', label: 'Personajes', icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 9a8 8 0 0 1 16 0z' },
  { path: 'cuentas', label: 'Cuentas', icon: 'M4 5h16v14H4zM8 9h8M8 13h5' },
  { path: 'config', label: 'Configuración', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 .5-1.5-1.5L16 4h-4l-.5 2L10 7.5 8 7 6 11l2 1-2 1 2 4 2-.5 1.5 1.5.5 2h4l.5-2 1.5-1.5 2 .5 2-4z' },
  { path: 'servidor', label: 'Servidor', icon: 'M4 4h16v6H4zm0 10h16v6H4zM8 7h.01M8 17h.01' },
];

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
        <p className="muted small">La contraseña está en <code>deploy/.env</code> del servidor (MLR_ADMIN_PASSWORD).</p>
      </form>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<'checking' | 'out' | string>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const route = useRoute();

  useEffect(() => {
    setOnUnauthorized(() => setSession('out'));
    api<{ user: string }>('/me').then(
      me => setSession(me.user),
      () => setSession('out')
    );
  }, []);

  if (session === 'checking') return <div className="loading full">Cargando…</div>;
  if (session === 'out') {
    return (
      <ToastProvider>
        <Login onDone={() => api<{ user: string }>('/me').then(me => setSession(me.user))} />
      </ToastProvider>
    );
  }

  const [section, id] = route;
  let page;
  switch (section ?? '') {
    case 'personajes':
      page = id ? <CharacterPage id={id} /> : <CharactersPage />;
      break;
    case 'cuentas':
      page = id ? <AccountPage id={id} /> : <AccountsPage />;
      break;
    case 'config':
      page = <ConfigPage tab={id} />;
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
            {NAV.map(item => (
              <a key={item.path} href={`#/${item.path}`} className={(section ?? '') === item.path ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                <Icon d={item.icon} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="muted small">Sesión: {session}</span>
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
          <main className="content">{page}</main>
        </div>
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      </div>
    </ToastProvider>
  );
}
