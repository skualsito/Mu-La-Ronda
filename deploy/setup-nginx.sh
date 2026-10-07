#!/usr/bin/env bash
# Agrega los sitios de Mu La Ronda al nginx del host y saca los certificados.
# Correr como root una vez, y de nuevo si cambia el dominio:
#
#   sudo bash /opt/mu-la-ronda/deploy/setup-nginx.sh
#
# No toca la config de Pterodactyl: escribe un archivo aparte y valida con
# `nginx -t` antes de recargar.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Correr como root" >&2; exit 1; fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$APP_DIR/deploy/.env"; set +a
PROXY_PORT="${PROXY_PORT:-3000}"
ADMIN_PORT="${ADMIN_PORT:-8090}"
ADMIN_PANEL_PORT="${ADMIN_PANEL_PORT:-3200}"
REGISTER_PORT="${REGISTER_PORT:-3100}"
MARKETPLACE_PORT="${MARKETPLACE_PORT:-3300}"

if [[ -d /etc/nginx/sites-available ]]; then
  TARGET=/etc/nginx/sites-available/mu-la-ronda.conf
  LINK=/etc/nginx/sites-enabled/mu-la-ronda.conf
else
  TARGET=/etc/nginx/conf.d/mu-la-ronda.conf
  LINK=""
fi

echo "▶ Escribiendo $TARGET para $DOMAIN"
sed -e "s|\${DOMAIN}|$DOMAIN|g" \
    -e "s|\${APP_DIR}|$APP_DIR|g" \
    -e "s|\${PROXY_PORT}|$PROXY_PORT|g" \
    -e "s|\${ADMIN_PORT}|$ADMIN_PORT|g" \
    -e "s|\${ADMIN_PANEL_PORT}|$ADMIN_PANEL_PORT|g" \
    -e "s|\${REGISTER_PORT}|$REGISTER_PORT|g" \
    -e "s|\${MARKETPLACE_PORT}|$MARKETPLACE_PORT|g" \
    "$APP_DIR/deploy/nginx/mu-la-ronda.conf.template" > "$TARGET"
[[ -n "$LINK" ]] && ln -sf "$TARGET" "$LINK"

nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  echo "▶ ufw activo: abriendo 80 y 443"
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo "▶ Certificados HTTPS"
if [[ -n "${ACME_EMAIL:-}" ]]; then EMAIL_ARGS=(-m "$ACME_EMAIL"); else EMAIL_ARGS=(--register-unsafely-without-email); fi
# --expand: al sumar un subdominio nuevo, amplia el certificado existente.
certbot --nginx --non-interactive --agree-tos --redirect --expand "${EMAIL_ARGS[@]}" \
  --cert-name "$DOMAIN" \
  -d "$DOMAIN" -d "ws.$DOMAIN" -d "admin.$DOMAIN" -d "openmu.$DOMAIN" -d "register.$DOMAIN"

echo "✔ nginx listo: https://$DOMAIN"
