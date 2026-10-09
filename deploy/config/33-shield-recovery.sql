-- Mu La Ronda - el SD se recupera en todos lados, no solo en zona segura.
--
-- En OpenMU el SD (escudo) solo se regenera en zona segura, salvo que el
-- personaje tenga el atributo "Shield Recovery Active Everywhere" (Stats.cs).
-- En el ring de Lorencia y en cualquier pelea afuera quedaba en cero despues
-- de un par de golpes y no volvia. Con el atributo en 1 para todas las clases
-- se recupera en cualquier mapa; sigue frenando un rato cada vez que te pegan
-- (ShieldRecoveryHiatus) y arranca de a poco, como en zona segura.
-- Idempotente.

BEGIN;

INSERT INTO config."ConstValueAttribute"
  ("Id", "DefinitionId", "CharacterClassId", "Value", "GameConfigurationId", "AggregateType")
SELECT gen_random_uuid(), '3d0a78ff-ccd4-442e-8b4e-64e5082abd78', c."Id", 1, NULL, 0
  FROM config."CharacterClass" c
 WHERE NOT EXISTS (
         SELECT 1 FROM config."ConstValueAttribute" v
          WHERE v."CharacterClassId" = c."Id"
            AND v."DefinitionId" = '3d0a78ff-ccd4-442e-8b4e-64e5082abd78');

UPDATE config."ConstValueAttribute" SET "Value" = 1
 WHERE "DefinitionId" = '3d0a78ff-ccd4-442e-8b4e-64e5082abd78' AND "Value" <> 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config."AttributeRelationship"
                  WHERE "TargetAttributeId" = '8f2c4d7e-b1a9-4e3f-9c5d-2a1b7e8f3c4d'
                    AND "InputAttributeId" = '3d0a78ff-ccd4-442e-8b4e-64e5082abd78') THEN
    RAISE NOTICE 'SD: falta la relacion Shield Recovery Active Everywhere -> Is Shield Recovery Active (instalar las actualizaciones de OpenMU)';
  END IF;
END $$;

COMMIT;
