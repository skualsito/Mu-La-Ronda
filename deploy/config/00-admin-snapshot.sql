-- Mu La Ronda - lo que se toca a mano en el panel admin no lo pisa un deploy.
--
-- El panel guarda cada valor de configuracion que cambia (experiencia,
-- niveles, drop, resets, comandos, el exp de cada mapa...) en
-- mlr.config_overrides, y 99-admin-config.sql los vuelve a poner al final de
-- cada deploy, despues de que los otros .sql hicieron lo suyo.
--
-- Este archivo corre primero y UNA sola vez (marca 'admin_overrides_snapshot'):
-- fija lo que ya estaba en la base de los campos que un .sql de aca tambien
-- escribe (01-game, 05-anticheat, 06-leveling, 10-vip), por si se cambiaron a
-- mano antes de que el panel los guardara. En una base nueva no hay nada que
-- conservar y solo deja la marca.
--
-- Para que un deploy vuelva a mandar en un campo, borrar su fila:
--   DELETE FROM mlr.config_overrides WHERE "Table" = 'GameConfiguration' AND "Column" = 'ExperienceRate';

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE IF NOT EXISTS mlr.config_overrides (
  "Table"     text NOT NULL,
  "KeyColumn" text NOT NULL DEFAULT '',
  "Key"       text NOT NULL DEFAULT '',
  "Column"    text NOT NULL,
  "Value"     text,
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("Table", "KeyColumn", "Key", "Column"));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'admin_overrides_snapshot') THEN
    RETURN;
  END IF;

  -- Una base que ya paso por deploys anteriores (si no, todavia tiene lo de OpenMU).
  IF EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'leveling_spots_seeded') THEN
    INSERT INTO mlr.config_overrides ("Table", "Column", "Value")
    SELECT 'GameConfiguration', c.col, c.val
      FROM config."GameConfiguration" g
     CROSS JOIN LATERAL (VALUES
       ('ExperienceRate', g."ExperienceRate"::text),
       ('MasterExperienceRate', g."MasterExperienceRate"::text),
       ('MaximumLevel', g."MaximumLevel"::text),
       ('MaximumMasterLevel', g."MaximumMasterLevel"::text),
       ('PreventExperienceOverflow', g."PreventExperienceOverflow"::text)) AS c(col, val)
    ON CONFLICT DO NOTHING;

    INSERT INTO mlr.config_overrides ("Table", "KeyColumn", "Key", "Column", "Value")
    SELECT 'GameMapDefinition', 'Id', m."Id"::text, 'ExpMultiplier', m."ExpMultiplier"::text
      FROM config."GameMapDefinition" m WHERE m."Number" = 6
    ON CONFLICT DO NOTHING;

    -- Resets, sus comandos, el detector de speed hack y los de VIP.
    INSERT INTO mlr.config_overrides ("Table", "KeyColumn", "Key", "Column", "Value")
    SELECT 'PlugInConfiguration', 'TypeId', p."TypeId"::text, 'IsActive', p."IsActive"::text
      FROM config."PlugInConfiguration" p
     WHERE p."TypeId" IN (
       '6a9d585d-79d7-4674-b6ea-7e87392fa501', '90b35404-aade-4f22-b5d2-4cd59b8bb4c8',
       '79f2c2c2-2e4c-4f4b-8a74-4227d1209d27', '08953be6-dabf-49cc-a500-fdb9dc2c4d80',
       '5e0c2b7a-3d41-4f6b-9a28-7c1e4d9b0a53', 'a95a8d2f-a0c3-442e-995c-005b5c1b42d2',
       '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c24', '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c25',
       '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c26')
    ON CONFLICT DO NOTHING;

    INSERT INTO mlr.config_overrides ("Table", "KeyColumn", "Key", "Column", "Value")
    SELECT 'PlugInConfiguration', 'TypeId', p."TypeId"::text, 'CustomConfiguration', p."CustomConfiguration"
      FROM config."PlugInConfiguration" p
     WHERE p."TypeId" = '6a9d585d-79d7-4674-b6ea-7e87392fa501' AND p."CustomConfiguration" IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO mlr.settings (key, value) VALUES ('admin_overrides_snapshot', now()::text);
END $$;

COMMIT;
