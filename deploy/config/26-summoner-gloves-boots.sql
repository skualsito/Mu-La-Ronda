-- Mu La Ronda - los guantes y las botas de los sets de Summoner (Mistery, Red
-- Wing, Ancient, Black Rose, Aura y Lilium: 10/39-44 y 11/39-44) son solo de
-- Summoner. La tabla del cliente (items.json) tambien los daba al Dark Wizard,
-- y 18-item-classes-sync.sql copio eso a la base: un mago podia ponerselos.
-- Se sacan Dark Wizard, Soul Master y Grand Master (0, 2, 3). Idempotente.

BEGIN;

DELETE FROM config."ItemDefinitionCharacterClass" x
 USING config."ItemDefinition" d, config."CharacterClass" c
 WHERE x."ItemDefinitionId" = d."Id"
   AND x."CharacterClassId" = c."Id"
   AND d."Group" IN (10, 11)
   AND d."Number" BETWEEN 39 AND 44
   AND c."Number" IN (0, 2, 3);

COMMIT;
