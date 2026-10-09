-- Mu La Ronda - todos los buffs duran 25 minutos.
--
-- En OpenMU cada buff tenia su duracion: Greater Defense y Greater Damage de la
-- elfa 60 segundos fijos, Soul Barrier, Swell Life y los de RF/DL 30-60 s mas
-- un extra por energia, Infinity Arrow 10 min, Expansion of Wizardry 30 min.
-- Los de la elfa se iban enseguida. Aca todos quedan en 1500 s (25 min), sin el
-- extra por atributos, contra monstruos y en PvP.
--
-- Son los efectos positivos (numero de MagicEffectDefinition):
--   1 Greater Damage, 2 Greater Defense, 4 Soul Barrier, 5 Critical Damage,
--   6 Infinity Arrow, 8 Swell Life (135 su proficiency), 71 Damage Reflection,
--   81 Berserker, 82 Expansion of Wizardry (138, 139 sus mejoras), 129 Ignore
--   Defense, 130 Increase Health, 131 Increase Block, 148 Critical Damage
--   Mastery, 153-155 las mejoras de RF.
-- Quedan como estan los negativos (Sleep 72, Weakness 76, Innovation 77) y el
-- escudo de 4 s del skill Defense (200). Idempotente.

BEGIN;

UPDATE config."PowerUpDefinitionValue" v
   SET "Value" = 1500
  FROM config."MagicEffectDefinition" e
 WHERE v."Id" IN (e."DurationId", e."DurationPvpId")
   AND e."Number" IN (1, 2, 4, 5, 6, 8, 71, 81, 82, 129, 130, 131, 135, 138, 139, 148, 153, 154, 155);

DELETE FROM config."AttributeRelationship" r
 USING config."MagicEffectDefinition" e
 WHERE r."PowerUpDefinitionValueId" IN (e."DurationId", e."DurationPvpId")
   AND e."Number" IN (1, 2, 4, 5, 6, 8, 71, 81, 82, 129, 130, 131, 135, 138, 139, 148, 153, 154, 155);

UPDATE config."MagicEffectDefinition"
   SET "DurationDependsOnTargetLevel" = false
 WHERE "Number" IN (1, 2, 4, 5, 6, 8, 71, 81, 82, 129, 130, 131, 135, 138, 139, 148, 153, 154, 155);

COMMIT;
