import type { Sql } from 'postgres';

/**
 * A character's inventory (data."Item" in its InventoryId storage) with each
 * item's options (data."ItemOptionLink" -> config."IncreasableItemOption").
 *
 * Slots, Season 6: 0-11 equipped (left hand, right hand, helm, armor, pants,
 * gloves, boots, wings, pet, pendant, ring, ring), 12-75 the 8x8 bag.
 * Items are only touched while the character is offline (main.ts checks).
 */

export const BAG_FIRST = 12;
export const BAG_COLUMNS = 8;
export const BAG_ROWS = 8;

const OPTION_TYPES: Record<string, string> = {
  '6487c498-58e0-48e5-b409-35d7598313fc': 'excellent',
  '55cb57a7-4fc6-47bb-9fee-84e6c4ebce95': 'wing',
  '3e3e9be8-4e16-4f27-a7cf-986d48454d76': 'luck',
  'f193f91e-86d7-4456-add8-a3667e731303': 'option',
  '0ca234f0-4a0f-4fa1-8e07-cfb89c1ec94f': 'harmony',
  '436d820f-6d50-429d-af63-bb0f59567dd1': 'ancient',
  '4aa95715-1ed3-453d-8d1d-093b281416ca': 'guardian',
  'c3ed45bc-5713-494d-a8c8-dc4afae56223': 'fenrir',
  'ed978695-bd3e-46ea-86d8-f8c30ea99b50': 'fenrir',
  '78e6db0b-ac53-454c-956f-cd2b5467856e': 'fenrir',
};

async function inventoryId(sql: Sql, characterId: string): Promise<string> {
  const [row] = await sql`SELECT "InventoryId" AS inv FROM data."Character" WHERE "Id" = ${characterId}::uuid`;
  if (!row?.inv) throw new Error('El personaje no tiene inventario');
  return row.inv;
}

export async function getInventory(sql: Sql, characterId: string) {
  const inv = await inventoryId(sql, characterId);
  const items = await sql`
    SELECT i."Id" AS id, i."ItemSlot" AS slot, i."Level" AS level, i."Durability" AS durability,
           i."HasSkill" AS "hasSkill", d."Id" AS "definitionId", d."Name" AS name, d."Group" AS "group",
           d."Number" AS number, d."Width" AS width, d."Height" AS height, d."Durability" AS "maxDurability",
           d."MaximumItemLevel" AS "maxLevel", (d."SkillId" IS NOT NULL) AS "canSkill"
      FROM data."Item" i
      JOIN config."ItemDefinition" d ON d."Id" = i."DefinitionId"
     WHERE i."ItemStorageId" = ${inv}::uuid
     ORDER BY i."ItemSlot"`;

  const links = items.length
    ? await sql`
        SELECT l."ItemId" AS "itemId", l."ItemOptionId" AS "optionId", l."Level" AS level,
               o."OptionTypeId"::text AS "typeId", o."Number" AS number, a."Designation" AS name
          FROM data."ItemOptionLink" l
          JOIN config."IncreasableItemOption" o ON o."Id" = l."ItemOptionId"
          LEFT JOIN config."PowerUpDefinition" p ON p."Id" = o."PowerUpDefinitionId"
          LEFT JOIN config."AttributeDefinition" a ON a."Id" = p."TargetAttributeId"
         WHERE l."ItemId" = ANY(${items.map(i => i.id)}::uuid[])
         ORDER BY l."Index"`
    : [];

  return items.map(item => ({
    ...item,
    options: links
      .filter(l => l.itemId === item.id)
      .map(l => ({ optionId: l.optionId, level: l.level, type: OPTION_TYPES[l.typeId] ?? 'other', name: l.name ?? `#${l.number}` })),
  }));
}

