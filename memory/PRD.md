# QuickPOS - Product Requirements Document

## Original Problem Statement
> Une application de gestion de point de vente très légère avec une interface tactile et qui génère des états quotidiens et mensuels automatiquement envoyés par mail à la clôture de la journée

## User Choices
- **Type de commerce**: Générique configurable (restaurant + boutique + épicerie)
- **Auth**: Code PIN (4-6 chiffres)
- **Email**: Resend
- **Paiements**: Espèces + Carte + Mobile Money
- **Modules supplémentaires (style Clyo Systems)**: plan de salle, session de caisse, rapports X/Z, modificateurs, multi-serveurs

## Architecture
- **Backend**: FastAPI + Motor (Mongo async) + Resend
- **Frontend**: React 19 + react-router 7 + Recharts + Sonner + Tailwind + Shadcn
- **Design**: Swiss & High-Contrast, Manrope + IBM Plex Sans + JetBrains Mono, bleu #002FA7

## Personas
- **Admin / Gérant**: gère catalogue, zones/tables, consulte rapports
- **Serveur**: ouvre une session, encaisse, ouvre/clôture des tables, envoie en cuisine
- **Patron**: reçoit les rapports Z par email automatiquement à la clôture

## Core Requirements
- Connexion par PIN multi-utilisateur (admin/manager/server)
- Catalogue : catégories, produits, **modificateurs** (groupes required/multi avec price_delta)
- Plan de salle : zones + tables avec capacité et position
- Commande par table : ouverture, ajout d'articles (avec modifiers), envoi en cuisine, paiement multi-moyens, ticket
- Vente directe (take-away) : POS classique
- **Session de caisse Clyo** : ouverture avec fond, vente liée à la session, fermeture avec comptage + écart, **rapport Z** définitif envoyé par email
- **Rapport X** : aperçu intermédiaire sans clôturer
- Rapports journaliers/mensuels par email (Resend)
- Dashboard (KPIs + graphiques), historique des ventes

## Implemented (2026-06-15 to 2026-06-16)
### v1
- PIN auth, catégories + produits avec stock, POS tactile, paiement multi-moyens, ticket, dashboard, historique, rapports daily/monthly par email

### v2 (Clyo refactor)
- Multi-serveurs (admin 000000, Sophie 1111, Marc 2222)
- Modificateurs sur produits (Cuisson requise, Suppléments multi)
- Zones + Tables (Salle, Terrasse, Bar)
- Plan de salle avec libre/occupé, total visible
- Commandes par table : open → add items → send-to-kitchen → pay → table free
- Annulation de commande
- Sessions de caisse : open/current/close
- Rapport X (intermédiaire) et Z (clôture avec écart de caisse + email Resend)
- PIN admin migré de 1234 vers 000000 (migration auto)

### Tests
- Backend pytest 16/16 (auth, zones, tables, sessions, orders, modifiers, send-kitchen, pay, X, Z, cancel)
- Frontend e2e Playwright 100% sur tous les flux

## Prioritized Backlog
- **P0** Configurer RESEND_API_KEY pour activer l'envoi réel des rapports
- **P1** UI d'édition des modificateurs depuis la page Produits (actuellement seedés)
- **P1** Scheduler CRON pour clôture Z automatique à heure fixe
- **P1** Splitter backend en modules (routes/services) — server.py ~1300 lignes
- **P2** Plan de salle drag&drop pour repositionner les tables
- **P2** Impression réelle (imprimante thermique ESC/POS, kitchen printer)
- **P2** Programme de fidélité par numéro de téléphone
- **P2** Remises / promotions / TVA paramétrable
- **P2** Backend auth boundaries (tokens, permissions par rôle)
- **P2** Stock insuffisant → 400 explicite plutôt qu'underflow silencieux à 0

## Next Tasks
- Fournir une clé Resend pour activer l'envoi email
- Configurer SENDER_EMAIL et REPORT_EMAIL dans /app/backend/.env
