import type { Sql } from 'postgres';

/**
 * Drops: OpenMU's drop item groups (config."DropItemGroup"). A group drops
 * with its chance on every kill of the monsters it reaches - every monster of
 * the maps it is on (config."GameMapDefinitionDropItemGroup"), or only the
 * monsters it is tied to (config."MonsterDefinitionDropItemGroup") - and
 * gives one of its items (config."DropItemGroupItemDefinition"), or for a
 * group without items, a random item of its kind (excellent, ancient, zen...).
 * Groups on neither a map nor a monster are prizes of events and quests.
 *
 * Every save also writes the whole group into mlr.drop_overrides, and
 * deploy/config/99-admin-drops.sql writes it back after every other config
 * file: a deploy that sets a chance of its own (21-moonstone-pendant.sql,
 * 32-fenrir-materials.sql...) runs first and the panel's value stays. A
 * deleted group is kept there as deleted, so a deploy that would insert it
 * again is undone too.
 *
 * Like every configuration edit, drops take effect when OpenMU restarts.
 */

export const ITEM_TYPES = [
  { value: 0, label: 'Ítems de la lista' },
  { value: 1, label: 'Ancient al azar' },
  { value: 2, label: 'Excellent al azar' },
  { value: 3, label: 'Ítem común al azar' },
  { value: 4, label: 'Ítem socket al azar' },
  { value: 5, label: 'Zen' },
  { value: 6, label: 'Joyas (de la lista)' },
] as const;

export type DropItem = { id: string; group: number; number: number; name: string };

export type DropGroup = {
  id: string;
  description: string;
  chance: number;
  itemType: number;
  itemLevel: number | null;
  minMonsterLevel: number | null;
  maxMonsterLevel: number | null;
  /** The monster it only drops from (the link table), or null. */
  monsterId: string | null;
  monsterName: string | null;
  mapIds: string[];
  items: DropItem[];
  /** Used by an event prize or a quest: it cannot be deleted. */
  inUse: string | null;
  /** Saved from the panel: the deploys do not change it any more. */
  edited: boolean;
};

export type DropInput = {
  description?: string;
  chance?: number;
  itemType?: number;
  itemLevel?: number | null;
  minMonsterLevel?: number | null;
  maxMonsterLevel?: number | null;
  monsterId?: string | null;
  mapIds?: string[];
  itemIds?: string[];
};

