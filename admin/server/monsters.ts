import type { Sql } from 'postgres';

/**
 * Monster editor: a monster's stats (config."MonsterAttribute": level, life,
 * damage, defence, rates, resistances...) and its timings
 * (config."MonsterDefinition": respawn, attack and move delays, ranges,
 * drops at most).
 *
 * Every save also writes the whole monster into mlr.monster_overrides, and
 * deploy/config/99-admin-monsters.sql writes it back after every other config
 * file: what a deploy sets of its own (the bosses' respawn in 19-kundun-boss
 * and 25-selupan-boss, the golden monsters' life, server fast's respawn)
 * runs first and the panel's value stays. "Dejar de fijar" hands the monster
 * back to the deploys.
 *
 * Like every configuration edit, it takes effect when OpenMU restarts.
 */

/** The attributes shown first and named in Spanish; the rest go below with OpenMU's name. */
export const MAIN_ATTRIBUTES: { designation: string; label: string; hint?: string }[] = [
  { designation: 'Level', label: 'Nivel' },
  { designation: 'Maximum Health', label: 'Vida' },
  { designation: 'Minimum Physical Base Damage', label: 'Daño mínimo' },
  { designation: 'Maximum Physical Base Damage', label: 'Daño máximo' },
  { designation: 'Base Defense', label: 'Defensa' },
  { designation: 'Attack Rate (PvM)', label: 'Precisión (attack rate)' },
  { designation: 'Defense Rate (PvM)', label: 'Evasión (defense rate)' },
  { designation: 'Skill Damage Multiplier', label: 'Multiplicador de daño de skills' },
  { designation: 'Fire Resistance', label: 'Resistencia al fuego', hint: 'de 0 a 1' },
  { designation: 'Ice Resistance', label: 'Resistencia al hielo', hint: 'de 0 a 1' },
  { designation: 'Lightning Resistance', label: 'Resistencia al rayo', hint: 'de 0 a 1' },
  { designation: 'Poison Resistance', label: 'Resistencia al veneno', hint: 'de 0 a 1' },
  { designation: 'Water Resistance', label: 'Resistencia al agua', hint: 'de 0 a 1' },
  { designation: 'Wind Resistance', label: 'Resistencia al viento', hint: 'de 0 a 1' },
  { designation: 'Earth Resistance', label: 'Resistencia a la tierra', hint: 'de 0 a 1' },
];

export type MonsterRow = {
  id: string;
  number: number;
  name: string;
  kind: number;
  level: number | null;
  health: number | null;
  minDamage: number | null;
  maxDamage: number | null;
  defense: number | null;
  spots: number;
  edited: boolean;
};

export type MonsterAttribute = { attributeId: string; designation: string; value: number };

export type MonsterDetail = MonsterRow & {
  respawnSeconds: number;
  attackDelayMs: number;
  moveDelayMs: number;
  moveRange: number;
  attackRange: number;
  viewRange: number;
  maxDrops: number;
  attributes: MonsterAttribute[];
  maps: string[];
};

export type MonsterInput = {
  name?: string;
  respawnSeconds?: number;
  attackDelayMs?: number;
  moveDelayMs?: number;
  moveRange?: number;
  attackRange?: number;
  viewRange?: number;
  maxDrops?: number;
  /** attributeId -> value; a new id adds the attribute. */
  attributes?: Record<string, number>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureBooks(sql: Sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.monster_overrides (
      "Id" uuid PRIMARY KEY,
      "Data" jsonb NOT NULL,
      "UpdatedAt" timestamptz NOT NULL DEFAULT now())`;
}

/** SQL for the value of one attribute of the monster row `m`, by OpenMU's name (a constant, never input). */
function attr(designation: string) {
  return `(SELECT ma."Value" FROM config."MonsterAttribute" ma
             JOIN config."AttributeDefinition" ad ON ad."Id" = ma."AttributeDefinitionId"
            WHERE ma."MonsterDefinitionId" = m."Id" AND ad."Designation" = '${designation.replace(/'/g, "''")}' LIMIT 1)`;
}

