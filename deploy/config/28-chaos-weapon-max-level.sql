-- Mu La Ronda - el Arma Chaos ya no se come items +9 o mas.
--
-- El Chaos Goblin adivina la combinacion por lo que hay en la maquina, de la
-- de numero mas alto a la mas baja. El Arma Chaos (numero 1) aceptaba cualquier
-- item +4 con opcion, sin tope, y las Joyas de Bendicion y Alma como opcionales:
-- unos guantes +10 con 1 Bendicion y 1 Alma no llegaban al +11 (pide 2 y 2) y
-- terminaban siendo un Chaos Nature Bow. Con el tope en +8 una subida de +10 a
-- +15 mal armada da "faltan items" en vez de perder el item. Idempotente.

BEGIN;

UPDATE config."ItemCraftingRequiredItem" r
   SET "MaximumItemLevel" = 8
  FROM config."ItemCrafting" c
 WHERE r."SimpleCraftingSettingsId" = c."SimpleCraftingSettingsId"
   AND c."Number" = 1
   AND c."Name" = 'Chaos Weapon'
   AND r."MinimumItemLevel" = 4;

COMMIT;
