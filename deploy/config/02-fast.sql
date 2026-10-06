-- Mu La Ronda - "server fast" para la beta: spots cargados y tiendas con
-- joyas, pets y alas en Lorencia, para probar todo sin farmear semanas.
--
-- Idempotente como 01-game.sql: los valores originales se guardan una sola
-- vez en el esquema "mlr" (OpenMU no lo conoce ni lo toca) y todo se calcula
-- a partir de ellos, asi correrlo dos veces no multiplica dos veces.
-- Para volver a lo original: borrar este archivo, y en la base
--   UPDATE config."MonsterSpawnArea" s SET "Quantity" = b."Quantity" FROM mlr.spawn_quantity b WHERE b."Id" = s."Id";
--   UPDATE config."MonsterDefinition" m SET "RespawnDelay" = b."RespawnDelay" FROM mlr.monster_respawn b WHERE b."Id" = m."Id";

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;

-- ─── Spots ──────────────────────────────────────────────────────────────────
-- Todos los spots normales de monstruos (no NPCs, no eventos, no bosses que
-- salen de a uno) con el triple de bichos, y respawn de 3 segundos.
-- Los spots de la zona de leveleo (06-leveling.sql) ya tienen su cantidad.
CREATE TABLE IF NOT EXISTS mlr.leveling_spawns ("Id" uuid PRIMARY KEY);

CREATE TABLE IF NOT EXISTS mlr.spawn_quantity (
  "Id" uuid PRIMARY KEY,
  "Quantity" smallint NOT NULL
);
INSERT INTO mlr.spawn_quantity ("Id", "Quantity")
SELECT "Id", "Quantity" FROM config."MonsterSpawnArea"
ON CONFLICT ("Id") DO NOTHING;

UPDATE config."MonsterSpawnArea" s
   SET "Quantity" = LEAST(b."Quantity" * 3, 32767)
  FROM mlr.spawn_quantity b, config."MonsterDefinition" m
 WHERE b."Id" = s."Id"
   AND m."Id" = s."MonsterDefinitionId"
   AND m."ObjectKind" = 0      -- NpcObjectKind.Monster
   AND s."SpawnTrigger" = 0    -- SpawnTrigger.Automatic
   AND b."Quantity" >= 2
   AND s."Id" NOT IN (SELECT "Id" FROM mlr.leveling_spawns);

CREATE TABLE IF NOT EXISTS mlr.monster_respawn (
  "Id" uuid PRIMARY KEY,
  "RespawnDelay" interval NOT NULL
);
INSERT INTO mlr.monster_respawn ("Id", "RespawnDelay")
SELECT "Id", "RespawnDelay" FROM config."MonsterDefinition"
ON CONFLICT ("Id") DO NOTHING;

-- Solo los que ya respawnean rapido (bichos comunes, ~10 s); los bosses con
-- horas de respawn quedan como estan.
UPDATE config."MonsterDefinition" m
   SET "RespawnDelay" = LEAST(b."RespawnDelay", interval '3 seconds')
  FROM mlr.monster_respawn b
 WHERE b."Id" = m."Id"
   AND m."ObjectKind" = 0
   AND b."RespawnDelay" <= interval '30 seconds';

