# Boutique — Interface d'administration

Interface web (React + Vite + TypeScript) pour l'API [Boutique](../README.md) :
tableau de bord, boutiques, produits, stock et ventes.

## Installation

```bash
npm install
cp .env.example .env
```

Par défaut `VITE_API_BASE_URL=http://127.0.0.1:8000/api` — adapte cette valeur
si ton backend Laravel tourne ailleurs.

## Lancer en développement

Le backend Laravel doit tourner en parallèle (`php artisan serve` depuis la
racine du dépôt) :

```bash
npm run dev
```

Connecte-toi avec le compte créé par le seeder Laravel :
- email : `admin@boutique.test`
- mot de passe : `password`

## Build de production

```bash
npm run build
```

## Pages

| Page | Rôle requis | Description |
|---|---|---|
| Connexion | — | Authentification via `/api/login`, jeton Sanctum stocké en local |
| Tableau de bord | tous | Indicateurs (CA, bénéfice, stock, alertes) — vue globale pour le super admin, scopée à la boutique sinon |
| Boutiques | lecture : tous · création : super admin | Liste et création des boutiques |
| Produits | lecture : tous · création : admin boutique/super admin | Catalogue, avec ajout rapide de catégories/fournisseurs |
| Stock | lecture : tous · réception : admin boutique/super admin | Lots de stock, avec calcul du coût de revient et du prix minimum |
| Ventes | tous | Historique des ventes, nouvelle vente avec ouverture de caisse et **application côté serveur du prix minimum** |
