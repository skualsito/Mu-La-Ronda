-- Mu La Ronda - puertas de salida / reaparicion sin celdas bloqueadas.
--
-- OpenMU elige un punto al azar dentro del rectangulo de la puerta
-- (ExitGateExtensions.GetRandomPoint) sin mirar el terreno. Varios
-- rectangulos de Season 6 incluyen paredes o vacio, y ahi aparecia el
-- personaje trabado: sobre todo en Arena/Stadium, donde dos de las tres
-- puertas de reaparicion eran directamente una celda bloqueada.
--
-- Generado comparando cada puerta de VersionSeasonSix/Gates.cs con el
-- terreno del cliente (Data/World*/EncTerrain*.att, celdas NoMove/NoGround):
-- cada puerta con celdas bloqueadas pasa al rectangulo mas grande que es
-- todo caminable dentro de ella (o a la celda caminable mas cercana).
-- Idempotente: cada UPDATE busca las coordenadas originales.

BEGIN;

-- gate 17, map 0: 52 of 342 cells blocked
UPDATE config."ExitGate" g SET "X1" = 137, "Y1" = 118, "X2" = 151, "Y2" = 123
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 0 AND g."X1" = 133 AND g."Y1" = 118 AND g."X2" = 151 AND g."Y2" = 135;

-- gate 8, map 1: 1 of 6 cells blocked
UPDATE config."ExitGate" g SET "X1" = 240, "Y1" = 149, "X2" = 241, "Y2" = 150
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 1 AND g."X1" = 240 AND g."Y1" = 149 AND g."X2" = 241 AND g."Y2" = 151;

-- gate 22, map 2: 9 of 352 cells blocked
UPDATE config."ExitGate" g SET "X1" = 198, "Y1" = 35, "X2" = 212, "Y2" = 50
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 2 AND g."X1" = 197 AND g."Y1" = 35 AND g."X2" = 218 AND g."Y2" = 50;

-- gate 48, map 3: 1 of 8 cells blocked
UPDATE config."ExitGate" g SET "X1" = 240, "Y1" = 240, "X2" = 241, "Y2" = 242
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 3 AND g."X1" = 240 AND g."Y1" = 240 AND g."X2" = 241 AND g."Y2" = 243;

-- gate 122, map 3: 2 of 28 cells blocked
UPDATE config."ExitGate" g SET "X1" = 220, "Y1" = 32, "X2" = 226, "Y2" = 34
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 3 AND g."X1" = 220 AND g."Y1" = 31 AND g."X2" = 226 AND g."Y2" = 34;

-- gate 50, map 6: 3 of 9 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 115, "X2" = 102, "Y2" = 117
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 6 AND g."X1" = 101 AND g."Y1" = 115 AND g."X2" = 103 AND g."Y2" = 117;

-- gate 51, map 6: 1 of 1 cells blocked
UPDATE config."ExitGate" g SET "X1" = 102, "Y1" = 114, "X2" = 102, "Y2" = 114
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 6 AND g."X1" = 107 AND g."Y1" = 115 AND g."X2" = 107 AND g."Y2" = 115;

-- gate 52, map 6: 1 of 1 cells blocked
UPDATE config."ExitGate" g SET "X1" = 102, "Y1" = 114, "X2" = 102, "Y2" = 114
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 6 AND g."X1" = 107 AND g."Y1" = 114 AND g."X2" = 107 AND g."Y2" = 114;

-- gate 49, map 7: 1 of 169 cells blocked
UPDATE config."ExitGate" g SET "X1" = 15, "Y1" = 11, "X2" = 27, "Y2" = 22
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 7 AND g."X1" = 15 AND g."Y1" = 11 AND g."X2" = 27 AND g."Y2" = 23;

-- gate 57, map 8: 1 of 119 cells blocked
UPDATE config."ExitGate" g SET "X1" = 188, "Y1" = 63, "X2" = 203, "Y2" = 69
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 8 AND g."X1" = 187 AND g."Y1" = 63 AND g."X2" = 203 AND g."Y2" = 69;

-- gate 54, map 8: 8 of 20 cells blocked
UPDATE config."ExitGate" g SET "X1" = 248, "Y1" = 40, "X2" = 250, "Y2" = 43
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 8 AND g."X1" = 248 AND g."Y1" = 40 AND g."X2" = 251 AND g."Y2" = 44;

-- gate 94, map 30: 22 of 240 cells blocked
UPDATE config."ExitGate" g SET "X1" = 88, "Y1" = 31, "X2" = 95, "Y2" = 46
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 88 AND g."Y1" = 31 AND g."X2" = 102 AND g."Y2" = 46;

