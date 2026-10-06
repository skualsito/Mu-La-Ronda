#!/usr/bin/env bash
# Preparacion inicial del VPS (Ubuntu, con Pterodactyl ya instalado). Correr
# UNA vez como root:
#
#   curl -fsSL https://raw.githubusercontent.com/skualsito/Mu-La-Ronda/main/deploy/bootstrap-vps.sh | bash
#
# Crea el usuario `deploy` (el que usa GitHub Actions), clona el repo en
# /opt/mu-la-ronda y genera deploy/.env. No toca el firewall ni la config de
# Pterodactyl: todo lo de MU escucha en 127.0.0.1 y entra por el nginx que ya
# atiende 80/443.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/skualsito/Mu-La-Ronda.git}"
APP_DIR="${APP_DIR:-/opt/mu-la-ronda}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [[ $EUID -ne 0 ]]; then echo "Correr como root" >&2; exit 1; fi

command -v docker >/dev/null || { echo "No hay Docker (Wings deberia haberlo instalado)" >&2; exit 1; }
docker compose version >/dev/null || { echo "Falta el plugin docker compose: apt-get install docker-compose-plugin" >&2; exit 1; }
command -v nginx >/dev/null || { echo "No encuentro nginx en el host" >&2; exit 1; }

echo "▶ Chequeando puertos que usa MU (deben estar libres)"
for port in 3000 3001 8090 44405 44406 55901 55902 55903 55904 55905 55906 55980; do
  if ss -ltnH "( sport = :$port )" | grep -q .; then
    echo "  ✖ $port ocupado:"; ss -ltnp "( sport = :$port )"
    BUSY=1
  fi
done
[[ -z "${BUSY:-}" ]] || { echo "Liberar esos puertos o cambiarlos en deploy/.env antes de seguir" >&2; exit 1; }

apt-get install -y git curl openssl

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "▶ Creando usuario $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "▶ Clonando $REPO_URL en $APP_DIR"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod 755 "$APP_DIR"   # nginx (www-data) lee dist/

if [[ ! -f "$APP_DIR/deploy/.env" ]]; then
  cp "$APP_DIR/deploy/.env.example" "$APP_DIR/deploy/.env"
  IP="$(curl -fsS https://api.ipify.org || echo 0.0.0.0)"
  sed -i "s/^DOMAIN=.*/DOMAIN=${IP//./-}.sslip.io/" "$APP_DIR/deploy/.env"
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 24)/" "$APP_DIR/deploy/.env"
  sed -i "s/^OPENMU_ADMIN_PASSWORD=.*/OPENMU_ADMIN_PASSWORD=$(openssl rand -hex 12)/" "$APP_DIR/deploy/.env"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/deploy/.env"
  chmod 600 "$APP_DIR/deploy/.env"
fi

cat <<EOF

✔ VPS listo.

Siguientes pasos:
  1. Pegar la clave publica de GitHub Actions en /home/$DEPLOY_USER/.ssh/authorized_keys
  2. Revisar $APP_DIR/deploy/.env (dominio y passwords ya generados):
       cat $APP_DIR/deploy/.env
  3. Primer deploy a mano:
       su - $DEPLOY_USER -c "bash $APP_DIR/deploy/deploy.sh"
  4. Sitios en nginx + HTTPS:
       bash $APP_DIR/deploy/setup-nginx.sh
EOF