export async function listMonsterRows(sql: Sql): Promise<MonsterRow[]> {
  await ensureBooks(sql);
  return sql.unsafe<MonsterRow[]>(`
    SELECT m."Id" AS id, m."Number" AS number, m."Designation" AS name, m."ObjectKind" AS kind,
           ${attr('Level')} AS level, ${attr('Maximum Health')} AS health,
           ${attr('Minimum Physical Base Damage')} AS "minDamage", ${attr('Maximum Physical Base Damage')} AS "maxDamage",
           ${attr('Base Defense')} AS defense,
           (SELECT count(*)::int FROM config."MonsterSpawnArea" s WHERE s."MonsterDefinitionId" = m."Id") AS spots,
           EXISTS (SELECT 1 FROM mlr.monster_overrides o WHERE o."Id" = m."Id") AS edited
      FROM config."MonsterDefinition" m
     ORDER BY m."ObjectKind", m."Number"`);
}

const seconds = (column: string) => `COALESCE(EXTRACT(EPOCH FROM m."${column}"), 0)::float8`;

export async function getMonster(sql: Sql, id: string): Promise<MonsterDetail | null> {
  await ensureBooks(sql);
  const [row] = await sql.unsafe<(Omit<MonsterDetail, 'attributes' | 'maps' | 'spots' | 'edited'> & { spots: number; edited: boolean })[]>(`
    SELECT m."Id" AS id, m."Number" AS number, m."Designation" AS name, m."ObjectKind" AS kind,
           ${attr('Level')} AS level, ${attr('Maximum Health')} AS health,
           ${attr('Minimum Physical Base Damage')} AS "minDamage", ${attr('Maximum Physical Base Damage')} AS "maxDamage",
           ${attr('Base Defense')} AS defense,
           ${seconds('RespawnDelay')} AS "respawnSeconds",
           (${seconds('AttackDelay')} * 1000)::int AS "attackDelayMs",
           (${seconds('MoveDelay')} * 1000)::int AS "moveDelayMs",
           m."MoveRange" AS "moveRange", m."AttackRange" AS "attackRange", m."ViewRange" AS "viewRange",
           m."NumberOfMaximumItemDrops" AS "maxDrops",
           (SELECT count(*)::int FROM config."MonsterSpawnArea" s WHERE s."MonsterDefinitionId" = m."Id") AS spots,
           EXISTS (SELECT 1 FROM mlr.monster_overrides o WHERE o."Id" = m."Id") AS edited
      FROM config."MonsterDefinition" m
     WHERE m."Id" = $1::uuid`, [id]);
  if (!row) return null;
  const attributes = await sql<MonsterAttribute[]>`
    SELECT ma."AttributeDefinitionId" AS "attributeId", ad."Designation" AS designation, ma."Value" AS value
      FROM config."MonsterAttribute" ma
      JOIN config."AttributeDefinition" ad ON ad."Id" = ma."AttributeDefinitionId"
     WHERE ma."MonsterDefinitionId" = ${id}::uuid
     ORDER BY ad."Designation"`;
  const maps = await sql<{ name: string }[]>`
    SELECT DISTINCT g."Name" AS name
      FROM config."MonsterSpawnArea" s JOIN config."GameMapDefinition" g ON g."Id" = s."GameMapId"
     WHERE s."MonsterDefinitionId" = ${id}::uuid
     ORDER BY 1`;
  return { ...row, attributes, maps: maps.map(m => m.name) };
}

/** Attributes a monster may be given that it does not have yet: the ones any monster has. */
export async function attributeChoices(sql: Sql) {
  return sql<{ id: string; designation: string }[]>`
    SELECT DISTINCT ad."Id" AS id, ad."Designation" AS designation
      FROM config."MonsterAttribute" ma JOIN config."AttributeDefinition" ad ON ad."Id" = ma."AttributeDefinitionId"
     ORDER BY 2`;
}

