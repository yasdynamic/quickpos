# QuickPOS - PRD

## Original Problem Statement
> Une application de gestion de point de vente très légère avec une interface tactile et qui génère des états quotidiens et mensuels automatiquement envoyés par mail à la clôture de la journée

## Architecture
- **Backend**: FastAPI + Motor (Mongo async) + Resend SDK + smtplib
- **Frontend**: React 19 + react-router 7 + Recharts + Sonner + Tailwind + Shadcn
- **Design**: Swiss & High-Contrast, Manrope + IBM Plex Sans + JetBrains Mono, bleu #002FA7

## Personas
- **Admin / Gérant**: paramètres (devise, utilisateurs, SMTP), catalogue, rapports
- **Serveur**: ouvre une session, gère les tables, encaisse, envoie en cuisine
- **Patron**: reçoit les rapports Z par email

## Implemented features
### v1 — POS de base
- Auth PIN, catalogue (catégories, produits, stock), POS tactile, ticket, dashboard, historique, rapports daily/monthly Resend

### v2 — Clyo refactor
- Multi-serveurs (admin/manager/server)
- Zones + tables + plan de salle (libre/occupé)
- Commande par table : open → add → send-to-kitchen → pay → libérée
- Modificateurs (groupes required/multi avec price_delta)
- Sessions de caisse : ouverture avec fond, fermeture avec écart
- Rapports X (intermédiaire) et Z (clôture définitive + email)

### v3 — Multi-devises
- Settings DB persistées (devise: code, symbole, décimales, position)
- Page `/parametres` avec presets (EUR, FCFA XOF/XAF, USD, GBP, CHF, MAD, TND, CAD)
- Application immédiate dans toute l'app (caisse, rapports, emails)

### v4 — Paramètres avancés (style Clyo)
- Onglets dans Paramètres : Devise / Utilisateurs / SMTP
- **CRUD utilisateurs** : nom, PIN 4-6 chiffres, rôle (admin/manager/server), couleur
- **SMTP** : host, port, user, password (masqué `********`), from_email, from_name, TLS, enabled
- Presets SMTP : Gmail, Outlook 365, OVH, Mailgun, SendGrid
- Bouton "Tester l'envoi" avec retour visuel
- Priorité SMTP > Resend > skip dans `_maybe_send_email`

## Tests cumulatifs
- v1: 16/16 backend (initial)
- v2: 16/16 (full Clyo)
- v3: 22/22 (currency)
- v4: 13/13 nouveaux (users + SMTP) — 100% frontend e2e à chaque itération

## Backlog
- **P1** Splitter `server.py` (~1500 lignes) en modules routes/services
- **P1** Auth boundaries: tokens JWT + protection des routes par rôle (les endpoints settings/users ne sont pas protégés)
- **P1** Scheduler CRON pour clôture Z automatique
- **P2** UI d'édition des modificateurs depuis Produits
- **P2** Drag&drop pour repositionner les tables sur le plan
- **P2** Programme de fidélité par numéro de téléphone
- **P2** TVA et remises paramétrables
- **P2** Impression réelle (ESC/POS thermique + cuisine)
