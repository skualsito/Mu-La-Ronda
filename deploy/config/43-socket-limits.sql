-- Mu La Ronda - limites del sistema de sockets, por balance.
--
-- * Ningun item tiene mas de 3 sockets (la Stinger Bow tenia 5): los drops
--   salen con 1 a 3, como en el editor del panel. Los items que ya tenian mas
--   quedan en 3 y pierden lo montado en el 4 y el 5. Lo montado queda entre
--   nivel 1 y 3.
-- * Las seed spheres llegan hasta nivel 3: el Seed Master solo arma seed
--   spheres con las Sphere (Mono), (Di) y (Tri), y el Seed Researcher solo
--   monta las de nivel 1 a 3. Las Sphere (4) y (5) ya no caian de monstruos.
-- Idempotente.

BEGIN;

UPDATE config."ItemDefinition" SET "MaximumSockets" = 3 WHERE "MaximumSockets" > 3;

DELETE FROM data."ItemOptionLink" l
 USING config."IncreasableItemOption" o
 WHERE o."Id" = l."ItemOptionId"
   AND l."Index" >= 3
   AND o."OptionTypeId" = 'aab309d3-cd97-4f77-ae1b-e9f904102502'::uuid; -- ItemOptionTypes.SocketOption
UPDATE data."Item" SET "SocketCount" = 3 WHERE "SocketCount" > 3;

-- Lo ya montado: el nivel del link es el de la esfera (1 a 3). OpenMU montaba con el tipo de
-- semilla como nivel (0 a 5, MountSeedSphereCrafting del overlay lo corrige).
UPDATE data."ItemOptionLink" l
   SET "Level" = LEAST(GREATEST(l."Level", 1), 3)
  FROM config."IncreasableItemOption" o
 WHERE o."Id" = l."ItemOptionId"
   AND o."OptionTypeId" = 'aab309d3-cd97-4f77-ae1b-e9f904102502'::uuid
   AND (l."Level" < 1 OR l."Level" > 3);

-- Seed Sphere Creation (43): la sphere (Reference 0x66) solo puede ser Mono, Di o Tri.
DELETE FROM config."ItemCraftingRequiredItemItemDefinition" x
 USING config."ItemCraftingRequiredItem" r, config."ItemCrafting" c, config."ItemDefinition" d
 WHERE r."Id" = x."ItemCraftingRequiredItemId"
   AND c."SimpleCraftingSettingsId" = r."SimpleCraftingSettingsId"
   AND d."Id" = x."ItemDefinitionId"
   AND c."Number" = 43 AND r."Reference" = 102
   AND d."Group" = 12 AND d."Number" IN (73, 74);

-- Mount Seed Sphere (44): la seed sphere (Reference 0x77) solo de nivel 1 a 3 (12/100-117).
DELETE FROM config."ItemCraftingRequiredItemItemDefinition" x
 USING config."ItemCraftingRequiredItem" r, config."ItemCrafting" c, config."ItemDefinition" d
 WHERE r."Id" = x."ItemCraftingRequiredItemId"
   AND c."SimpleCraftingSettingsId" = r."SimpleCraftingSettingsId"
   AND d."Id" = x."ItemDefinitionId"
   AND c."Number" = 44 AND r."Reference" = 119
   AND d."Group" = 12 AND d."Number" BETWEEN 118 AND 129;

COMMIT;
