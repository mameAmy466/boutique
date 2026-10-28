# Boutique — API de gestion commerciale multi-boutiques

Backend Laravel (API REST) pour la gestion centralisée de plusieurs
boutiques : utilisateurs et rôles, produits et lots de stock, calcul
automatique et contrôle serveur du **prix minimum de vente**, ventes,
caisses, facturation et tableaux de bord.

Ceci correspond au MVP V1 du cahier des charges : authentification,
utilisateurs/rôles, boutiques, produits, stocks, prix minimum, ventes,
caisse, factures, dashboard.

## Stack

- Laravel 11, PHP 8.2+
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

## Plateforme SaaS (multi-clients)

Chaque client est une **organisation** (`Organization`) : ses boutiques,
utilisateurs, produits, ventes, stock et plan comptable lui appartiennent.

- **Isolation** : les modèles utilisent les traits `BelongsToOrganization`
  (données de l'organisation) ou `BelongsToTenantShop` (données d'une de ses
  boutiques). Toute requête est limitée à l'organisation de l'utilisateur
  connecté : l'identifiant d'un autre client renvoie 404. Les règles de
  validation passent par `App\Support\TenantRule` (`exists`/`unique` limités
  au client). Voir `tests/Feature/TenantIsolationTest.php`.
- **Accès** : `organizations.status` (`active`, `suspended`, `closed`) est
  distinct de `subscriptions.status` (`trial`, `active`, `past_due`,
  `expired`, `cancelled`). Le middleware `organization.access` répond **402**
  sur toutes les routes métier d'un client suspendu, fermé ou dont
  l'abonnement a expiré ; `/api/me`, `/api/logout` et `/api/subscription`
  restent accessibles.
- **Inscriptions** : une boutique qui s'inscrit (`POST /api/register`) est
  créée inactive (`organizations.status = inactive`, demande `pending`,
  abonnement `pending_payment`) : le responsable peut se connecter pour suivre
  sa demande, rien d'autre. Les Super Admins reçoivent un e-mail (si l'envoi de
  mails est configuré) et voient la demande dans « Inscriptions ». Ils
  l'acceptent avec un essai, avec un premier paiement, ou en attendant le
  paiement ; ils peuvent aussi demander des informations ou la refuser (les
  données sont conservées).
- **Échéances** : `php artisan subscriptions:check` (planifié chaque nuit)
  passe un essai ou une période terminée en `past_due`, puis en `expired`
  après le délai de grâce (`grace_days`, 7 jours par défaut).
- **Fonctionnalités par formule** : `App\Support\PlanFeatures` liste les
  modules activables (employés, dépenses, dettes, bons de commande,
  comptabilité et rapports avancés, export, multi-boutiques) et les limites
  (boutiques, utilisateurs, caisses, produits). Les valeurs de chaque formule
  sont dans `plan_features`, modifiables depuis le Super Admin. L'API refuse
  un module non inclus (middleware `feature:<clé>`, réponse 403
  `feature_not_included`) ; `/api/subscription` renvoie `features`, `limits`
  et `usage`, à partir desquels l'interface construit ses menus
  (`admin-web/src/lib/features.ts`).
- **Super Admin** : les comptes `is_platform_admin` (et eux seuls) accèdent à
  `/api/platform/*` et aux pages « Super Admin » de l'interface : clients,
  suspension/réactivation, abonnements, paiements, formules et historique.
  Le rôle `super_admin` d'un client ne donne accès qu'à sa propre organisation.

## API

Voir `routes/api.php` pour la liste complète des endpoints. Authentification
via `POST /api/login` (retourne un token Sanctum à envoyer en
`Authorization: Bearer <token>`).
