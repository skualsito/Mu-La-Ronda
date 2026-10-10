-- Mu La Ronda - los personajes nuevos arrancan sin armas.
--
-- OpenMU les da un arma (y escudo) a cada clase al crearla: Small Axe al DK,
-- Short Bow y flechas a la Elfa, Short Sword y Small Shield al DL y al MG.
-- Con el kit de inicio (set excelente +9 y alas, MlrStarterKitPlugIn) las
-- armas se compran en las tiendas. Se apagan esos plugins; el Ring of Warrior
-- y los skills iniciales quedan. Idempotente.

UPDATE config."PlugInConfiguration"
   SET "IsActive" = false
 WHERE "TypeId" IN (
   '2377c222-4418-4f17-8388-1f8825e6243c', -- AddSmallAxeForDarkKnight
   '9ef17296-0436-4059-bc4e-0a71967f36ec', -- AddShortBowForFairyElf
   '71b6eb8d-e676-4b22-9e7e-15c7c3969852', -- AddArrowsForFairyElf
   'bac120d0-d981-4ebb-8f5a-0ec19434af16', -- AddShortSwordForDarkLord
   '3d2790e3-b757-46fd-8618-2441b7e9e2b3', -- AddShortSwordForMagicGladiator
   'cd60bd4a-2bd5-4e36-95d0-edb6b94cddd8', -- AddSmallShieldForDarkLord
   '74fc7d85-7aa0-4437-88ba-ce008fd31745'  -- AddSmallShieldForMagicGladiator
 );
