#!/usr/bin/env bash
# Despliega la rama actual en este VPS. Lo corre GitHub Actions por SSH en
# cada push, o a mano: ./deploy/deploy.sh
#
#   1. trae el ultimo commit de origin
#   2. compila el cliente (bun, dentro de un contenedor) en dist/
#   3. genera dist/serverlist.md con el dominio de deploy/.env
#   4. levanta / actualiza el stack (docker compose)
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$(pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -f deploy/.env ]]; then
  echo "Falta deploy/.env (copiar deploy/.env.example y completarlo)" >&2
  exit 1
fi

# El git reset reescribe este mismo archivo, y bash lo va leyendo mientras
# corre: primero actualizar, despues relanzar la version nueva desde cero.
if [[ "${1:-}" != "--updated" ]]; then
  echo "▶ Actualizando codigo ($BRANCH)"
  git fetch --depth 1 origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  exec bash deploy/deploy.sh --updated
fi
echo "  commit: $(git log --oneline -1)"

# Secretos que se agregaron despues de crear el .env: se generan una vez.
for key in MARKETPLACE_ESCROW_SECRET MARKETPLACE_TICKET_SECRET MLR_ADMIN_SECRET; do
  if ! grep -q "^$key=." deploy/.env; then
    sed -i "/^$key=/d" deploy/.env
    value=$(openssl rand -hex 32)
    echo "$key=$value" >> deploy/.env
    echo "  generado $key en deploy/.env"
  fi
done

set -a; source deploy/.env; set +a

echo "▶ Compilando cliente"
# Cache de bun en una carpeta del usuario que despliega: un volumen de docker
# nace con dueño root y bun (que corre con nuestro uid) no podria escribirlo.
BUN_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/mu-la-ronda-bun"
mkdir -p "$BUN_CACHE"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e TMPDIR=/tmp \
  -e BUN_TMPDIR=/tmp \
  -e BUN_INSTALL_CACHE_DIR=/cache \
  -e VITE_SERVER_LIST_URL=/serverlist.md \
  -v "$REPO_DIR:/app" \
  -v "$BUN_CACHE:/cache" \
  -w /app \
  oven/bun:1.2 \
  sh -c "bun install --frozen-lockfile && bun run build \
    && VITE_DATA_URL=https://$DOMAIN/Data/ VITE_REGISTER_API=/api/register bun run build:register \
    && bun run build:admin"

echo "▶ Generando serverlist.md para $DOMAIN"
sed "s/\${DOMAIN}/$DOMAIN/g" deploy/serverlist.template.md > dist/serverlist.md

COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

echo "▶ Bajando imagenes"
# De a una y con reintentos: `compose pull` en paralelo falla en Docker 29
# con "unable to lease content: lease does not exist".
for image in $("${COMPOSE[@]}" config --images | grep -v '^mu-la-ronda/' | sort -u); do
  for attempt in 1 2 3; do
    docker pull -q "$image" && break
    [[ $attempt == 3 ]] && { echo "No se pudo bajar $image" >&2; exit 1; }
    echo "  reintentando $image..."; sleep 5
  done
done

echo "▶ Compilando OpenMU con el plugin del mercado"
# La primera vez tarda (baja OpenMU y compila .NET); despues usa la cache de
# docker y solo recompila si cambia marketplace/openmu.
"${COMPOSE[@]}" build openmu

echo "▶ Levantando servicios"
"${COMPOSE[@]}" up -d --pull never --remove-orphans
# Proxy y registro corren el codigo montado: reiniciarlos para que tomen los cambios.
"${COMPOSE[@]}" restart proxy register marketplace panel

echo "▶ Configuracion del juego"
bash deploy/apply-config.sh

docker image prune -f >/dev/null
echo "✔ Listo: https://$DOMAIN/online  ·  panel: https://admin.$DOMAIN (usuario/clave: OPENMU_ADMIN_USER/PASSWORD de deploy/.env)"
