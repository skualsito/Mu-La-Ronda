-- Mu La Ronda - items de quest: caen de los monstruos reales de cada quest.
--
-- OpenMU suma a cada kill los DropItemGroup de los items que pide la quest
-- activa (CharacterExtensions.GetQuestDropItemGroups). Cada item tiene su grupo
-- con el rango de nivel de monstruo (o el monstruo puntual) de MU original:
--
--   Quest 0  Scroll of the Emperor            monstruos nivel 45-60
--   Quest 1  Broken Sword / Tear of Elf /
--            Soul Shard of Wizard / etc.      monstruos nivel 62-76
--   Quest 2  Scroll of the Emperor +1         monstruos nivel 72-108
--   Quest 3  Broken Sword +1                  monstruos nivel 78-108
--   Quest 4  Flame of Death Beam Knight       solo Death Beam Knight (Tarkan)
--            Horn of Hell Maine               solo Hell Maine (Aida)
--            Feather of Dark Phoenix          solo Dark Phoenix (Icarus)
--
-- Una version anterior de este archivo los hacia caer de cualquier monstruo
-- (por eso en Devias caian todos): aca se restauran los valores originales de
-- forma explicita. Lo unico distinto de MU original es la chance: 10% por kill
-- (el original es 0,1%, impracticable en este server). Solo cae para quien
-- tiene la quest activa.
UPDATE config."DropItemGroup" g
   SET "MinimumMonsterLevel" = v.min_level,
       "MaximumMonsterLevel" = v.max_level,
       "MonsterId" = (SELECT m."Id" FROM config."MonsterDefinition" m WHERE m."Number" = v.monster LIMIT 1),
       "Chance" = 0.10
  FROM config."QuestItemRequirement" r
  JOIN config."QuestDefinition" q ON q."Id" = r."QuestDefinitionId"
  JOIN config."ItemDefinition" i ON i."Id" = r."ItemId",
       (VALUES
         (0, NULL::smallint, 45::smallint, 60::smallint,  NULL::smallint),
         (1, NULL,           62,           76,            NULL),
         (2, NULL,           72,           108,           NULL),
         (3, NULL,           78,           108,           NULL),
         (4, 65,             NULL,         NULL,          63),
         (4, 66,             NULL,         NULL,          309),
         (4, 67,             NULL,         NULL,          77)
       ) AS v(quest, item, min_level, max_level, monster)
 WHERE g."Id" = r."DropItemGroupId"
   AND q."Group" = 0
   AND q."Number" = v.quest
   AND i."Group" = 14
   AND (v.item IS NULL OR i."Number" = v.item);