-- ─── Tiendas ────────────────────────────────────────────────────────────────
-- Llena tiendas de NPC: `shelves` es una lista de listas de items
-- ([grupo, numero, nivel]); la lista N va preferentemente a stores[N] y lo
-- que no entra ahi pasa a las otras tiendas. Cada lista se acomoda de mayor a
-- menor en la grilla de 8x15. Lo que no entra en ninguna se avisa con un
-- NOTICE. Los precios los calcula OpenMU (los del MU original).
DROP FUNCTION IF EXISTS mlr.fill_store(uuid, jsonb);
CREATE OR REPLACE FUNCTION mlr.fill_stores(stores uuid[], shelves jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  n int := array_length(stores, 1);
  grid boolean[] := array_fill(false, ARRAY[n * 120]);
  it record;
  k int; s int; base int;
  x int; y int; dx int; dy int;
  fits boolean;
  placed boolean;
BEGIN
  DELETE FROM data."ItemOptionLink"
   WHERE "ItemId" IN (SELECT "Id" FROM data."Item" WHERE "ItemStorageId" = ANY (stores));
  DELETE FROM data."Item" WHERE "ItemStorageId" = ANY (stores);

  FOR it IN
    SELECT d."Id", d."Name", d."Width" AS w, d."Height" AS h, d."Durability" AS dur,
           (e.value->>2)::int AS lvl, sh.ord::int AS pref
      FROM jsonb_array_elements(shelves) WITH ORDINALITY AS sh(items, ord)
     CROSS JOIN LATERAL jsonb_array_elements(sh.items) WITH ORDINALITY AS e(value, ord)
      JOIN config."ItemDefinition" d
        ON d."Group" = (e.value->>0)::int AND d."Number" = (e.value->>1)::int
     ORDER BY sh.ord, d."Width" * d."Height" DESC, e.ord
  LOOP
    placed := false;
    <<search>>
    FOR k IN 0 .. n - 1 LOOP
      s := ((it.pref - 1 + k) % n) + 1;
      base := (s - 1) * 120;
      FOR y IN 0 .. 15 - it.h LOOP
        FOR x IN 0 .. 8 - it.w LOOP
          fits := true;
          FOR dy IN 0 .. it.h - 1 LOOP
            FOR dx IN 0 .. it.w - 1 LOOP
              IF grid[base + (y + dy) * 8 + (x + dx) + 1] THEN fits := false; END IF;
            END LOOP;
          END LOOP;

          IF fits THEN
            FOR dy IN 0 .. it.h - 1 LOOP
              FOR dx IN 0 .. it.w - 1 LOOP
                grid[base + (y + dy) * 8 + (x + dx) + 1] := true;
              END LOOP;
            END LOOP;

            INSERT INTO data."Item"
              ("Id", "DefinitionId", "Durability", "HasSkill", "ItemSlot", "ItemStorageId",
               "Level", "PetExperience", "SocketCount", "StorePrice")
            VALUES
              (gen_random_uuid(), it."Id", GREATEST(it.dur, 1), false, y * 8 + x, stores[s],
               it.lvl, 0, 0, NULL);
            placed := true;
            EXIT search;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;

    IF NOT placed THEN
      RAISE NOTICE 'mlr.fill_stores: "%" no entra en las tiendas', it."Name";
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  lorencia uuid;
  -- Guids fijos para que el deploy siguiente encuentre las mismas tiendas.
  jewels_store uuid := 'b1a0f457-0000-4000-8000-000000000568';
  wings_store  uuid := 'b1a0f457-0000-4000-8000-000000000566';
  zyro uuid;
  felicia uuid;
BEGIN
  SELECT "Id" INTO lorencia FROM config."GameMapDefinition" WHERE "Number" = 0;
  SELECT "Id" INTO zyro     FROM config."MonsterDefinition" WHERE "Number" = 568;
  SELECT "Id" INTO felicia  FROM config."MonsterDefinition" WHERE "Number" = 566;

  INSERT INTO data."ItemStorage" ("Id", "Money") VALUES (jewels_store, 0), (wings_store, 0)
  ON CONFLICT ("Id") DO NOTHING;

  -- Wandering Merchant Zyro: joyas, materiales y pets.
  -- Mercenary Guild Felicia: alas de 1ra, 2da y 3ra (lo que no entre, a Zyro).
  PERFORM mlr.fill_stores(ARRAY[jewels_store, wings_store], '[
    [
      [14,13,0], [14,14,0], [14,16,0], [12,15,0], [14,22,0], [14,31,0],
      [14,42,0], [14,41,0], [14,43,0], [14,44,0],
      [13,14,0], [13,14,1], [13,52,0], [13,53,0],
      [13,0,0], [13,1,0], [13,2,0], [13,3,0], [13,4,0], [13,5,0], [13,37,0]
    ],
    [
      [12,0,0], [12,1,0], [12,2,0], [12,41,0],
      [12,3,0], [12,4,0], [12,5,0], [12,6,0], [12,42,0], [13,30,0], [12,49,0],
      [12,36,0], [12,37,0], [12,38,0], [12,39,0], [12,40,0], [12,43,0], [12,50,0]
    ]
  ]');

  -- En OpenMU los dos solo tenian un dialogo vacio; ahora son tiendas.
  UPDATE config."MonsterDefinition"
     SET "NpcWindow" = 1, "MerchantStoreId" = jewels_store   -- NpcWindow.Merchant
   WHERE "Id" = zyro;
  UPDATE config."MonsterDefinition"
     SET "NpcWindow" = 1, "MerchantStoreId" = wings_store
   WHERE "Id" = felicia;

  -- Zyro queda fijo en la plaza de Lorencia (131/139) en vez de caminar.
  UPDATE config."MonsterSpawnArea"
     SET "SpawnTrigger" = 0
   WHERE "MonsterDefinitionId" = zyro AND "GameMapId" = lorencia;

  -- Felicia, en la plaza entre Zyro y Julia.
  IF NOT EXISTS (SELECT 1 FROM config."MonsterSpawnArea"
                  WHERE "MonsterDefinitionId" = felicia AND "GameMapId" = lorencia) THEN
    INSERT INTO config."MonsterSpawnArea"
      ("Id", "Direction", "GameMapId", "MonsterDefinitionId", "Quantity", "SpawnTrigger",
       "WaveNumber", "X1", "X2", "Y1", "Y2")
    VALUES
      (gen_random_uuid(), 3, lorencia, felicia, 1, 0, 0, 135, 135, 139, 139);
  END IF;
END $$;

COMMIT;
