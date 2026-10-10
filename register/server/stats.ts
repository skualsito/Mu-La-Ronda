import type { Sql } from 'postgres';

/**
 * Mu La Ronda: read-only numbers out of OpenMU's database for the client -
 * the rankings window and the reset count on the character window. The game
 * protocol carries neither, so they are read here, beside the signup endpoint
 * that already holds a database connection.
 *
 *   GET /api/rankings?type=resets|pk|guilds
 *   GET /api/character?name=<name>
 *
 * Public data, so any origin may read it (no credentials, GET only). Rankings
 * are cached for a minute: they are polled by every open window and nobody
 * needs them to the second.
 */

/** `Stats.*` attribute definitions (GameLogic/Attributes/Stats.cs). */
const STAT = {
  level: '560931ad-0901-4342-b7f4-fd2e2fcc0563',
  masterLevel: '70cd8c10-391a-4c51-9aa4-a854600e3a9f',
  resets: '89a891a7-f9f9-4ab5-af36-12056e53a5f7',
  /** Mu La Ronda's grand resets (GameLogic/GrandReset/GrandReset.cs). */
  grandResets: '4d1c7b2a-9e3f-4a58-8c61-2b7e0f9a3d51',
} as const;

/**
 * Banned characters and game masters stay out of the rankings. A GM is
 * usually made by the account's `State` (2 GameMaster, 3 GameMasterInvisible;
 * 4 and 5 are bans), not the character's `CharacterStatus` (1 banned, 32 GM),
 * so both are checked - and a GM's other characters too: the GM mark is per
 * character, and a GM's alt with edited resets topped the ranking.
 */
const STATUS_BANNED = 1;
const STATUS_GAME_MASTER = 32;
const ACCOUNT_HIDDEN = [2, 3, 4, 5];

/** `GuildPosition.GuildMaster`. */
const GUILD_MASTER = 128;

const RANKING_SIZE = 50;

/** Mu La Ronda's grand reset plugin (GameLogic/GrandReset/GrandReset.cs) and its default resets per grand reset. */
const GRAND_RESET_TYPE = 'e2b7c4d1-6a3f-4e58-9b0c-1d2e3f4a5b6c';
const DEFAULT_RESETS_PER_GRAND_RESET = 10;

/**
 * How many resets one grand reset stands for, as the grand reset gives them (240 resets, 24 grand
 * resets): the rankings count each character's grand resets that many times over its resets, so
 * 260 resets (26 grand resets' worth) stand above 1 grand reset and 10 resets (20).
 */
async function resetsPerGrandReset(sql: Sql): Promise<number> {
  try {
    const [row] = await sql<{ config: string | null }[]>`
      SELECT "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${GRAND_RESET_TYPE}::uuid`;
    const value = Number(JSON.parse(row?.config || '{}').ResetsPerGrandReset);
    return Number.isFinite(value) && value >= 1 ? Math.trunc(value) : DEFAULT_RESETS_PER_GRAND_RESET;
  } catch {
    return DEFAULT_RESETS_PER_GRAND_RESET;
  }
}
const CACHE_MS = 60_000;

const NAME_RE = /^[A-Za-z0-9]{1,10}$/;

export type RankingType = 'resets' | 'pk' | 'guilds';

const cache = new Map<RankingType, { at: number; rows: readonly unknown[] }>();

const PUBLIC_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=30',
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: PUBLIC_HEADERS });
}

