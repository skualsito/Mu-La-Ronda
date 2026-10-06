#!/usr/bin/env bash
# Aplica deploy/config/*.sql sobre la base de OpenMU y reinicia OpenMU.
#
#   ./deploy/apply-config.sh          solo si algun .sql cambio desde la ultima vez
#   ./deploy/apply-config.sh --force  siempre
#
# deploy.sh lo llama en cada deploy. El hash de lo aplicado se guarda en
# .deploy-state/ (fuera de git) para no reiniciar OpenMU -y echar a los
# jugadores- cuando la configuracion no cambio.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)
STATE_DIR=.deploy-state
STATE_FILE="$STATE_DIR/config.sha256"

shopt -s nullglob
files=(deploy/config/*.sql)
[[ ${#files[@]} -gt 0 ]] || { echo "  sin archivos en deploy/config"; exit 0; }

hash="$(cat "${files[@]}" | sha256sum | cut -d' ' -f1)"
if [[ "${1:-}" != "--force" && -f "$STATE_FILE" && "$(cat "$STATE_FILE")" == "$hash" ]]; then
  echo "  configuracion sin cambios"
  exit 0
fi

# OpenMU crea el esquema la primera vez que arranca: esperar a que exista.
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T database psql -U postgres -d openmu -tAc \
       'SELECT 1 FROM config."GameConfiguration" LIMIT 1' 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 5
done

for f in "${files[@]}"; do
  echo "  aplicando $f"
  "${COMPOSE[@]}" exec -T database psql -U postgres -d openmu -v ON_ERROR_STOP=1 -q < "$f"
done

echo "  reiniciando OpenMU"
"${COMPOSE[@]}" restart openmu

mkdir -p "$STATE_DIR"
echo "$hash" > "$STATE_FILE"
