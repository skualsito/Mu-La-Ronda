-- Mu La Ronda - horarios de los eventos, separados 15 minutos.
--
-- Por defecto OpenMU arranca Blood Castle (cada 2 h), Chaos Castle (cada 1 h),
-- Devil Square (cada 4 h) y las invasiones a la hora en punto, asi que caian
-- todos juntos. Aca cada uno tiene su minuto dentro de la hora:
--
--   :00  Blood Castle                cada 2 h, horas pares (00:00, 02:00 ... 22:00)
--        White Wizard (invasion)     cada 2 h, horas impares de 13:00 a 23:00
--   :15  Chaos Castle                cada hora
--   :30  Devil Square                cada 4 h (00:30, 04:30 ... 20:30)
--   :45  Golden Invasion             cada 4 h (00:45, 04:45 ... 20:45)
--        Red Dragon (invasion)       cada 6 h desde 03:45 (03:45, 09:45, 15:45, 21:45)
--        Kanturu                     una vez por dia, 22:45
--
-- Los jefes por horario y el Loren Deep (35-bosses.sql, 36-loren-deep.sql)
-- traen su horario de guide.elitemu.net en su plugin; duran 1 hora (Loren
-- Deep media) o hasta que mueren todos:
--   Skeleton King (Lorencia)     cada 4 h desde 00:45
--   Medusa (Swamp of Calmness)   cada 6 h desde 02:00
--   Lord Silvester (Vulcanus)    cada 6 h desde 02:05
--   Erohim (Kanturu Relics)      08:25 y 20:25
--   Loren Deep (Valley of Loren) 08:00 y 20:00, nunca los domingos
--
-- Las horas son las del servidor (OpenMU usa su zona horaria). Solo se cambia
-- el "Timetable" de la configuracion de cada plugin (el resto - duracion,
-- mensajes, monstruos - queda como este). OpenMU guarda esa configuracion al
-- arrancar por primera vez; si en una base nueva todavia no esta, este archivo
-- no cambia nada y hay que volver a aplicarlo despues del primer arranque.
-- Idempotente.
BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;

CREATE OR REPLACE FUNCTION mlr.set_timetable(plugin uuid, times text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  timetable text := '"Timetable": ' || to_json(times)::text;
BEGIN
  -- Texto, no jsonb: OpenMU puede guardar metadatos "$id" que tienen que
  -- quedar primeros en cada objeto, y jsonb reordena las claves. La lista va
  -- como arreglo simple (o como {"$id":..,"$values":[..]} si asi estaba).
  UPDATE config."PlugInConfiguration"
     SET "CustomConfiguration" = regexp_replace(
           "CustomConfiguration",
           '"Timetable"\s*:\s*(\{[^{}]*\}|\[[^\]]*\])',
           timetable)
   WHERE "TypeId" = plugin
     AND "CustomConfiguration" ~ '"Timetable"\s*:';
END $$;

DO $$
DECLARE
  every2_even text[] := ARRAY(SELECT format('%s:00:00', lpad(h::text, 2, '0')) FROM generate_series(0, 22, 2) h);
  every1      text[] := ARRAY(SELECT format('%s:15:00', lpad(h::text, 2, '0')) FROM generate_series(0, 23) h);
  every4_30   text[] := ARRAY(SELECT format('%s:30:00', lpad(h::text, 2, '0')) FROM generate_series(0, 20, 4) h);
  every4_45   text[] := ARRAY(SELECT format('%s:45:00', lpad(h::text, 2, '0')) FROM generate_series(0, 20, 4) h);
  every6_45   text[] := ARRAY(SELECT format('%s:45:00', lpad(h::text, 2, '0')) FROM generate_series(3, 21, 6) h);
  odd_13_23   text[] := ARRAY(SELECT format('%s:00:00', lpad(h::text, 2, '0')) FROM generate_series(13, 23, 2) h);
BEGIN
  PERFORM mlr.set_timetable('95e68c14-ad87-4b3c-af46-45b8f1c3bc2a', every2_even);  -- Blood Castle
  PERFORM mlr.set_timetable('3ad96a70-ed24-4979-80b8-169e461e548f', every1);       -- Chaos Castle
  PERFORM mlr.set_timetable('61c61a58-211e-4d6a-9ea1-d25e0c4a47c5', every4_30);    -- Devil Square
  PERFORM mlr.set_timetable('06d18a9e-2919-4c17-9dbc-6e4f7756495c', every4_45);    -- Golden Invasion
  PERFORM mlr.set_timetable('548a76cc-242c-441c-bc9d-6c22745a2d72', every6_45);    -- Red Dragon
  PERFORM mlr.set_timetable('4b5d0f55-5b26-4447-b9c0-c272e5d0a141', odd_13_23);    -- White Wizard
  PERFORM mlr.set_timetable('a8f3c2d1-9e74-4ecb-8963-08a3697278c4', ARRAY['22:45:00']); -- Kanturu
END $$;


-- Kanturu (Refinery Tower: Maya, Nightmare) activo. Los datos del evento (el
-- mapa, los monstruos, la definicion del minijuego) los trae una actualizacion
-- de OpenMU que se instala a mano desde su panel (openmu.<dominio> -> Updates,
-- "Add Kanturu data"); si falta, se avisa en el log del deploy.
UPDATE config."PlugInConfiguration" SET "IsActive" = true
 WHERE "TypeId" = 'a8f3c2d1-9e74-4ecb-8963-08a3697278c4';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config."MiniGameDefinition" WHERE "Type" = 6) THEN
    RAISE NOTICE 'Kanturu: falta la definicion del evento - instalar las actualizaciones pendientes en el panel de OpenMU (Updates)';
  END IF;
  -- Las oleadas (SpawnTrigger 4 = OnceAtWaveStart) en la Refinery Tower (mapa 39)
  -- las trae otra actualizacion: sin ellas la fase 1 no tiene monstruos.
  IF NOT EXISTS (SELECT 1 FROM config."MonsterSpawnArea" s
                   JOIN config."GameMapDefinition" m ON m."Id" = s."GameMapId"
                  WHERE m."Number" = 39 AND s."SpawnTrigger" = 4) THEN
    RAISE NOTICE 'Kanturu: faltan los monstruos del evento - instalar "Add Kanturu map content" en el panel de OpenMU (Updates)';
  END IF;
END $$;
COMMIT;
