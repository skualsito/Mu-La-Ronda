import type { Sql } from 'postgres';
import { addToStorage, deleteFromStorage, storageItems, updateInStorage, type Grid, type ItemInput } from './inventory';

/**
 * Merchant shops: an NPC (config."MonsterDefinition") with NpcWindow =
 * Merchant (1) and a MerchantStoreId pointing at a data."ItemStorage" whose
 * items are what the shop sells, laid out on the original's 8x15 store grid.
 *
 * OpenMU prices each item itself (ItemPriceCalculator, from the item and its
 * level/options), so there is no price to set. It loads the stores with the
 * game configuration: changes reach the game when OpenMU restarts.
 */

export const SHOP_GRID: Grid = { first: 0, columns: 8, rows: 15 };
const MERCHANT = 1;

export type ShopRow = {
  id: string;
  number: number;
  name: string;
  storeId: string | null;
  items: number;
  maps: string[];
};

export async function listShops(sql: Sql): Promise<ShopRow[]> {
  const rows = await sql<ShopRow[]>`
    SELECT m."Id" AS id, m."Number" AS number, m."Designation" AS name, m."MerchantStoreId" AS "storeId",
           (SELECT count(*)::int FROM data."Item" i WHERE i."ItemStorageId" = m."MerchantStoreId") AS items,
           COALESCE((SELECT array_agg(DISTINCT g."Name" ORDER BY g."Name")
                       FROM config."MonsterSpawnArea" a
                       JOIN config."GameMapDefinition" g ON g."Id" = a."GameMapId"
                      WHERE a."MonsterDefinitionId" = m."Id"), '{}') AS maps
      FROM config."MonsterDefinition" m
     WHERE m."NpcWindow" = ${MERCHANT} OR m."MerchantStoreId" IS NOT NULL
     ORDER BY m."Designation", m."Number"`;
  return rows;
}

/** NPCs that are not shops yet, for "make this NPC a shop". */
export async function candidateNpcs(sql: Sql) {
  return sql<{ id: string; number: number; name: string }[]>`
    SELECT m."Id" AS id, m."Number" AS number, m."Designation" AS name
      FROM config."MonsterDefinition" m
     WHERE m."ObjectKind" = 1 AND m."MerchantStoreId" IS NULL AND m."NpcWindow" <> ${MERCHANT}
     ORDER BY m."Designation", m."Number"`;
}

async function storeOf(sql: Sql, monsterId: string): Promise<string> {
  const [row] = await sql<{ storeId: string | null }[]>`
    SELECT "MerchantStoreId" AS "storeId" FROM config."MonsterDefinition" WHERE "Id" = ${monsterId}::uuid`;
  if (!row) throw new Error('Esa tienda no existe');
  if (!row.storeId) throw new Error('Ese NPC todavía no es una tienda');
  return row.storeId;
}

export async function shopItems(sql: Sql, monsterId: string) {
  return storageItems(sql, await storeOf(sql, monsterId));
}

/**
 * Makes an NPC a shop: an empty store and the merchant window. Its old dialog
 * (if it had one) is replaced, so a quest NPC is better left alone.
 */
export async function makeShop(sql: Sql, monsterId: string): Promise<void> {
  await sql.begin(async tx => {
    const [npc] = await tx<{ storeId: string | null }[]>`
      SELECT "MerchantStoreId" AS "storeId" FROM config."MonsterDefinition" WHERE "Id" = ${monsterId}::uuid FOR UPDATE`;
    if (!npc) throw new Error('Ese NPC no existe');
    let storeId = npc.storeId;
    if (!storeId) {
      const [store] = await tx<{ id: string }[]>`
        INSERT INTO data."ItemStorage" ("Id", "Money") VALUES (gen_random_uuid(), 0) RETURNING "Id" AS id`;
      storeId = store.id;
    }
    await tx`
      UPDATE config."MonsterDefinition" SET "NpcWindow" = ${MERCHANT}, "MerchantStoreId" = ${storeId}::uuid
       WHERE "Id" = ${monsterId}::uuid`;
  });
}

export async function addShopItem(sql: Sql, monsterId: string, input: ItemInput) {
  return addToStorage(sql, await storeOf(sql, monsterId), SHOP_GRID, input, 'La tienda está llena (8x15)');
}

export async function updateShopItem(sql: Sql, monsterId: string, itemId: string, input: ItemInput) {
  return updateInStorage(sql, await storeOf(sql, monsterId), SHOP_GRID, itemId, input);
}

export async function deleteShopItem(sql: Sql, monsterId: string, itemId: string) {
  return deleteFromStorage(sql, await storeOf(sql, monsterId), itemId);
}

/** Empties a shop (the NPC stays a shop). */
export async function clearShop(sql: Sql, monsterId: string): Promise<number> {
  const storeId = await storeOf(sql, monsterId);
  return sql.begin(async tx => {
    await tx`DELETE FROM data."ItemOptionLink" WHERE "ItemId" IN (SELECT "Id" FROM data."Item" WHERE "ItemStorageId" = ${storeId}::uuid)`;
    await tx`DELETE FROM data."ItemItemOfItemSet" WHERE "ItemId" IN (SELECT "Id" FROM data."Item" WHERE "ItemStorageId" = ${storeId}::uuid)`;
    const result = await tx`DELETE FROM data."Item" WHERE "ItemStorageId" = ${storeId}::uuid`;
    return result.count;
  });
}
