-- Mu La Ronda - sin detector de speed hack en la beta.
--
-- SpeedHackDetectPlugIn (A95A8D2F-...) viene activo con AutoBan: tira los
-- ataques que llegan mas rapido de lo que calcula para tu velocidad de
-- ataque y, a la tercera advertencia, banea la CUENTA. Con agilidad alta y
-- skills de area (cada objetivo alcanzado cuenta como un ataque) un jugador
-- normal lo dispara solo: asi se bloqueo la cuenta de prueba.
--
-- Para desbanear: deploy/tools/unban.sh <cuenta> (o el panel admin, Accounts).
DO $$
DECLARE
  speedhack uuid := 'a95a8d2f-a0c3-442e-995c-005b5c1b42d2';
BEGIN
  UPDATE config."PlugInConfiguration" SET "IsActive" = false WHERE "TypeId" = speedhack;

  -- Sin fila OpenMU lo crearia activo al arrancar: la dejamos creada apagada.
  IF NOT FOUND THEN
    INSERT INTO config."PlugInConfiguration" ("Id", "TypeId", "IsActive", "GameConfigurationId")
    SELECT gen_random_uuid(), speedhack, false, "Id" FROM config."GameConfiguration" LIMIT 1;
  END IF;
END $$;
