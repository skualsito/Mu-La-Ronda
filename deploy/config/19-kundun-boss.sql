-- Mu La Ronda - Kundun (jefe de Kalima 7, monstruo 275): un solo item, ancient
-- o excelente, nunca zen; y reaparece cada 1 hora.
--
-- En OpenMU Kundun tira un sorteo entre los grupos generales (item comun,
-- excelente, zen...), asi que a veces daba solo zen. Aca tiene dos grupos
-- garantizados (ancient y excelente) y lugar para un solo drop:
-- DefaultDropGenerator sortea cual cae cuando no entran todos.
-- Idempotente (ids fijos).

BEGIN;

DO $$
DECLARE
  kundun uuid;
  config_id uuid;
BEGIN
  SELECT "Id" INTO kundun FROM config."MonsterDefinition" WHERE "Number" = 275;
  IF kundun IS NULL THEN
    RAISE NOTICE 'Kundun (275) no existe: drops omitidos';
    RETURN;
  END IF;
  SELECT "Id" INTO config_id FROM config."GameConfiguration" LIMIT 1;

  UPDATE config."MonsterDefinition"
     SET "NumberOfMaximumItemDrops" = 1, "RespawnDelay" = interval '1 hour'
   WHERE "Id" = kundun;

  -- El segundo ancient de antes (3 drops) ya no va.
  DELETE FROM config."MonsterDefinitionDropItemGroup"
   WHERE "MonsterDefinitionId" = kundun
     AND "DropItemGroupId" = 'd0a1c275-0000-4000-8000-000000000002';

  -- ItemType: 1 = Ancient, 2 = Excellent (SpecialItemType).
  INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType")
  VALUES
    ('d0a1c275-0000-4000-8000-000000000001', 1.0, 'Kundun: ancient', config_id, 1),
    ('d0a1c275-0000-4000-8000-000000000003', 1.0, 'Kundun: excelente', config_id, 2)
  ON CONFLICT ("Id") DO UPDATE SET "Chance" = EXCLUDED."Chance", "ItemType" = EXCLUDED."ItemType";

  INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
  SELECT kundun, g FROM unnest(ARRAY[
    'd0a1c275-0000-4000-8000-000000000001'::uuid,
    'd0a1c275-0000-4000-8000-000000000003'::uuid]) AS g
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
