-- Mu La Ronda - los monstruos editados en el panel de administracion ganan.
--
-- El panel (admin/server/monsters.ts) cambia config."MonsterDefinition" y
-- config."MonsterAttribute" y guarda cada monstruo editado entero en
-- mlr.monster_overrides. Este archivo corre ultimo (99-): lo que otros .sql
-- de aca ponen (el respawn de server fast y de los jefes, la vida de los
-- dorados...) se vuelve a pisar con lo del panel. Para devolverle el
-- monstruo a los deploys, el panel tiene "Dejar de fijar". Idempotente.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.monster_overrides (
  "Id" uuid PRIMARY KEY,
  "Data" jsonb NOT NULL,
  "UpdatedAt" timestamptz NOT NULL DEFAULT now());

UPDATE config."MonsterDefinition" m SET
  "Designation" = o."Data"->>'name',
  "RespawnDelay" = (o."Data"->>'respawnDelay')::interval,
  "AttackDelay" = (o."Data"->>'attackDelay')::interval,
  "MoveDelay" = (o."Data"->>'moveDelay')::interval,
  "MoveRange" = (o."Data"->>'moveRange')::smallint,
  "AttackRange" = (o."Data"->>'attackRange')::smallint,
  "ViewRange" = (o."Data"->>'viewRange')::smallint,
  "NumberOfMaximumItemDrops" = (o."Data"->>'maxDrops')::int
  FROM mlr.monster_overrides o
 WHERE o."Id" = m."Id";

-- Los atributos guardados: se actualizan los que existen y se agregan los que faltan.
UPDATE config."MonsterAttribute" a SET "Value" = e.value::float4
  FROM mlr.monster_overrides o
 CROSS JOIN LATERAL jsonb_each_text(o."Data"->'attributes') e(attribute, value)
 WHERE a."MonsterDefinitionId" = o."Id" AND a."AttributeDefinitionId" = e.attribute::uuid;

INSERT INTO config."MonsterAttribute" ("Id", "AttributeDefinitionId", "MonsterDefinitionId", "Value")
SELECT gen_random_uuid(), d."Id", o."Id", e.value::float4
  FROM mlr.monster_overrides o
 CROSS JOIN LATERAL jsonb_each_text(o."Data"->'attributes') e(attribute, value)
  JOIN config."AttributeDefinition" d ON d."Id" = e.attribute::uuid
  JOIN config."MonsterDefinition" m ON m."Id" = o."Id"
 WHERE NOT EXISTS (SELECT 1 FROM config."MonsterAttribute" a
                    WHERE a."MonsterDefinitionId" = o."Id" AND a."AttributeDefinitionId" = d."Id");

COMMIT;
