-- Mu La Ronda - items de quest que de verdad caen.
--
-- OpenMU suma a cada kill los DropItemGroup de los items que pide la quest
-- activa (CharacterExtensions.GetQuestDropItemGroups), pero los de las quests
-- clasicas vienen con 0,1% por kill y solo de monstruos de cierto nivel
-- (Scroll of the Emperor: nivel 45-60; Broken Sword / Scroll +1: 72-108).
-- Y los de la 3ra quest (Evidence of Strength, Apostle Devin) solo caen de un
-- jefe puntual, que en todo el juego tiene un unico spawn:
--   Flame of Death Beam Knight -> Death Beam Knight (Tarkan, 3%)
--   Horn of Hell Maine         -> Hell Maine (Aida, 4%)
--   Feather of Dark Phoenix    -> Dark Phoenix (Icarus, 5%)
-- En este server se levelea en Arena con bichos de nivel 26/28 y 60+, asi que
-- con la quest activa practicamente no caian nunca.
--
-- Ahora: 10% por kill (o lo que ya tuvieran si era mas), de cualquier nivel
-- de monstruo y de cualquier monstruo (el jefe tambien sigue soltandolo).
-- Solo afecta a quien tiene la quest activa.
UPDATE config."DropItemGroup" g
   SET "Chance" = GREATEST(g."Chance", 0.10),
       "MinimumMonsterLevel" = NULL,
       "MaximumMonsterLevel" = NULL,
       "MonsterId" = NULL
 WHERE g."Id" IN (SELECT "DropItemGroupId" FROM config."QuestItemRequirement" WHERE "DropItemGroupId" IS NOT NULL);