async function query(sql: Sql, type: RankingType): Promise<readonly unknown[]> {
  const perGrandReset = await resetsPerGrandReset(sql);
  switch (type) {
    case 'resets':
      return sql`
        SELECT c."Name" AS name,
               cc."Name" AS class,
               COALESCE(gr."Value", 0)::int AS "grandResets",
               COALESCE(r."Value", 0)::int AS resets,
               COALESCE(l."Value", 0)::int AS level,
               COALESCE(m."Value", 0)::int AS "masterLevel"
          FROM data."Character" c
          JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
          LEFT JOIN data."StatAttribute" gr ON gr."CharacterId" = c."Id" AND gr."DefinitionId" = ${STAT.grandResets}::uuid
          LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
          LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
          LEFT JOIN data."StatAttribute" m ON m."CharacterId" = c."Id" AND m."DefinitionId" = ${STAT.masterLevel}::uuid
          JOIN data."Account" a ON a."Id" = c."AccountId"
         WHERE c."CharacterStatus" NOT IN (${STATUS_BANNED}, ${STATUS_GAME_MASTER})
           AND a."State" NOT IN ${sql(ACCOUNT_HIDDEN)}
           AND NOT EXISTS (SELECT 1 FROM data."Character" g
                            WHERE g."AccountId" = c."AccountId" AND g."CharacterStatus" = ${STATUS_GAME_MASTER})
         ORDER BY COALESCE(gr."Value", 0) * ${perGrandReset} + COALESCE(r."Value", 0) DESC, level DESC, "masterLevel" DESC, c."Experience" DESC, c."Name"
         LIMIT ${RANKING_SIZE}`;

    case 'pk':
      return sql`
        SELECT c."Name" AS name,
               cc."Name" AS class,
               c."PlayerKillCount" AS kills
          FROM data."Character" c
          JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
          JOIN data."Account" a ON a."Id" = c."AccountId"
         WHERE c."CharacterStatus" NOT IN (${STATUS_BANNED}, ${STATUS_GAME_MASTER})
           AND a."State" NOT IN ${sql(ACCOUNT_HIDDEN)}
           AND NOT EXISTS (SELECT 1 FROM data."Character" g
                            WHERE g."AccountId" = c."AccountId" AND g."CharacterStatus" = ${STATUS_GAME_MASTER})
           AND c."PlayerKillCount" > 0
         ORDER BY kills DESC, c."Name"
         LIMIT ${RANKING_SIZE}`;

    case 'guilds':
      return sql`
        SELECT g."Name" AS name,
               g."Score" AS score,
               COUNT(gm."Id")::int AS members,
               COALESCE(SUM(gr."Value"), 0)::int AS "grandResets",
               COALESCE(SUM(r."Value"), 0)::int AS resets,
               MAX(CASE WHEN gm."Status" = ${GUILD_MASTER} THEN c."Name" END) AS master
          FROM guild."Guild" g
          LEFT JOIN guild."GuildMember" gm ON gm."GuildId" = g."Id"
          LEFT JOIN data."Character" c ON c."Id" = gm."Id"
          LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
          LEFT JOIN data."StatAttribute" gr ON gr."CharacterId" = c."Id" AND gr."DefinitionId" = ${STAT.grandResets}::uuid
         GROUP BY g."Id", g."Name", g."Score"
         ORDER BY score DESC, COALESCE(SUM(gr."Value"), 0) * ${perGrandReset} + COALESCE(SUM(r."Value"), 0) DESC, members DESC, g."Name"
         LIMIT ${RANKING_SIZE}`;
  }
}

async function ranking(sql: Sql, type: RankingType): Promise<readonly unknown[]> {
  const hit = cache.get(type);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;

  const rows = await query(sql, type);
  cache.set(type, { at: Date.now(), rows });
  return rows;
}

async function character(sql: Sql, name: string) {
  const [row] = await sql`
    SELECT c."Name" AS name,
           COALESCE(r."Value", 0)::int AS resets,
           COALESCE(l."Value", 0)::int AS level,
           COALESCE(m."Value", 0)::int AS "masterLevel",
           c."PlayerKillCount" AS kills
      FROM data."Character" c
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
      LEFT JOIN data."StatAttribute" m ON m."CharacterId" = c."Id" AND m."DefinitionId" = ${STAT.masterLevel}::uuid
     WHERE c."Name" = ${name}
     LIMIT 1`;
  return row ?? null;
}

/** The response for a stats path, or null when the path is not one of these. */
export async function handleStats(req: Request, url: URL, sql: Sql): Promise<Response | null> {
  if (url.pathname !== '/api/rankings' && url.pathname !== '/api/character') return null;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
  if (req.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);

  try {
    if (url.pathname === '/api/rankings') {
      const type = url.searchParams.get('type') as RankingType | null;
      if (type !== 'resets' && type !== 'pk' && type !== 'guilds') {
        return reply({ error: 'type must be resets, pk or guilds' }, 400);
      }
      return reply({ type, rows: await ranking(sql, type) });
    }

    const name = url.searchParams.get('name') ?? '';
    if (!NAME_RE.test(name)) return reply({ error: 'Bad name' }, 400);

    const row = await character(sql, name);
    return row ? reply(row) : reply({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('stats query failed:', err);
    return reply({ error: 'Stats unavailable' }, 500);
  }
}
