# WARYA — Wrapper Electron Windows

Application Electron qui empaquette WARYA (caisse tactile) en `.exe` Windows
installable, distribué via GitHub Releases.

## Structure

```
electron/
├── package.json          # Métadonnées + config electron-builder (NSIS)
├── build/
│   ├── icon.ico          # Icône Windows multi-tailles (généré à partir du logo)
│   └── icon.png          # Icône 512×512
└── src/
    ├── main.js           # Process principal Electron
    ├── preload.js        # Préchargement (vide pour l'instant)
    └── config.js         # URL WARYA cible
```

## Configuration de l'URL cible

Par défaut, le wrapper charge l'URL définie dans `src/config.js`
(actuellement la preview Emergent). Pour pointer vers ton domaine production :

1. **Édition statique** — modifier `src/config.js` puis commiter.
2. **Override au build** — fournir la variable d'environnement `WARYA_URL`
   lors de `yarn build:win` (ou via l'input `warya_url` du workflow GitHub).

## Build local (Windows uniquement)

```powershell
cd electron
yarn install
yarn build:win
# → electron/dist/WARYA-Setup-1.0.0.exe
```

Sur Linux/macOS le build Windows n'est pas garanti — utilise la CI GitHub.

## Build via GitHub Actions

### Build manuel (artefact uniquement)

1. Va sur `Actions` → `Windows installer (Electron)` → `Run workflow`.
2. (Optionnel) saisis une URL custom (`warya_url`) et des notes de release.
3. À la fin, télécharge `warya-windows-installer` depuis l'onglet Artifacts.

### Release publique (sur tag)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Le workflow crée automatiquement une GitHub Release avec le `.exe` attaché.

## Signature de code (recommandée)

Sans signature, Windows SmartScreen affiche "Windows protected your PC" au
premier lancement (l'utilisateur doit cliquer "Plus d'infos → Exécuter quand
même"). Pour signer :

1. Procure-toi un **Code Signing Certificate** (Sectigo, DigiCert, SSL.com,
   ~100-500€/an). Tu obtiens un fichier `.pfx` + mot de passe.
2. Encode le `.pfx` en base64 :
   ```bash
   base64 -w0 warya-cert.pfx > cert.b64
   ```
3. Dans GitHub → ton repo → `Settings` → `Secrets and variables` → `Actions`,
   ajoute :
   - `WIN_CSC_LINK` = contenu de `cert.b64`
   - `WIN_CSC_KEY_PASSWORD` = mot de passe du `.pfx`
4. Relance le workflow → le `.exe` produit sera signé. SmartScreen accepte
   tout de suite (réputation acquise progressivement avec EV cert).

Le workflow détecte automatiquement la présence des secrets ; pas de
modification du yaml requise.

## Permissions natives

Electron est configuré pour autoriser **WebUSB** (imprimante thermique
ESC/POS) et **WebHID**. Le sélecteur de périphérique natif de Chromium
s'affiche normalement lors du premier `navigator.usb.requestDevice()`.

## Sécurité

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` —
  isolation stricte du renderer.
- Les navigations hors-origine sont bloquées et redirigées vers le
  navigateur système.
- Aucun `eval`, aucune intégration Node dans le renderer.

## Roadmap V2 (Electron offline complet)

Cette version (Option A) reste dépendante d'Internet : c'est un kiosk qui
charge `WARYA_URL`. La V2 (Option C, future) embarquera FastAPI + SQLite
localement pour fonctionner sans réseau. Voir `/app/memory/PRD.md` § "V2".
