-- Mu La Ronda - items de quest que de verdad caen.
--
-- OpenMU suma a cada kill los DropItemGroup de los items que pide la quest
-- activa (CharacterExtensions.GetQuestDropItemGroups), pero los de las quests
-- clasicas vienen con 0,1% por kill y solo de monstruos de cierto nivel
-- (Scroll of the Emperor: nivel 45-60; Broken Sword / Scroll +1: 72-108).
-- En este server se levelea en Arena con bichos de nivel 26/28 y 60+, asi que
-- con la quest activa practicamente no caian nunca.
--
-- Ahora: 10% por kill (o lo que ya tuvieran si era mas) y de cualquier nivel
-- de monstruo. Los que salen de un monstruo puntual (Balram, Dark Elf...)
-- siguen atados a ese monstruo. Solo afecta a quien tiene la quest activa.
UPDATE config."DropItemGroup" g
   SET "Chance" = GREATEST(g."Chance", 0.10),
       "MinimumMonsterLevel" = NULL,
       "MaximumMonsterLevel" = NULL
 WHERE g."Id" IN (SELECT "DropItemGroupId" FROM config."QuestItemRequirement" WHERE "DropItemGroupId" IS NOT NULL);
