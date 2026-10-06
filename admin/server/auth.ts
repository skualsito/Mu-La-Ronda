import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The panel's own login: the operator account from the environment
 * (`MLR_ADMIN_USER` / `MLR_ADMIN_PASSWORD`, which docker-compose fills with
 * OpenMU's OPENMU_ADMIN_USER / OPENMU_ADMIN_PASSWORD - one login for both
 * panels) and a signed, HttpOnly session cookie. That operator is the
 * superuser; the users it creates (users.ts) sign in with the same cookie.
 */

export const USER = process.env.MLR_ADMIN_USER || 'admin';
const PASSWORD = process.env.MLR_ADMIN_PASSWORD || '';

// Strings and TextEncoder bytes only: the Buffer type of bun-types doesn't
// type-check against TypeScript's Uint8Array, which crypto's typings want.
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const SECRET = process.env.MLR_ADMIN_SECRET || randomBytes(32).toString('hex');

if (!process.env.MLR_ADMIN_SECRET) {
  console.warn('admin: MLR_ADMIN_SECRET no esta definido; las sesiones se pierden al reiniciar.');
}

export const COOKIE = 'mlr_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;

export function passwordConfigured(): boolean {
  return PASSWORD.length >= 8;
}

function safeEqual(a: string, b: string): boolean {
  const left = bytes(createHmac('sha256', SECRET).update(a).digest('hex'));
  const right = bytes(createHmac('sha256', SECRET).update(b).digest('hex'));
  return timingSafeEqual(left, right);
}

export function checkCredentials(user: string, password: string): boolean {
  if (!passwordConfigured()) return false;
  // Both compared, always: no early exit telling which one was wrong.
  const userOk = safeEqual(user.trim().toLowerCase(), USER.toLowerCase());
  const passOk = safeEqual(password, PASSWORD);
  return userOk && passOk;
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function issueSession(user: string = USER): { value: string; maxAge: number } {
  const expires = Date.now() + SESSION_MS;
  const payload = `${user}|${expires}`;
  return { value: `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`, maxAge: SESSION_MS / 1000 };
}

/** The operator's name when the request carries a valid, unexpired session. */
export function sessionUser(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const raw = cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;

  const [encoded, mac] = raw.split('.');
  if (!encoded || !mac) return null;

  const payload = Buffer.from(encoded, 'base64url').toString();
  const expected = sign(payload);
  if (expected.length !== mac.length || !timingSafeEqual(bytes(expected), bytes(mac))) {
    return null;
  }

  const [user, expires] = payload.split('|');
  if (!user || Number(expires) < Date.now()) return null;
  return user;
}

export function sessionCookie(value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
