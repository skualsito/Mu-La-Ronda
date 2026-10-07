-- Mu La Ronda - "Zona de leveleo" en Arena (/move arena), estilo server fast.
--
-- Con PreventExperienceOverflow cada bicho da como mucho UN nivel, siempre
-- que su experiencia alcance para el nivel siguiente. OpenMU calcula
-- (AttackableExtensions.CalculateBaseExperience):
--   exp = ((M+25)*M/3 [* (M+10)/L si L > M+10] + (M-64)*M/4 si M >= 65) * 1.25
--         * ExperienceRate (9999) * ExpMultiplier del mapa
-- (M nivel del monstruo, L nivel del personaje). Arena va con ExpMultiplier 2
-- y cuatro spots, cada uno con monstruos que alcanzan para subir 1 nivel por
-- kill en su rango (calculado contra la tabla de experiencia de OpenMU):
--
--   Spot 1  niveles   1-230   Assassin (26), Cyclops (28)       oeste      x37-50  y108-117
--   Spot 2  niveles 230-300   Devil (60), Death Knight (62)     centro     x69-82  y112-117
--   Spot 3  niveles 300-385   Dark Phoenix Shield (106)        este       x80-99  y84-100
--   Spot 4  niveles 385-400   Dark Elf (135), Soram (134)       sureste    x88-97  y110-117
--
-- Cada spot se arma con cajas de 5x5 celdas de 8 bichos (en los spots de dos
-- monstruos, 4 y 4): asi quedan grupos de 8 separados en vez de 20-40 bichos
-- desparramados. OpenMU (SpawnSpots.cs) deja estas cajas tal cual.
--
-- Se llega y se reaparece entre el spot 1 y el 2 (x53-57 y113-116), lejos de
-- los fuertes. Todas las coordenadas estan verificadas contra el terreno del
-- cliente (Data/World7, celdas caminables). El norte de Arena no conecta con
-- el estadio, asi que no molesta a nada.
--
-- Los spots se cargan UNA sola vez (marca 'leveling_spots_seeded' en
-- mlr.settings); despues se editan unicamente desde el panel admin (Spots) y
-- un deploy no los toca. Quedan anotados en mlr.leveling_spawns (el panel los
-- marca como "leveleo" y 02-fast.sql no los multiplica). Para volver a este
-- armado: DELETE FROM mlr.settings WHERE key = 'leveling_spots_seeded'.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.leveling_spawns ("Id" uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL);

DO $$
DECLARE
  arena uuid;
  spot record;
  monster uuid;
  new_id uuid;
BEGIN
  SELECT "Id" INTO arena FROM config."GameMapDefinition" WHERE "Number" = 6;
  IF arena IS NULL THEN
    RAISE NOTICE 'Arena (mapa 6) no existe: zona de leveleo omitida';
    RETURN;
  END IF;

  -- Doble experiencia en Arena: con los monstruos que tiene el cliente es lo
  -- que hace falta para llegar a 400 de a un nivel por kill.
  UPDATE config."GameMapDefinition" SET "ExpMultiplier" = 2 WHERE "Id" = arena;

  -- Los spots: solo la primera vez, despues son del panel admin.
  IF NOT EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'leveling_spots_seeded') THEN
  -- Spawns anteriores de esta zona, fuera.
  DELETE FROM config."MonsterSpawnArea"
   WHERE "Id" IN (SELECT "Id" FROM mlr.leveling_spawns);
  DELETE FROM mlr.leveling_spawns;

  FOR spot IN
    SELECT * FROM (VALUES
      -- monstruo, cantidad, x1, y1, x2, y2
      (21::smallint, 4, 37, 108, 41, 112),  -- Spot 1 Assassin/Cyclops caja 1
      (17::smallint, 4, 37, 108, 41, 112),  -- Spot 1 Assassin/Cyclops caja 1
      (21::smallint, 4, 44, 108, 48, 112),  -- Spot 1 Assassin/Cyclops caja 2
      (17::smallint, 4, 44, 108, 48, 112),  -- Spot 1 Assassin/Cyclops caja 2
      (21::smallint, 4, 37, 113, 41, 117),  -- Spot 1 Assassin/Cyclops caja 3
      (17::smallint, 4, 37, 113, 41, 117),  -- Spot 1 Assassin/Cyclops caja 3
      (21::smallint, 4, 44, 113, 48, 117),  -- Spot 1 Assassin/Cyclops caja 4
      (17::smallint, 4, 44, 113, 48, 117),  -- Spot 1 Assassin/Cyclops caja 4
      (37::smallint, 4, 69, 112, 73, 116),  -- Spot 2 Devil/Death Knight caja 1
      (40::smallint, 4, 69, 112, 73, 116),  -- Spot 2 Devil/Death Knight caja 1
      (37::smallint, 4, 75, 112, 79, 116),  -- Spot 2 Devil/Death Knight caja 2
      (40::smallint, 4, 75, 112, 79, 116),  -- Spot 2 Devil/Death Knight caja 2
      (76::smallint, 7, 80, 84, 84, 88),  -- Spot 3 Dark Phoenix Shield caja 1
      (76::smallint, 7, 92, 84, 96, 88),  -- Spot 3 Dark Phoenix Shield caja 2
      (76::smallint, 7, 86, 90, 90, 94),  -- Spot 3 Dark Phoenix Shield caja 3
      (76::smallint, 7, 80, 96, 84, 100),  -- Spot 3 Dark Phoenix Shield caja 4
      (76::smallint, 7, 92, 96, 96, 100),  -- Spot 3 Dark Phoenix Shield caja 5
      (440::smallint, 4, 88, 110, 92, 114),  -- Spot 4 Dark Elf/Soram caja 1
      (437::smallint, 4, 88, 110, 92, 114),  -- Spot 4 Dark Elf/Soram caja 1
      (440::smallint, 4, 93, 113, 97, 117),  -- Spot 4 Dark Elf/Soram caja 2
      (437::smallint, 4, 93, 113, 97, 117)  -- Spot 4 Dark Elf/Soram caja 2
    ) AS t(num, qty, x1, y1, x2, y2)
  LOOP
    SELECT "Id" INTO monster FROM config."MonsterDefinition" WHERE "Number" = spot.num;
    IF monster IS NULL THEN
      RAISE NOTICE 'Monstruo % no existe: se omite en la zona de leveleo', spot.num;
      CONTINUE;
    END IF;

    new_id := gen_random_uuid();
    INSERT INTO config."MonsterSpawnArea"
      ("Id", "Direction", "GameMapId", "MonsterDefinitionId", "Quantity", "SpawnTrigger",
       "WaveNumber", "X1", "X2", "Y1", "Y2")
    VALUES
      (new_id, 0, arena, monster, spot.qty, 0, 0, spot.x1, spot.x2, spot.y1, spot.y2);
    INSERT INTO mlr.leveling_spawns ("Id") VALUES (new_id);
  END LOOP;
  INSERT INTO mlr.settings (key, value) VALUES ('leveling_spots_seeded', now()::text);
  END IF;

  -- Llegada (/move arena) y reaparicion: las tres puertas de Arena.
  UPDATE config."ExitGate"
     SET "X1" = 53, "Y1" = 113, "X2" = 57, "Y2" = 116
   WHERE "MapId" = arena AND "IsSpawnGate"; -- no la del estadio (11-warps.sql)

  -- Que se pueda entrar desde nivel 1.
  UPDATE config."WarpInfo" SET "LevelRequirement" = 1, "Costs" = 0
   WHERE "GateId" IN (SELECT "Id" FROM config."ExitGate" WHERE "MapId" = arena);
END $$;

COMMIT;
