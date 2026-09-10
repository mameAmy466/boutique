# Boutique — API de gestion commerciale multi-boutiques

Backend Laravel (API REST) pour la gestion centralisée de plusieurs
boutiques : utilisateurs et rôles, produits et lots de stock, calcul
automatique et contrôle serveur du **prix minimum de vente**, ventes,
caisses, facturation et tableaux de bord.

Ceci correspond au MVP V1 du cahier des charges : authentification,
utilisateurs/rôles, boutiques, produits, stocks, prix minimum, ventes,
caisse, factures, dashboard.

## Stack

- Laravel 11, PHP 8.4
- MySQL
- Laravel Sanctum (authentification par token)

## Installation

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Configurer les identifiants MySQL dans `.env` (`DB_DATABASE`, `DB_USERNAME`,
`DB_PASSWORD`), puis :

```bash
php artisan migrate --seed
```

Le seeder crée les 3 rôles (`super_admin`, `admin_boutique`, `caissier`) et
un administrateur général :

- email : `admin@boutique.test`
- mot de passe : `password`

## Lancer les tests

Les tests tournent sur SQLite en mémoire (déjà configuré dans
`phpunit.xml`), aucune base MySQL n'est nécessaire :

```bash
php artisan test
```

## Règle métier centrale : le prix minimum

Le prix minimum est calculé par `App\Services\PricingService` à partir de
chaque lot de stock (`ProductBatch`) :

```
coût de revient = prix d'achat + frais associés
prix minimum    = coût de revient + bénéfice minimum
```

Le vendeur peut vendre à un prix supérieur, jamais inférieur. Cette règle
est vérifiée côté serveur dans `App\Services\SaleService::createSale()`
(jamais uniquement côté client) : toute tentative de vente sous le prix
minimum est rejetée avec un code `422`.

## Principaux modules

| Domaine | Modèles | Service |
|---|---|---|
| Boutiques / utilisateurs / rôles | `Shop`, `User`, `Role` | — |
| Catalogue | `Category`, `Supplier`, `Product` | — |
| Stock / lots | `ProductBatch`, `StockMovement` | `StockService` |
| Prix | — | `PricingService` |
| Ventes | `Sale`, `SaleItem` | `SaleService` |
| Facturation | `Invoice` | `InvoiceService` |
| Caisse | `CashRegister`, `CashSession` | `CashService` |

Les autorisations par rôle (super admin / admin de boutique / caissier)
sont appliquées via les policies dans `app/Policies`.

## API

Voir `routes/api.php` pour la liste complète des endpoints. Authentification
via `POST /api/login` (retourne un token Sanctum à envoyer en
`Authorization: Bearer <token>`).
