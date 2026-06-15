# QuickPOS - Product Requirements Document

## Original Problem Statement
> Une application de gestion de point de vente très légère avec une interface tactile et qui génère des états quotidiens et mensuels automatiquement envoyés par mail à la clôture de la journée

## User Choices
- **Type de commerce**: Générique configurable (restaurant, boutique, épicerie)
- **Auth**: Code PIN simple (4-6 chiffres)
- **Email**: Resend (RESEND_API_KEY à fournir par l'utilisateur)
- **Paiements**: Espèces + Carte + Mobile Money
- **Fonctionnalités**: Stock simple, ticket de caisse, dashboard avec graphiques, historique

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async) + Resend SDK
- **Frontend**: React 19 + react-router 7 + Recharts + Sonner + Tailwind + Shadcn UI
- **Design system**: Swiss & High-Contrast (Light), Manrope + IBM Plex Sans + JetBrains Mono, blue #002FA7

## Personas
- **Caissier**: encaisse les ventes au quotidien, vue tactile dédiée
- **Gérant (admin)**: gère le catalogue, consulte les rapports, déclenche les clôtures

## Core Requirements (static)
- Connexion par PIN
- Catalogue produits + catégories (CRUD) avec stock optionnel
- Écran caisse (POS) tactile : grille produits + panier + encaissement multi-paiement
- Aperçu / impression de ticket
- Tableau de bord (KPIs, ventes par heure, par catégorie, par paiement, top produits)
- Historique des ventes filtrable par date
- Clôture journalière : agrégation + email Resend (HTML)
- Rapport mensuel : agrégation + email Resend
- Persistance des clôtures

## Implemented (2026-06-15)
- API: auth/login, users CRUD, categories CRUD, products CRUD, sales (POST+GET), dashboard, daily/monthly reports, send daily/monthly via Resend, closures history, settings
- Frontend: Login (PIN pad), POS (split layout 70/30), Products+Categories admin, Dashboard (Recharts), History, Reports (Resend send)
- Seed: 1 admin PIN=1234, 4 catégories, 11 produits
- Émails dégradent gracieusement quand RESEND_API_KEY n'est pas configurée (statut "skipped"), la clôture est tout de même enregistrée

## Prioritized Backlog
- **P0** Configurer RESEND_API_KEY pour activer l'envoi réel
- **P1** Scheduler automatique (CRON) pour clôturer à heure fixe chaque jour
- **P1** Export PDF/CSV en pièce jointe email
- **P2** Multi-utilisateur (cassiers nominatifs + journal d'audit)
- **P2** Remises / promotions / TVA paramétrable
- **P2** Mode hors-ligne avec resynchronisation
- **P2** Tickets imprimables ESC/POS sur imprimante thermique

## Next Tasks
- Demander la clé Resend à l'utilisateur et activer l'envoi réel
- Tester de bout en bout via testing agent
