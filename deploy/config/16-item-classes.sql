-- Mu La Ronda - clases que pueden equiparse ciertos items.
--
-- Staff of Kundun (5/11): en MU original (ItemList.xml: DarkWizard=2,
-- MagicGladiator=1) lo usan Soul Master y Grand Master, y Magic Gladiator /
-- Duel Master. En esta base solo lo aceptaba el Grand Master. Se agregan las
-- clases que falten (no se saca ninguna). Idempotente.
INSERT INTO config."ItemDefinitionCharacterClass" ("ItemDefinitionId", "CharacterClassId")
SELECT d."Id", c."Id"
  FROM config."ItemDefinition" d
  JOIN config."CharacterClass" c ON c."Number" IN (2, 3, 12, 13)  -- SM, GM, MG, DM
 WHERE d."Group" = 5 AND d."Number" = 11
   AND NOT EXISTS (SELECT 1 FROM config."ItemDefinitionCharacterClass" x
                    WHERE x."ItemDefinitionId" = d."Id" AND x."CharacterClassId" = c."Id");
