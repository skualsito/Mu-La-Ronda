-- Mu La Ronda - la configuracion cambiada en el panel admin gana.
--
-- El panel (admin/server/game.ts, pin) guarda cada valor que cambia en
-- mlr.config_overrides: la tabla de config."...", que fila (KeyColumn = Key,
-- o todas si estan vacios), la columna y el valor como texto. Este archivo
-- corre ultimo (99-) y los vuelve a poner, asi lo que otro .sql de aca haya
-- puesto en esos campos no pisa lo del panel. Ver 00-admin-snapshot.sql.
-- Idempotente.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.config_overrides (
  "Table"     text NOT NULL,
  "KeyColumn" text NOT NULL DEFAULT '',
  "Key"       text NOT NULL DEFAULT '',
  "Column"    text NOT NULL,
  "Value"     text,
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("Table", "KeyColumn", "Key", "Column"));

DO $$
DECLARE
  o record;
BEGIN
  FOR o IN SELECT * FROM mlr.config_overrides ORDER BY "UpdatedAt" LOOP
    BEGIN
      IF o."KeyColumn" = '' THEN
        EXECUTE format('UPDATE config.%I SET %I = %L', o."Table", o."Column", o."Value");
      ELSE
        EXECUTE format('UPDATE config.%I SET %I = %L WHERE %I::text = %L',
                       o."Table", o."Column", o."Value", o."KeyColumn", o."Key");
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column OR invalid_text_representation THEN
      -- Una columna que OpenMU ya no tiene no frena el deploy.
      RAISE NOTICE 'mlr.config_overrides: no se pudo aplicar %.% (%): %', o."Table", o."Column", o."Key", SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
