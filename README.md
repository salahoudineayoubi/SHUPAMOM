# SHUPAMOM

**Apprends ta langue. Parle avec ta famille. Préserve tes racines.**

Application d'apprentissage du shüpamom (bamoun) pour les francophones d'Afrique et de la diaspora — parcours vedette « Parler à ma grand-mère ». Démo prévue au Nguon de Foumban (4–13 décembre 2026).

- Architecture, modèle de données, API, écrans, risques, critères d'acceptation : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Données et licences : [`docs/DATA_LICENSES.md`](docs/DATA_LICENSES.md)
- Fournir du contenu bamoun (locuteurs, validateurs) : [`content/bamoun/README.md`](content/bamoun/README.md)

> Règle d'or : aucun mot de bamoun n'est inventé. Le contenu non validé est marqué `placeholder`, affiché avec un bandeau, et refusé en production.

## Structure

```
apps/api        API Node.js/Express/TypeScript + MongoDB (auth Google/e-mail/invité, leçons, score, dictionnaire)
apps/mobile     Expo SDK 58 + Expo Router — Android, iOS et web (QR code)
packages/shared Contrats Zod partagés
content/bamoun  Contenu linguistique (JSON) + audios
.data/          Jeux de données privés (ignorés par Git) + base locale
```

## Démarrer en local

```bash
npm install
npm run build:shared

# Base locale (ou un MongoDB existant)
mkdir -p .data/mongo && mongod --dbpath .data/mongo --port 27027 --bind_ip 127.0.0.1

# API — copier apps/api/.env.example vers apps/api/.env (MONGODB_URI=mongodb://127.0.0.1:27027/shupamom)
npm run seed                                   # parcours de démonstration (placeholder)
npm run import:corpus -w @shupamom/api -- ../../.data/datasets/bamun_french_parallel_v1.tsv iadh-bamun-french-v1
npm run dev:api                                # http://localhost:4000/v1/health

# Application
cd apps/mobile && npx expo start               # appuyer sur w (web), a (Android)
```

Build web (QR code) : `cd apps/mobile && EXPO_PUBLIC_API_URL=https://api.exemple.com npx expo export -p web` → dossier `dist/`.

## Tests

```bash
npm test          # API : auth, rotation des sessions, Google, invité→compte, leçons, score, dictionnaire, corpus, production sans placeholder
npm run typecheck
```

## Connexion Google

Même fonctionnement que KolayExpress : le jeton Google est vérifié côté serveur (`google-auth-library`), uniquement pour nos identifiants client, avec e-mail vérifié. Créer dans Google Cloud Console un client OAuth **Web**, **Android** (SHA-1 de la clé de signature) et **iOS**, puis renseigner :

- `apps/api/.env` : `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`
- `apps/mobile/.env` : `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME`

Le bouton Google n'apparaît que lorsque ces identifiants sont configurés. Sur mobile, il faut un build de développement (`npx expo run:android`), pas Expo Go.
