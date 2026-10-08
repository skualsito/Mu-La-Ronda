-- Mu La Ronda - Stadium VIP (mapa 100): una copia de Arena solo para VIP.
--
-- Mismo terreno que Arena (con los corrales abiertos de 17-arena-pens.sql),
-- otro mapa en el servidor: sus propios spots de monstruos, que se editan en el
-- panel admin (Spots > Stadium VIP) como los de cualquier mapa. El cliente lo
-- dibuja con el World7 de Arena (src/maps/stadium).
--
-- Solo entran cuentas VIP: el plugin VIP (VipStadium.cs) rechaza el /move, las
-- puertas y el llamado de party para el resto, y a quien se le vence el VIP
-- adentro lo manda a Arena al entrar al juego. Se llega con /move StadiumVIP
-- (warp 61, gratis y desde nivel 50) y se reaparece adentro.
--
-- Los spots se copian de la zona de leveleo de Arena UNA sola vez (marca
-- 'vip_stadium_spots_seeded' en mlr.settings); despues son del panel y un
-- deploy no los toca. Quedan en mlr.leveling_spawns, asi 02-fast.sql no los
-- multiplica. El terreno se vuelve a copiar de Arena en cada aplicacion.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.leveling_spawns ("Id" uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL);

DO $$
DECLARE
  arena config."GameMapDefinition"%ROWTYPE;
  vip CONSTANT uuid := 'a1e5ad10-0000-4000-8000-000000000100';
  gate CONSTANT uuid := 'a1e5ad10-0000-4000-8000-000000000101';
  spawn record;
  new_id uuid;
BEGIN
  SELECT * INTO arena FROM config."GameMapDefinition" WHERE "Number" = 6;
  IF NOT FOUND THEN
    RAISE NOTICE 'Arena (mapa 6) no existe: Stadium VIP omitido';
    RETURN;
  END IF;

  -- El mapa. La experiencia arranca como la de Arena y despues se cambia
  -- desde el panel; un deploy no la pisa.
  INSERT INTO config."GameMapDefinition"
    ("Id", "BattleZoneId", "Discriminator", "ExpMultiplier", "GameConfigurationId",
     "Name", "Number", "SafezoneMapId", "TerrainData")
  VALUES
    (vip, NULL, arena."Discriminator", arena."ExpMultiplier", arena."GameConfigurationId",
     'Stadium VIP', 100, vip, arena."TerrainData")
  ON CONFLICT ("Id") DO UPDATE
    SET "Name" = 'Stadium VIP', "Number" = 100, "SafezoneMapId" = vip,
        "TerrainData" = EXCLUDED."TerrainData";

  -- Llegada y reaparicion: donde llega el /move arena (la zona de leveleo).
  INSERT INTO config."ExitGate" ("Id", "MapId", "X1", "Y1", "X2", "Y2", "Direction", "IsSpawnGate")
  SELECT gate, vip, g."X1", g."Y1", g."X2", g."Y2", g."Direction", true
    FROM config."ExitGate" g
   WHERE g."MapId" = arena."Id" AND g."IsSpawnGate"
   ORDER BY g."X1", g."Y1"
   LIMIT 1
  ON CONFLICT ("Id") DO NOTHING;

  -- Lo que tira cada bicho, igual que en Arena.
  INSERT INTO config."GameMapDefinitionDropItemGroup" ("GameMapDefinitionId", "DropItemGroupId")
  SELECT vip, d."DropItemGroupId"
    FROM config."GameMapDefinitionDropItemGroup" d
   WHERE d."GameMapDefinitionId" = arena."Id"
  ON CONFLICT DO NOTHING;

  -- Que cada servidor de juego que tiene Arena levante tambien el Stadium VIP.
  INSERT INTO config."GameServerConfigurationGameMapDefinition" ("GameServerConfigurationId", "GameMapDefinitionId")
  SELECT s."GameServerConfigurationId", vip
    FROM config."GameServerConfigurationGameMapDefinition" s
   WHERE s."GameMapDefinitionId" = arena."Id"
  ON CONFLICT DO NOTHING;

  -- Los spots: los de la zona de leveleo de Arena, solo la primera vez.
  IF NOT EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'vip_stadium_spots_seeded') THEN
    FOR spawn IN
      SELECT s.* FROM config."MonsterSpawnArea" s
        JOIN mlr.leveling_spawns l ON l."Id" = s."Id"
       WHERE s."GameMapId" = arena."Id"
    LOOP
      new_id := gen_random_uuid();
      INSERT INTO config."MonsterSpawnArea"
        ("Id", "Direction", "GameMapId", "MonsterDefinitionId", "Quantity", "SpawnTrigger",
         "WaveNumber", "X1", "X2", "Y1", "Y2")
      VALUES
        (new_id, spawn."Direction", vip, spawn."MonsterDefinitionId", spawn."Quantity", spawn."SpawnTrigger",
         spawn."WaveNumber", spawn."X1", spawn."X2", spawn."Y1", spawn."Y2");
      INSERT INTO mlr.leveling_spawns ("Id") VALUES (new_id);
    END LOOP;
    INSERT INTO mlr.settings (key, value) VALUES ('vip_stadium_spots_seeded', now()::text);
  END IF;
END $$;

-- El /move (indice 61; el 60 fue el viejo "Estadio" y 11-warps.sql lo borra).
INSERT INTO config."WarpInfo" ("Id", "Index", "Name", "Costs", "LevelRequirement", "GateId", "GameConfigurationId")
SELECT gen_random_uuid(), 61, 'Stadium VIP', 0, 50, g."Id", gc."Id"
  FROM config."ExitGate" g
 CROSS JOIN (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) gc
 WHERE g."Id" = 'a1e5ad10-0000-4000-8000-000000000101'
   AND NOT EXISTS (SELECT 1 FROM config."WarpInfo" WHERE "Index" = 61);

UPDATE config."WarpInfo"
   SET "Name" = 'Stadium VIP', "Costs" = 0, "LevelRequirement" = 50,
       "GateId" = 'a1e5ad10-0000-4000-8000-000000000101'
 WHERE "Index" = 61
   AND EXISTS (SELECT 1 FROM config."ExitGate" WHERE "Id" = 'a1e5ad10-0000-4000-8000-000000000101');

COMMIT;
