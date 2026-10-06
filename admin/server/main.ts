import postgres from 'postgres';
import { BurstLimit, bucketFor, clientIp } from '../../src/common/rateLimit';
import { checkCredentials, issueSession, passwordConfigured, sessionCookie, sessionUser } from './auth';
import * as game from './game';
import * as spots from './spots';
import * as inventory from './inventory';
import * as skills from './skills';
import * as messages from './messages';
import { hasTerrain, terrainOf } from './terrain';
import { openmuLogs, openmuStatus, restartOpenmu } from './docker';

/**
 * Mu La Ronda's admin panel API (admin.<DOMAIN>/api). nginx serves the page
 * (dist-admin/) and proxies /api here. Loopback only.
 *
 * Every route but /api/login needs the session cookie; every write also needs
 * the `X-MLR: 1` header (a cross-site form cannot set it), on top of the
 * cookie being SameSite=Strict.
 */

const PORT = Number(process.env.ADMIN_PANEL_PORT || 3200);
const HOSTNAME = process.env.HOSTNAME || '127.0.0.1';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin@127.0.0.1:5432/openmu';
const PRESENCE_URL = process.env.PRESENCE_URL || 'http://127.0.0.1:3001';

const sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 30 });

/** Five tries a minute per network: the password is long, this just stops a script. */
const logins = new BurstLimit(5, 60_000);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function onlineAccounts(): Promise<Set<string>> {
  try {
    const res = await fetch(`${PRESENCE_URL}/presence`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return new Set();
    const body = (await res.json()) as { online?: string[] };
    return new Set((body.online ?? []).map(a => a.toLowerCase()));
  } catch {
    return new Set();
  }
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'JSON invalido');
  }
}

function idFrom(path: string, prefix: string): string {
  const id = path.slice(prefix.length);
  if (!UUID_RE.test(id)) throw new HttpError(404, 'No existe');
  return id;
}

