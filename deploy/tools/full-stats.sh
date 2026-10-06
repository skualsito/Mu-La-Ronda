#!/usr/bin/env bash
# Deja un personaje "full" para probar: nivel 400, master level 200 con sus
# puntos, 32767 en cada stat, 2.000.000.000 de zen y estado Game Master (para
# poder usar /item, /move, /setlevel, etc.).
#
#   sudo -u deploy bash /opt/mu-la-ronda/deploy/tools/full-stats.sh Skual
#
# El personaje TIENE QUE ESTAR DESCONECTADO: OpenMU guarda al salir y pisaria
# estos cambios con lo que tenia en memoria.
set -euo pipefail

NAME="${1:?uso: full-stats.sh <personaje>}"
[[ "$NAME" =~ ^[A-Za-z0-9]{1,10}$ ]] || { echo "Nombre invalido: $NAME" >&2; exit 1; }

cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

"${COMPOSE[@]}" exec -T database psql -U postgres -d openmu -v ON_ERROR_STOP=1 -v name="$NAME" <<'SQL'
BEGIN;

SELECT "Id" AS cid, "InventoryId" AS inv
  FROM data."Character" WHERE "Name" = :'name' \gset

-- Stats.cs: Level, MasterLevel, BaseStrength, BaseAgility, BaseVitality, BaseEnergy.
CREATE TEMP TABLE wanted (def uuid, val real) ON COMMIT DROP;
INSERT INTO wanted VALUES
  ('560931ad-0901-4342-b7f4-fd2e2fcc0563', 400),
  ('70cd8c10-391a-4c51-9aa4-a854600e3a9f', 200),
  ('123282fe-fead-448e-ad2c-baece939b4b1', 32767),
  ('1ae9c014-e3cd-4703-bd05-1b65f5f94ceb', 32767),
  ('6ca5c3a6-b109-45a5-87a7-fdcb107b4982', 32767),
  ('01b0ef28-f7a0-46b5-97ba-2b624a54cd75', 32767);

UPDATE data."StatAttribute" s
   SET "Value" = w.val
  FROM wanted w
 WHERE s."CharacterId" = :'cid' AND s."DefinitionId" = w.def;

INSERT INTO data."StatAttribute" ("Id", "CharacterId", "DefinitionId", "Value")
SELECT gen_random_uuid(), :'cid', w.def, w.val
  FROM wanted w
 WHERE NOT EXISTS (
   SELECT 1 FROM data."StatAttribute" s
    WHERE s."CharacterId" = :'cid' AND s."DefinitionId" = w.def);

-- Base Leadership solo si la clase ya lo tiene (Dark Lord).
UPDATE data."StatAttribute"
   SET "Value" = 32767
 WHERE "CharacterId" = :'cid' AND "DefinitionId" = '6af2c9df-3ae4-4721-8462-9a8ec7f56fe4';

UPDATE data."Character"
   SET "LevelUpPoints" = 0,
       "MasterLevelUpPoints" = 200,
       "CharacterStatus" = 32
 WHERE "Id" = :'cid';

UPDATE data."ItemStorage" SET "Money" = 2000000000 WHERE "Id" = :'inv';

COMMIT;

SELECT c."Name", c."CharacterStatus" AS status, c."MasterLevelUpPoints" AS ml_points,
       (SELECT "Money" FROM data."ItemStorage" WHERE "Id" = c."InventoryId") AS zen
  FROM data."Character" c WHERE c."Id" = :'cid';
SQL

echo "✔ $NAME listo. Entra de nuevo al juego para ver los cambios."
