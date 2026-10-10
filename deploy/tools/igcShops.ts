/**
 * Mu La Ronda: turns IGC's shops (IGCData/IGC_ShopList.xml and IGCData/Shops/*.xml) into
 * deploy/config/38-igc-shops.sql, which loads them once into OpenMU's merchant stores.
 *
 *   bun run deploy/tools/igcShops.ts "G:/Mu/Servidor/Files/IGCData"
 *
 * Moss (gambling) and Jin (Arca Battle, not in this version) are left out, and so is a shop
 * whose file is empty.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const igc = process.argv[2];
if (!igc) throw new Error('usage: bun run deploy/tools/igcShops.ts <IGCData folder>');

const SKIP = new Set([492, 583, 604]);

const shopList = readFileSync(join(igc, 'IGC_ShopList.xml'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const files = new Map<number, string>();
for (const m of shopList.matchAll(/<Shop\s[^>]*NPCIndex="(\d+)"[^>]*FileName="([^"]+)"/g)) {
  files.set(Number(m[1]), m[2]);
}

const shops: { npc: number; file: string; items: number[][] }[] = [];
const names = new Set(readdirSync(join(igc, 'Shops')));
for (const [npc, file] of [...files].sort((a, b) => a[0] - b[0])) {
  if (SKIP.has(npc) || !names.has(file)) continue;
  const xml = readFileSync(join(igc, 'Shops', file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const items = [...xml.matchAll(/<Item\s([^>]*)\/>/g)].map(m => {
    const a = (k: string) => Number(new RegExp(`\\b${k}="(\\d+)"`).exec(m[1])?.[1] ?? 0);
    return [a('Cat'), a('Index'), a('Level'), a('Durability'), a('Skill'), a('Luck'), a('Option')];
  });
  if (items.length) shops.push({ npc, file, items });
}

const body = shops
  .map(s => {
    const rows = s.items.map(i => `[${i.join(',')}]`);
    const lines: string[] = [];
    for (let k = 0; k < rows.length; k += 8) lines.push('    ' + rows.slice(k, k + 8).join(', '));
    return `  -- ${s.file}\n  PERFORM mlr.seed_igc_store(${s.npc}, '[\n${lines.join(',\n')}\n  ]');`;
  })
  .join('\n\n');

const sql = `-- Mu La Ronda - las tiendas de los NPC, iguales a las del server IGC
-- (IGCData/Shops, generado con deploy/tools/igcShops.ts: no editar a mano).
--
-- Cada item: [grupo, numero, nivel, durabilidad, skill, luck, opcion]. Se
-- acomodan en el orden del archivo, en el primer lugar libre de la grilla de
-- 8x15, como en IGC. Durabilidad 0 = la maxima del item (en pociones y
-- flechas la durabilidad es la cantidad). Opcion N = +4*N.
--
-- Corre UNA vez (marca 'igc_shops_seeded'): despues las tiendas son del panel
-- admin y un deploy no las toca. Para volver a cargarlas:
--   DELETE FROM mlr.settings WHERE key = 'igc_shops_seeded';
-- Quedan afuera Moss (apuestas) y Jin (Arca Battle). Zyro y Felicia no son de
-- IGC y quedan como estan.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL);

CREATE OR REPLACE FUNCTION mlr.seed_igc_store(npc int, items jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  luck_type   uuid := '3e3e9be8-4e16-4f27-a7cf-986d48454d76';
  option_type uuid := 'f193f91e-86d7-4456-add8-a3667e731303';
  per_level   int[] := ARRAY[0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 17, 21, 26, 32, 39, 47];
  monster uuid;
  store uuid;
  grid boolean[] := array_fill(false, ARRAY[120]);
  it record;
  item_id uuid;
  opt record;
  lvl int; dur int;
  x int; y int; dx int; dy int;
  fits boolean;
  placed boolean;
BEGIN
  SELECT "Id", "MerchantStoreId" INTO monster, store FROM config."MonsterDefinition" WHERE "Number" = npc;
  IF monster IS NULL THEN
    RAISE NOTICE 'mlr.seed_igc_store: no existe el NPC %', npc;
    RETURN;
  END IF;

  -- Arena Guard y Natasha no eran tiendas en OpenMU.
  IF store IS NULL THEN
    store := ('b1a0f457-0000-4000-8000-' || lpad(npc::text, 12, '0'))::uuid;
    INSERT INTO data."ItemStorage" ("Id", "Money") VALUES (store, 0) ON CONFLICT ("Id") DO NOTHING;
    UPDATE config."MonsterDefinition" SET "NpcWindow" = 1, "MerchantStoreId" = store WHERE "Id" = monster;
  END IF;

  DELETE FROM data."ItemOptionLink" WHERE "ItemId" IN (SELECT "Id" FROM data."Item" WHERE "ItemStorageId" = store);
  DELETE FROM data."ItemItemOfItemSet" WHERE "ItemId" IN (SELECT "Id" FROM data."Item" WHERE "ItemStorageId" = store);
  DELETE FROM data."Item" WHERE "ItemStorageId" = store;

  FOR it IN
    SELECT d."Id", d."Name", d."Group" AS grp, d."Number" AS num, d."Width" AS w, d."Height" AS h,
           d."Durability" AS max_dur, d."MaximumItemLevel" AS max_lvl, d."SkillId" IS NOT NULL AS can_skill,
           d."ItemSlotId" IS NOT NULL AS wearable,
           (e.value->>2)::int AS lvl, (e.value->>3)::int AS dur, (e.value->>4)::int = 1 AS skill,
           (e.value->>5)::int = 1 AS luck, (e.value->>6)::int AS opt
      FROM jsonb_array_elements(items) WITH ORDINALITY AS e(value, ord)
      JOIN config."ItemDefinition" d
        ON d."Group" = (e.value->>0)::int AND d."Number" = (e.value->>1)::int
     ORDER BY e.ord
  LOOP
    lvl := LEAST(it.lvl, GREATEST(COALESCE(NULLIF(it.max_lvl, 0), 15), 0));
    IF it.dur > 0 THEN
      dur := LEAST(it.dur, 255);
    ELSIF NOT it.wearable THEN
      dur := GREATEST(it.max_dur, 1);
    ELSIF it.grp = 13 AND it.num IN (4, 5) THEN
      dur := 255;
    ELSE
      dur := LEAST(it.max_dur + per_level[LEAST(lvl, 15) + 1], 255);
    END IF;

    placed := false;
    <<search>>
    FOR y IN 0 .. 15 - it.h LOOP
      FOR x IN 0 .. 8 - it.w LOOP
        fits := true;
        FOR dy IN 0 .. it.h - 1 LOOP
          FOR dx IN 0 .. it.w - 1 LOOP
            IF grid[(y + dy) * 8 + (x + dx) + 1] THEN fits := false; END IF;
          END LOOP;
        END LOOP;
        IF fits THEN
          FOR dy IN 0 .. it.h - 1 LOOP
            FOR dx IN 0 .. it.w - 1 LOOP
              grid[(y + dy) * 8 + (x + dx) + 1] := true;
            END LOOP;
          END LOOP;
          item_id := gen_random_uuid();
          INSERT INTO data."Item"
            ("Id", "DefinitionId", "Durability", "HasSkill", "ItemSlot", "ItemStorageId",
             "Level", "PetExperience", "SocketCount", "StorePrice")
          VALUES (item_id, it."Id", dur, it.skill AND it.can_skill, y * 8 + x, store, lvl, 0, 0, NULL);
          placed := true;
          EXIT search;
        END IF;
      END LOOP;
    END LOOP;

    IF NOT placed THEN
      RAISE NOTICE 'mlr.seed_igc_store: "%" no entra en la tienda del NPC %', it."Name", npc;
      CONTINUE;
    END IF;

    IF it.luck THEN
      SELECT o."Id" INTO opt FROM config."ItemDefinitionItemOptionDefinition" x
        JOIN config."IncreasableItemOption" o ON o."ItemOptionDefinitionId" = x."ItemOptionDefinitionId"
       WHERE x."ItemDefinitionId" = it."Id" AND o."OptionTypeId" = luck_type
       ORDER BY o."Number" LIMIT 1;
      IF FOUND THEN
        INSERT INTO data."ItemOptionLink" ("Id", "ItemId", "ItemOptionId", "Level", "Index")
        VALUES (gen_random_uuid(), item_id, opt."Id", 0, 0);
      END IF;
    END IF;

    IF it.opt > 0 THEN
      SELECT o."Id",
             COALESCE((SELECT max(l."Level") FROM config."ItemOptionOfLevel" l WHERE l."IncreasableItemOptionId" = o."Id"), 4) AS max_level
        INTO opt
        FROM config."ItemDefinitionItemOptionDefinition" x
        JOIN config."IncreasableItemOption" o ON o."ItemOptionDefinitionId" = x."ItemOptionDefinitionId"
       WHERE x."ItemDefinitionId" = it."Id" AND o."OptionTypeId" = option_type
       ORDER BY o."Number" LIMIT 1;
      IF FOUND THEN
        INSERT INTO data."ItemOptionLink" ("Id", "ItemId", "ItemOptionId", "Level", "Index")
        VALUES (gen_random_uuid(), item_id, opt."Id", LEAST(it.opt, opt.max_level), 0);
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'igc_shops_seeded') THEN
    RETURN;
  END IF;

${body}

  INSERT INTO mlr.settings (key, value) VALUES ('igc_shops_seeded', now()::text);
END $$;

COMMIT;
`;

writeFileSync(new URL('../config/38-igc-shops.sql', import.meta.url), sql);
console.log(shops.map(s => `${s.npc}: ${s.items.length}`).join('\n'));
