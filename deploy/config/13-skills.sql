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

-- Ni la quest "Gain Hero Status" (Marlon): la Crystal of Destruction (12/44,
-- Strike of Destruction del Blade Knight; "Orb of Explotion" en el cliente)
-- la pedia y con resets casi nadie la tiene, asi que no se podia aprender.
DELETE FROM config."AttributeRequirement" r
 WHERE r."AttributeId" = '4a847231-171b-4fe2-a203-009cb4a26227';  -- Stats.GainHeroStatusQuestCompleted
