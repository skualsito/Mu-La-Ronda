-- Mu La Ronda - puertas de los corrales de Arena.
--
-- Los corrales con cerca al norte de Arena (/move arena) estan cerrados del
-- todo en el terreno de OpenMU (y en el del cliente), asi que no se podia
-- entrar. Se abren donde la cerca dibujada tiene la entrada: las celdas de
-- las paredes de los corrales sin ninguna pieza de cerca encima (Object11 en
-- EncTerrain7.obj). Se cambia el
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

  -- La primera version abrio puertas donde la cerca no tiene entrada: vuelven
  -- a ser pared (4, el valor original del terreno).
  FOR cell IN
    SELECT * FROM (VALUES
    (23, 38, 4), (24, 38, 4), (23, 39, 4), (24, 39, 4), (41, 39, 4), (41, 40, 4),
    (23, 56, 4), (24, 56, 4), (23, 57, 4), (24, 57, 4), (41, 57, 4), (41, 58, 4),
    (23, 74, 4), (24, 74, 4), (23, 75, 4), (24, 75, 4), (41, 82, 4), (41, 83, 4),
    (17, 92, 4), (18, 92, 4), (17, 93, 4), (18, 93, 4), (23, 92, 4), (24, 92, 4),
    (23, 93, 4), (24, 93, 4)
    ) AS t(x, y, v)
  LOOP
    data := set_byte(data, 3 + cell.y * 256 + cell.x, cell.v);
  END LOOP;

  FOR cell IN
    SELECT * FROM (VALUES
    (16, 37), (17, 37), (35, 37), (36, 37), (53, 37), (54, 37),
    (16, 38), (35, 38), (53, 38), (16, 39), (35, 39), (53, 39),
    (16, 40), (17, 40), (35, 40), (36, 40), (53, 40), (54, 40),
    (16, 55), (17, 55), (35, 55), (36, 55), (53, 55), (54, 55),
    (16, 56), (35, 56), (53, 56), (16, 57), (35, 57), (53, 57),
    (16, 58), (17, 58), (35, 58), (36, 58), (53, 58), (54, 58),
    (16, 73), (17, 73), (35, 73), (36, 73), (16, 74), (35, 74),
    (16, 75), (35, 75), (16, 76), (17, 76), (35, 76), (36, 76),
    (53, 80), (54, 80), (53, 81), (53, 82), (53, 83), (54, 83),
    (15, 85), (16, 85), (28, 85), (31, 85), (15, 86), (16, 86),
    (17, 86), (28, 86), (29, 86), (30, 86), (31, 86), (17, 87),
    (18, 87), (44, 92), (45, 92)
    ) AS t(x, y)
  LOOP
    data := set_byte(data, 3 + cell.y * 256 + cell.x, 0);
  END LOOP;

  UPDATE config."GameMapDefinition" SET "TerrainData" = data WHERE "Number" = 6;
END $$;

COMMIT;
