-- Mu La Ronda - Loren Deep: los monstruos del evento en el Valley of Loren
-- (LorenDeepInvasionPlugIn, marketplace/openmu) tiran la Star of Sacred Birth
-- (Box of Luck +1), y la estrella al tirarla al piso da (guide.elitemu.net):
--   80% Jewel of Bless o Soul, 19% Jewel of Life o Creation, 1% Jewel of Guardian.
--
-- El Valley of Loren no tiene monstruos propios (es el mapa del castle siege),
-- asi que el grupo del mapa solo cuenta durante el evento: 15% por muerte.
-- La chance despues se ajusta desde el panel (Drops). Idempotente (ids fijos).

BEGIN;

DO $$
DECLARE
  config_id uuid;
  star uuid;
  valley uuid;
  grp record;
BEGIN
  SELECT "Id" INTO config_id FROM config."GameConfiguration" LIMIT 1;
  SELECT "Id" INTO star FROM config."ItemDefinition" WHERE "Group" = 14 AND "Number" = 11;
  SELECT "Id" INTO valley FROM config."GameMapDefinition" WHERE "Number" = 30;
  IF star IS NULL OR valley IS NULL THEN
    RAISE NOTICE 'Loren Deep: falta la Box of Luck o el Valley of Loren; omitido';
    RETURN;
  END IF;

  -- Lo que da la estrella (Box of Luck nivel 1). ItemType 3 = de la lista.
  FOR grp IN
    SELECT * FROM (VALUES
      ('e0a1de3b-0000-4000-8000-000000000001'::uuid, 'Star of Sacred Birth: Bless / Soul', 0.80, ARRAY[13, 14]),
      ('e0a1de3b-0000-4000-8000-000000000002'::uuid, 'Star of Sacred Birth: Life / Creation', 0.19, ARRAY[16, 22]),
      ('e0a1de3b-0000-4000-8000-000000000003'::uuid, 'Star of Sacred Birth: Guardian', 0.01, ARRAY[31])
    ) AS t(id, descr, chance, jewels)
  LOOP
    INSERT INTO config."ItemDropItemGroup"
      ("Id", "MonsterId", "ItemDefinitionId", "Description", "Chance", "ItemType", "SourceItemLevel",
       "MoneyAmount", "MinimumLevel", "MaximumLevel", "RequiredCharacterLevel", "DropEffect")
    VALUES (grp.id, NULL, star, grp.descr, grp.chance, 3, 1, 0, 0, 0, 0, 0)
    ON CONFLICT ("Id") DO UPDATE
      SET "Description" = EXCLUDED."Description", "Chance" = EXCLUDED."Chance",
          "ItemType" = EXCLUDED."ItemType", "SourceItemLevel" = EXCLUDED."SourceItemLevel";

    DELETE FROM config."ItemDropItemGroupItemDefinition" WHERE "ItemDropItemGroupId" = grp.id;
    INSERT INTO config."ItemDropItemGroupItemDefinition" ("ItemDropItemGroupId", "ItemDefinitionId")
    SELECT grp.id, d."Id" FROM config."ItemDefinition" d
     WHERE d."GameConfigurationId" = config_id AND d."Group" = 14 AND d."Number" = ANY (grp.jewels);
  END LOOP;

  -- La estrella en el Valley of Loren.
  INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType", "ItemLevel")
  VALUES ('e0a1de3b-0000-4000-8000-000000000010', 0.15, 'Loren Deep: Star of Sacred Birth', config_id, 0, 1)
  ON CONFLICT ("Id") DO UPDATE
    SET "Description" = EXCLUDED."Description", "ItemType" = EXCLUDED."ItemType", "ItemLevel" = EXCLUDED."ItemLevel";

  DELETE FROM config."DropItemGroupItemDefinition" WHERE "DropItemGroupId" = 'e0a1de3b-0000-4000-8000-000000000010';
  INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
  VALUES ('e0a1de3b-0000-4000-8000-000000000010', star);

  INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
  VALUES (valley, 'e0a1de3b-0000-4000-8000-000000000010')
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
