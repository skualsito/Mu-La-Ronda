-- Mu La Ronda - los materiales del Fenrir caen en Crywolf.
--
-- El Fenrir se arma en la Chaos Machine con Splinter of Armor (13,32) y Bless
-- of Guardian (13,33) (paso 1, 20 de cada uno) y Claw of Beast (13,34) (paso 2,
-- 10), pero OpenMU no los hace caer de ningun lado. Como en MU, caen de los
-- monstruos de Crywolf Fortress (mapa 34), cada uno de a una pieza (se apilan
-- 20, 20 y 10). Un grupo por item, asi cada uno tiene su chance y no los
-- frena el nivel minimo de drop (DefaultDropGenerator: grupo del mapa con un
-- solo item). Las chances se cambian aca: cada deploy que toque este archivo
-- las vuelve a poner.

BEGIN;

CREATE TEMP TABLE fenrir_drops (id uuid, item_number int, chance float8, description text) ON COMMIT DROP;
INSERT INTO fenrir_drops VALUES
  ('a1e5ad10-0000-4000-8000-000000000202', 32, 0.10, 'Splinter of Armor (Crywolf)'),
  ('a1e5ad10-0000-4000-8000-000000000203', 33, 0.10, 'Bless of Guardian (Crywolf)'),
  ('a1e5ad10-0000-4000-8000-000000000204', 34, 0.05, 'Claw of Beast (Crywolf)');

INSERT INTO config."DropItemGroup"
  ("Id", "Chance", "Description", "GameConfigurationId", "ItemLevel", "ItemType",
   "MaximumMonsterLevel", "MinimumMonsterLevel", "MonsterId")
SELECT f.id, f.chance, f.description, gc."Id", NULL, 0, NULL, NULL, NULL
  FROM fenrir_drops f, (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) gc
ON CONFLICT ("Id") DO NOTHING;

UPDATE config."DropItemGroup" g SET "Chance" = f.chance
  FROM fenrir_drops f
 WHERE g."Id" = f.id;

INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
SELECT f.id, i."Id"
  FROM fenrir_drops f
  JOIN config."ItemDefinition" i ON i."Group" = 13 AND i."Number" = f.item_number
ON CONFLICT DO NOTHING;

INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
SELECT m."Id", f.id
  FROM fenrir_drops f, config."GameMapDefinition" m
 WHERE m."Number" = 34
ON CONFLICT DO NOTHING;

COMMIT;
