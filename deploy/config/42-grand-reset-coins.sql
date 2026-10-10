-- Mu La Ronda - Grand Reset por resets.
--
-- El Grand Reset daba siempre lo mismo (1 grand reset y CoinsPerGrandReset
-- monedas, 100) sin importar los resets: alguien con 240 resets se llevo 100
-- monedas. Ahora da 10 monedas y 1 grand reset por cada 10 resets (240 resets:
-- 2400 monedas y 24 grand resets), y CoinsPerGrandReset queda como extra (0).
-- La config ya guardada (y lo fijado desde el panel) se pasa una sola vez a
-- esos valores; despues se cambian desde Configuracion > Resets.

BEGIN;

DO $$
DECLARE
  grand_type uuid := 'e2b7c4d1-6a3f-4e58-9b0c-1d2e3f4a5b6c';
  patch jsonb := '{"CoinsPerReset": 10, "CoinsPerGrandReset": 0, "ResetsPerGrandReset": 10}';
BEGIN
  IF EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'grand_reset_per_reset') THEN
    RETURN;
  END IF;

  -- Sin "$id": OpenMU lo acepta solo como primera propiedad, y jsonb reordena.
  UPDATE config."PlugInConfiguration"
     SET "CustomConfiguration" = jsonb_pretty((COALESCE(NULLIF("CustomConfiguration", ''), '{}')::jsonb - '$id') || patch)
   WHERE "TypeId" = grand_type;

  -- Lo fijado desde el panel (00-admin-snapshot.sql) tambien, o 99-admin-config.sql lo volveria atras.
  IF to_regclass('mlr.config_overrides') IS NOT NULL THEN
    UPDATE mlr.config_overrides
       SET "Value" = jsonb_pretty((COALESCE(NULLIF("Value", ''), '{}')::jsonb - '$id') || patch), "UpdatedAt" = now()
     WHERE "Table" = 'PlugInConfiguration' AND lower("Key") = grand_type::text AND "Column" = 'CustomConfiguration';
  END IF;

  INSERT INTO mlr.settings (key, value) VALUES ('grand_reset_per_reset', now()::text);
END $$;

COMMIT;
