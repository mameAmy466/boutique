#!/usr/bin/env bash
# Met à jour Boutique avec la dernière version de la branche main.
set -euo pipefail
DIR=/var/www/boutique
BRANCH="${BRANCH:-main}"
cd "$DIR"
git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH"
export COMPOSER_ALLOW_SUPERUSER=1
php artisan down || true
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan optimize
chown -R www-data:www-data storage bootstrap/cache
(cd admin-web && npm ci && npm run build)
(cd site && npm ci && npm run build)
php artisan up
systemctl reload php8.4-fpm nginx
echo "Mise à jour terminée."
