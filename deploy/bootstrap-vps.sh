#!/usr/bin/env bash
# Preparacion inicial del VPS (Ubuntu/Debian). Correr UNA vez como root:
#
#   curl -fsSL https://raw.githubusercontent.com/skualsito/Mu-La-Ronda/main/deploy/bootstrap-vps.sh | bash
#
# Instala Docker, abre solo 22/80/443, crea el usuario `deploy` (el que usa
# GitHub Actions) y clona el repo en /opt/mu-la-ronda.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/skualsito/Mu-La-Ronda.git}"
APP_DIR="${APP_DIR:-/opt/mu-la-ronda}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [[ $EUID -ne 0 ]]; then echo "Correr como root" >&2; exit 1; fi

echo "▶ Paquetes base"
apt-get update -y
apt-get install -y git curl ufw ca-certificates

if ! command -v docker >/dev/null; then
  echo "▶ Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi

echo "▶ Firewall (22, 80, 443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

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
  2. Revisar $APP_DIR/deploy/.env (dominio y password del panel ya generados):
       cat $APP_DIR/deploy/.env
  3. Primer deploy a mano:
       su - $DEPLOY_USER -c "bash $APP_DIR/deploy/deploy.sh"
EOF
