-- Mu La Ronda - Medusa (monstruo 561), el jefe del Swamp of Calmness.
--
-- OpenMU no la tiene: ni el monstruo ni el evento. Aca se crea el monstruo
-- (el cliente ya tiene su modelo) con los tiempos y rangos de Selupan y stats
-- de jefe por encima de los bichos del pantano (nivel 131-137, unos 240 mil
-- de vida). La hace aparecer MedusaInvasionPlugIn (marketplace/openmu): cada
-- 4 horas, media hora, en 129,164. Las stats y los drops despues se ajustan
-- desde el panel (Monstruos / Drops), y lo de ahi gana sobre este archivo.
-- Solo crea lo que falta: no pisa a Medusa si ya existe. Idempotente.

BEGIN;

DO $$
DECLARE
  medusa uuid := 'a1e5ad10-0000-4000-8000-000000000561';
  selupan uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM config."MonsterDefinition" WHERE "Number" = 561) THEN
    RETURN;
  END IF;

  SELECT "Id" INTO selupan FROM config."MonsterDefinition" WHERE "Number" = 459;
  IF selupan IS NULL THEN
    RAISE NOTICE 'Medusa: falta Selupan (459) para copiar sus tiempos; omitida';
    RETURN;
  END IF;

  INSERT INTO config."MonsterDefinition"
    ("Id", "AttackSkillId", "MerchantStoreId", "GameConfigurationId", "Number", "Designation",
     "MoveRange", "AttackRange", "ViewRange", "MoveDelay", "AttackDelay", "RespawnDelay",
     "Attribute", "NumberOfMaximumItemDrops", "NpcWindow", "ObjectKind", "IntelligenceTypeName")
  SELECT medusa, NULL, NULL, s."GameConfigurationId", 561, 'Medusa',
         s."MoveRange", s."AttackRange", s."ViewRange", s."MoveDelay", s."AttackDelay", interval '1 hour',
         s."Attribute", 8, 0, 0, NULL
    FROM config."MonsterDefinition" s
   WHERE s."Id" = selupan;

  INSERT INTO config."MonsterAttribute" ("Id", "AttributeDefinitionId", "MonsterDefinitionId", "Value")
  SELECT gen_random_uuid(), d."Id", medusa, v.value
    FROM (VALUES
      ('Level', 150),
      ('Maximum Health', 5000000),
      ('Minimum Physical Base Damage', 2600),
      ('Maximum Physical Base Damage', 3200),
      ('Base Defense', 1300),
      ('Attack Rate (PvM)', 2400),
      ('Defense Rate (PvM)', 2000),
      ('Skill Damage Multiplier', 2),
      ('Fire Resistance', 0.5882353),
      ('Water Resistance', 0.5882353),
      ('Ice Resistance', 0.99607843),
      ('Poison Resistance', 0.99607843)
    ) AS v(name, value)
    -- The same attribute definitions the monsters use: Selupan's (a name may repeat).
    JOIN config."MonsterAttribute" sa ON sa."MonsterDefinitionId" = selupan
    JOIN config."AttributeDefinition" d ON d."Id" = sa."AttributeDefinitionId" AND d."Designation" = v.name;
END $$;

COMMIT;
