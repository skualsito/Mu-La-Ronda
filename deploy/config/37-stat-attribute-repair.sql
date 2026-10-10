-- Mu La Ronda - atributos de personaje sin definicion.
--
-- Dos personajes (2026-10-10) no podian entrar: el server tiraba "Value cannot
-- be null (Parameter 'key')" en ItemAwareAttributeSystem al elegirlos y el
-- cliente se quedaba en el selector. Un atributo guardado del personaje (o de
-- la cuenta) sin definicion rompe el sistema de atributos entero. El server
-- ahora los saca al entrar (Player.cs, RemoveUndefinedStatAttributes); aca se
-- borran de la base y se avisa cuantos habia.
--
-- Tambien se asegura que existan, en la configuracion del juego, los dos
-- contadores del Golden Archer (Renas registradas): si faltaban, registrar
-- una Rena guardaba el contador con una definicion que la base no tenia.
-- Idempotente.

BEGIN;

DO $$
DECLARE
  removed int;
  config_id uuid;
BEGIN
  DELETE FROM data."StatAttribute" WHERE "DefinitionId" IS NULL;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE 'Atributos sin definicion borrados: %', removed;
  END IF;

  SELECT "Id" INTO config_id FROM config."GameConfiguration" LIMIT 1;
  IF config_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO config."AttributeDefinition" ("Id", "Designation", "Description", "GameConfigurationId", "MaximumValue")
  VALUES
    ('45b1c2a3-3e4f-5a6b-7c8d-9e0f1a2b3c4d', 'Registered Renas', 'Progress towards next item registration reward', config_id, NULL),
    ('56c2d3b4-4f5a-6b7c-8d9e-0f1a2b3c4d5e', 'Total Registered Renas', 'Total registered items (all-time counter)', config_id, NULL)
  ON CONFLICT ("Id") DO UPDATE
    SET "GameConfigurationId" = COALESCE(config."AttributeDefinition"."GameConfigurationId", EXCLUDED."GameConfigurationId");
END $$;

COMMIT;
