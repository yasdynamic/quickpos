# WARYA — PRD

## Original Problem Statement
> Application de caisse moderne inspirée de Clyo Systems, conçue pour les PME africaines, simple à installer et utiliser, fonctionnant hors ligne plusieurs mois sans dépendre d'Internet.

## Architecture
- Backend FastAPI + Motor (Mongo) — sera porté en Electron + SQLite pour la V2
- Frontend React 19 + Tailwind + Sonner + Lucide + Recharts
- Crypto: Ed25519 (licences) + AES-256-GCM (obfuscation) + SHA-256 (NF525 chain, fingerprint)
- Hardware: WebUSB ESC/POS 80mm, tiroir-caisse

## Personas
Admin / Manager / Serveur — permissions personnalisables (matrice par profil)

## Features livrées

### Cœur métier
- POS tactile + vente directe + vente en attente comptoir
- Plan de salle (zones, tables, capacités) + commandes par table + modificateurs
- Sessions de caisse strictes (Hub obligatoire après login, ouverture/clôture, X/Z par email auto)
- Clôture bloquée si ventes en attente ; réouverture journée même jour pour tous rôles

### Catalogue & opérations
- Catégories, produits (barcode, SKU, cost_price, supplier, low_stock_threshold)
- Fournisseurs (CRUD)
- Stock (mouvements in/out/adjust, historique par produit, alertes stock bas)
- Inventaire complet (snapshot → comptage → écarts → clôture avec ajustements en masse)
- Retours / Avoirs (vente négative NF525, restitution stock, validation max par ligne)
- Import / Export Excel des produits (openpyxl, dry-run + preview)
- Numpad article libre (montant hors catalogue)

### Compliance
- NF525 (journal chainé immuable, vérification, types TICKET/REFUND/CANCEL/Z/X/PARAM/LOGIN/USER/STOCK)
- TVA multi-taux, remises panier
- Fidélité client par téléphone

### Compatibilité internationale
- Multi-devises (EUR, FCFA/XOF/XAF, USD, GBP, CHF, MAD, TND, CAD)
- Locale FR

### Impression
- ESC/POS WebUSB direct (ticket + journal Z + tiroir-caisse)
- Identité point de vente paramétrable : nom, adresse, téléphone, email, NIF/TVA, site web, message de pied
- Logo upload (PNG/JPG → conversion automatique N&B + redimensionnement 384px max pour 80mm)

### Hub & UI
- Hub Caisse strict avec mini-dashboard live (CA, ventes, panier moyen, top 3 du jour, refresh 30s)
- Bannières licence (90j/30j/expirée) + désactivation des actions en mode restreint
- Branding **WARYA** (logo en grand sur login + activation, manifest PWA, headers)
- Page de connexion épurée : grand logo + nom d'utilisateur + PIN tactile (pas de slogan)

### Sécurité & exploitation
- **Système de licences hors ligne** : Ed25519 + AES-256-GCM, empreinte machine (hostname+MAC+machine-id+sel .env)
- CLI éditeur `tools/license_gen.py` (génère .lic signé + chiffré)
- Activation par glisser-déposer du .lic, mode restreint à expiration (90j/30j/0j warnings)
- Sauvegarde ZIP locale (19 collections JSON + manifest)
- Permissions par profil (matrice configurable : `role_permissions` dans settings + catalogue `/api/permissions/catalog`)
- **Permissions appliquées côté API** : `require_permission(perm_key)` gating sur `POST /api/refunds` (`refund.create`) et `POST /api/orders/{id}/discount` (`discount.apply`) — défense en profondeur (Feb 2026)
- **Réparation NF525** : `POST /api/journal/repair` (admin only, `?confirm=true`) — reconstruit la chaîne en ordre chronologique, ajoute une entrée PARAM/journal_repair. UI : bouton "Réparer la chaîne" dans Paramètres → Audit lorsqu'une vérification détecte une corruption. (Feb 2026)
- **`append_journal` rollback de séquence** : si l'insertion échoue après réservation du `seq`, le compteur est décrémenté pour éviter les gaps permanents. (Feb 2026)

