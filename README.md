# WARYA — Logiciel de caisse pour PME africaines

> Caisse tactile moderne inspirée de Clyo Systems, conçue pour les PME africaines.
> Fonctionne hors ligne pendant plusieurs mois après activation, protégée par
> signatures cryptographiques Ed25519 + AES-256-GCM.

![Status](https://img.shields.io/badge/status-V1%20PMR-blue) ![License](https://img.shields.io/badge/license-Proprietary-red)

## ✨ Fonctionnalités V1

- **Hub Caisse** tactile + POS direct + commandes par table + ventes en attente comptoir
- **Catalogue** produits (code-barres, SKU, coût, fournisseur, stock bas) + **Menus / Formules** (combos prix fixe avec décrément stock auto)
- **Stock** : entrées/sorties/ajustements, historique, alertes stock bas
- **Inventaire complet** : snapshot → comptage → écarts → clôture avec ajustements en masse
- **Retours / Avoirs** NF525 (vente négative chaînée, restitution stock)
- **Import / Export Excel** des produits (openpyxl)
- **Multi-devises** : EUR, FCFA (XOF/XAF), USD, GBP, CHF, MAD, TND, CAD
- **NF525** : journal cryptographiquement chaîné (SHA-256) + audit & traçabilité
- **Système de licences hors ligne** : Ed25519 + AES-256-GCM, empreinte machine, mode restreint à expiration
- **Permissions par profil** : matrice 36 permissions × 3 rôles (Admin/Manager/Serveur)
- **Sauvegarde ZIP** locale (19 collections)
- **WebUSB ESC/POS** 80mm direct + ouverture tiroir
- **Identité point de vente** paramétrable + logo

## 🏗 Architecture

- **Backend** : FastAPI + Motor (MongoDB async) + Resend SMTP + openpyxl + cryptography (Ed25519/AES-256)
- **Frontend** : React 19 + Tailwind + Sonner + Lucide + Recharts
- **Crypto** : Ed25519 (signatures licence) + AES-256-GCM (obfuscation) + SHA-256 (NF525)
- **Hardware** : WebUSB ESC/POS 80mm, tiroir-caisse

**Roadmap V2** : portage en **Electron + SQLite + TypeScript + Prisma** pour un déploiement desktop one-click installer.

## 🚀 Installation locale

### Prérequis
- Python 3.11+, Node 20+, MongoDB 7+
- Optionnel : Chrome/Edge en HTTPS pour WebUSB

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # configurer MONGO_URL, LICENSE_SALT, RESEND_API_KEY...
uvicorn server:app --reload
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

### Activation
1. Premier lancement → page d'activation affichant l'empreinte machine `POS-XXXX-XXXX-XXXX`
2. Envoyer cette empreinte à l'éditeur (WhatsApp / SMS / email)
3. L'éditeur génère le fichier `.lic` :
   ```bash
   python backend/tools/license_gen.py \
     --company "Nom Client" \
     --fingerprint POS-XXXX-XXXX-XXXX \
     --years 1 --edition Business --max-users 5 \
     --out client.lic
   ```
4. Glisser-déposer le `.lic` dans l'écran d'activation → activé hors ligne pour 1 an

## 📂 Structure

```
warya/
├── backend/
│   ├── server.py                  # FastAPI monolith
│   ├── licensing/                 # Module Ed25519 + AES-256
│   │   └── public_ed25519.pem
│   ├── nf525_loyalty.py           # Journal NF525 + fidélité
│   ├── tools/license_gen.py       # CLI éditeur (clé privée locale)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Hub, POS, Tables, Stock, Inventaire, Retours…
│   │   ├── components/settings/   # 9 onglets (Shop, Permissions, Audit, …)
│   │   ├── context/               # Auth, Settings, Printer, License
│   │   └── lib/escpos.js
│   └── public/brand/              # Logo WARYA + icônes PWA
└── .github/workflows/             # CI + build Windows (V2)
```

## 🔑 Identifiants de démo

| Rôle | Nom | PIN |
|---|---|---|
| Admin | Admin | `000000` |
| Serveur | Sophie | `1111` |
| Serveur | Marc | `2222` |

## 🛣️ Roadmap

| Phase | État |
|---|---|
| V1 — Web React+FastAPI | ✅ Livrée |
| Split bill · JWT auth · Logo imprimé ticket | 🚧 P1 |
| V2 — Electron + SQLite one-click installer Windows | 📋 Vision |
| Mobile Money · BCEAO · Android · Multi-magasins | 📋 Vision |

## 📜 Licence

Logiciel propriétaire — voir [`LICENSE`](./LICENSE). Tout usage commercial nécessite une licence valide générée par l'éditeur.
