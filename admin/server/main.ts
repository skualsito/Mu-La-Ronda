import postgres from 'postgres';
import { BurstLimit, bucketFor, clientIp } from '../../src/common/rateLimit';
import { USER, checkCredentials, issueSession, passwordConfigured, sessionCookie, sessionUser } from './auth';
import * as users from './users';
import * as game from './game';
import * as spots from './spots';
import * as inventory from './inventory';
import * as vip from './vip';
import * as skills from './skills';
import * as messages from './messages';
import * as vipCodes from './vipCodes';
import * as shops from './shops';
import * as drops from './drops';
import * as survey from './survey';
import { hasTerrain, terrainOf } from './terrain';
import { openmuLogs, openmuStatus, restartOpenmu } from './docker';
import { disconnectAccount, onlinePlayers, vaultInGame, type VaultOperation } from './openmuApi';

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

/** A panel item edit as the in-game vault endpoint takes it (null durability = back to the maximum). */
function vaultItemFields(input: inventory.ItemInput) {
  return {
    definitionId: input.definitionId,
    level: input.level === undefined ? undefined : Number(input.level),
    durability: input.durability == null ? undefined : Number(input.durability),
    resetDurability: input.durability === null,
    hasSkill: input.hasSkill,
    options: input.options?.map(o => ({ optionId: o.optionId, level: o.level })),
    slot: input.slot === undefined ? undefined : Number(input.slot),
  };
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
    const name = (await users.checkSuperuser(sql, String(user ?? ''), String(password ?? ''), USER, checkCredentials))
      ? USER
      : await users.checkUser(sql, String(user ?? ''), String(password ?? ''));
    if (!name) return json({ error: 'Usuario o contraseña incorrectos' }, 401);
    const session = issueSession(name);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(session.value, session.maxAge) });
  }

  const user = sessionUser(req);
  if (!user) return json({ error: 'Sesion vencida' }, 401);
  // A panel user that was disabled or deleted loses the session right away.
  const access = await users.accessOf(sql, user, USER);
  if (!access) return json({ error: 'Sesion vencida' }, 401, { 'Set-Cookie': sessionCookie('', 0) });
  if (!users.allowed(access, path, method)) return json({ error: 'No tenés permiso para esta sección' }, 403);

  if (method !== 'GET' && req.headers.get('x-mlr') !== '1') {
    return json({ error: 'Falta el encabezado X-MLR' }, 403);
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (path === '/api/me') return json({ ...access, sections: users.SECTIONS });
  if (path === '/api/me/password' && method === 'POST') {
    if (logins.hammering(bucketFor(ip))) return json({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
    try {
      await users.changeOwnPassword(sql, user, await body(req), USER, checkCredentials);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : String(err));
    }
    return json({ ok: true });
  }

  // ---- panel users (superuser only, see users.allowed) ----------------------
  if (path === '/api/admin-users') {
    if (method === 'POST') await users.createUser(sql, await body(req), USER);
    else if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    return json(await users.listUsers(sql));
  }
  const adminUser = path.match(/^\/api\/admin-users\/(\d+)$/);
  if (adminUser) {
    const id = Number(adminUser[1]);
    if (method === 'PATCH') await users.updateUser(sql, id, await body(req));
    else if (method === 'DELETE') await users.deleteUser(sql, id);
    else throw new HttpError(405, 'Metodo no permitido');
    return json(await users.listUsers(sql));
  }

  if (path === '/api/dashboard') {
    const [accounts, inGame] = await Promise.all([onlineAccounts(), onlinePlayers(sql)]);
    const [data, server] = await Promise.all([game.dashboard(sql, accounts, inGame), openmuStatus()]);
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

  // ---- drops ---------------------------------------------------------------
  if (path === '/api/drops') {
    if (method === 'POST') {
      const id = await drops.createDrop(sql, (await body(req)) as drops.DropInput);
      return json({ id, groups: await drops.listDrops(sql), types: drops.ITEM_TYPES });
    }
    if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    return json({ groups: await drops.listDrops(sql), types: drops.ITEM_TYPES });
  }
  const dropRoute = path.match(/^\/api\/drops\/([0-9a-f-]{36})(\/release)?$/i);
  if (dropRoute) {
    const [, id, release] = dropRoute;
    if (release && method === 'POST') await drops.releaseDrop(sql, id);
    else if (!release && method === 'PATCH') await drops.updateDrop(sql, id, (await body(req)) as drops.DropInput);
    else if (!release && method === 'DELETE') await drops.deleteDrop(sql, id);
    else throw new HttpError(405, 'Metodo no permitido');
    return json({ groups: await drops.listDrops(sql), types: drops.ITEM_TYPES });
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
  if (path === '/api/classes' && method === 'GET') return json(await game.listClasses(sql));
  // Disconnect from the account page, or from one of its characters' pages.
  const kick = path.match(/^\/api\/(accounts|characters)\/([0-9a-f-]{36})\/disconnect$/i);
  if (kick && method === 'POST') {
    let accountId = kick[2];
    if (kick[1].toLowerCase() === 'characters') {
      const [row] = await sql`SELECT "AccountId" AS id FROM data."Character" WHERE "Id" = ${kick[2]}::uuid`;
      if (!row) throw new HttpError(404, 'No existe');
      accountId = String(row.id);
    }
    const result = await disconnectAccount(sql, accountId).catch(err => {
      throw new HttpError(502, err instanceof Error ? err.message : String(err));
    });
    return json({ disconnected: result === 'applied' });
  }
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
    if (method === 'DELETE') {
      try {
        return json(await game.deleteCharacter(sql, id, online));
      } catch (err) {
        throw new HttpError(409, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // ---- accounts ------------------------------------------------------------
  if (path === '/api/accounts' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').slice(0, 40);
    return json(await game.listAccounts(sql, q, await onlineAccounts()));
  }
  const vault = path.match(/^\/api\/accounts\/([0-9a-f-]{36})\/vault(?:\/(money|items\/([0-9a-f-]{36})))?$/i);
  if (vault) {
    const [, accountId, sub, itemId] = vault;
    const account = await game.getAccount(sql, accountId, await onlineAccounts());
    if (!account) throw new HttpError(404, 'No existe');
    if (method !== 'GET') {
      const input = (method === 'DELETE' ? {} : await body(req)) as inventory.ItemInput & { money?: number };
      const operation: VaultOperation | null =
        sub === 'money' && method === 'PATCH' ? { op: 'money', money: Number(input.money) || 0 }
        : !sub && method === 'POST' ? { op: 'add', ...vaultItemFields(input) }
        : itemId && method === 'PATCH' ? { op: 'update', itemId, ...vaultItemFields(input) }
        : itemId && method === 'DELETE' ? { op: 'delete', itemId }
        : null;
      if (!operation) throw new HttpError(405, 'Metodo no permitido');

      // In the game, OpenMU holds the vault in memory: the change is made there (openmuApi.ts).
      const inGame = account.online ? await vaultInGame(sql, accountId, operation).catch(err => {
        throw new HttpError(409, err instanceof Error ? err.message : String(err));
      }) : 'offline';
      if (inGame === 'offline') {
        if (sub === 'money') await inventory.setVaultMoney(sql, accountId, Number(input.money));
        else if (!sub) await inventory.addVaultItem(sql, accountId, input);
        else if (method === 'PATCH') await inventory.updateVaultItem(sql, accountId, itemId!, input);
        else await inventory.deleteVaultItem(sql, accountId, itemId!);
      }
    } else if (account.online) {
      // What the game holds right now, written to the database before it is read.
      await vaultInGame(sql, accountId, { op: 'save' }).catch(() => undefined);
    }
    return json(await inventory.getVault(sql, accountId));
  }
  const vipRoute = path.match(/^\/api\/accounts\/([0-9a-f-]{36})\/vip$/i);
  if (vipRoute) {
    const accountId = vipRoute[1];
    if (method === 'PATCH') {
      const account = await game.getAccount(sql, accountId, await onlineAccounts());
      if (!account) throw new HttpError(404, 'No existe');
      if (account.online) throw new HttpError(409, 'La cuenta esta conectada: que salga primero (OpenMU pisaria el VIP).');
      const input = await body(req);
      await vip.setVip(sql, accountId, Number(input.tier), Number(input.days));
    } else if (method !== 'GET') {
      throw new HttpError(405, 'Metodo no permitido');
    }
    return json(await vip.getVip(sql, accountId));
  }
  if (path === '/api/accounts/delete' && method === 'POST') {
    const ids = (await body(req)).ids;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
      throw new HttpError(400, 'ids invalidos');
    }
    return json(await game.deleteAccounts(sql, ids as string[], await onlineAccounts()));
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

  // ---- shops ------------------------------------------------------------------------
  if (path === '/api/shops') {
    if (method === 'POST') {
      const { monsterId } = await body(req);
      if (typeof monsterId !== 'string' || !UUID_RE.test(monsterId)) throw new HttpError(400, 'Falta el NPC');
      await shops.makeShop(sql, monsterId);
    } else if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    const [list, candidates] = await Promise.all([shops.listShops(sql), shops.candidateNpcs(sql)]);
    return json({ shops: list, candidates });
  }
  const shop = path.match(/^\/api\/shops\/([0-9a-f-]{36})\/(items|clear)(?:\/([0-9a-f-]{36}))?$/i);
  if (shop) {
    const [, monsterId, what, itemId] = shop;
    if (what === 'clear' && method === 'POST' && !itemId) await shops.clearShop(sql, monsterId);
    else if (what === 'items' && !itemId && method === 'POST') await shops.addShopItem(sql, monsterId, (await body(req)) as inventory.ItemInput);
    else if (what === 'items' && itemId && method === 'PATCH') await shops.updateShopItem(sql, monsterId, itemId, (await body(req)) as inventory.ItemInput);
    else if (what === 'items' && itemId && method === 'DELETE') await shops.deleteShopItem(sql, monsterId, itemId);
    else if (method !== 'GET' || what !== 'items' || itemId) throw new HttpError(405, 'Metodo no permitido');
    return json(await shops.shopItems(sql, monsterId));
  }

  // ---- VIP discount codes -------------------------------------------------------
  if (path === '/api/vip-codes') {
    if (method === 'POST') await vipCodes.createCode(sql, (await body(req)) as vipCodes.VipCodeInput);
    else if (method !== 'GET') throw new HttpError(405, 'Metodo no permitido');
    return json(await vipCodes.listCodes(sql));
  }
  const vipCode = path.match(/^\/api\/vip-codes\/([0-9a-f-]{36})$/i);
  if (vipCode) {
    if (method === 'PATCH') await vipCodes.updateCode(sql, vipCode[1], (await body(req)) as vipCodes.VipCodeInput);
    else if (method === 'DELETE') await vipCodes.deleteCode(sql, vipCode[1]);
    else throw new HttpError(405, 'Metodo no permitido');
    return json(await vipCodes.listCodes(sql));
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

  // ---- post-beta survey (read only) ----------------------------------------------
  if (path === '/api/survey' && method === 'GET') return json(await survey.listResponses(sql));

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
