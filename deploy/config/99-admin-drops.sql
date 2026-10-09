-- Mu La Ronda - los drops editados en el panel de administracion ganan.
--
-- El panel (admin/server/drops.ts) cambia config."DropItemGroup" y sus
-- vinculos, y guarda cada grupo editado entero en mlr.drop_overrides. Este
-- archivo corre ultimo (99-): lo que otros .sql de aca ponen (la chance del
-- Moonstone, los materiales del Fenrir...) se vuelve a pisar con lo del
-- panel. Un grupo borrado en el panel se vuelve a borrar si un deploy lo
-- creo de nuevo (salvo que lo use un evento o una quest). Para devolverle el
-- grupo a los deploys, el panel tiene "Dejar de fijar". Idempotente.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.drop_overrides (
  "Id" uuid PRIMARY KEY,
  "Data" jsonb,
  "Deleted" boolean NOT NULL DEFAULT false,
  "UpdatedAt" timestamptz NOT NULL DEFAULT now());

-- Borrados en el panel.
DELETE FROM config."DropItemGroup" g
 USING mlr.drop_overrides o
 WHERE o."Id" = g."Id" AND o."Deleted"
   AND NOT EXISTS (SELECT 1 FROM config."MiniGameReward" r WHERE r."ItemRewardId" = g."Id")
   AND NOT EXISTS (SELECT 1 FROM config."QuestItemRequirement" q WHERE q."DropItemGroupId" = g."Id");

-- Los campos del grupo.
INSERT INTO config."DropItemGroup"
  ("Id", "Chance", "Description", "GameConfigurationId", "ItemLevel", "ItemType",
   "MaximumMonsterLevel", "MinimumMonsterLevel", "MonsterId")
SELECT o."Id",
       (o."Data"->>'chance')::float8,
       o."Data"->>'description',
       (SELECT "Id" FROM config."GameConfiguration" LIMIT 1),
       (o."Data"->>'itemLevel')::smallint,
       (o."Data"->>'itemType')::int,
       (o."Data"->>'maxMonsterLevel')::smallint,
       (o."Data"->>'minMonsterLevel')::smallint,
       m."Id"
  FROM mlr.drop_overrides o
  LEFT JOIN config."MonsterDefinition" m ON m."Id" = (o."Data"->>'monsterColumn')::uuid
 WHERE NOT o."Deleted" AND o."Data" IS NOT NULL
ON CONFLICT ("Id") DO UPDATE SET
  "Chance" = EXCLUDED."Chance",
  "Description" = EXCLUDED."Description",
  "ItemLevel" = EXCLUDED."ItemLevel",
  "ItemType" = EXCLUDED."ItemType",
  "MaximumMonsterLevel" = EXCLUDED."MaximumMonsterLevel",
  "MinimumMonsterLevel" = EXCLUDED."MinimumMonsterLevel",
  "MonsterId" = EXCLUDED."MonsterId";

-- Los vinculos: mapas, monstruos e items, tal cual quedaron en el panel.
DELETE FROM config."GameMapDefinitionDropItemGroup" x
 USING mlr.drop_overrides o
 WHERE o."Id" = x."DropItemGroupId" AND NOT o."Deleted" AND o."Data" IS NOT NULL;
INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
SELECT m."Id", o."Id"
  FROM mlr.drop_overrides o
  CROSS JOIN LATERAL jsonb_array_elements_text(o."Data"->'mapIds') e(id)
  JOIN config."GameMapDefinition" m ON m."Id" = e.id::uuid
 WHERE NOT o."Deleted" AND o."Data" IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM config."MonsterDefinitionDropItemGroup" x
 USING mlr.drop_overrides o
 WHERE o."Id" = x."DropItemGroupId" AND NOT o."Deleted" AND o."Data" IS NOT NULL;
INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
SELECT m."Id", o."Id"
  FROM mlr.drop_overrides o
  CROSS JOIN LATERAL jsonb_array_elements_text(o."Data"->'monsterIds') e(id)
  JOIN config."MonsterDefinition" m ON m."Id" = e.id::uuid
 WHERE NOT o."Deleted" AND o."Data" IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM config."DropItemGroupItemDefinition" x
 USING mlr.drop_overrides o
 WHERE o."Id" = x."DropItemGroupId" AND NOT o."Deleted" AND o."Data" IS NOT NULL;
INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
SELECT o."Id", d."Id"
  FROM mlr.drop_overrides o
  CROSS JOIN LATERAL jsonb_array_elements_text(o."Data"->'itemIds') e(id)
  JOIN config."ItemDefinition" d ON d."Id" = e.id::uuid
 WHERE NOT o."Deleted" AND o."Data" IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
