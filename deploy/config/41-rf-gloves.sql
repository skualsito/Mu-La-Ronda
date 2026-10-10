-- Mu La Ronda - el Rage Fighter no usa guantes de armadura.
--
-- En el MU original sus sets no tienen guantes (pelea con los guantes-arma);
-- los datos de OpenMU le dejaban equiparse los de Leather, Scale, Brass y
-- Plate. Se le sacan a sus dos clases (Rage Fighter y Fist Master).
-- Idempotente.

DELETE FROM config."ItemDefinitionCharacterClass" x
 USING config."ItemDefinition" d, config."CharacterClass" c
 WHERE x."ItemDefinitionId" = d."Id"
   AND x."CharacterClassId" = c."Id"
   AND d."Group" = 10
   AND c."Name" IN ('Rage Fighter', 'Fist Master');
