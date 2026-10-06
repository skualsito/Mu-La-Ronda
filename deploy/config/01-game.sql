-- Mu La Ronda - configuracion del juego (OpenMU, esquema "config").
--
-- Se aplica sola en cada deploy si este archivo cambio (deploy/apply-config.sh)
-- y despues se reinicia OpenMU, que lee la configuracion al arrancar.
-- Tiene que ser idempotente: correrlo dos veces deja lo mismo.
--
-- Lo que se cambie aca pisa lo que se haya tocado a mano en el panel admin
-- para estos mismos campos.

BEGIN;

-- ─── Experiencia y niveles ──────────────────────────────────────────────────
-- Exp efectiva = GameConfiguration.ExperienceRate × GameServerDefinition.ExperienceRate
-- (y lo mismo para Master con MasterExperienceRate).
UPDATE config."GameConfiguration" SET
  "ExperienceRate"       = 9999,
  "MasterExperienceRate" = 9999,
  "MaximumLevel"         = 400,
  "MaximumMasterLevel"   = 200,
  -- Un solo nivel por bicho: la experiencia que sobra al subir se descarta
  -- (PlayerExperience.cs). Solo aplica a la experiencia normal, no a la master.
  "PreventExperienceOverflow" = true;

-- ─── Un solo canal ──────────────────────────────────────────────────────────
-- OpenMU crea 3 game servers al instalar; dejamos solo el 0 (puertos 55901/55902).
DELETE FROM config."GameServerEndpoint"
 WHERE "GameServerDefinitionId" IN (
   SELECT "Id" FROM config."GameServerDefinition" WHERE "ServerID" > 0);
DELETE FROM config."GameServerDefinition" WHERE "ServerID" > 0;

UPDATE config."GameServerDefinition" SET
  "Description"    = 'Mu La Ronda',
  "ExperienceRate" = 1,
  "PvpEnabled"     = true
 WHERE "ServerID" = 0;

-- ─── Resets ─────────────────────────────────────────────────────────────────
-- ResetFeaturePlugIn (6A9D585D-...). Viene desactivado. Los jugadores resetean
-- con /reset (o hablando con Leo the Helper) y ven su estado con /resetinfo.
--
-- RequiredMoney se multiplica por la cantidad de resets (reset 5 = 5.000.000).
-- Puntos: ReplacePointsPerReset + MultiplyPointsByResetCount => despues del
-- reset N el personaje tiene PointsPerReset × N puntos libres.
DO $$
DECLARE
  reset_type uuid := '6a9d585d-79d7-4674-b6ea-7e87392fa501';
  reset_cfg  text := '{
    "ResetLimit": null,
    "RequiredLevel": 400,
    "LevelAfterReset": 1,
    "RequiredMoney": 1000000,
    "MultiplyRequiredMoneyByResetCount": true,
    "RequiredResetItem": null,
    "ItemCostTiers": [],
    "ResetStats": true,
    "PointsPerReset": 500,
    "MultiplyPointsByResetCount": true,
    "ReplacePointsPerReset": true,
    "PointsTiers": [],
    "MoveHome": true,
    "LogOut": true
  }';
BEGIN
  UPDATE config."PlugInConfiguration"
     SET "IsActive" = true, "CustomConfiguration" = reset_cfg
   WHERE "TypeId" = reset_type;

  IF NOT FOUND THEN
    INSERT INTO config."PlugInConfiguration" ("Id", "TypeId", "IsActive", "CustomConfiguration", "GameConfigurationId")
    SELECT gen_random_uuid(), reset_type, true, reset_cfg, "Id"
      FROM config."GameConfiguration" LIMIT 1;
  END IF;
END $$;

-- Los comandos de reset (/reset, /resetinfo) y Leo the Helper, por si quedaron
-- desactivados en la base: OpenMU ignora en silencio un comando cuyo plugin
-- no esta activo.
UPDATE config."PlugInConfiguration" SET "IsActive" = true
 WHERE "TypeId" IN (
   '90b35404-aade-4f22-b5d2-4cd59b8bb4c8',  -- ResetChatCommandPlugIn
   '79f2c2c2-2e4c-4f4b-8a74-4227d1209d27',  -- ResetInfoChatCommandPlugIn
   '08953be6-dabf-49cc-a500-fdb9dc2c4d80'); -- ResetCharacterNpcPlugin

COMMIT;
