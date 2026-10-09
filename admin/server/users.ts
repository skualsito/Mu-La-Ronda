import type { Sql } from 'postgres';
import bcrypt from 'bcryptjs';

/**
 * Extra panel users (mlr.admin_users) with the sections each one may use - so
 * someone can look after the shops and spots without the rest of the panel.
 *
 * The operator from the environment (auth.ts) is the superuser: every section,
 * plus "Usuarios", which no table user can ever get. A table user's
 * permissions are read again on every request (cached a few seconds), so
 * taking one away or disabling the user applies at once, session or not.
 */

/** The panel's sections, in menu order. The keys are what the menu and the API guard share. */
export const SECTIONS = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'personajes', label: 'Personajes' },
  { key: 'cuentas', label: 'Cuentas' },
  { key: 'spots', label: 'Spots' },
  { key: 'shops', label: 'Shops' },
  { key: 'drops', label: 'Drops' },
  { key: 'mensajes', label: 'Mensajes' },
  { key: 'vip', label: 'Códigos VIP' },
  { key: 'encuesta', label: 'Encuesta' },
  { key: 'config', label: 'Configuración' },
  { key: 'servidor', label: 'Servidor' },
] as const;

export type Section = (typeof SECTIONS)[number]['key'];
const SECTION_KEYS = new Set<string>(SECTIONS.map(s => s.key));

export type Access = { user: string; superuser: boolean; permissions: Section[] };

