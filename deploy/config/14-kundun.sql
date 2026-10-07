-- Mu La Ronda - Box of Kundun +1..+5: siempre un item excelente, nunca zen.
--
-- En OpenMU (VersionSeasonSix/Items/BoxOfLuck.cs) la Box of Luck (14/11) de
-- nivel 8 a 12 es la Box of Kundun +1..+5: cada una tiene un grupo de items
-- excelentes de su nivel (Kundun+1 armas y sets bajos ... Kundun+5 los mas
-- altos) con 20% de chance, y si no sale, un grupo de zen (AddMoneyDropFallback).
-- Aca el grupo excelente pasa a 100% y el de zen se borra: al abrirla siempre
-- cae un excelente de la lista de esa caja. Idempotente.
BEGIN;

UPDATE config."ItemDropItemGroup" g
   SET "Chance" = 1.0
  FROM config."ItemDefinition" d
 WHERE g."ItemDefinitionId" = d."Id"
   AND d."Group" = 14 AND d."Number" = 11
   AND g."SourceItemLevel" BETWEEN 8 AND 12
   AND g."ItemType" = 2;   -- SpecialItemType.Excellent

DELETE FROM config."ItemDropItemGroup" g
 USING config."ItemDefinition" d
 WHERE g."ItemDefinitionId" = d."Id"
   AND d."Group" = 14 AND d."Number" = 11
   AND g."SourceItemLevel" BETWEEN 8 AND 12
   AND g."ItemType" = 5;   -- SpecialItemType.Money

COMMIT;
