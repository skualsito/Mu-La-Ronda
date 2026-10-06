import type { Sql } from 'postgres';
import bcrypt from 'bcryptjs';

/**
 * Everything the panel reads from and writes to OpenMU's database. The game
 * server keeps loaded characters and its configuration in memory, so:
 *  - a character is only edited while its account is offline (OpenMU would
 *    overwrite the edit when it saves on logout);
 *  - configuration changes apply when OpenMU restarts (the panel's Restart).
 */

export const STAT = {
  level: '560931ad-0901-4342-b7f4-fd2e2fcc0563',
  masterLevel: '70cd8c10-391a-4c51-9aa4-a854600e3a9f',
  resets: '89a891a7-f9f9-4ab5-af36-12056e53a5f7',
  strength: '123282fe-fead-448e-ad2c-baece939b4b1',
  agility: '1ae9c014-e3cd-4703-bd05-1b65f5f94ceb',
  vitality: '6ca5c3a6-b109-45a5-87a7-fdcb107b4982',
  energy: '01b0ef28-f7a0-46b5-97ba-2b624a54cd75',
  leadership: '6af2c9df-3ae4-4721-8462-9a8ec7f56fe4',
} as const;

type StatKey = keyof typeof STAT;

export const MAX_STAT = 32767;

/** CharacterStatus: 0 Normal, 1 Banned, 32 Game Master. */
export const CHARACTER_STATUS = [0, 1, 32] as const;
/** AccountState: 0 Normal, 2 Game Master, 4 Banned, 5 Temporarily banned. */
export const ACCOUNT_STATES = [0, 2, 4, 5] as const;

/**
 * OpenMU's default experience table (GameConfiguration.ExperienceFormula):
 * the experience a character has on reaching `level`.
 */
export function experienceForLevel(level: number): number {
  if (level <= 1) return 0;
  const base = 10 * (level + 8) * (level - 1) ** 2;
  return level > 256 ? base + 1000 * (level - 247) * (level - 256) ** 2 : base;
}

/** Plug-ins the panel shows by name; OpenMU stores only their type ids. */
export const PLUGINS: { id: string; name: string; group: string; description: string }[] = [
  { id: '6a9d585d-79d7-4674-b6ea-7e87392fa501', group: 'Resets', name: 'Sistema de resets', description: 'Habilita los resets (la configuracion esta en la pestaña Resets).' },
  { id: '90b35404-aade-4f22-b5d2-4cd59b8bb4c8', group: 'Resets', name: '/reset', description: 'Comando de chat para resetear.' },
  { id: '79f2c2c2-2e4c-4f4b-8a74-4227d1209d27', group: 'Resets', name: '/resetinfo', description: 'Muestra resets y el costo del proximo.' },
  { id: '08953be6-dabf-49cc-a500-fdb9dc2c4d80', group: 'Resets', name: 'Reset con Leo the Helper', description: 'Resetear hablando con el NPC.' },
  { id: '26acf6a9-346a-49df-8583-ea610f6e3aea', group: 'Game Master', name: '/getresets', description: 'Ver los resets de un personaje (GM).' },
  { id: '47a8644c-b6c5-439e-bab0-c1a7ae72691c', group: 'Game Master', name: '/setresets', description: 'Cambiar los resets de un personaje (GM).' },
  { id: '042ec5c6-27c8-4e00-a48b-c5458edea0bc', group: 'Stats', name: '/add (servidor)', description: 'El cliente de Mu La Ronda ya resuelve /add solo; esto es la version del servidor.' },
  { id: 'a95a8d2f-a0c3-442e-995c-005b5c1b42d2', group: 'Seguridad', name: 'Detector de speed hack', description: 'Banea cuentas que atacan "demasiado rapido". Con agilidad alta da falsos positivos.' },
];

