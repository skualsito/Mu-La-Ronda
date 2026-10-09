-- Mu La Ronda - la Gateway Machine de Kanturu Relics derecha.
--
-- OpenMU la crea mirando al sur (Direction 3, KanturuRelics.cs), que en el
-- cliente son 45 grados: queda en diagonal contra la pared. Mirando al
-- sudeste (Direction 4, paquete 3, 90 grados en el cliente) encaja en su
-- marco; se eligio probando los giros en el juego. Idempotente;
-- apply-config.sh reinicia OpenMU y la crea de nuevo con este giro.

BEGIN;

UPDATE config."MonsterSpawnArea" s
   SET "Direction" = 4
  FROM config."MonsterDefinition" d, config."GameMapDefinition" m
 WHERE d."Id" = s."MonsterDefinitionId"
   AND m."Id" = s."GameMapId"
   AND d."Number" = 367
   AND m."Number" = 38
   AND s."Direction" <> 4;

COMMIT;
