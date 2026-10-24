#!/usr/bin/env bash
# Installation complète de Boutique sur un serveur Ubuntu 22.04 / 24.04 neuf.
#
#   curl -fsSL https://raw.githubusercontent.com/mameAmy466/boutique/main/deploy/install.sh | sudo bash
#
# Variables optionnelles :
#   DOMAIN=myboutiqu.com        domaine principal (site vitrine)
#   EMAIL=contact@...           e-mail pour les certificats Let's Encrypt
#   GITHUB_TOKEN=ghp_...        seulement si le dépôt est privé
#   BRANCH=main
set -euo pipefail

DOMAIN="${DOMAIN:-myboutiqu.com}"
APP_DOMAIN="app.${DOMAIN}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
BRANCH="${BRANCH:-main}"
REPO="github.com/mameAmy466/boutique.git"
DIR=/var/www/boutique

[ "$(id -u)" = 0 ] || { echo "Lancer en root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> Paquets système"
grep -rlis ondrej /etc/apt/sources.list.d/ | xargs -r rm -f
apt-get update -y
apt-get install -y software-properties-common curl git unzip ufw nginx mysql-server certbot python3-certbot-nginx
# PHP fourni par Ubuntu (le PPA ondrej n'existe pas pour les versions récentes).
apt-get install -y php-fpm php-cli php-mysql php-mbstring php-xml php-curl php-zip php-bcmath php-intl php-gd
PHP="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
echo "PHP $PHP"
php -r 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);' || { echo "PHP >= 8.2 requis (trouvé $PHP)."; exit 1; }
if ! command -v composer >/dev/null; then
  curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Pare-feu"
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

echo "==> Code source"
if [ -n "${GITHUB_TOKEN:-}" ]; then URL="https://${GITHUB_TOKEN}@${REPO}"; else URL="https://${REPO}"; fi
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$URL" "$DIR"
fi
git -C "$DIR" remote set-url origin "https://${REPO}"

echo "==> Base de données"
CRED=/root/boutique-credentials.txt
if [ ! -f "$CRED" ]; then
  DB_PASS="$(openssl rand -hex 16)"
  ADMIN_PASS="$(openssl rand -base64 12 | tr -d '/+=')"
  mysql -e "CREATE DATABASE IF NOT EXISTS boutique CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            CREATE USER IF NOT EXISTS 'boutique'@'localhost' IDENTIFIED BY '${DB_PASS}';
            ALTER USER 'boutique'@'localhost' IDENTIFIED BY '${DB_PASS}';
            GRANT ALL PRIVILEGES ON boutique.* TO 'boutique'@'localhost'; FLUSH PRIVILEGES;"
  printf 'DB_PASS=%s\nADMIN_EMAIL=admin@%s\nADMIN_PASS=%s\n' "$DB_PASS" "$DOMAIN" "$ADMIN_PASS" > "$CRED"
  chmod 600 "$CRED"
fi
# shellcheck disable=SC1090
. "$CRED"

echo "==> Backend Laravel"
cd "$DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i \
    -e "s|^APP_ENV=.*|APP_ENV=production|" \
    -e "s|^APP_DEBUG=.*|APP_DEBUG=false|" \
    -e "s|^APP_URL=.*|APP_URL=https://${APP_DOMAIN}|" \
    -e "s|^APP_LOCALE=.*|APP_LOCALE=fr|" \
    -e "s|^LOG_LEVEL=.*|LOG_LEVEL=warning|" \
    -e "s|^DB_USERNAME=.*|DB_USERNAME=boutique|" \
    -e "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" \
    .env
fi
export COMPOSER_ALLOW_SUPERUSER=1
composer install --no-dev --optimize-autoloader --no-interaction
grep -q '^APP_KEY=base64' .env || php artisan key:generate --force
php artisan migrate --force
if ! php artisan tinker --execute='echo App\Models\User::count();' 2>/dev/null | grep -qE '^[1-9]'; then
  php artisan db:seed --force
  # Remplace le compte de démo par un vrai compte avec mot de passe aléatoire
  php artisan tinker --execute="App\Models\User::where('email','admin@boutique.test')->update(['email'=>'${ADMIN_EMAIL}','password'=>Illuminate\Support\Facades\Hash::make('${ADMIN_PASS}')]);"
fi
php artisan storage:link || true
php artisan optimize
chown -R www-data:www-data storage bootstrap/cache

echo "==> Interface d'administration (app.${DOMAIN})"
cd "$DIR/admin-web"
echo "VITE_API_BASE_URL=https://${APP_DOMAIN}/api" > .env.production
npm ci && npm run build

echo "==> Site vitrine (${DOMAIN})"
cd "$DIR/site"
echo "VITE_APP_URL=https://${APP_DOMAIN}/login" > .env.production
npm ci && npm run build

echo "==> Nginx"
cat > /etc/nginx/sites-available/boutique <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${DIR}/site/dist;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}

server {
    listen 80;
    server_name ${APP_DOMAIN};
    root ${DIR}/admin-web/dist;
    index index.html;
    client_max_body_size 20M;

    # API Laravel
    location ~ ^/(api|sanctum|up)(/|\$) {
        root ${DIR}/public;
        try_files /index.php =404;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME ${DIR}/public/index.php;
        fastcgi_pass unix:/run/php/php${PHP}-fpm.sock;
    }

    # Images produits (storage:link)
    location /storage/ { alias ${DIR}/storage/app/public/; }

    # Interface React
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/boutique /etc/nginx/sites-enabled/boutique
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Tâches planifiées Laravel"
echo "* * * * * www-data cd ${DIR} && php artisan schedule:run >> /dev/null 2>&1" > /etc/cron.d/boutique

echo "==> HTTPS (Let's Encrypt)"
if ! certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" \
      -d "$DOMAIN" -d "www.$DOMAIN" -d "$APP_DOMAIN"; then
  echo "!! Certificat non obtenu : vérifier que les DNS pointent vers ce serveur, puis relancer ce script."
fi

cat <<DONE

==============================================================
 Boutique est installée.
   Site vitrine : https://${DOMAIN}
   Application  : https://${APP_DOMAIN}
   Connexion    : ${ADMIN_EMAIL}  /  ${ADMIN_PASS}
 (identifiants sauvegardés dans ${CRED})
 Mise à jour plus tard : sudo bash ${DIR}/deploy/update.sh
==============================================================
DONE