function online(onlineAccounts: Set<string>, login: string | null): boolean {
  return !!login && onlineAccounts.has(login.toLowerCase());
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function dashboard(sql: Sql, onlineAccounts: Set<string>) {
  const [counts] = await sql`
    SELECT (SELECT count(*) FROM data."Account")::int AS accounts,
           (SELECT count(*) FROM data."Character")::int AS characters,
           (SELECT count(*) FROM data."Account" WHERE "State" IN (4, 5))::int AS banned,
           (SELECT count(*) FROM data."Account" WHERE "RegistrationDate" > now() - interval '24 hours')::int AS "newAccounts"`;

  const top = await sql`
    SELECT c."Name" AS name, cc."Name" AS class,
           COALESCE(r."Value", 0)::int AS resets, COALESCE(l."Value", 0)::int AS level
      FROM data."Character" c
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
     ORDER BY resets DESC, level DESC LIMIT 8`;

  const recent = await sql`
    SELECT a."LoginName" AS login, a."RegistrationDate" AS "registeredAt"
      FROM data."Account" a ORDER BY a."RegistrationDate" DESC LIMIT 8`;

  return { ...counts, online: onlineAccounts.size, onlineAccounts: [...onlineAccounts], top, recent };
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export async function listCharacters(sql: Sql, q: string, onlineAccounts: Set<string>) {
  const like = `%${q}%`;
  const rows = await sql`
    SELECT c."Id" AS id, c."Name" AS name, a."LoginName" AS account, cc."Name" AS class,
           COALESCE(l."Value", 0)::int AS level, COALESCE(m."Value", 0)::int AS "masterLevel",
           COALESCE(r."Value", 0)::int AS resets, c."CharacterStatus" AS status,
           gm."Name" AS map
      FROM data."Character" c
      LEFT JOIN data."Account" a ON a."Id" = c."AccountId"
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN config."GameMapDefinition" gm ON gm."Id" = c."CurrentMapId"
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
      LEFT JOIN data."StatAttribute" m ON m."CharacterId" = c."Id" AND m."DefinitionId" = ${STAT.masterLevel}::uuid
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
     WHERE ${q} = '' OR c."Name" ILIKE ${like} OR a."LoginName" ILIKE ${like}
     ORDER BY resets DESC, level DESC, c."Name"
     LIMIT 200`;
  return rows.map(row => ({ ...row, online: online(onlineAccounts, row.account) }));
}

export async function getCharacter(sql: Sql, id: string, onlineAccounts: Set<string>) {
  const [row] = await sql`
    SELECT c."Id" AS id, c."Name" AS name, a."Id" AS "accountId", a."LoginName" AS account,
           cc."Name" AS class, c."CharacterStatus" AS status, c."LevelUpPoints" AS points,
           c."MasterLevelUpPoints" AS "masterPoints", c."PlayerKillCount" AS kills, c."State" AS "heroState",
           c."CurrentMapId" AS "mapId", c."PositionX" AS x, c."PositionY" AS y,
           c."Experience"::text AS experience, c."CreateDate" AS "createdAt",
           COALESCE(s."Money", 0) AS money
      FROM data."Character" c
      LEFT JOIN data."Account" a ON a."Id" = c."AccountId"
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."ItemStorage" s ON s."Id" = c."InventoryId"
     WHERE c."Id" = ${id}::uuid`;
  if (!row) return null;

  const stats = await sql`
    SELECT "DefinitionId"::text AS def, "Value" AS value FROM data."StatAttribute"
     WHERE "CharacterId" = ${id}::uuid`;
  const byDef = new Map(stats.map(s => [s.def, Number(s.value)]));
  const values = Object.fromEntries(
    (Object.keys(STAT) as StatKey[]).map(key => [key, byDef.has(STAT[key]) ? Math.round(byDef.get(STAT[key])!) : null])
  );

  return { ...row, stats: values, online: online(onlineAccounts, row.account) };
}

export type CharacterPatch = Partial<Record<StatKey, number>> & {
  points?: number;
  masterPoints?: number;
  money?: number;
  status?: number;
  kills?: number;
  heroState?: number;
  mapId?: string;
  x?: number;
  y?: number;
};

const clampInt = (v: unknown, min: number, max: number): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
};

export async function updateCharacter(sql: Sql, id: string, patch: CharacterPatch) {
  await sql.begin(async tx => {
    const [character] = await tx`SELECT "InventoryId" AS inv FROM data."Character" WHERE "Id" = ${id}::uuid FOR UPDATE`;
    if (!character) throw new Error('Personaje inexistente');

    const statLimits: Record<StatKey, [number, number]> = {
      level: [1, 400],
      masterLevel: [0, 200],
      resets: [0, 100000],
      strength: [1, MAX_STAT],
      agility: [1, MAX_STAT],
      vitality: [1, MAX_STAT],
      energy: [1, MAX_STAT],
      leadership: [0, MAX_STAT],
    };

    for (const key of Object.keys(STAT) as StatKey[]) {
      const value = clampInt(patch[key], ...statLimits[key]);
      if (value === undefined) continue;
      const def = STAT[key];
      const updated = await tx`
        UPDATE data."StatAttribute" SET "Value" = ${value}
         WHERE "CharacterId" = ${id}::uuid AND "DefinitionId" = ${def}::uuid RETURNING 1`;
      // Leadership only exists for the classes that have it (Dark Lord).
      if (!updated.length && key !== 'leadership') {
        await tx`
          INSERT INTO data."StatAttribute" ("Id", "CharacterId", "DefinitionId", "Value")
          VALUES (gen_random_uuid(), ${id}::uuid, ${def}::uuid, ${value})`;
      }
      // The level without its experience would take a hundred kills to move.
      if (key === 'level') {
        await tx`UPDATE data."Character" SET "Experience" = ${experienceForLevel(value)} WHERE "Id" = ${id}::uuid`;
      }
    }

    const sets: Record<string, number | string> = {};
    const points = clampInt(patch.points, 0, 2_000_000_000);
    if (points !== undefined) sets.LevelUpPoints = points;
    const masterPoints = clampInt(patch.masterPoints, 0, 100_000);
    if (masterPoints !== undefined) sets.MasterLevelUpPoints = masterPoints;
    const kills = clampInt(patch.kills, 0, 1_000_000);
    if (kills !== undefined) sets.PlayerKillCount = kills;
    const heroState = clampInt(patch.heroState, 0, 6);
    if (heroState !== undefined) sets.State = heroState;
    if (patch.status !== undefined && (CHARACTER_STATUS as readonly number[]).includes(Number(patch.status))) {
      sets.CharacterStatus = Number(patch.status);
    }
    if (patch.mapId) {
      const [map] = await tx`SELECT 1 FROM config."GameMapDefinition" WHERE "Id" = ${patch.mapId}::uuid`;
      if (!map) throw new Error('Mapa inexistente');
      sets.CurrentMapId = patch.mapId;
    }
    const x = clampInt(patch.x, 0, 255);
    if (x !== undefined) sets.PositionX = x;
    const y = clampInt(patch.y, 0, 255);
    if (y !== undefined) sets.PositionY = y;

    if (Object.keys(sets).length) await tx`UPDATE data."Character" SET ${tx(sets)} WHERE "Id" = ${id}::uuid`;

    const money = clampInt(patch.money, 0, 2_000_000_000);
    if (money !== undefined && character.inv) {
      await tx`UPDATE data."ItemStorage" SET "Money" = ${money} WHERE "Id" = ${character.inv}::uuid`;
    }
  });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listAccounts(sql: Sql, q: string, onlineAccounts: Set<string>) {
  const like = `%${q}%`;
  const rows = await sql`
    SELECT a."Id" AS id, a."LoginName" AS login, a."EMail" AS email, a."State" AS state,
           a."RegistrationDate" AS "registeredAt", count(c."Id")::int AS characters
      FROM data."Account" a
      LEFT JOIN data."Character" c ON c."AccountId" = a."Id"
     WHERE (${q} = '' OR a."LoginName" ILIKE ${like} OR a."EMail" ILIKE ${like}) AND NOT a."IsTemplate"
     GROUP BY a."Id"
     ORDER BY a."RegistrationDate" DESC
     LIMIT 200`;
  return rows.map(row => ({ ...row, online: online(onlineAccounts, row.login) }));
}

export async function getAccount(sql: Sql, id: string, onlineAccounts: Set<string>) {
  const [row] = await sql`
    SELECT a."Id" AS id, a."LoginName" AS login, a."EMail" AS email, a."State" AS state,
           a."RegistrationDate" AS "registeredAt", a."ChatBanUntil" AS "chatBanUntil",
           (a."VaultPassword" IS NOT NULL AND a."VaultPassword" <> '') AS "hasVaultPin"
      FROM data."Account" a WHERE a."Id" = ${id}::uuid`;
  if (!row) return null;
  const characters = await sql`
    SELECT c."Id" AS id, c."Name" AS name, cc."Name" AS class,
           COALESCE(l."Value", 0)::int AS level, COALESCE(r."Value", 0)::int AS resets
      FROM data."Character" c
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
     WHERE c."AccountId" = ${id}::uuid ORDER BY c."CharacterSlot"`;
  return { ...row, characters, online: online(onlineAccounts, row.login) };
}

export async function updateAccount(
  sql: Sql,
  id: string,
  patch: { state?: number; email?: string; password?: string; clearVaultPin?: boolean; clearChatBan?: boolean }
) {
  const sets: Record<string, unknown> = {};
  if (patch.state !== undefined) {
    if (!(ACCOUNT_STATES as readonly number[]).includes(Number(patch.state))) throw new Error('Estado invalido');
    sets.State = Number(patch.state);
  }
  if (patch.email !== undefined) sets.EMail = String(patch.email).slice(0, 100);
  if (patch.password) {
    const password = String(patch.password);
    if (!/^[!-~]{4,10}$/.test(password)) throw new Error('La contraseña tiene que tener 4 a 10 caracteres, sin espacios');
    sets.PasswordHash = await bcrypt.hash(password, 11);
  }
  if (patch.clearVaultPin) sets.VaultPassword = '';
  if (patch.clearChatBan) sets.ChatBanUntil = null;
  if (!Object.keys(sets).length) return;
  await sql`UPDATE data."Account" SET ${sql(sets)} WHERE "Id" = ${id}::uuid`;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESET_TYPE = '6a9d585d-79d7-4674-b6ea-7e87392fa501';

export async function getConfig(sql: Sql) {
  const [game] = await sql`
    SELECT "ExperienceRate" AS "experienceRate", "MasterExperienceRate" AS "masterExperienceRate",
           "MaximumLevel" AS "maximumLevel", "MaximumMasterLevel" AS "maximumMasterLevel",
           "PreventExperienceOverflow" AS "preventExperienceOverflow"
      FROM config."GameConfiguration" LIMIT 1`;

  const [reset] = await sql`
    SELECT "IsActive" AS active, "CustomConfiguration" AS config
      FROM config."PlugInConfiguration" WHERE "TypeId" = ${RESET_TYPE}::uuid`;

  const maps = await sql`
    SELECT "Id" AS id, "Number" AS number, "Name" AS name, "ExpMultiplier" AS "expMultiplier"
      FROM config."GameMapDefinition" ORDER BY "Number"`;

  const fast = await getFastSettings(sql);

  const plugins = await sql`
    SELECT "TypeId"::text AS id, "IsActive" AS active FROM config."PlugInConfiguration"
     WHERE "TypeId" = ANY(${PLUGINS.map(p => p.id)}::uuid[])`;
  const activeById = new Map(plugins.map(p => [p.id, p.active]));

  return {
    game,
    reset: { active: reset?.active ?? false, config: safeJson(reset?.config) },
    maps,
    fast,
    plugins: PLUGINS.map(p => ({ ...p, active: activeById.get(p.id) ?? null })),
  };
}

function safeJson(text: string | null | undefined): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function updateGameConfig(sql: Sql, patch: Record<string, unknown>) {
  const sets: Record<string, number | boolean> = {};
  const n = (key: string, column: string, min: number, max: number) => {
    const v = clampInt(patch[key], min, max);
    if (v !== undefined) sets[column] = v;
  };
  n('experienceRate', 'ExperienceRate', 1, 1_000_000);
  n('masterExperienceRate', 'MasterExperienceRate', 1, 1_000_000);
  n('maximumLevel', 'MaximumLevel', 1, 1000);
  n('maximumMasterLevel', 'MaximumMasterLevel', 0, 1000);
  if (typeof patch.preventExperienceOverflow === 'boolean') sets.PreventExperienceOverflow = patch.preventExperienceOverflow;
  if (Object.keys(sets).length) await sql`UPDATE config."GameConfiguration" SET ${sql(sets)}`;

  if (Array.isArray(patch.maps)) {
    for (const map of patch.maps as { id: string; expMultiplier: number }[]) {
      const mult = Number(map.expMultiplier);
      if (!Number.isFinite(mult) || mult < 0 || mult > 100) continue;
      await sql`UPDATE config."GameMapDefinition" SET "ExpMultiplier" = ${mult} WHERE "Id" = ${map.id}::uuid`;
    }
  }
}

const RESET_KEYS: Record<string, 'number' | 'boolean' | 'nullableNumber'> = {
  ResetLimit: 'nullableNumber',
  RequiredLevel: 'number',
  LevelAfterReset: 'number',
  RequiredMoney: 'number',
  MultiplyRequiredMoneyByResetCount: 'boolean',
  ResetStats: 'boolean',
  PointsPerReset: 'number',
  MultiplyPointsByResetCount: 'boolean',
  ReplacePointsPerReset: 'boolean',
  MoveHome: 'boolean',
  LogOut: 'boolean',
};

export async function updateResetConfig(sql: Sql, patch: { active?: boolean; config?: Record<string, unknown> }) {
  const [row] = await sql`SELECT "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${RESET_TYPE}::uuid`;
  if (!row) throw new Error('El plugin de resets no existe en la base (corre el deploy primero)');
  const current = safeJson(row.config);

  for (const [key, kind] of Object.entries(RESET_KEYS)) {
    if (!patch.config || !(key in patch.config)) continue;
    const value = patch.config[key];
    if (kind === 'boolean') current[key] = !!value;
    else if (kind === 'nullableNumber' && (value === null || value === '')) current[key] = null;
    else {
      const num = clampInt(value, 0, 2_000_000_000);
      if (num !== undefined) current[key] = num;
    }
  }

  await sql`
    UPDATE config."PlugInConfiguration"
       SET "CustomConfiguration" = ${JSON.stringify(current, null, 2)},
           "IsActive" = ${patch.active ?? true}
     WHERE "TypeId" = ${RESET_TYPE}::uuid`;
}

export async function setPlugin(sql: Sql, id: string, active: boolean) {
  if (!PLUGINS.some(p => p.id === id)) throw new Error('Plugin desconocido');
  const updated = await sql`UPDATE config."PlugInConfiguration" SET "IsActive" = ${active} WHERE "TypeId" = ${id}::uuid RETURNING 1`;
  if (!updated.length) {
    await sql`
      INSERT INTO config."PlugInConfiguration" ("Id", "TypeId", "IsActive", "GameConfigurationId")
      SELECT gen_random_uuid(), ${id}::uuid, ${active}, "Id" FROM config."GameConfiguration" LIMIT 1`;
  }
}

// ---------------------------------------------------------------------------
// Server fast (deploy/config/02-fast.sql keeps the originals in mlr.*)
// ---------------------------------------------------------------------------

export async function getFastSettings(sql: Sql) {
  const [exists] = await sql`SELECT to_regclass('mlr.settings') IS NOT NULL AS ok`;
  if (!exists.ok) return { spawnFactor: 3, respawnSeconds: 3, available: false };
  const rows = await sql`SELECT key, value FROM mlr.settings`;
  const get = (k: string, d: number) => Number(rows.find(r => r.key === k)?.value ?? d);
  return { spawnFactor: get('spawn_factor', 3), respawnSeconds: get('respawn_seconds', 3), available: true };
}

export async function updateFastSettings(sql: Sql, patch: { spawnFactor?: number; respawnSeconds?: number }) {
  const factor = clampInt(patch.spawnFactor, 1, 10);
  const respawn = clampInt(patch.respawnSeconds, 1, 30);
  const [ready] = await sql`
    SELECT to_regclass('mlr.spawn_quantity') IS NOT NULL AND to_regclass('mlr.monster_respawn') IS NOT NULL AS ok`;
  if (!ready.ok) throw new Error('Faltan las tablas de 02-fast.sql: corre el deploy primero');

  await sql.begin(async tx => {
    await tx`CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL)`;
    if (factor !== undefined) {
      await tx`INSERT INTO mlr.settings VALUES ('spawn_factor', ${String(factor)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await tx`
        UPDATE config."MonsterSpawnArea" s
           SET "Quantity" = LEAST(b."Quantity" * ${factor}, 32767)
          FROM mlr.spawn_quantity b, config."MonsterDefinition" m
         WHERE b."Id" = s."Id" AND m."Id" = s."MonsterDefinitionId"
           AND m."ObjectKind" = 0 AND s."SpawnTrigger" = 0 AND b."Quantity" >= 2
           AND s."Id" NOT IN (SELECT "Id" FROM mlr.leveling_spawns)`;
    }
    if (respawn !== undefined) {
      await tx`INSERT INTO mlr.settings VALUES ('respawn_seconds', ${String(respawn)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await tx`
        UPDATE config."MonsterDefinition" m
           SET "RespawnDelay" = LEAST(b."RespawnDelay", make_interval(secs => ${respawn}))
          FROM mlr.monster_respawn b
         WHERE b."Id" = m."Id" AND m."ObjectKind" = 0 AND b."RespawnDelay" <= interval '30 seconds'`;
    }
  });
}

export async function listMaps(sql: Sql) {
  return sql`SELECT "Id" AS id, "Number" AS number, "Name" AS name FROM config."GameMapDefinition" ORDER BY "Number"`;
}
