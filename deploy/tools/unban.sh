#!/usr/bin/env bash
# Desbanea una cuenta (la deja en estado Normal). Sirve para las que bloqueo
# el detector de speed hack de OpenMU, o para revertir un /banacc.
#
#   sudo -u deploy bash /opt/mu-la-ronda/deploy/tools/unban.sh <cuenta>
#   sudo -u deploy bash /opt/mu-la-ronda/deploy/tools/unban.sh --all   # todas las baneadas
set -euo pipefail

TARGET="${1:?uso: unban.sh <cuenta> | --all}"
cd "$(dirname "$0")/../.."
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

# AccountState: 0 Normal, 4 Banned, 5 TemporarilyBanned.
if [[ "$TARGET" == "--all" ]]; then
  SQL='UPDATE data."Account" SET "State" = 0 WHERE "State" IN (4, 5) RETURNING "LoginName";'
  "${COMPOSE[@]}" exec -T database psql -U postgres -d openmu -c "$SQL"
else
  [[ "$TARGET" =~ ^[A-Za-z0-9]{1,10}$ ]] || { echo "Cuenta invalida: $TARGET" >&2; exit 1; }
  "${COMPOSE[@]}" exec -T database psql -U postgres -d openmu -v ON_ERROR_STOP=1 -v login="$TARGET" <<'SQL'
UPDATE data."Account" SET "State" = 0
 WHERE lower("LoginName") = lower(:'login') AND "State" IN (4, 5)
RETURNING "LoginName", "State";
SQL
fi
echo "✔ Listo. Si el servidor tenia la cuenta en memoria, puede tardar hasta reconectar."
