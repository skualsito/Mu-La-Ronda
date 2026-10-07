-- Mu La Ronda - Kundun (jefe de Kalima 7, monstruo 275): siempre 3 items de
-- los buenos, nunca solo zen.
--
-- En OpenMU Kundun tira un sorteo entre los grupos generales (item comun,
-- excelente, zen...), asi que a veces daba solo zen. Aca tira 3 items
-- garantizados (DefaultDropGenerator: un grupo con Chance >= 1 siempre cae, y
-- los del monstruo van primero): 2 ancient al azar y 1 excelente de su nivel.
-- NumberOfMaximumItemDrops = 3, asi no queda lugar para el zen.
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

  UPDATE config."MonsterDefinition" SET "NumberOfMaximumItemDrops" = 3 WHERE "Id" = kundun;

  -- ItemType: 1 = Ancient, 2 = Excellent (SpecialItemType).
  INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType")
  VALUES
    ('d0a1c275-0000-4000-8000-000000000001', 1.0, 'Kundun: ancient 1', config_id, 1),
    ('d0a1c275-0000-4000-8000-000000000002', 1.0, 'Kundun: ancient 2', config_id, 1),
    ('d0a1c275-0000-4000-8000-000000000003', 1.0, 'Kundun: excelente', config_id, 2)
  ON CONFLICT ("Id") DO UPDATE SET "Chance" = EXCLUDED."Chance", "ItemType" = EXCLUDED."ItemType";

  INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
  SELECT kundun, g FROM unnest(ARRAY[
    'd0a1c275-0000-4000-8000-000000000001'::uuid,
    'd0a1c275-0000-4000-8000-000000000002'::uuid,
    'd0a1c275-0000-4000-8000-000000000003'::uuid]) AS g
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