export type AdminUser = {
  id: number;
  username: string;
  permissions: Section[];
  enabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const NAME_RE = /^[a-z0-9_.-]{3,24}$/;

/** Compared against on an unknown name, so a miss costs the same time as a hit. */
const DUMMY_HASH = bcrypt.hashSync('no-such-user', 11);

let ensured = false;
async function ensure(sql: Sql): Promise<void> {
  if (ensured) return;
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.admin_users (
      id            serial PRIMARY KEY,
      username      text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      permissions   text[] NOT NULL DEFAULT '{}',
      enabled       boolean NOT NULL DEFAULT true,
      created_at    timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    )`;
  ensured = true;
}

function cleanPermissions(value: unknown): Section[] {
  if (!Array.isArray(value)) throw new Error('Faltan los permisos');
  const out = [...new Set(value.map(String))].filter(p => SECTION_KEYS.has(p)) as Section[];
  return SECTIONS.map(s => s.key).filter(k => out.includes(k));
}

function cleanUsername(value: unknown): string {
  const name = String(value ?? '').trim().toLowerCase();
  if (!NAME_RE.test(name)) throw new Error('El usuario va de 3 a 24 caracteres: letras, números, punto, guion o guion bajo');
  return name;
}

function cleanPassword(value: unknown): string {
  const password = String(value ?? '');
  if (password.length < 8) throw new Error('La contraseña tiene que tener 8 caracteres o más');
  return password;
}

type Row = {
  id: number;
  username: string;
  permissions: string[];
  enabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
};

const toUser = (r: Row): AdminUser => ({
  id: r.id,
  username: r.username,
  permissions: r.permissions.filter(p => SECTION_KEYS.has(p)) as Section[],
  enabled: r.enabled,
  createdAt: r.created_at.toISOString(),
  lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
});

export async function listUsers(sql: Sql): Promise<AdminUser[]> {
  await ensure(sql);
  const rows = await sql<Row[]>`
    SELECT id, username, permissions, enabled, created_at, last_login_at FROM mlr.admin_users ORDER BY username`;
  return rows.map(toUser);
}

export async function createUser(
  sql: Sql,
  input: { username?: unknown; password?: unknown; permissions?: unknown },
  reserved: string
): Promise<void> {
  await ensure(sql);
  const username = cleanUsername(input.username);
  if (username === reserved.toLowerCase()) throw new Error('Ese nombre es el del administrador principal');
  const hash = await bcrypt.hash(cleanPassword(input.password), 11);
  const permissions = cleanPermissions(input.permissions ?? []);
  const [taken] = await sql`SELECT 1 FROM mlr.admin_users WHERE username = ${username}`;
  if (taken) throw new Error('Ya existe un usuario con ese nombre');
  await sql`
    INSERT INTO mlr.admin_users (username, password_hash, permissions)
    VALUES (${username}, ${hash}, ${permissions})`;
  invalidate();
}

export async function updateUser(
  sql: Sql,
  id: number,
  input: { password?: unknown; permissions?: unknown; enabled?: unknown }
): Promise<void> {
  await ensure(sql);
  const sets: Record<string, unknown> = {};
  if (input.permissions !== undefined) sets.permissions = cleanPermissions(input.permissions);
  if (input.enabled !== undefined) sets.enabled = !!input.enabled;
  if (input.password !== undefined && input.password !== '') {
    sets.password_hash = await bcrypt.hash(cleanPassword(input.password), 11);
  }
  if (!Object.keys(sets).length) return;
  const result = await sql`UPDATE mlr.admin_users SET ${sql(sets)} WHERE id = ${id}`;
  if (result.count === 0) throw new Error('Ese usuario no existe');
  invalidate();
}

export async function deleteUser(sql: Sql, id: number): Promise<void> {
  await ensure(sql);
  await sql`DELETE FROM mlr.admin_users WHERE id = ${id}`;
  invalidate();
}

/** A table user's login: their name when the password matches and they are enabled. */
export async function checkUser(sql: Sql, username: string, password: string): Promise<string | null> {
  await ensure(sql);
  const name = username.trim().toLowerCase();
  const [row] = await sql<{ password_hash: string; enabled: boolean }[]>`
    SELECT password_hash, enabled FROM mlr.admin_users WHERE username = ${name}`;
  // Hash anyway on a miss, so the answer takes as long either way.
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok || !row.enabled) return null;
  await sql`UPDATE mlr.admin_users SET last_login_at = now() WHERE username = ${name}`;
  return name;
}

const CACHE_MS = 5000;
const cache = new Map<string, { at: number; access: Access | null }>();
function invalidate(): void {
  cache.clear();
}

/** What a session's user may do now; null when they no longer exist or are disabled. */
export async function accessOf(sql: Sql, user: string, superuserName: string): Promise<Access | null> {
  if (user.toLowerCase() === superuserName.toLowerCase()) {
    return { user, superuser: true, permissions: SECTIONS.map(s => s.key) };
  }
  const hit = cache.get(user);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.access;

  await ensure(sql);
  const [row] = await sql<{ permissions: string[]; enabled: boolean }[]>`
    SELECT permissions, enabled FROM mlr.admin_users WHERE username = ${user}`;
  const access: Access | null =
    row && row.enabled
      ? { user, superuser: false, permissions: row.permissions.filter(p => SECTION_KEYS.has(p)) as Section[] }
      : null;
  cache.set(user, { at: Date.now(), access });
  return access;
}

/**
 * Which section an API path belongs to. Null for what every signed-in user
 * needs (their own session, the map list the pickers share); 'usuarios' is
 * the superuser's alone.
 */
export function sectionOf(path: string, method: string): Section | 'usuarios' | 'any' | 'vault' | 'monsters' | null {
  if (path === '/api/me' || path === '/api/me/password' || path === '/api/logout') return null;
  if (path.startsWith('/api/admin-users')) return 'usuarios';
  if (path === '/api/dashboard') return 'inicio';
  if (path === '/api/maps' && method === 'GET') return null;
  // Both the spot editor and the drop editor pick monsters.
  if (path === '/api/monsters') return 'monsters';
  if (path.startsWith('/api/drops')) return 'drops';
  if (path.startsWith('/api/spawns/') || /^\/api\/maps\/[^/]+\/(spawns|terrain)$/.test(path)) return 'spots';
  if (path.startsWith('/api/shops')) return 'shops';
  // The inventory, shop and drop editors search the item catalogue.
  if (path.startsWith('/api/item-definitions')) return 'any';
  if (path.startsWith('/api/characters') || path === '/api/classes') return 'personajes';
  // The vault shows on the account page and on each of its characters'.
  if (/^\/api\/accounts\/[^/]+\/vault/.test(path)) return 'vault';
  // Mu La Ronda: and so does the VIP, edited from either page.
  if (/^\/api\/accounts\/[^/]+\/vip$/.test(path)) return 'vault';
  if (path.startsWith('/api/accounts')) return 'cuentas';
  if (path.startsWith('/api/messages')) return 'mensajes';
  if (path.startsWith('/api/vip-codes')) return 'vip';
  if (path.startsWith('/api/survey')) return 'encuesta';
  if (path.startsWith('/api/config')) return 'config';
  if (path.startsWith('/api/server')) return 'servidor';
  return 'usuarios';
}

export function allowed(access: Access, path: string, method: string): boolean {
  const section = sectionOf(path, method);
  if (section === null) return true;
  if (access.superuser) return true;
  if (section === 'usuarios') return false;
  if (section === 'any') {
    return access.permissions.includes('personajes') || access.permissions.includes('shops') || access.permissions.includes('drops');
  }
  if (section === 'monsters') return access.permissions.includes('spots') || access.permissions.includes('drops');
  if (section === 'vault') return access.permissions.includes('personajes') || access.permissions.includes('cuentas');
  return access.permissions.includes(section);
}

// ---- own password -------------------------------------------------------------

/**
 * Mu La Ronda: the superuser's password changed from the panel. The first one
 * comes from deploy/.env (MLR_ADMIN_PASSWORD, shared with OpenMU's panel); once
 * changed here, its BCrypt hash in mlr.settings is the one this panel checks -
 * OpenMU's own panel keeps the .env one.
 */
const SUPER_HASH_KEY = 'admin_password_hash';

async function superHash(sql: Sql): Promise<string | null> {
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL)`;
  const [row] = await sql<{ value: string }[]>`SELECT value FROM mlr.settings WHERE key = ${SUPER_HASH_KEY}`;
  return row?.value ?? null;
}

/** The superuser's login: the panel's own hash once there is one, the .env password before. */
export async function checkSuperuser(
  sql: Sql,
  user: string,
  password: string,
  superuserName: string,
  envCheck: (user: string, password: string) => boolean
): Promise<boolean> {
  if (user.trim().toLowerCase() !== superuserName.toLowerCase()) return false;
  const hash = await superHash(sql);
  return hash ? bcrypt.compare(password, hash) : envCheck(user, password);
}

/** Changes the signed-in user's own password, after checking the current one. */
export async function changeOwnPassword(
  sql: Sql,
  user: string,
  input: { current?: unknown; next?: unknown },
  superuserName: string,
  envCheck: (user: string, password: string) => boolean
): Promise<void> {
  const current = String(input.current ?? '');
  const next = cleanPassword(input.next);
  if (next === current) throw new Error('La contraseña nueva es igual a la actual');
  if (user.toLowerCase() === superuserName.toLowerCase()) {
    if (!(await checkSuperuser(sql, user, current, superuserName, envCheck))) throw new Error('La contraseña actual no es correcta');
    const hash = await bcrypt.hash(next, 11);
    await sql`
      INSERT INTO mlr.settings (key, value) VALUES (${SUPER_HASH_KEY}, ${hash})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return;
  }
  await ensure(sql);
  const [row] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM mlr.admin_users WHERE username = ${user.toLowerCase()}`;
  if (!row || !(await bcrypt.compare(current, row.password_hash))) throw new Error('La contraseña actual no es correcta');
  await sql`UPDATE mlr.admin_users SET password_hash = ${await bcrypt.hash(next, 11)} WHERE username = ${user.toLowerCase()}`;
  invalidate();
}
