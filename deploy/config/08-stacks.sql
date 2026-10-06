-- Mu La Ronda - pociones apilables hasta 255.
--
-- OpenMU usa la durabilidad del ItemDefinition como tope de la pila
-- (ItemExtensions.IsStackable / CanCompletelyStackOn), y las pociones vienen
-- con 3. La durabilidad viaja en un byte, asi que 255 es el maximo posible.
-- Las pilas que ya existen no cambian: solo crece el tope.
UPDATE config."ItemDefinition"
   SET "Durability" = 255
 WHERE "Group" = 14
   AND "Durability" BETWEEN 2 AND 254
   AND "Number" IN (0, 1, 2, 3, 4, 5, 6,  -- manzana, pociones de vida y de mana
                    8, 9,                  -- antidoto, cerveza
                    35, 36, 37,            -- pociones de SD
                    38, 39, 40,            -- pociones complejas
                    70, 71);               -- pociones elite
