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

COMMIT;