export async function searchDefinitions(sql: Sql, q: string) {
  const like = `%${q}%`;
  return sql`
    SELECT d."Id" AS id, d."Name" AS name, d."Group" AS "group", d."Number" AS number,
           d."Width" AS width, d."Height" AS height, d."Durability" AS durability,
           d."MaximumItemLevel" AS "maxLevel", (d."SkillId" IS NOT NULL) AS "canSkill"
      FROM config."ItemDefinition" d
     WHERE ${q} = '' OR d."Name" ILIKE ${like}
     ORDER BY d."Group", d."Number"
     LIMIT 60`;
}

/** Options an item of this definition can carry, grouped by type. */
export async function definitionOptions(sql: Sql, definitionId: string) {
  const rows = await sql`
    SELECT o."Id" AS "optionId", o."OptionTypeId"::text AS "typeId", o."Number" AS number,
           a."Designation" AS name, od."Name" AS "definitionName", od."MaximumOptionsPerItem" AS "maxPerItem"
      FROM config."ItemDefinitionItemOptionDefinition" x
      JOIN config."ItemOptionDefinition" od ON od."Id" = x."ItemOptionDefinitionId"
      JOIN config."IncreasableItemOption" o ON o."ItemOptionDefinitionId" = od."Id"
      LEFT JOIN config."PowerUpDefinition" p ON p."Id" = o."PowerUpDefinitionId"
      LEFT JOIN config."AttributeDefinition" a ON a."Id" = p."TargetAttributeId"
     WHERE x."ItemDefinitionId" = ${definitionId}::uuid
     ORDER BY od."Name", o."Number"`;
  return rows.map(r => ({
    optionId: String(r.optionId),
    number: Number(r.number),
    definitionName: String(r.definitionName),
    maxPerItem: Number(r.maxPerItem),
    type: OPTION_TYPES[r.typeId] ?? 'other',
    name: (r.name as string | null) ?? `${r.definitionName} #${r.number}`,
  }));
}

export type ItemInput = {
  definitionId?: string;
  level?: number;
  durability?: number;
  hasSkill?: boolean;
  options?: { optionId: string; level?: number }[];
  slot?: number;
};

async function writeOptions(sql: Sql, itemId: string, definitionId: string, options: ItemInput['options']) {
  await sql`DELETE FROM data."ItemOptionLink" WHERE "ItemId" = ${itemId}::uuid`;
  if (!options?.length) return;

  const allowed = new Set((await definitionOptions(sql, definitionId)).map(o => o.optionId));
  let index = 0;
  for (const option of options) {
    if (!allowed.has(option.optionId)) throw new Error('Ese item no admite una de las opciones elegidas');
    const level = Math.min(15, Math.max(0, Math.trunc(Number(option.level ?? 0))));
    await sql`
      INSERT INTO data."ItemOptionLink" ("Id", "ItemId", "ItemOptionId", "Level", "Index")
      VALUES (gen_random_uuid(), ${itemId}::uuid, ${option.optionId}::uuid, ${level}, ${index++})`;
  }
}

/** First bag slot where a w x h item fits, or null when the bag is full. */
function freeSlot(taken: { slot: number; width: number; height: number }[], w: number, h: number): number | null {
  const grid = new Array(BAG_COLUMNS * BAG_ROWS).fill(false);
  for (const item of taken) {
    if (item.slot < BAG_FIRST || item.slot >= BAG_FIRST + BAG_COLUMNS * BAG_ROWS) continue;
    const cell = item.slot - BAG_FIRST;
    const x0 = cell % BAG_COLUMNS;
    const y0 = Math.floor(cell / BAG_COLUMNS);
    for (let y = y0; y < y0 + item.height && y < BAG_ROWS; y++)
      for (let x = x0; x < x0 + item.width && x < BAG_COLUMNS; x++) grid[y * BAG_COLUMNS + x] = true;
  }
  for (let y = 0; y + h <= BAG_ROWS; y++)
    for (let x = 0; x + w <= BAG_COLUMNS; x++) {
      let fits = true;
      for (let dy = 0; dy < h && fits; dy++) for (let dx = 0; dx < w; dx++) if (grid[(y + dy) * BAG_COLUMNS + x + dx]) { fits = false; break; }
      if (fits) return BAG_FIRST + y * BAG_COLUMNS + x;
    }
  return null;
}

