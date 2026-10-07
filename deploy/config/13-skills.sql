-- Mu La Ronda - los skills no piden nivel.
--
-- En OpenMU muchos skills piden un nivel minimo para usarse (SkillsInitializer:
-- Infinity Arrow 220, Recovery 100, Nova 100, Swell Life 120, Fire Breath 110,
-- Plasma Storm 110, etc.). En un server con resets el personaje vuelve a nivel 1
-- con esos skills ya aprendidos, y el servidor se los rechazaba (Player.cs:
-- skill.Requirements) hasta volver a ese nivel. Aca se saca el requisito de
-- nivel de todos los skills: si lo tenes aprendido, lo podes usar. Los demas
-- requisitos (energia, etc.) quedan. Idempotente.
DELETE FROM config."AttributeRequirement" r
 WHERE r."SkillId1" IS NOT NULL
   AND r."AttributeId" = '560931ad-0901-4342-b7f4-fd2e2fcc0563';  -- Stats.Level
