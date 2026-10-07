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
-- (el original es 0,1%, impracticable en este server), y los tres items de la
-- 3ra quest de cambio de clase (quest 4, Evidence of Strength) caen siempre
-- (100%) de su jefe, que tiene un unico spawn. Solo cae para quien tiene la
-- quest activa.
UPDATE config."DropItemGroup" g
   SET "MinimumMonsterLevel" = v.min_level,
       "MaximumMonsterLevel" = v.max_level,
       "MonsterId" = (SELECT m."Id" FROM config."MonsterDefinition" m WHERE m."Number" = v.monster LIMIT 1),
       "Chance" = v.chance
  FROM config."QuestItemRequirement" r
  JOIN config."QuestDefinition" q ON q."Id" = r."QuestDefinitionId"
  JOIN config."ItemDefinition" i ON i."Id" = r."ItemId",
       (VALUES
         (0, NULL::smallint, 45::smallint, 60::smallint,  NULL::smallint, 0.10::float8),
         (1, NULL,           62,           76,            NULL,           0.10),
         (2, NULL,           72,           108,           NULL,           0.10),
         (3, NULL,           78,           108,           NULL,           0.10),
         (4, 65,             NULL,         NULL,          63,             1.0),
         (4, 66,             NULL,         NULL,          309,            1.0),
         (4, 67,             NULL,         NULL,          77,             1.0)
       ) AS v(quest, item, min_level, max_level, monster, chance)
 WHERE g."Id" = r."DropItemGroupId"
   AND q."Group" = 0
   AND q."Number" = v.quest
   AND i."Group" = 14
   AND (v.item IS NULL OR i."Number" = v.item);

-- Los tres jefes de la 3ra quest tienen pocos spawns (Death Beam Knight uno
-- solo en Tarkan, con 150 s de respawn): reaparecen a los 30 segundos. Para
-- poner mas, se agregan spots desde el panel admin.
UPDATE config."MonsterDefinition"
   SET "RespawnDelay" = interval '30 seconds'
 WHERE "Number" IN (63, 309, 77)
   AND "RespawnDelay" > interval '30 seconds';