export async function addItem(sql: Sql, characterId: string, input: ItemInput) {
  const inv = await inventoryId(sql, characterId);
  const [def] = await sql`
    SELECT "Id" AS id, "Width" AS width, "Height" AS height, "Durability" AS durability,
           "MaximumItemLevel" AS "maxLevel", ("SkillId" IS NOT NULL) AS "canSkill"
      FROM config."ItemDefinition" WHERE "Id" = ${input.definitionId ?? ''}::uuid`;
  if (!def) throw new Error('Item inexistente');

  const taken = await sql`
    SELECT i."ItemSlot" AS slot, d."Width" AS width, d."Height" AS height
      FROM data."Item" i JOIN config."ItemDefinition" d ON d."Id" = i."DefinitionId"
     WHERE i."ItemStorageId" = ${inv}::uuid`;
  const slot = freeSlot(taken as never, def.width, def.height);
  if (slot === null) throw new Error('No hay lugar en el inventario para ese item');

  const level = Math.min(def.maxLevel || 15, Math.max(0, Math.trunc(Number(input.level ?? 0))));
  const durability = input.durability !== undefined ? Math.max(0, Math.min(255, Number(input.durability))) : Math.max(1, def.durability);

  await sql.begin(async tx => {
    const [item] = await tx`
      INSERT INTO data."Item"
        ("Id", "DefinitionId", "Durability", "HasSkill", "ItemSlot", "ItemStorageId", "Level", "PetExperience", "SocketCount", "StorePrice")
      VALUES (gen_random_uuid(), ${def.id}, ${durability}, ${!!input.hasSkill && def.canSkill}, ${slot}, ${inv}::uuid, ${level}, 0, 0, NULL)
      RETURNING "Id"`;
    await writeOptions(tx as unknown as Sql, item.Id, def.id, input.options);
  });
  return slot;
}

async function itemOf(sql: Sql, characterId: string, itemId: string) {
  const inv = await inventoryId(sql, characterId);
  const [item] = await sql`
    SELECT i."Id" AS id, i."DefinitionId" AS "definitionId", d."MaximumItemLevel" AS "maxLevel", (d."SkillId" IS NOT NULL) AS "canSkill"
      FROM data."Item" i JOIN config."ItemDefinition" d ON d."Id" = i."DefinitionId"
     WHERE i."Id" = ${itemId}::uuid AND i."ItemStorageId" = ${inv}::uuid`;
  if (!item) throw new Error('Ese item no es de este personaje');
  return item;
}

export async function updateItem(sql: Sql, characterId: string, itemId: string, input: ItemInput) {
  const item = await itemOf(sql, characterId, itemId);
  await sql.begin(async tx => {
    const sets: Record<string, unknown> = {};
    if (input.level !== undefined) sets.Level = Math.min(item.maxLevel || 15, Math.max(0, Math.trunc(Number(input.level))));
    if (input.durability !== undefined) sets.Durability = Math.max(0, Math.min(255, Number(input.durability)));
    if (input.hasSkill !== undefined) sets.HasSkill = !!input.hasSkill && item.canSkill;
    if (Object.keys(sets).length) await tx`UPDATE data."Item" SET ${tx(sets)} WHERE "Id" = ${itemId}::uuid`;
    if (input.options) await writeOptions(tx as unknown as Sql, itemId, item.definitionId, input.options);
  });
}

export async function deleteItem(sql: Sql, characterId: string, itemId: string) {
  await itemOf(sql, characterId, itemId);
  await sql.begin(async tx => {
    await tx`DELETE FROM data."ItemOptionLink" WHERE "ItemId" = ${itemId}::uuid`;
    await tx`DELETE FROM data."ItemItemOfItemSet" WHERE "ItemId" = ${itemId}::uuid`;
    await tx`DELETE FROM data."Item" WHERE "Id" = ${itemId}::uuid`;
  });
}
