-- Mu La Ronda - el Moonstone Pendant (13,38) cae en Kanturu.
--
-- Hace falta tenerlo equipado para entrar al evento de Kanturu (Maya y
-- Nightmare) por la Gateway Machine de Kanturu Relics, pero OpenMU no lo hace
-- caer de ningun lado. Como en MU, cae de los monstruos de Kanturu Ruins
-- (mapa 37) y Kanturu Relics (mapa 38): 2% por kill (el original es mas bajo,
-- este server va con rates altos). La chance se cambia aca o en el panel.

BEGIN;

INSERT INTO config."DropItemGroup"
  ("Id", "Chance", "Description", "GameConfigurationId", "ItemLevel", "ItemType",
   "MaximumMonsterLevel", "MinimumMonsterLevel", "MonsterId")
SELECT 'a1e5ad10-0000-4000-8000-000000000201', 0.02, 'Moonstone Pendant (Kanturu)', gc."Id",
       NULL, 0, NULL, NULL, NULL
  FROM config."GameConfiguration" gc
 LIMIT 1
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
SELECT 'a1e5ad10-0000-4000-8000-000000000201', i."Id"
  FROM config."ItemDefinition" i
 WHERE i."Group" = 13 AND i."Number" = 38
ON CONFLICT DO NOTHING;

INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
SELECT m."Id", 'a1e5ad10-0000-4000-8000-000000000201'
  FROM config."GameMapDefinition" m
 WHERE m."Number" IN (37, 38)
ON CONFLICT DO NOTHING;

COMMIT;
