-- Mu La Ronda - el ring de Lorencia.
--
-- En el medio de Lorencia, donde estaba la fuente con la estatua, queda un
-- ring de 8x8 (x 137-144, y 124-131) para pelear: las celdas pasan a ser
-- caminables y fuera de la zona segura, asi se puede pegar a otro jugador
-- adentro. Afuera sigue todo siendo zona segura. Matar adentro del ring no
-- da PK (LorenciaRing.cs / Player.cs en marketplace/openmu). Se cambia el
-- terreno guardado en la base (GameMapDefinition."TerrainData": 3 bytes de
-- cabecera y despues una celda por byte, y * 256 + x; 0 = caminable y sin
-- zona segura). El cliente dibuja el ring, saca la fuente y abre las mismas
-- celdas (src/common/terrain/lorenciaRing.ts, con un test que compara el
-- rectangulo). Idempotente.

BEGIN;

DO $$
DECLARE
  data bytea;
  x int;
  y int;
BEGIN
  SELECT "TerrainData" INTO data FROM config."GameMapDefinition" WHERE "Number" = 0;
  IF data IS NULL OR length(data) < 3 + 65536 THEN
    RAISE NOTICE 'Lorencia (mapa 0) sin terreno: ring omitido';
    RETURN;
  END IF;

  FOR y IN 124..131 LOOP
    FOR x IN 137..144 LOOP
      data := set_byte(data, 3 + y * 256 + x, 0);
    END LOOP;
  END LOOP;

  UPDATE config."GameMapDefinition" SET "TerrainData" = data WHERE "Number" = 0;
END $$;

COMMIT;