async function route(req: Request, url: URL, ip: string): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  if (path === '/api/login' && method === 'POST') {
    if (logins.hammering(bucketFor(ip))) return json({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
    if (!passwordConfigured()) {
      return json({ error: 'El panel no tiene contraseña configurada (OPENMU_ADMIN_PASSWORD en deploy/.env, 8 caracteres o mas).' }, 503);
    }
    const { user, password } = await body(req);
    if (!checkCredentials(String(user ?? ''), String(password ?? ''))) {
      return json({ error: 'Usuario o contraseña incorrectos' }, 401);
    }
    const session = issueSession();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(session.value, session.maxAge) });
  }

  const user = sessionUser(req);
  if (!user) return json({ error: 'Sesion vencida' }, 401);

  if (method !== 'GET' && req.headers.get('x-mlr') !== '1') {
    return json({ error: 'Falta el encabezado X-MLR' }, 403);
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (path === '/api/me') return json({ user });

  if (path === '/api/dashboard') {
    const [data, server] = await Promise.all([game.dashboard(sql, await onlineAccounts()), openmuStatus()]);
    return json({ ...data, server });
  }

  if (path === '/api/maps') {
    const maps = await game.listMaps(sql);
    return json(maps.map(m => ({ ...m, hasTerrain: hasTerrain(m.number) })));
  }

  // ---- spots (monster spawns) ---------------------------------------------
  if (path === '/api/monsters') return json(await spots.listMonsters(sql));

  const terrain = path.match(/^\/api\/maps\/(\d+)\/terrain$/);
  if (terrain && method === 'GET') {
    const data = await terrainOf(Number(terrain[1]));
    return data ? json({ size: 256, cells: data }) : json({ error: 'Sin terreno para ese mapa' }, 404);
  }

  const mapSpawns = path.match(/^\/api\/maps\/([0-9a-f-]{36})\/spawns$/i);
  if (mapSpawns) {
    if (method === 'POST') await spots.createSpawn(sql, mapSpawns[1], (await body(req)) as spots.SpawnInput);
    else if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    return json(await spots.listSpawns(sql, mapSpawns[1]));
  }

  if (path.startsWith('/api/spawns/')) {
    const id = idFrom(path, '/api/spawns/');
    if (method === 'PATCH') await spots.updateSpawn(sql, id, (await body(req)) as spots.SpawnInput);
    else if (method === 'DELETE') await spots.deleteSpawn(sql, id);
    else throw new HttpError(405, 'Metodo no permitido');
    return json({ ok: true });
  }

  // ---- inventory -------------------------------------------------------------
  if (path === '/api/item-definitions') {
    return json(await inventory.searchDefinitions(sql, (url.searchParams.get('q') ?? '').slice(0, 40)));
  }
  const defOptions = path.match(/^\/api\/item-definitions\/([0-9a-f-]{36})\/options$/i);
  if (defOptions) return json(await inventory.definitionOptions(sql, defOptions[1]));

  const inv = path.match(/^\/api\/characters\/([0-9a-f-]{36})\/(inventory|items\/([0-9a-f-]{36}))$/i);
  if (inv) {
    const [, characterId, , itemId] = inv;
    if (method !== 'GET') {
      const character = await game.getCharacter(sql, characterId, await onlineAccounts());
      if (!character) throw new HttpError(404, 'No existe');
      if (character.online) {
        throw new HttpError(409, 'El personaje esta conectado: OpenMU pisaria los cambios al salir. Desconectalo primero.');
      }
      if (!itemId && method === 'POST') await inventory.addItem(sql, characterId, (await body(req)) as inventory.ItemInput);
      else if (itemId && method === 'PATCH') await inventory.updateItem(sql, characterId, itemId, (await body(req)) as inventory.ItemInput);
      else if (itemId && method === 'DELETE') await inventory.deleteItem(sql, characterId, itemId);
      else throw new HttpError(405, 'Metodo no permitido');
    }
    return json(await inventory.getInventory(sql, characterId));
  }

  // ---- skills ----------------------------------------------------------------
  const sk = path.match(/^\/api\/characters\/([0-9a-f-]{36})\/skills(?:\/([0-9a-f-]{36}))?$/i);
  if (sk) {
    const [, characterId, entryId] = sk;
    if (method !== 'GET') {
      const character = await game.getCharacter(sql, characterId, await onlineAccounts());
      if (!character) throw new HttpError(404, 'No existe');
      if (character.online) {
        throw new HttpError(409, 'El personaje esta conectado: OpenMU pisaria los cambios al salir. Desconectalo primero.');
      }
      if (!entryId && method === 'POST') await skills.addSkill(sql, characterId, (await body(req)) as skills.SkillInput);
      else if (entryId && method === 'PATCH') await skills.updateSkill(sql, characterId, entryId, (await body(req)) as skills.SkillInput);
      else if (entryId && method === 'DELETE') await skills.deleteSkill(sql, characterId, entryId);
      else throw new HttpError(405, 'Metodo no permitido');
    }
    return json(await skills.getSkills(sql, characterId));
  }

  // ---- characters --------------------------------------------------------
  if (path === '/api/characters' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').slice(0, 20);
    return json(await game.listCharacters(sql, q, await onlineAccounts()));
  }
  if (path.startsWith('/api/characters/')) {
    const id = idFrom(path, '/api/characters/');
    const online = await onlineAccounts();
    const character = await game.getCharacter(sql, id, online);
    if (!character) throw new HttpError(404, 'No existe');
    if (method === 'GET') return json(character);
    if (method === 'PATCH') {
      if (character.online) {
        throw new HttpError(409, 'El personaje esta conectado: OpenMU pisaria los cambios al salir. Desconectalo primero.');
      }
      await game.updateCharacter(sql, id, (await body(req)) as game.CharacterPatch);
      return json(await game.getCharacter(sql, id, online));
    }
  }

  // ---- accounts ------------------------------------------------------------
  if (path === '/api/accounts' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').slice(0, 40);
    return json(await game.listAccounts(sql, q, await onlineAccounts()));
  }
  if (path.startsWith('/api/accounts/')) {
    const id = idFrom(path, '/api/accounts/');
    const online = await onlineAccounts();
    if (method === 'PATCH') {
      await game.updateAccount(sql, id, await body(req));
    } else if (method !== 'GET') {
      throw new HttpError(405, 'Metodo no permitido');
    }
    const account = await game.getAccount(sql, id, online);
    return account ? json(account) : json({ error: 'No existe' }, 404);
  }

  // ---- configuration -------------------------------------------------------
  if (path === '/api/config' && method === 'GET') return json(await game.getConfig(sql));
  if (path === '/api/config/game' && method === 'PATCH') {
    await game.updateGameConfig(sql, await body(req));
    return json(await game.getConfig(sql));
  }
  if (path === '/api/config/reset' && method === 'PATCH') {
    await game.updateResetConfig(sql, await body(req));
    return json(await game.getConfig(sql));
  }
  if (path === '/api/config/fast' && method === 'PATCH') {
    await game.updateFastSettings(sql, await body(req));
    return json(await game.getConfig(sql));
  }
  if (path.startsWith('/api/config/plugins/') && method === 'PATCH') {
    const id = idFrom(path, '/api/config/plugins/');
    const { active } = await body(req);
    await game.setPlugin(sql, id, !!active);
    return json(await game.getConfig(sql));
  }

  // ---- automatic messages -------------------------------------------------------
  if (path === '/api/messages') {
    if (method === 'POST') await messages.createMessage(sql, (await body(req)) as messages.MessageInput);
    else if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    return json(await messages.listMessages(sql));
  }
  const msg = path.match(/^\/api\/messages\/(\d+)(\/send)?$/);
  if (msg) {
    const id = Number(msg[1]);
    if (msg[2] && method === 'POST') await messages.sendNow(sql, id);
    else if (!msg[2] && method === 'PATCH') await messages.updateMessage(sql, id, (await body(req)) as messages.MessageInput);
    else if (!msg[2] && method === 'DELETE') await messages.deleteMessage(sql, id);
    else throw new HttpError(405, 'Metodo no permitido');
    return json(await messages.listMessages(sql));
  }

  // ---- server --------------------------------------------------------------
  if (path === '/api/server' && method === 'GET') return json(await openmuStatus());
  if (path === '/api/server/logs' && method === 'GET') return json({ lines: await openmuLogs(300) });
  if (path === '/api/server/restart' && method === 'POST') {
    await restartOpenmu();
    return json({ ok: true });
  }

  return json({ error: 'No existe' }, 404);
}

Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  async fetch(req, server) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'No existe' }, 404);
    try {
      return await route(req, url, clientIp(req, server));
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('admin:', err);
      const message = err instanceof Error ? err.message : 'Error interno';
      return json({ error: message }, 500);
    }
  },
});

console.info(`admin: http://${HOSTNAME}:${PORT}`);
