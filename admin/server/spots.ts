import type { Sql } from 'postgres';

/**
 * Monster spots (config."MonsterSpawnArea") for the map editor.
 *
 * The panel edits the *base* quantity. Server fast (02-fast.sql) keeps every
 * spot's base in mlr.spawn_quantity and multiplies the plain monster spots by
 * the configured factor; the panel keeps the same books, so the effective
 * number stays right across deploys. The Arena levelling spots belong to
 * 06-leveling.sql (re-created on every apply) and are shown read-only.
 *
 * Like every configuration edit, spots take effect when OpenMU restarts.
 */

async function ensureBooks(sql: Sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`CREATE TABLE IF NOT EXISTS mlr.spawn_quantity ("Id" uuid PRIMARY KEY, "Quantity" smallint NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS mlr.leveling_spawns ("Id" uuid PRIMARY KEY)`;
  await sql`CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL)`;
}

async function spawnFactor(sql: Sql): Promise<number> {
  const [row] = await sql`SELECT value FROM mlr.settings WHERE key = 'spawn_factor'`;
  // 02-fast.sql's default when the panel never set one.
  const [fast] = await sql`SELECT to_regclass('mlr.monster_respawn') IS NOT NULL AS applied`;
  return Number(row?.value ?? (fast.applied ? 3 : 1));
}

export async function listMonsters(sql: Sql) {
  return sql`
    SELECT "Id" AS id, "Number" AS number, "Designation" AS name, "ObjectKind" AS kind
      FROM config."MonsterDefinition"
     ORDER BY "ObjectKind", "Number"`;
}

export async function listSpawns(sql: Sql, mapId: string) {
  await ensureBooks(sql);
  return sql`
    SELECT s."Id" AS id, s."MonsterDefinitionId" AS "monsterId", m."Number" AS "monsterNumber",
           m."Designation" AS "monsterName", m."ObjectKind" AS kind,
           s."Quantity" AS quantity, COALESCE(b."Quantity", s."Quantity") AS "baseQuantity",
           s."X1" AS x1, s."Y1" AS y1, s."X2" AS x2, s."Y2" AS y2,
           s."SpawnTrigger" AS trigger, s."Direction" AS direction,
           (l."Id" IS NOT NULL) AS leveling
      FROM config."MonsterSpawnArea" s
      JOIN config."MonsterDefinition" m ON m."Id" = s."MonsterDefinitionId"
      LEFT JOIN mlr.spawn_quantity b ON b."Id" = s."Id"
      LEFT JOIN mlr.leveling_spawns l ON l."Id" = s."Id"
     WHERE s."GameMapId" = ${mapId}::uuid
     ORDER BY m."ObjectKind", m."Number", s."X1", s."Y1"`;
}

