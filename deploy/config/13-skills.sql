-- Mu La Ronda - skills que no dependen del nivel.
--
-- Infinity Arrow (77) e Infinity Arrow Str (441) piden nivel 220 en OpenMU
-- (SkillsInitializer). Se aprenden con la quest Gain Hero Status, asi que una
-- elfa que la hizo y despues resetea queda en nivel 1 con el skill aprendido
-- pero el servidor se lo rechaza (Player.cs: skill.Requirements) hasta volver
-- a 220. Aca se saca ese requisito: si lo tenes aprendido, lo podes usar.
-- Idempotente.
DELETE FROM config."AttributeRequirement" r
 USING config."Skill" s
 WHERE r."SkillId1" = s."Id"
   AND s."Number" IN (77, 441)
   AND r."AttributeId" = '560931ad-0901-4342-b7f4-fd2e2fcc0563';  -- Stats.Level
