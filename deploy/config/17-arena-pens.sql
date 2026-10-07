-- Mu La Ronda - puertas de los corrales de Arena.
--
-- Los corrales con cerca al norte de Arena (/move arena) estan cerrados del
-- todo en el terreno de OpenMU (y en el del cliente), asi que no se podia
-- entrar. A cada uno se le abre una puerta de 2 celdas en el lado que da al
-- pasillo, como los tiene el Arena del server de referencia. Se cambia el
-- terreno guardado en la base (GameMapDefinition."TerrainData": 3 bytes de
-- cabecera y despues una celda por byte, y * 256 + x; 0 = caminable). El
-- cliente abre las mismas celdas (src/common/terrain/arenaPenDoors.ts, con un
-- test que compara las dos listas). Idempotente.

BEGIN;

DO $$
DECLARE
  data bytea;
  cell record;
BEGIN
  SELECT "TerrainData" INTO data FROM config."GameMapDefinition" WHERE "Number" = 6;
  IF data IS NULL OR length(data) < 3 + 65536 THEN
    RAISE NOTICE 'Arena (mapa 6) sin terreno: puertas de los corrales omitidas';
    RETURN;
  END IF;

  FOR cell IN
    SELECT * FROM (VALUES
    (16, 38), (17, 38), (16, 39), (17, 39),
    (23, 38), (24, 38), (23, 39), (24, 39),
    (41, 39), (41, 40), (16, 56), (17, 56),
    (16, 57), (17, 57), (23, 56), (24, 56),
    (23, 57), (24, 57), (41, 57), (41, 58),
    (16, 74), (17, 74), (16, 75), (17, 75),
    (23, 74), (24, 74), (23, 75), (24, 75),
    (41, 82), (41, 83), (17, 92), (18, 92),
    (17, 93), (18, 93), (23, 92), (24, 92),
    (23, 93), (24, 93)
    ) AS t(x, y)
  LOOP
    data := set_byte(data, 3 + cell.y * 256 + cell.x, 0);
  END LOOP;

  UPDATE config."GameMapDefinition" SET "TerrainData" = data WHERE "Number" = 6;
END $$;

COMMIT;
