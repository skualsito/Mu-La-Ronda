-- Mu La Ronda - warps de la M que faltan.
--
-- OpenMU (VersionSeasonSix/Gates.cs) no trae el warp de Crywolf Fortress
-- (indice 24), asi que no habia forma de llegar al mapa. Aterriza en la
-- puerta de reaparicion de Crywolf (gate 118; 04-gates.sql la achico a las
-- celdas caminables). La fila de la ventana M la agrega el cliente
-- (src/libs/mu/moveReqFile.ts, EXTRA_ROWS) con el mismo nivel y zen.
-- Idempotente: si ya existe el indice, solo actualiza.

BEGIN;

UPDATE config."WarpInfo" w
   SET "Name" = 'Crywolf',
       "Costs" = 15000,
       "LevelRequirement" = 10,
       "GateId" = g."Id"
  FROM config."ExitGate" g
  JOIN config."GameMapDefinition" m ON m."Id" = g."MapId"
 WHERE w."Index" = 24
   AND m."Number" = 34 AND g."IsSpawnGate" AND g."X1" = 229 AND g."Y1" = 37;

INSERT INTO config."WarpInfo" ("Id", "Index", "Name", "Costs", "LevelRequirement", "GateId", "GameConfigurationId")
SELECT gen_random_uuid(), 24, 'Crywolf', 15000, 10, g."Id", gc."Id"
  FROM config."ExitGate" g
  JOIN config."GameMapDefinition" m ON m."Id" = g."MapId"
  CROSS JOIN (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) gc
 WHERE m."Number" = 34 AND g."IsSpawnGate" AND g."X1" = 229 AND g."Y1" = 37
   AND NOT EXISTS (SELECT 1 FROM config."WarpInfo" WHERE "Index" = 24)
 LIMIT 1;


-- Estadio de Arena (indice 60). Desde que 06-leveling.sql puso la llegada de
-- Arena en la zona de leveleo, el estadio (el anillo con el Arena Guard y Baz,
-- y la cancha adentro) quedo sin entrada: no se conecta caminando con el resto
-- del mapa. Este warp aterriza en las gradas, donde dejaba el /move arena
-- original (x72-73). No es puerta de reaparicion: morir en Arena sigue dejando
-- en la zona de leveleo. La fila de la M la agrega el cliente (EXTRA_ROWS).

INSERT INTO config."ExitGate" ("Id", "MapId", "X1", "Y1", "X2", "Y2", "Direction", "IsSpawnGate")
SELECT 'a1e5ad10-0000-4000-8000-000000000060', m."Id", 71, 142, 73, 150, 0, false
  FROM config."GameMapDefinition" m
 WHERE m."Number" = 6
ON CONFLICT ("Id") DO UPDATE SET "X1" = 71, "Y1" = 142, "X2" = 73, "Y2" = 150, "IsSpawnGate" = false;

UPDATE config."WarpInfo"
   SET "Name" = 'Estadio', "Costs" = 0, "LevelRequirement" = 1,
       "GateId" = 'a1e5ad10-0000-4000-8000-000000000060'
 WHERE "Index" = 60
   AND EXISTS (SELECT 1 FROM config."ExitGate" WHERE "Id" = 'a1e5ad10-0000-4000-8000-000000000060');

INSERT INTO config."WarpInfo" ("Id", "Index", "Name", "Costs", "LevelRequirement", "GateId", "GameConfigurationId")
SELECT gen_random_uuid(), 60, 'Estadio', 0, 1, g."Id", gc."Id"
  FROM config."ExitGate" g
  CROSS JOIN (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) gc
 WHERE g."Id" = 'a1e5ad10-0000-4000-8000-000000000060'
   AND NOT EXISTS (SELECT 1 FROM config."WarpInfo" WHERE "Index" = 60);

COMMIT;