const int = (v: unknown, min: number, max: number, what: string) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${what}: de ${min} a ${max}`);
  return n;
};

/** The monster as it is now, in the shape mlr.monster_overrides keeps. */
async function snapshot(sql: Sql, id: string) {
  const [row] = await sql`
    SELECT m."Designation" AS name, m."RespawnDelay"::text AS "respawnDelay", m."AttackDelay"::text AS "attackDelay",
           m."MoveDelay"::text AS "moveDelay", m."MoveRange" AS "moveRange", m."AttackRange" AS "attackRange",
           m."ViewRange" AS "viewRange", m."NumberOfMaximumItemDrops" AS "maxDrops",
           COALESCE((SELECT jsonb_object_agg(ma."AttributeDefinitionId", ma."Value") FROM config."MonsterAttribute" ma
                      WHERE ma."MonsterDefinitionId" = m."Id"), '{}'::jsonb) AS attributes
      FROM config."MonsterDefinition" m WHERE m."Id" = ${id}::uuid`;
  return row ?? null;
}

export async function updateMonster(sql: Sql, id: string, input: MonsterInput) {
  await ensureBooks(sql);
  await sql.begin(async tx => {
    const [exists] = await tx`SELECT 1 FROM config."MonsterDefinition" WHERE "Id" = ${id}::uuid FOR UPDATE`;
    if (!exists) throw new Error('Ese monstruo no existe');

    if (input.name !== undefined) {
      const name = String(input.name).trim().slice(0, 100);
      if (!name) throw new Error('Poné un nombre');
      await tx`UPDATE config."MonsterDefinition" SET "Designation" = ${name} WHERE "Id" = ${id}::uuid`;
    }
    if (input.respawnSeconds !== undefined) {
      const s = int(input.respawnSeconds, 1, 7 * 24 * 3600, 'Respawn (segundos)');
      await tx`UPDATE config."MonsterDefinition" SET "RespawnDelay" = make_interval(secs => ${s}) WHERE "Id" = ${id}::uuid`;
    }
    if (input.attackDelayMs !== undefined) {
      const ms = int(input.attackDelayMs, 100, 60000, 'Tiempo entre ataques (ms)');
      await tx`UPDATE config."MonsterDefinition" SET "AttackDelay" = make_interval(secs => ${ms / 1000}) WHERE "Id" = ${id}::uuid`;
    }
    if (input.moveDelayMs !== undefined) {
      const ms = int(input.moveDelayMs, 0, 60000, 'Tiempo entre pasos (ms)');
      await tx`UPDATE config."MonsterDefinition" SET "MoveDelay" = make_interval(secs => ${ms / 1000}) WHERE "Id" = ${id}::uuid`;
    }
    if (input.moveRange !== undefined) {
      await tx`UPDATE config."MonsterDefinition" SET "MoveRange" = ${int(input.moveRange, 0, 30, 'Rango de movimiento')} WHERE "Id" = ${id}::uuid`;
    }
    if (input.attackRange !== undefined) {
      await tx`UPDATE config."MonsterDefinition" SET "AttackRange" = ${int(input.attackRange, 0, 30, 'Rango de ataque')} WHERE "Id" = ${id}::uuid`;
    }
    if (input.viewRange !== undefined) {
      await tx`UPDATE config."MonsterDefinition" SET "ViewRange" = ${int(input.viewRange, 0, 30, 'Rango de visión')} WHERE "Id" = ${id}::uuid`;
    }
    if (input.maxDrops !== undefined) {
      await tx`UPDATE config."MonsterDefinition" SET "NumberOfMaximumItemDrops" = ${int(input.maxDrops, 0, 50, 'Drops como máximo')} WHERE "Id" = ${id}::uuid`;
    }

    for (const [attributeId, raw] of Object.entries(input.attributes ?? {})) {
      if (!UUID_RE.test(attributeId)) throw new Error('Atributo inválido');
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 2_000_000_000) throw new Error('Valor de atributo inválido');
      const [updated] = await tx`
        UPDATE config."MonsterAttribute" SET "Value" = ${value}
         WHERE "MonsterDefinitionId" = ${id}::uuid AND "AttributeDefinitionId" = ${attributeId}::uuid
        RETURNING 1 AS ok`;
      if (!updated) {
        const [definition] = await tx`SELECT 1 FROM config."AttributeDefinition" WHERE "Id" = ${attributeId}::uuid`;
        if (!definition) throw new Error('Atributo inexistente');
        await tx`
          INSERT INTO config."MonsterAttribute" ("Id", "AttributeDefinitionId", "MonsterDefinitionId", "Value")
          VALUES (gen_random_uuid(), ${attributeId}::uuid, ${id}::uuid, ${value})`;
      }
    }

    const data = await snapshot(tx as unknown as Sql, id);
    await tx`
      INSERT INTO mlr.monster_overrides ("Id", "Data", "UpdatedAt") VALUES (${id}::uuid, ${tx.json(data as never)}, now())
      ON CONFLICT ("Id") DO UPDATE SET "Data" = EXCLUDED."Data", "UpdatedAt" = now()`;
  });
}

/** Forgets the panel's edit: the next deploy is free to set the monster again. */
export async function releaseMonster(sql: Sql, id: string) {
  await ensureBooks(sql);
  await sql`DELETE FROM mlr.monster_overrides WHERE "Id" = ${id}::uuid`;
}
