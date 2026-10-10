import type { Sql } from 'postgres';

/**
 * The NPC editor: where each NPC stands (config."MonsterSpawnArea" rows of a
 * MonsterDefinition whose ObjectKind is PassiveNpc or Guard). An NPC stands on
 * one cell - X1 = X2, Y1 = Y2, quantity 1 - looking one way. The same NPC can
 * stand on any number of maps (Hanzo in Lorencia and Crywolf): each place is
 * its own row.
 *
 * Like the spots, the changes take effect when OpenMU restarts.
 */

/** NpcObjectKind: 1 PassiveNpc, 2 Guard. */
const NPC_KINDS = [1, 2];

export async function listNpcDefinitions(sql: Sql) {
  return sql`
    SELECT "Id" AS id, "Number" AS number, "Designation" AS name, "ObjectKind" AS kind,
           "NpcWindow" AS window, ("MerchantStoreId" IS NOT NULL) AS shop
      FROM config."MonsterDefinition"
     WHERE "ObjectKind" IN ${sql(NPC_KINDS)}
     ORDER BY "Number"`;
}

/** Every NPC placed, on every map: the page filters by map or by NPC. */
export async function listNpcPlaces(sql: Sql) {
  return sql`
    SELECT s."Id" AS id, g."Id" AS "mapId", g."Number" AS "mapNumber", g."Name" AS "mapName",
           m."Id" AS "npcId", m."Number" AS number, m."Designation" AS name,
           s."X1" AS x, s."Y1" AS y, s."Direction" AS direction
      FROM config."MonsterSpawnArea" s
      JOIN config."MonsterDefinition" m ON m."Id" = s."MonsterDefinitionId"
      JOIN config."GameMapDefinition" g ON g."Id" = s."GameMapId"
     WHERE m."ObjectKind" IN ${sql(NPC_KINDS)}
     ORDER BY g."Number", m."Number", s."X1", s."Y1"`;
}

export type NpcPlaceInput = { mapId?: string; npcId?: string; x?: number; y?: number; direction?: number };

const coord = (v: unknown, name: string) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 255) throw new Error(`Coordenada ${name} inválida (0 a 255)`);
  return n;
};

/** Direction: 0 none, 1 west ... 8 north-west. */
const direction = (v: unknown) => {
  const n = Math.trunc(Number(v ?? 3));
  return Number.isFinite(n) && n >= 0 && n <= 8 ? n : 3;
};

async function npcOf(sql: Sql, id: string) {
  const [npc] = await sql`
    SELECT "Id" FROM config."MonsterDefinition" WHERE "Id" = ${id}::uuid AND "ObjectKind" IN ${sql(NPC_KINDS)}`;
  if (!npc) throw new Error('NPC inexistente');
  return npc.Id as string;
}

async function mapOf(sql: Sql, id: string) {
  const [map] = await sql`SELECT "Id" FROM config."GameMapDefinition" WHERE "Id" = ${id}::uuid`;
  if (!map) throw new Error('Mapa inexistente');
  return map.Id as string;
}

export async function createNpcPlace(sql: Sql, input: NpcPlaceInput) {
  const npc = await npcOf(sql, input.npcId ?? '');
  const map = await mapOf(sql, input.mapId ?? '');
  const x = coord(input.x, 'X');
  const y = coord(input.y, 'Y');
  const [row] = await sql`
    INSERT INTO config."MonsterSpawnArea"
      ("Id", "Direction", "GameMapId", "MonsterDefinitionId", "Quantity", "SpawnTrigger",
       "WaveNumber", "X1", "X2", "Y1", "Y2")
    VALUES (gen_random_uuid(), ${direction(input.direction)}, ${map}, ${npc}, 1, 0, 0, ${x}, ${x}, ${y}, ${y})
    RETURNING "Id" AS id`;
  return row;
}

async function placeOf(sql: Sql, id: string) {
  const [place] = await sql`
    SELECT s."Id", s."GameMapId" AS "mapId", s."MonsterDefinitionId" AS "npcId", s."X1" AS x, s."Y1" AS y, s."Direction" AS direction
      FROM config."MonsterSpawnArea" s
      JOIN config."MonsterDefinition" m ON m."Id" = s."MonsterDefinitionId"
     WHERE s."Id" = ${id}::uuid AND m."ObjectKind" IN ${sql(NPC_KINDS)}`;
  if (!place) throw new Error('Ese NPC ya no está en el mapa');
  return place;
}

export async function updateNpcPlace(sql: Sql, id: string, input: NpcPlaceInput) {
  const current = await placeOf(sql, id);
  const npc = input.npcId ? await npcOf(sql, input.npcId) : current.npcId;
  const map = input.mapId ? await mapOf(sql, input.mapId) : current.mapId;
  const x = coord(input.x ?? current.x, 'X');
  const y = coord(input.y ?? current.y, 'Y');
  await sql`
    UPDATE config."MonsterSpawnArea"
       SET "MonsterDefinitionId" = ${npc}, "GameMapId" = ${map}, "Direction" = ${direction(input.direction ?? current.direction)},
           "X1" = ${x}, "X2" = ${x}, "Y1" = ${y}, "Y2" = ${y}, "Quantity" = 1
     WHERE "Id" = ${id}::uuid`;
}

export async function deleteNpcPlace(sql: Sql, id: string) {
  await placeOf(sql, id);
  await sql.begin(async tx => {
    await tx`DELETE FROM config."MonsterSpawnArea" WHERE "Id" = ${id}::uuid`;
    // The spot books, in case it was ever listed there.
    if ((await tx`SELECT to_regclass('mlr.spawn_quantity') IS NOT NULL AS ok`)[0].ok) {
      await tx`DELETE FROM mlr.spawn_quantity WHERE "Id" = ${id}::uuid`;
    }
  });
}
