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
  return storageItems(sql, await inventoryId(sql, characterId));
}

/** Every item of a storage (an inventory, a merchant's store) with its options. */
export async function storageItems(sql: Sql, inv: string) {
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

/** A grid of slots: the bag (12 + 8x8) or a merchant's store (0 + 8x15). */
export type Grid = { first: number; columns: number; rows: number };
export const BAG_GRID: Grid = { first: BAG_FIRST, columns: BAG_COLUMNS, rows: BAG_ROWS };

type Placed = { id?: string; slot: number; width: number; height: number };

function occupancy(taken: Placed[], grid: Grid, except?: string): boolean[] {
  const cells = new Array(grid.columns * grid.rows).fill(false);
  for (const item of taken) {
    if (except && item.id === except) continue;
    const cell = item.slot - grid.first;
    if (cell < 0 || cell >= grid.columns * grid.rows) continue;
    const x0 = cell % grid.columns;
    const y0 = Math.floor(cell / grid.columns);
    for (let y = y0; y < y0 + item.height && y < grid.rows; y++)
      for (let x = x0; x < x0 + item.width && x < grid.columns; x++) cells[y * grid.columns + x] = true;
  }
  return cells;
}

function fitsAt(cells: boolean[], grid: Grid, slot: number, w: number, h: number): boolean {
  const cell = slot - grid.first;
  if (cell < 0 || cell >= grid.columns * grid.rows) return false;
  const x0 = cell % grid.columns;
  const y0 = Math.floor(cell / grid.columns);
  if (x0 + w > grid.columns || y0 + h > grid.rows) return false;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (cells[y * grid.columns + x]) return false;
  return true;
}

/** First slot of the grid where a w x h item fits, or null when it is full. */
function freeSlot(cells: boolean[], grid: Grid, w: number, h: number): number | null {
  for (let y = 0; y + h <= grid.rows; y++)
    for (let x = 0; x + w <= grid.columns; x++) {
      const slot = grid.first + y * grid.columns + x;
      if (fitsAt(cells, grid, slot, w, h)) return slot;
    }
  return null;
}

async function placed(sql: Sql, storageId: string): Promise<Placed[]> {
  const rows = await sql`
    SELECT i."Id" AS id, i."ItemSlot" AS slot, d."Width" AS width, d."Height" AS height
      FROM data."Item" i JOIN config."ItemDefinition" d ON d."Id" = i."DefinitionId"
     WHERE i."ItemStorageId" = ${storageId}::uuid`;
  return rows as unknown as Placed[];
}

/** Adds an item to a storage: at `input.slot` when it is free there, else at the first free slot. */
export async function addToStorage(sql: Sql, storageId: string, grid: Grid, input: ItemInput, fullMessage: string) {
  const [def] = await sql`
    SELECT "Id" AS id, "Group" AS "group", "Width" AS width, "Height" AS height, "Durability" AS durability,
           "MaximumItemLevel" AS "maxLevel", ("SkillId" IS NOT NULL) AS "canSkill"
      FROM config."ItemDefinition" WHERE "Id" = ${input.definitionId ?? ''}::uuid`;
  if (!def) throw new Error('Item inexistente');

  const cells = occupancy(await placed(sql, storageId), grid);
  let slot: number | null;
  if (input.slot !== undefined) {
    slot = Number(input.slot);
    if (!fitsAt(cells, grid, slot, def.width, def.height)) throw new Error('El item no entra en ese lugar');
  } else {
    slot = freeSlot(cells, grid, def.width, def.height);
  }
  if (slot === null) throw new Error(fullMessage);

  const level = Math.min(def.maxLevel || 15, Math.max(0, Math.trunc(Number(input.level ?? 0))));
  // Potions' durability is the stack size (deploy/config/08-stacks.sql): one, unless asked.
  const fallback = def.group === 14 && def.durability > 1 ? 1 : Math.max(1, def.durability);
  const durability = input.durability !== undefined ? Math.max(0, Math.min(255, Number(input.durability))) : fallback;

  await sql.begin(async tx => {
    const [item] = await tx`
      INSERT INTO data."Item"
        ("Id", "DefinitionId", "Durability", "HasSkill", "ItemSlot", "ItemStorageId", "Level", "PetExperience", "SocketCount", "StorePrice")
      VALUES (gen_random_uuid(), ${def.id}, ${durability}, ${!!input.hasSkill && def.canSkill}, ${slot}, ${storageId}::uuid, ${level}, 0, 0, NULL)
      RETURNING "Id"`;
    await writeOptions(tx as unknown as Sql, item.Id, def.id, input.options);
  });
  return slot;
}

async function storageItem(sql: Sql, storageId: string, itemId: string) {
  const [item] = await sql`
    SELECT i."Id" AS id, i."DefinitionId" AS "definitionId", d."MaximumItemLevel" AS "maxLevel",
           (d."SkillId" IS NOT NULL) AS "canSkill", d."Width" AS width, d."Height" AS height
      FROM data."Item" i JOIN config."ItemDefinition" d ON d."Id" = i."DefinitionId"
     WHERE i."Id" = ${itemId}::uuid AND i."ItemStorageId" = ${storageId}::uuid`;
  if (!item) throw new Error('Ese item no está ahí');
  return item;
}

/** Edits an item; `input.slot` moves it within the grid when the new place is free. */
export async function updateInStorage(sql: Sql, storageId: string, grid: Grid | null, itemId: string, input: ItemInput) {
  const item = await storageItem(sql, storageId, itemId);
  const sets: Record<string, unknown> = {};
  if (input.slot !== undefined) {
    if (!grid) throw new Error('Ese item no se puede mover');
    const slot = Number(input.slot);
    const cells = occupancy(await placed(sql, storageId), grid, itemId);
    if (!fitsAt(cells, grid, slot, item.width, item.height)) throw new Error('El item no entra en ese lugar');
    sets.ItemSlot = slot;
  }
  await sql.begin(async tx => {
    if (input.level !== undefined) sets.Level = Math.min(item.maxLevel || 15, Math.max(0, Math.trunc(Number(input.level))));
    if (input.durability !== undefined) sets.Durability = Math.max(0, Math.min(255, Number(input.durability)));
    if (input.hasSkill !== undefined) sets.HasSkill = !!input.hasSkill && item.canSkill;
    if (Object.keys(sets).length) await tx`UPDATE data."Item" SET ${tx(sets)} WHERE "Id" = ${itemId}::uuid`;
    if (input.options) await writeOptions(tx as unknown as Sql, itemId, item.definitionId, input.options);
  });
}

export async function deleteFromStorage(sql: Sql, storageId: string, itemId: string) {
  await storageItem(sql, storageId, itemId);
  await sql.begin(async tx => {
    await tx`DELETE FROM data."ItemOptionLink" WHERE "ItemId" = ${itemId}::uuid`;
    await tx`DELETE FROM data."ItemItemOfItemSet" WHERE "ItemId" = ${itemId}::uuid`;
    await tx`DELETE FROM data."Item" WHERE "Id" = ${itemId}::uuid`;
  });
}

// ---- a character's inventory ---------------------------------------------------------

export async function addItem(sql: Sql, characterId: string, input: ItemInput) {
  return addToStorage(sql, await inventoryId(sql, characterId), BAG_GRID, input, 'No hay lugar en el inventario para ese item');
}

export async function updateItem(sql: Sql, characterId: string, itemId: string, input: ItemInput) {
  const inv = await inventoryId(sql, characterId);
  // Equipped items (slots 0-11) are not moved by slot; only bag items are.
  return updateInStorage(sql, inv, BAG_GRID, itemId, input);
}

export async function deleteItem(sql: Sql, characterId: string, itemId: string) {
  return deleteFromStorage(sql, await inventoryId(sql, characterId), itemId);
}

// ---------------------------------------------------------------------------
// Vault (the account's baúl): 8x15 from slot 0, like a shop.
// ---------------------------------------------------------------------------

export const VAULT_GRID: Grid = { first: 0, columns: 8, rows: 15 };

/** The account's vault storage; one is made when the account never opened it. */
async function vaultOf(sql: Sql, accountId: string, create: boolean): Promise<string | null> {
  const [account] = await sql<{ vault: string | null }[]>`
    SELECT "VaultId" AS vault FROM data."Account" WHERE "Id" = ${accountId}::uuid`;
  if (!account) throw new Error('Cuenta inexistente');
  if (account.vault || !create) return account.vault;
  return sql.begin(async tx => {
    const [store] = await tx<{ id: string }[]>`
      INSERT INTO data."ItemStorage" ("Id", "Money") VALUES (gen_random_uuid(), 0) RETURNING "Id" AS id`;
    await tx`UPDATE data."Account" SET "VaultId" = ${store.id}::uuid WHERE "Id" = ${accountId}::uuid`;
    return store.id;
  });
}

export async function getVault(sql: Sql, accountId: string) {
  const vault = await vaultOf(sql, accountId, false);
  if (!vault) return { money: 0, items: [] };
  const [row] = await sql<{ money: number }[]>`SELECT "Money" AS money FROM data."ItemStorage" WHERE "Id" = ${vault}::uuid`;
  return { money: row?.money ?? 0, items: await storageItems(sql, vault) };
}

export async function addVaultItem(sql: Sql, accountId: string, input: ItemInput) {
  return addToStorage(sql, (await vaultOf(sql, accountId, true))!, VAULT_GRID, input, 'El baúl está lleno (8x15)');
}

export async function updateVaultItem(sql: Sql, accountId: string, itemId: string, input: ItemInput) {
  const vault = await vaultOf(sql, accountId, false);
  if (!vault) throw new Error('El baúl está vacío');
  return updateInStorage(sql, vault, VAULT_GRID, itemId, input);
}

export async function deleteVaultItem(sql: Sql, accountId: string, itemId: string) {
  const vault = await vaultOf(sql, accountId, false);
  if (!vault) throw new Error('El baúl está vacío');
  return deleteFromStorage(sql, vault, itemId);
}

export async function setVaultMoney(sql: Sql, accountId: string, money: number) {
  const vault = (await vaultOf(sql, accountId, true))!;
  const value = Math.max(0, Math.min(2_000_000_000, Math.trunc(Number(money) || 0)));
  await sql`UPDATE data."ItemStorage" SET "Money" = ${value} WHERE "Id" = ${vault}::uuid`;
}