### Impression (mise à jour Feb 2026)
- ESC/POS WebUSB direct (ticket + journal Z + tiroir-caisse)
- Identité point de vente paramétrable : nom, adresse, téléphone, email, NIF/TVA, site web, message de pied
- **Logo WARYA raster ESC/POS** (`GS v 0`) : `lib/escpos.js` → `buildRasterImage` + `loadLogoBytes` (cache en mémoire), max 384px (80mm) ou 256px (58mm), monochrome avec seuil 180
- **ReceiptModal UI** : affiche le logo + nom commerce + adresse + téléphone + email + site + NIF
- Logo par défaut : `/assets/warya-logo-print.png` (raster) + `/assets/warya-logo-ui.png` (preview)

## API endpoints clés
- `POST /api/auth/login` (name + pin, case-insensitive)
- `POST /api/sales`, `POST /api/orders/{id}/pay`, `POST /api/refunds`
- `POST /api/cash-sessions/open` `/close` `/{id}/reopen`
- CRUD `/api/zones` `/api/tables` `/api/products` `/api/suppliers` `/api/customers`
- `POST /api/stock/movements` `POST /api/stock/adjust` `GET /api/stock/low`
- `POST /api/inventory/sessions` `PUT` `POST /close`
- `GET /api/exports/products.xlsx` `POST /api/imports/products`
- `GET /api/backup/export`
- `GET /api/license/status` `POST /api/license/activate` `DELETE /api/license`
- `GET /api/permissions/catalog`
- `GET/PUT /api/settings` (currency, smtp, print, loyalty, role_permissions)

### Distribution desktop (Feb 2026)
- **Wrapper Electron Windows** : dossier `/app/electron/` (Electron 31 + electron-builder 24 + NSIS)
- Charge l'URL WARYA (configurable via `electron/src/config.js` ou env `WARYA_URL`)
- Permissions WebUSB autorisées automatiquement (imprimante thermique ESC/POS)
- Workflow GitHub Actions `electron-windows.yml` : build manuel + sur tag `v*.*.*`
- Signature de code conditionnelle (secrets `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`)
- Icône WARYA multi-tailles (16/24/32/48/64/128/256) générée depuis `frontend/public/assets/warya-logo.png`

## Backlog
### P1
- Settings UI "Profils & Permissions" (matrice rendant `role_permissions`)
- Split bill (partage d'addition)
- ✅ ~~Menus / Formules (combos)~~ (livré)
- JWT auth + protection des routes admin
- ✅ ~~Logo imprimé sur ticket ESC/POS (raster GS v 0)~~ (livré Feb 2026)
- ✅ ~~Permissions API-side pour `refund.create` & `discount.apply`~~ (livré Feb 2026)
- ✅ ~~Réparation chaîne NF525 (`/journal/repair` + rollback append_journal)~~ (livré Feb 2026)

### P2
- Impression du ticket d'avoir physique
- Inventaire partiel (filtres)
- Excel modifiers
- CRON clôture Z auto
- Imprimante cuisine séparée
- Happy hours
- Rappel sauvegarde > 7 jours
- License Manager admin (Electron)
- Refactor server.py → routers

### V2 (Electron + SQLite + protection contre la copie)
- Migration backend → TypeScript + Prisma + SQLite
- Packaging Electron one-click installer Win/macOS/Linux
- Empreinte machine côté PC client (disk serial + cpu id natif)
- Obfuscation code Electron + intégrité fichiers critiques
- Multi-magasins, Mobile Money, BCEAO, Android

## Identifiants test
- Admin (PIN 000000) / Sophie (PIN 111111) / Marc (PIN 222222) — login = name + PIN
- Empreinte serveur actuelle : `POS-D79C-CE21-621B`
- Démo licence : `/tmp/quickpos.lic` (peut être régénérée via `python3 /app/backend/tools/license_gen.py --years 1`)
