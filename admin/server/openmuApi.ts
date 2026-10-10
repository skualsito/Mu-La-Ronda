import { createHash, randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';

/**
 * OpenMU's own HTTP API (the admin panel host, openmu.<DOMAIN>), for what has to happen inside the
 * game server: the vault of an account that is in the game lives in OpenMU's memory, so the panel
 * hands those edits to Mu La Ronda's endpoint there (marketplace/openmu/src/Web/AdminPanel/API/
 * MlrVaultController.cs) instead of writing the database.
 *
 * The API wants a key. The panel makes its own the first time - the same row OpenMU's "API keys"
 * page creates (admin."ApiKey": base64 SHA-256 of the key, role Operator) - and keeps the key in
 * mlr.settings, so nothing has to be set up by hand.
 */

const OPENMU_API_URL = process.env.OPENMU_API_URL || 'http://127.0.0.1:8090';
const KEY_SETTING = 'openmu_api_key';
const KEY_NAME = 'Mu La Ronda panel';

let cachedKey: string | null = null;

const hashOf = (key: string) => createHash('sha256').update(key, 'utf8').digest('base64');

async function apiKey(sql: Sql): Promise<string> {
  if (cachedKey) return cachedKey;
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL)`;

  const [stored] = await sql<{ value: string }[]>`SELECT value FROM mlr.settings WHERE key = ${KEY_SETTING}`;
  if (stored) {
    const [row] = await sql`
      SELECT 1 FROM admin."ApiKey" WHERE "KeyHash" = ${hashOf(stored.value)} AND NOT "IsDisabled"`;
    if (row) return (cachedKey = stored.value);
  }

  const key = randomBytes(36).toString('base64url');
  await sql.begin(async tx => {
    await tx`DELETE FROM admin."ApiKey" WHERE "Name" = ${KEY_NAME}`;
    await tx`
      INSERT INTO admin."ApiKey" ("Id", "Name", "KeyHash", "KeyPrefix", "Roles", "IsDisabled", "CreatedAt")
      VALUES (gen_random_uuid(), ${KEY_NAME}, ${hashOf(key)}, ${key.slice(0, 12)}, 'Operator', false, now())`;
    await tx`
      INSERT INTO mlr.settings (key, value) VALUES (${KEY_SETTING}, ${key})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  });
  return (cachedKey = key);
}

export type VaultOperation =
  | { op: 'save' }
  | { op: 'money'; money: number }
  | { op: 'delete'; itemId: string }
  | {
      op: 'add' | 'update';
      itemId?: string;
      definitionId?: string;
      level?: number;
      durability?: number;
      resetDurability?: boolean;
      hasSkill?: boolean;
      options?: { optionId: string; level?: number }[];
      slot?: number;
    };

/**
 * Applies the change in the game. 'offline' when the account is not in the game (any more): the
 * caller then writes the database. Throws with OpenMU's reason when the change was refused.
 */
export async function vaultInGame(sql: Sql, accountId: string, operation: VaultOperation): Promise<'applied' | 'offline'> {
  return post(sql, `/api/mlr/vault/${accountId}`, operation, 'cambiar el baúl');
}

/** Disconnects the account's player (OpenMU saves it on the way out). 'offline' when it was not in the game. */
export async function disconnectAccount(sql: Sql, accountId: string): Promise<'applied' | 'offline'> {
  return post(sql, `/api/mlr/players/${accountId}/disconnect`, {}, 'desconectar al jugador');
}