/** What mlr.drop_overrides keeps of a group: everything 99-admin-drops.sql writes back. */
type Snapshot = {
  description: string;
  chance: number;
  itemType: number;
  itemLevel: number | null;
  minMonsterLevel: number | null;
  maxMonsterLevel: number | null;
  /** The column (config."DropItemGroup"."MonsterId"), apart from the links. */
  monsterColumn: string | null;
  monsterIds: string[];
  mapIds: string[];
  itemIds: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureBooks(sql: Sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.drop_overrides (
      "Id" uuid PRIMARY KEY,
      "Data" jsonb,
      "Deleted" boolean NOT NULL DEFAULT false,
      "UpdatedAt" timestamptz NOT NULL DEFAULT now())`;
}

export async function listDrops(sql: Sql): Promise<DropGroup[]> {
  await ensureBooks(sql);
  const rows = await sql<(Omit<DropGroup, 'items'> & { items: DropItem[] | null })[]>`
    SELECT g."Id" AS id, g."Description" AS description, g."Chance" AS chance, g."ItemType" AS "itemType",
           g."ItemLevel" AS "itemLevel", g."MinimumMonsterLevel" AS "minMonsterLevel",
           g."MaximumMonsterLevel" AS "maxMonsterLevel",
           link."MonsterDefinitionId" AS "monsterId", mo."Designation" AS "monsterName",
           COALESCE((SELECT array_agg(x."GameMapDefinitionId")
                       FROM config."GameMapDefinitionDropItemGroup" x WHERE x."DropItemGroupId" = g."Id"), '{}') AS "mapIds",
           (SELECT json_agg(json_build_object('id', d."Id", 'group', d."Group", 'number', d."Number", 'name', d."Name")
                            ORDER BY d."Group", d."Number")
              FROM config."DropItemGroupItemDefinition" x
              JOIN config."ItemDefinition" d ON d."Id" = x."ItemDefinitionId"
             WHERE x."DropItemGroupId" = g."Id") AS items,
           CASE WHEN EXISTS (SELECT 1 FROM config."MiniGameReward" r WHERE r."ItemRewardId" = g."Id") THEN 'premio de un evento'
                WHEN EXISTS (SELECT 1 FROM config."QuestItemRequirement" q WHERE q."DropItemGroupId" = g."Id") THEN 'una quest'
           END AS "inUse",
           (o."Id" IS NOT NULL) AS edited
      FROM config."DropItemGroup" g
      LEFT JOIN LATERAL (SELECT l."MonsterDefinitionId" FROM config."MonsterDefinitionDropItemGroup" l
                          WHERE l."DropItemGroupId" = g."Id" LIMIT 1) link ON true
      LEFT JOIN config."MonsterDefinition" mo ON mo."Id" = COALESCE(link."MonsterDefinitionId", g."MonsterId")
      LEFT JOIN mlr.drop_overrides o ON o."Id" = g."Id" AND NOT o."Deleted"
     ORDER BY g."Description"`;
  return rows.map(r => ({ ...r, items: r.items ?? [] }));
}

const level = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(255, Math.max(0, n));
};

const ids = (list: unknown, what: string): string[] => {
  if (!Array.isArray(list)) return [];
  const out = [...new Set(list.map(String))];
  if (out.some(id => !UUID_RE.test(id))) throw new Error(`${what} inválidos`);
  return out;
};

/** The group as it is now, in the shape mlr.drop_overrides keeps. */
async function snapshot(sql: Sql, id: string): Promise<Snapshot | null> {
  const [row] = await sql<Snapshot[]>`
    SELECT g."Description" AS description, g."Chance" AS chance, g."ItemType" AS "itemType",
           g."ItemLevel" AS "itemLevel", g."MinimumMonsterLevel" AS "minMonsterLevel",
           g."MaximumMonsterLevel" AS "maxMonsterLevel", g."MonsterId" AS "monsterColumn",
           COALESCE((SELECT array_agg(x."MonsterDefinitionId") FROM config."MonsterDefinitionDropItemGroup" x
                      WHERE x."DropItemGroupId" = g."Id"), '{}') AS "monsterIds",
           COALESCE((SELECT array_agg(x."GameMapDefinitionId") FROM config."GameMapDefinitionDropItemGroup" x
                      WHERE x."DropItemGroupId" = g."Id"), '{}') AS "mapIds",
           COALESCE((SELECT array_agg(x."ItemDefinitionId") FROM config."DropItemGroupItemDefinition" x
                      WHERE x."DropItemGroupId" = g."Id"), '{}') AS "itemIds"
      FROM config."DropItemGroup" g
     WHERE g."Id" = ${id}::uuid`;
  return row ?? null;
}

async function remember(sql: Sql, id: string) {
  const data = await snapshot(sql, id);
  if (!data) return;
  await sql`
    INSERT INTO mlr.drop_overrides ("Id", "Data", "Deleted", "UpdatedAt")
    VALUES (${id}::uuid, ${sql.json(data as never)}, false, now())
    ON CONFLICT ("Id") DO UPDATE SET "Data" = EXCLUDED."Data", "Deleted" = false, "UpdatedAt" = now()`;
}

/** Writes a group's fields and links; `id` must exist already. */
async function write(sql: Sql, id: string, input: DropInput) {
  const [current] = await sql<{ monsterColumn: string | null; linkMonster: string | null }[]>`
    SELECT g."MonsterId" AS "monsterColumn",
           (SELECT l."MonsterDefinitionId" FROM config."MonsterDefinitionDropItemGroup" l
             WHERE l."DropItemGroupId" = g."Id" LIMIT 1) AS "linkMonster"
      FROM config."DropItemGroup" g WHERE g."Id" = ${id}::uuid`;
  if (!current) throw new Error('Ese drop no existe');

  if (input.description !== undefined) {
    const description = String(input.description).trim().slice(0, 200);
    if (!description) throw new Error('Poné un nombre');
    await sql`UPDATE config."DropItemGroup" SET "Description" = ${description} WHERE "Id" = ${id}::uuid`;
  }
  if (input.chance !== undefined) {
    const chance = Number(input.chance);
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) throw new Error('La chance va de 0 a 100 %');
    await sql`UPDATE config."DropItemGroup" SET "Chance" = ${chance} WHERE "Id" = ${id}::uuid`;
  }
  if (input.itemType !== undefined) {
    const type = Math.trunc(Number(input.itemType));
    if (!ITEM_TYPES.some(t => t.value === type)) throw new Error('Tipo de drop inválido');
    await sql`UPDATE config."DropItemGroup" SET "ItemType" = ${type} WHERE "Id" = ${id}::uuid`;
  }
  if (input.itemLevel !== undefined) {
    await sql`UPDATE config."DropItemGroup" SET "ItemLevel" = ${level(input.itemLevel)} WHERE "Id" = ${id}::uuid`;
  }
  if (input.minMonsterLevel !== undefined || input.maxMonsterLevel !== undefined) {
    const min = input.minMonsterLevel !== undefined ? level(input.minMonsterLevel) : undefined;
    const max = input.maxMonsterLevel !== undefined ? level(input.maxMonsterLevel) : undefined;
    if (min !== undefined) await sql`UPDATE config."DropItemGroup" SET "MinimumMonsterLevel" = ${min} WHERE "Id" = ${id}::uuid`;
    if (max !== undefined) await sql`UPDATE config."DropItemGroup" SET "MaximumMonsterLevel" = ${max} WHERE "Id" = ${id}::uuid`;
  }

  // The monster it only drops from: the link table decides that. The column
  // follows the link, except on groups that only have the column (quest
  // items name their monster there without being tied to it).
  if (input.monsterId !== undefined) {
    const monsterId = input.monsterId || null;
    if (monsterId && !UUID_RE.test(monsterId)) throw new Error('Monstruo inválido');
    if (monsterId !== current.linkMonster) {
      await sql`DELETE FROM config."MonsterDefinitionDropItemGroup" WHERE "DropItemGroupId" = ${id}::uuid`;
      if (monsterId) {
        const [monster] = await sql`SELECT 1 FROM config."MonsterDefinition" WHERE "Id" = ${monsterId}::uuid`;
        if (!monster) throw new Error('Monstruo inexistente');
        await sql`
          INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
          VALUES (${monsterId}::uuid, ${id}::uuid)`;
      }
      if (monsterId || current.monsterColumn === current.linkMonster) {
        await sql`UPDATE config."DropItemGroup" SET "MonsterId" = ${monsterId} WHERE "Id" = ${id}::uuid`;
      }
    }
  }

  if (input.mapIds !== undefined) {
    const mapIds = ids(input.mapIds, 'Mapas');
    await sql`DELETE FROM config."GameMapDefinitionDropItemGroup" WHERE "DropItemGroupId" = ${id}::uuid`;
    if (mapIds.length) {
      await sql`
        INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
        SELECT m."Id", ${id}::uuid FROM config."GameMapDefinition" m WHERE m."Id" = ANY(${mapIds}::uuid[])`;
    }
  }

  if (input.itemIds !== undefined) {
    const itemIds = ids(input.itemIds, 'Ítems');
    await sql`DELETE FROM config."DropItemGroupItemDefinition" WHERE "DropItemGroupId" = ${id}::uuid`;
    if (itemIds.length) {
      await sql`
        INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
        SELECT ${id}::uuid, d."Id" FROM config."ItemDefinition" d WHERE d."Id" = ANY(${itemIds}::uuid[])`;
    }
  }
}

export async function createDrop(sql: Sql, input: DropInput): Promise<string> {
  await ensureBooks(sql);
  return sql.begin(async tx => {
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType")
      SELECT gen_random_uuid(), 0, 'Nuevo drop', gc."Id", 0 FROM config."GameConfiguration" gc LIMIT 1
      RETURNING "Id" AS id`;
    await write(tx as unknown as Sql, row.id, { description: 'Nuevo drop', chance: 0.01, ...input });
    await remember(tx as unknown as Sql, row.id);
    return row.id;
  });
}

