-- Mu La Ronda - tiendas para server fast.
--
-- 1. Pociones de a 255 en todas las tiendas de NPC. 08-stacks.sql ya subio el
--    tope de la pila a 255; aca las tiendas las venden con la pila completa.
--    OpenMU cobra por unidad (ItemPriceCalculator multiplica por la cantidad),
--    asi que el precio por pocion no cambia. Corre en cada deploy.
--
-- 2. Pasi the Mage (Lorencia) vende todos los poderes de todas las clases:
--    orbes (grupo 12) y pergaminos (grupo 15) que ensenian un skill. Se carga
--    UNA vez (marca en mlr.settings) y despues se edita desde el panel admin;
--    para volver a este surtido: DELETE FROM mlr.settings WHERE key = 'skill_store_seeded'.

BEGIN;

UPDATE data."Item" i
   SET "Durability" = d."Durability"
  FROM config."ItemDefinition" d
 WHERE i."DefinitionId" = d."Id"
   AND d."Group" = 14
   AND d."Number" IN (0, 1, 2, 3, 4, 5, 6, 8, 9, 35, 36, 37, 38, 39, 40, 70, 71)
   AND d."Durability" > 1
   AND i."Durability" <> d."Durability"
   AND i."ItemStorageId" IN (SELECT "MerchantStoreId" FROM config."MonsterDefinition" WHERE "MerchantStoreId" IS NOT NULL);

DO $$
DECLARE
  pasi_store uuid;
  skills jsonb;
BEGIN
  SELECT "MerchantStoreId" INTO pasi_store FROM config."MonsterDefinition" WHERE "Number" = 254;
  IF pasi_store IS NULL OR EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'skill_store_seeded') THEN
    RETURN;
  END IF;

  -- Todo item de orbe o pergamino que ensenia un skill (las alas tambien son
  -- del grupo 12, pero ocupan un slot de equipo).
  SELECT jsonb_agg(jsonb_build_array(d."Group", d."Number", 0) ORDER BY d."Group", d."Number")
    INTO skills
    FROM config."ItemDefinition" d
   WHERE d."Group" IN (12, 15)
     AND d."SkillId" IS NOT NULL
     AND d."ItemSlotId" IS NULL;

  IF skills IS NOT NULL THEN
    PERFORM mlr.fill_stores(ARRAY[pasi_store], jsonb_build_array(skills));
  END IF;
  INSERT INTO mlr.settings (key, value) VALUES ('skill_store_seeded', now()::text);
END $$;

COMMIT;