export type SpawnInput = {
  monsterId?: string;
  quantity?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

const coord = (v: unknown) => Math.min(255, Math.max(0, Math.trunc(Number(v))));

function rect(input: SpawnInput, current?: { x1: number; y1: number; x2: number; y2: number }) {
  const r = {
    x1: input.x1 ?? current?.x1,
    y1: input.y1 ?? current?.y1,
    x2: input.x2 ?? current?.x2,
    y2: input.y2 ?? current?.y2,
  };
  if ([r.x1, r.y1, r.x2, r.y2].some(v => v === undefined || !Number.isFinite(Number(v)))) {
    throw new Error('Faltan las coordenadas del spot');
  }
  const [x1, x2] = [coord(r.x1), coord(r.x2)].sort((a, b) => a - b);
  const [y1, y2] = [coord(r.y1), coord(r.y2)].sort((a, b) => a - b);
  return { x1, y1, x2, y2 };
}

/** The quantity OpenMU uses: the base, multiplied for plain monster spots. */
function effective(base: number, kind: number, trigger: number, factor: number): number {
  return kind === 0 && trigger === 0 && base >= 2 ? Math.min(32767, base * factor) : base;
}

export async function createSpawn(sql: Sql, mapId: string, input: SpawnInput) {
  await ensureBooks(sql);
  const base = Math.min(500, Math.max(1, Math.trunc(Number(input.quantity ?? 1))));
  const area = rect(input);
  const [monster] = await sql`SELECT "Id", "ObjectKind" AS kind FROM config."MonsterDefinition" WHERE "Id" = ${input.monsterId ?? ''}::uuid`;
  if (!monster) throw new Error('Monstruo inexistente');
  const factor = await spawnFactor(sql);

  await sql.begin(async tx => {
    const [row] = await tx`
      INSERT INTO config."MonsterSpawnArea"
        ("Id", "Direction", "GameMapId", "MonsterDefinitionId", "Quantity", "SpawnTrigger",
         "WaveNumber", "X1", "X2", "Y1", "Y2")
      VALUES (gen_random_uuid(), 0, ${mapId}::uuid, ${monster.Id}, ${effective(base, monster.kind, 0, factor)}, 0,
              0, ${area.x1}, ${area.x2}, ${area.y1}, ${area.y2})
      RETURNING "Id"`;
    await tx`INSERT INTO mlr.spawn_quantity ("Id", "Quantity") VALUES (${row.Id}, ${base})`;
  });
}

export async function updateSpawn(sql: Sql, id: string, input: SpawnInput) {
  await ensureBooks(sql);
  const [current] = await sql`
    SELECT s."X1" AS x1, s."Y1" AS y1, s."X2" AS x2, s."Y2" AS y2, s."SpawnTrigger" AS trigger,
           s."Quantity" AS quantity, COALESCE(b."Quantity", s."Quantity") AS base,
           s."MonsterDefinitionId" AS "monsterId", (l."Id" IS NOT NULL) AS leveling
      FROM config."MonsterSpawnArea" s
      LEFT JOIN mlr.spawn_quantity b ON b."Id" = s."Id"
      LEFT JOIN mlr.leveling_spawns l ON l."Id" = s."Id"
     WHERE s."Id" = ${id}::uuid`;
  if (!current) throw new Error('Spot inexistente');
  if (current.leveling) throw new Error('Este spot es de la zona de leveleo (06-leveling.sql): se cambia en ese archivo.');

  const monsterId = input.monsterId ?? current.monsterId;
  const [monster] = await sql`SELECT "Id", "ObjectKind" AS kind FROM config."MonsterDefinition" WHERE "Id" = ${monsterId}::uuid`;
  if (!monster) throw new Error('Monstruo inexistente');

  const base = input.quantity !== undefined ? Math.min(500, Math.max(1, Math.trunc(Number(input.quantity)))) : current.base;
  const area = rect(input, current as unknown as { x1: number; y1: number; x2: number; y2: number });
  const factor = await spawnFactor(sql);

  await sql.begin(async tx => {
    await tx`
      UPDATE config."MonsterSpawnArea"
         SET "MonsterDefinitionId" = ${monster.Id}, "Quantity" = ${effective(base, monster.kind, current.trigger, factor)},
             "X1" = ${area.x1}, "Y1" = ${area.y1}, "X2" = ${area.x2}, "Y2" = ${area.y2}
       WHERE "Id" = ${id}::uuid`;
    await tx`
      INSERT INTO mlr.spawn_quantity ("Id", "Quantity") VALUES (${id}::uuid, ${base})
      ON CONFLICT ("Id") DO UPDATE SET "Quantity" = EXCLUDED."Quantity"`;
  });
}

export async function deleteSpawn(sql: Sql, id: string) {
  await ensureBooks(sql);
  const [leveling] = await sql`SELECT 1 FROM mlr.leveling_spawns WHERE "Id" = ${id}::uuid`;
  if (leveling) throw new Error('Este spot es de la zona de leveleo (06-leveling.sql): se cambia en ese archivo.');
  await sql.begin(async tx => {
    await tx`DELETE FROM config."MonsterSpawnArea" WHERE "Id" = ${id}::uuid`;
    await tx`DELETE FROM mlr.spawn_quantity WHERE "Id" = ${id}::uuid`;
  });
}
