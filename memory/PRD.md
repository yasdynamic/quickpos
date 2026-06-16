# QuickPOS — PRD

## Original Problem Statement
> Une application de gestion de point de vente très légère avec une interface tactile et qui génère des états quotidiens et mensuels automatiquement envoyés par mail à la clôture de la journée.

**Vision étendue (Feb 2026)** : caisse moderne inspirée de Clyo, conçue pour les PME africaines, install ultra-simple, archi web React + FastAPI + Mongo (Electron + SQLite envisagé en V2).

## Architecture
- **Backend** : FastAPI + Motor (Mongo async) + Resend SDK + smtplib + zipfile (backup)
- **Frontend** : React 19 + react-router 7 + Recharts + Sonner + Tailwind + Shadcn
- **Hardware** : WebUSB ESC/POS + ouverture tiroir
- **Compliance** : NF525 (journal chainé), TVA multi-taux

## Personas
- **Admin** : paramètres, catalogue, stock, fournisseurs, rapports, sauvegarde
- **Manager** : catalogue, stock, mouvements
- **Serveur** : ouvre session, gère tables, encaisse
- **Patron** : reçoit les Z automatiques par email

## Implemented Features

### v1 — POS de base
- Auth PIN, catalogue, POS tactile, ticket, rapports auto par email

### v2 — Clyo flow
- Tables/zones, commandes, modificateurs, sessions X/Z

### v3-v5 — Multi-devises, NF525, fidélité, TVA, WebUSB, PWA

### v6 — Hub Caisse strict
- Page d'accueil = Hub avec 4 actions tactiles
- Session obligatoire avant toute vente (backend + SessionGuard)
- Réouverture journée même jour (tous rôles)
- Clôture bloquée si ventes en attente
- Mini-dashboard live (CA, ventes, panier moyen, top produit, top 3)

### v7 — Ventes en attente comptoir (POS direct)
- Bouton "Attente" dans POSPage avec label optionnel
- Section "Ventes en attente · Comptoir" dans TablesPage
- Compatible avec le blocage de clôture Z

### v8 — V1 Phase A (16/02/2026) — Vision PME africaine
- **Code-barres** : champs `barcode`, `sku` sur produits ; recherche/scan dans POS (Enter = ajout direct si match exact, sinon recherche partielle)
- **Fournisseurs** : modèle Supplier + CRUD complet + page `/fournisseurs`
- **Stock** : modèle StockMovement (in/out/adjust) + page `/stock` avec entrées, sorties, ajustement inventaire, historique par produit, seuil stock bas (`low_stock_threshold` + endpoint `/api/stock/low`)
- **Coût d'achat & fournisseur sur produit** : `cost_price`, `supplier_id`
- **Backup ZIP** : endpoint `GET /api/backup/export` (17 collections JSON + manifest), bouton dans Paramètres > Sauvegarde
- NF525 étendu pour journaliser les mouvements de stock

## Backlog V1 — Phase B (prochaine session)
- **P1** Retour produit / Avoir (avec NF525)
- **P1** Import / Export Excel des produits (xlsx via openpyxl)
- **P1** Inventaire complet (session de comptage avec écarts)
- **P1** Vente au clavier numérique rapide

## Backlog V2 (vision Electron)
- **P2** Réécriture backend en TypeScript + Prisma + SQLite
- **P2** Packaging Electron (one-click install Windows / macOS / Linux)
- **P2** PWA enrichie (offline-first complet)
- **P3** Multi-magasins
- **P3** Mobile Money (Orange Money, MTN, Wave)
- **P3** PI-SPI BCEAO + Facturation électronique
- **P3** Application Android (React Native ou Capacitor)

## Backlog Clyo features
- **P1** Split bill (partage d'addition)
- **P1** Menus / Formules (combos)
- **P1** Auth JWT + protection routes admin
- **P2** Imprimante cuisine séparée
- **P2** Happy hours, CRON Z auto
- **P2** Refactor `server.py` en routers

## Tests cumulés
- Iterations 1-7 : ~16-22 backend, 100% frontend e2e à chaque
- Iteration 8 (Hub Caisse) : 8/8 backend + 100% frontend
- v7 (holds POS) : testé manuellement end-to-end
- v8 (V1 Phase A) : screenshots smoke + curl backend OK

## Known issues
- Lint pré-existant `react-hooks/set-state-in-effect` sur 6 fichiers (non bloquant, fonctionnel)
- Comparaison "même jour" basée sur UTC (peut basculer à minuit UTC ≠ local)
- Resend = clé de test
