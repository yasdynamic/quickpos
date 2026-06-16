# QuickPOS — PRD

## Original Problem Statement
> Une application de gestion de point de vente très légère avec une interface tactile et qui génère des états quotidiens et mensuels automatiquement envoyés par mail à la clôture de la journée.

Évolution: clone fonctionnel "Clyo Systems" en PWA (kiosque), impression directe ESC/POS via WebUSB, RBAC PIN, conformité NF525 (hash blockchain), fidélité client, TVA multi-taux, remises, multi-devises, envoi automatique des Z par email.

## Architecture
- **Backend**: FastAPI + Motor (Mongo async) + Resend SDK + smtplib
- **Frontend**: React 19 + react-router 7 + Recharts + Sonner + Tailwind + Shadcn
- **Design**: Swiss / High-Contrast, Manrope + IBM Plex Sans + JetBrains Mono, bleu #002FA7
- **Hardware**: WebUSB → impression directe ESC/POS 80mm + ouverture tiroir-caisse

## Personas
- **Admin / Gérant**: paramètres (devise, utilisateurs, SMTP, destinataires email verrouillés), catalogue, rapports
- **Serveur**: ouvre une session, gère les tables, encaisse, envoie en cuisine
- **Patron**: reçoit les Z automatiques à la clôture

## Implemented Features
### v1 — POS de base
- Auth PIN, catalogue (catégories, produits, stock), POS tactile, ticket, dashboard, historique, rapports daily/monthly Resend

### v2 — Clyo refactor
- Multi-serveurs (admin/manager/server), Zones + tables + plan de salle, Commande par table, Modificateurs
- Sessions de caisse (ouverture/clôture), Rapports X (intermédiaire) et Z (clôture + email)

### v3 — Multi-devises
- Devise paramétrable (EUR/FCFA/USD/GBP/CHF/MAD/TND/CAD) appliquée partout

### v4 — Paramètres avancés
- CRUD utilisateurs, SMTP custom (Gmail/Outlook/OVH/Mailgun/SendGrid), bouton "tester l'envoi"

### v5 — Conformité & fidélité
- NF525: journal immuable chainé (hash + previous_hash), endpoint /api/nf525/verify
- Fidélité client par téléphone (points configurables)
- TVA multi-taux par produit + rapport TVA
- Remise globale au panier (% ou montant fixe)
- Impression ESC/POS WebUSB directe (ticket + journal Z + tiroir-caisse)
- PWA installable

### v6 — Hub Caisse strict (16/02/2026)
- **Page d'accueil = "Caisse Hub"** après login, 4 boutons tactiles:
  1. Vente directe (`/vente-rapide`)
  2. Ventes en attente (`/tables`, badge nombre de commandes)
  3. Bande de contrôle (état X, `/session?view=x`)
  4. Clôture de la journée (état Z, `/session?view=z`)
- **Ouverture de caisse obligatoire** avant toute vente — backend rejette `POST /sales` et `POST /orders/{id}/pay` avec 400 si aucune session ouverte
- **SessionGuard** côté frontend redirige `/tables`, `/vente-rapide`, `/commande/:id` vers le Hub si pas de session
- **Réouverture d'une journée**: si la session a été clôturée le même jour calendaire (UTC), bouton "Rouvrir la journée" — autorisée pour tous les rôles
- **Clôture bloquée tant qu'il reste des ventes en attente**: backend rejette `POST /cash-sessions/{id}/close` si `orders.status=open` existent; frontend affiche bordure ambrée + texte "Bloqué · N vente(s) en attente" sur le Hub, et désactive le bouton de clôture dans SessionPage avec un appel à l'action "Voir les ventes en attente"
- **Destinataires email Z verrouillés**: seul l'admin peut écraser la liste via `recipient_email` à la clôture

## Tests cumulatifs
- v1: 16/16 backend
- v2: 16/16 (full Clyo)
- v3: 22/22 (currency)
- v4: 13/13 (users + SMTP)
- v5: NF525/loyalty/TVA testés
- v6 (iter 8): 8/8 backend pytest + 100% frontend e2e (Hub + SessionGuard + reopen)

## Tech Stack
- Backend: FastAPI, Motor, Pydantic, Resend, smtplib, hashlib (NF525)
- Frontend: React 19, react-router 7, Tailwind, Shadcn UI, Sonner, Lucide, Recharts
- DB: MongoDB (motor async)

## DB Schema (key collections)
- `users`: id, name, pin, role(admin/manager/server), color
- `products`: id, name, price, category, modifiers, tva_rate, stock
- `orders`: id, table_id, items, status(open/paid/cancelled), discount, session_id, covers
- `sales`: id, ticket_number, items, subtotal, discount_amount, total, tva_breakdown, payment_method, session_id, hash, previous_hash
- `cash_sessions`: id, opened_at, closed_at, opening_cash, closing_cash_declared, expected_cash, cash_difference, status
- `customers`: id, phone, name, points
- `settings`: currency, smtp, report_recipients, print, loyalty

## Backlog (priorités)
### P1
- Split bill (partage d'addition)
- Menus / Formules (combos)
- Auth: tokens JWT + protection des routes admin (`/settings`, `/users`)
- Scheduler CRON pour clôture Z automatique à heure fixe

### P2
- Imprimante cuisine séparée (routage ESC/POS multi-périphériques)
- Happy hours (tarification horaire)
- UI d'édition des modificateurs depuis Produits
- Drag&drop pour repositionner les tables sur le plan
- Splitter `server.py` (~1700 lignes) en routers (`routes/sales.py`, `routes/auth.py`, etc.)
- Bande de contrôle: vue dédiée X (focus séparé de la clôture Z)

## Known issues / Caveats
- Comparaison "même jour calendaire" basée sur UTC dans backend & frontend — peut basculer à minuit UTC plutôt qu'au minuit local
- Lint warning pré-existant dans SessionPage.jsx (`react-hooks/set-state-in-effect` sur `closeSession`) — fonctionnel mais à refactoriser
- Resend API key actuelle est une clé de test (`re_fGRq...`)