-- gate 100, map 30: 224 of 3848 cells blocked
UPDATE config."ExitGate" g SET "X1" = 62, "Y1" = 27, "X2" = 121, "Y2" = 38
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 39 AND g."Y1" = 14 AND g."X2" = 142 AND g."Y2" = 50;

-- gate 101, map 30: 131 of 731 cells blocked
UPDATE config."ExitGate" g SET "X1" = 92, "Y1" = 184, "X2" = 95, "Y2" = 222
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 84 AND g."Y1" = 180 AND g."X2" = 100 AND g."Y2" = 222;

-- gate 104, map 30: 40 of 336 cells blocked
UPDATE config."ExitGate" g SET "X1" = 87, "Y1" = 215, "X2" = 100, "Y2" = 220
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 87 AND g."Y1" = 209 AND g."X2" = 100 AND g."Y2" = 232;

-- gate 105, map 30: 1262 of 6270 cells blocked
UPDATE config."ExitGate" g SET "X1" = 89, "Y1" = 10, "X2" = 95, "Y2" = 112
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 72 AND g."Y1" = 10 AND g."X2" = 104 AND g."Y2" = 199;

-- gate 97, map 30: 16 of 288 cells blocked
UPDATE config."ExitGate" g SET "X1" = 164, "Y1" = 198, "X2" = 174, "Y2" = 209
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 164 AND g."Y1" = 198 AND g."X2" = 187 AND g."Y2" = 209;

-- gate 103, map 30: 2 of 12 cells blocked
UPDATE config."ExitGate" g SET "X1" = 29, "Y1" = 39, "X2" = 30, "Y2" = 42
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 30 AND g."X1" = 29 AND g."Y1" = 37 AND g."X2" = 30 AND g."Y2" = 42;

-- gate 95, map 31: 2 of 100 cells blocked
UPDATE config."ExitGate" g SET "X1" = 60, "Y1" = 10, "X2" = 68, "Y2" = 14
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 31 AND g."X1" = 60 AND g."Y1" = 10 AND g."X2" = 69 AND g."Y2" = 19;

-- gate 118, map 34: 8 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 229, "Y1" = 37, "X2" = 237, "Y2" = 45
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 34 AND g."X1" = 229 AND g."Y1" = 37 AND g."X2" = 239 AND g."Y2" = 46;

-- gate 119, map 33: 2 of 42 cells blocked
UPDATE config."ExitGate" g SET "X1" = 82, "Y1" = 8, "X2" = 87, "Y2" = 13
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 33 AND g."X1" = 82 AND g."Y1" = 8 AND g."X2" = 87 AND g."Y2" = 14;

-- gate 113, map 33: 11 of 24 cells blocked
UPDATE config."ExitGate" g SET "X1" = 76, "Y1" = 9, "X2" = 78, "Y2" = 12
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 33 AND g."X1" = 76 AND g."Y1" = 9 AND g."X2" = 78 AND g."Y2" = 16;

-- gate 334, map 37: 30 of 81 cells blocked
UPDATE config."ExitGate" g SET "X1" = 67, "Y1" = 183, "X2" = 74, "Y2" = 188
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 37 AND g."X1" = 66 AND g."Y1" = 183 AND g."X2" = 74 AND g."Y2" = 191;

-- gate 142, map 45: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 45 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 143, map 46: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 46 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 144, map 47: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 47 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 145, map 48: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 48 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 146, map 49: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 49 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 147, map 50: 5 of 110 cells blocked
UPDATE config."ExitGate" g SET "X1" = 101, "Y1" = 129, "X2" = 108, "Y2" = 137
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 50 AND g."X1" = 98 AND g."Y1" = 128 AND g."X2" = 108 AND g."Y2" = 137;

-- gate 329, map 65: 3 of 56 cells blocked
UPDATE config."ExitGate" g SET "X1" = 194, "Y1" = 26, "X2" = 199, "Y2" = 32
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 65 AND g."X1" = 193 AND g."Y1" = 26 AND g."X2" = 200 AND g."Y2" = 32;

-- gate 330, map 66: 8 of 49 cells blocked
UPDATE config."ExitGate" g SET "X1" = 134, "Y1" = 69, "X2" = 139, "Y2" = 74
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 66 AND g."X1" = 133 AND g."Y1" = 68 AND g."X2" = 139 AND g."Y2" = 74;

-- gate 332, map 68: 25 of 64 cells blocked
UPDATE config."ExitGate" g SET "X1" = 92, "Y1" = 13, "X2" = 97, "Y2" = 17
  FROM config."GameMapDefinition" m
 WHERE g."MapId" = m."Id" AND m."Number" = 68 AND g."X1" = 90 AND g."Y1" = 10 AND g."X2" = 97 AND g."Y2" = 17;

COMMIT;
