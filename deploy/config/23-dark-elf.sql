-- Mu La Ronda - la Dark Elf (monstruo 440: jefe del Devil Square 7 y el spot 4
-- de la zona de leveleo de Arena) mucho mas dura.
--
-- En OpenMU tiene 1.000.000 de vida, 650 de defensa y 800 de dano: con los
-- stats al tope (65534) caia en un par de golpes. Valores absolutos, asi el
-- script se puede correr las veces que haga falta.
--
--   vida 10.000.000, dano 2500, defensa 3000, attack rate 4000, defense rate 2000

BEGIN;

DO $$
DECLARE
  elf uuid;
BEGIN
  SELECT "Id" INTO elf FROM config."MonsterDefinition" WHERE "Number" = 440;
  IF elf IS NULL THEN
    RAISE NOTICE 'Dark Elf (440) no existe: omitido';
    RETURN;
  END IF;

  UPDATE config."MonsterAttribute" a
     SET "Value" = v.value
    FROM (VALUES
      ('a6c39a5c-295f-415e-a314-5e9f9a748d27'::uuid, 10000000::real),  -- MaximumHealth
      ('3e8d6a02-e973-4ae4-9df3-cddc3d3183b3'::uuid, 2500),            -- MinimumPhysBaseDmg
      ('8a918ea2-893a-48b2-a684-3e71526ca71f'::uuid, 2500),            -- MaximumPhysBaseDmg
      ('eb098c46-60d4-4ca6-bbd4-5b6270a1407b'::uuid, 3000),            -- DefenseBase
      ('1129442a-e1c7-4240-8866-b781c2838c25'::uuid, 4000),            -- AttackRatePvm
      ('c520dd2d-1b06-4392-95ee-3c41f33e68da'::uuid, 2000)             -- DefenseRatePvm
    ) AS v(attribute, value)
   WHERE a."MonsterDefinitionId" = elf
     AND a."AttributeDefinitionId" = v.attribute;
END $$;

COMMIT;