export async function updateDrop(sql: Sql, id: string, input: DropInput) {
  await ensureBooks(sql);
  await sql.begin(async tx => {
    await write(tx as unknown as Sql, id, input);
    await remember(tx as unknown as Sql, id);
  });
}

export async function deleteDrop(sql: Sql, id: string) {
  await ensureBooks(sql);
  const [use] = await sql`
    SELECT (EXISTS (SELECT 1 FROM config."MiniGameReward" r WHERE r."ItemRewardId" = ${id}::uuid)
         OR EXISTS (SELECT 1 FROM config."QuestItemRequirement" q WHERE q."DropItemGroupId" = ${id}::uuid)) AS used`;
  if (use?.used) throw new Error('Lo usa un evento o una quest: no se puede borrar. Bajale la chance a 0 si querés que no caiga.');
  await sql.begin(async tx => {
    // The links go with it (ON DELETE CASCADE).
    await tx`DELETE FROM config."DropItemGroup" WHERE "Id" = ${id}::uuid`;
    await tx`
      INSERT INTO mlr.drop_overrides ("Id", "Data", "Deleted", "UpdatedAt") VALUES (${id}::uuid, NULL, true, now())
      ON CONFLICT ("Id") DO UPDATE SET "Data" = NULL, "Deleted" = true, "UpdatedAt" = now()`;
  });
}

/** Forgets the panel's edit: the next deploy is free to set the group again. */
export async function releaseDrop(sql: Sql, id: string) {
  await ensureBooks(sql);
  await sql`DELETE FROM mlr.drop_overrides WHERE "Id" = ${id}::uuid`;
}
