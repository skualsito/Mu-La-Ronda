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

set -a; source deploy/.env; set +a

echo "▶ Actualizando codigo ($BRANCH)"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "  commit: $(git log --oneline -1)"

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
  sh -c "bun install --frozen-lockfile && bun run build"

echo "▶ Generando serverlist.md para $DOMAIN"
sed "s/\${DOMAIN}/$DOMAIN/g" deploy/serverlist.template.md > dist/serverlist.md

echo "▶ Levantando servicios"
docker compose -f deploy/docker-compose.yml --env-file deploy/.env pull --quiet
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --remove-orphans
# El proxy corre el codigo montado: reiniciarlo para que tome los cambios.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env restart proxy

docker image prune -f >/dev/null
echo "✔ Listo: https://play.$DOMAIN/online"