async function post(sql: Sql, path: string, payload: unknown, what: string): Promise<'applied' | 'offline'> {
  const send = async () =>
    fetch(`${OPENMU_API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Api-Key': await apiKey(sql) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 || res.status === 403) {
      // The key was deleted or disabled in OpenMU's panel: make a new one, once.
      cachedKey = null;
      await sql`DELETE FROM mlr.settings WHERE key = ${KEY_SETTING}`;
      res = await send();
    }
  } catch (err) {
    throw new Error(`No se pudo hablar con OpenMU para ${what}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (res.ok) return 'applied';
  const body = (await res.json().catch(() => null)) as { error?: string; online?: boolean } | null;
  // Only the endpoint's own answer: a plain 404 is an OpenMU without it (not deployed yet).
  if (res.status === 404 && body?.online === false) return 'offline';
  throw new Error(body?.error ?? `OpenMU respondió ${res.status} al ${what}`);
}

export type InGamePlayer = { accountId: string; login: string; characterId: string | null; character: string | null; map: string | null };

/**
 * Mu La Ronda: who is in the game and with which character (MlrPlayersController `online`).
 * Null when OpenMU does not answer - the caller falls back to the proxy's account list.
 */
export async function onlinePlayers(sql: Sql): Promise<InGamePlayer[] | null> {
  const fail = (why: string) => {
    // Once a minute at most: the dashboard asks every few seconds.
    if (Date.now() - lastOnlineWarning > 60_000) {
      lastOnlineWarning = Date.now();
      console.warn(`[openmu] la lista de conectados no respondio: ${why}`);
    }
    return null;
  };
  try {
    const get = async () =>
      fetch(`${OPENMU_API_URL}/api/mlr/players/online`, {
        headers: { 'X-Api-Key': await apiKey(sql) },
        signal: AbortSignal.timeout(2500),
      });
    let res = await get();
    if (res.status === 401 || res.status === 403) {
      cachedKey = null;
      await sql`DELETE FROM mlr.settings WHERE key = ${KEY_SETTING}`;
      res = await get();
    }
    if (!res.ok) return fail(`HTTP ${res.status}`);
    const rows = (await res.json()) as (Omit<InGamePlayer, 'map'> & { map: unknown })[];
    // An OpenMU from before the fix sends the map name as a LocalizedString object.
    return rows.map(r => ({ ...r, map: mapName(r.map) }));
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

let lastOnlineWarning = 0;

function mapName(map: unknown): string | null {
  if (typeof map === 'string') return map;
  if (map && typeof map === 'object') {
    const named = map as { valueInNeutralLanguage?: unknown; value?: unknown };
    const name = named.valueInNeutralLanguage ?? named.value;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

export type GameEvent = {
  id: string;
  type: string;
  name: string;
  kind: 'minigame' | 'periodic';
  state: 'NotStarted' | 'Prepared' | 'Started';
  running: boolean;
  players: number;
  lastStartUtc: string | null;
  nextStepUtc: string;
  nextStartUtc: string | null;
};

/**
 * Mu La Ronda: the periodic events and their state (MlrEventsController). Throws when OpenMU does
 * not answer, with a reason the panel shows.
 */
export async function gameEvents(sql: Sql): Promise<GameEvent[]> {
  const get = async () =>
    fetch(`${OPENMU_API_URL}/api/mlr/events/`, {
      headers: { 'X-Api-Key': await apiKey(sql) },
      signal: AbortSignal.timeout(5000),
    });
  let res: Response;
  try {
    res = await get();
    if (res.status === 401 || res.status === 403) {
      cachedKey = null;
      await sql`DELETE FROM mlr.settings WHERE key = ${KEY_SETTING}`;
      res = await get();
    }
  } catch (err) {
    throw new Error(`No se pudo hablar con OpenMU: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 404) throw new Error('Este OpenMU todavía no tiene la lista de eventos (falta deployar).');
  if (!res.ok) throw new Error(`OpenMU respondió ${res.status} a la lista de eventos`);
  return (await res.json()) as GameEvent[];
}

export type GameEventDetails = {
  id: string;
  type: string;
  name: string;
  setup: {
    timetable: string[];
    durationMinutes: number;
    mobs: { number: number; name: string; count: number; maps: string[]; x: number | null; y: number | null }[] | null;
  } | null;
  places: { x: number; y: number }[] | null;
  servers: {
    server: number;
    description: string;
    state: GameEvent['state'];
    running: boolean;
    players: number;
    lastStartUtc: string | null;
    nextStepUtc: string;
    nextStartUtc: string | null;
    monsters: { number: number; name: string; map: number; mapName: string; x: number; y: number }[];
  }[];
};

/** Mu La Ronda: one event in full - setup, and per server its state and live monsters (MlrEventsController). */
export async function gameEventDetails(sql: Sql, id: string): Promise<GameEventDetails | null> {
  const get = async () =>
    fetch(`${OPENMU_API_URL}/api/mlr/events/${id}`, {
      headers: { 'X-Api-Key': await apiKey(sql) },
      signal: AbortSignal.timeout(5000),
    });
  let res: Response;
  try {
    res = await get();
    if (res.status === 401 || res.status === 403) {
      cachedKey = null;
      await sql`DELETE FROM mlr.settings WHERE key = ${KEY_SETTING}`;
      res = await get();
    }
  } catch (err) {
    throw new Error(`No se pudo hablar con OpenMU: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenMU respondió ${res.status} al detalle del evento`);
  return (await res.json()) as GameEventDetails;
}

/** Starts (or stops) an event on every game server. */
export async function controlEvent(sql: Sql, id: string, action: 'start' | 'stop'): Promise<void> {
  const result = await post(sql, `/api/mlr/events/${id}/${action}`, {}, action === 'start' ? 'arrancar el evento' : 'parar el evento');
  if (result === 'offline') throw new Error('Ese evento no está activo en OpenMU.');
}

/**
 * Turns a plugin on or off in the running game servers (MlrPlugInsController), so it counts without
 * a restart. False when OpenMU did not take it (down, or without the endpoint yet).
 */
export async function setPluginInGame(sql: Sql, id: string, active: boolean): Promise<boolean> {
  try {
    return (await post(sql, `/api/mlr/plugins/${id}`, { active }, 'cambiar el plugin')) === 'applied';
  } catch {
    return false;
  }
}

/** Gives a plugin a new configuration in the running game servers (the resets, the drop rates). */
export async function configurePluginInGame(sql: Sql, id: string, configuration: string, active: boolean): Promise<boolean> {
  try {
    // game.ts pluginJson already leaves OpenMU's reference metadata out.
    return (await post(sql, `/api/mlr/plugins/${id}/configuration`, { configuration, active }, 'configurar el plugin')) === 'applied';
  } catch {
    return false;
  }
}
