# SHUPAMOM — Architecture du MVP (Nguon 2026)

> Objectif : une application **réellement utilisable** (web + Android) avant le **4 décembre 2026**, qui permet à un francophone d'apprendre le bamoun (shüpamom) — avec, en vedette, le parcours **« Parler à ma grand-mère »**.
>
> Règle d'or : **aucun mot, traduction ou audio bamoun n'est inventé**, ni par l'IA, ni par les développeurs. Tout contenu bamoun affiché comme référence doit avoir le statut `validated` par un locuteur compétent. Les données de test sont marquées `placeholder` et l'interface les affiche avec un bandeau « Contenu de démonstration — non validé ».

---

## 1. Monorepo

```
shupamom/
├── apps/
│   ├── mobile/          Expo SDK 58 + Expo Router + TypeScript — Android + web (QR code au Nguon)
│   └── api/             Node.js 22 + Express + TypeScript + Mongoose — API REST versionnée /v1
├── packages/
│   └── shared/          Types + schémas Zod partagés (contrats d'API, enums, règles de validation)
├── services/
│   └── speech/          (plus tard) Python FastAPI — reconnaissance vocale bamoun EXPÉRIMENTALE, isolée
├── content/
│   └── bamoun/          Contenu linguistique source (JSON) + audios — importé en base par script, versionné
└── docs/
```

npm workspaces. Un seul `npm install` à la racine. Les apps importent `@shupamom/shared`.

**Pourquoi REST et pas GraphQL ici** : surface d'API petite, cache HTTP simple pour l'audio et les leçons, et la validation Zod partagée suffit. (Migrable plus tard.)

## 2. Les deux moteurs

| Moteur | Rôle | MVP Nguon |
|---|---|---|
| **Moteur linguistique** | Sert les expressions, traductions, audios, dictionnaire — uniquement des contenus `validated` en production | Oui |
| **Moteur pédagogique (coach IA)** | Choisit la prochaine activité, explique en français, adapte les exercices, révision espacée | Oui — la sélection est algorithmique (déterministe) ; le LLM sert à **expliquer en français** et ne reçoit/ne cite que des expressions validées passées dans son contexte |
| Reconnaissance vocale | Bamoun → texte | Module expérimental séparé, désactivé par défaut (feature flag), après évaluation (taux d'erreur mesuré sur voix inconnues) |

Garde-fou du coach : la réponse du LLM est post-filtrée — tout segment présenté comme du bamoun qui ne correspond pas à une `Phrase.text` validée fournie dans le contexte est rejeté et la réponse est régénérée ou remplacée par une explication sans bamoun.

## 3. Modèle de données (MongoDB / Mongoose)

| Collection | Champs clés |
|---|---|
| **Language** | `code` (`bax` = bamoun ISO 639-3, `fr`), `name`, `scripts[]` (`latin`, `bamum` U+A6A0–A6FF), `rtl`, `active` |
| **Phrase** | `languageCode`, `text`, `script`, `normalized` (recherche), `context` (salutation, famille, marché…), `register` (respect aîné / familier), `dialectNote`, `status` (`placeholder` \| `draft` \| `in_review` \| `validated` \| `rejected`), `audioIds[]`, `tags[]` |
| **Translation** | `sourcePhraseId`, `targetPhraseId`, `literalGloss?`, `usageNote?`, `status` |
| **AudioRecording** | `phraseId`, `speakerId` (pseudonymisé), `storageKey` (S3), `durationMs`, `format`, `consentId`, `status` |
| **Speaker** | `pseudonym`, `ageBand`, `gender?`, `region`, `consentId` — jamais de nom public |
| **LinguisticValidation** | `targetType` (`phrase`/`translation`/`audio`), `targetId`, `validatorId`, `decision`, `comment`, `createdAt` — historique complet, une expression publiée a ≥ 1 validation `approved` |
| **Consent** | `subjectType` (`speaker`/`user`), `subjectId`, `scopes[]` (`publish_audio`, `train_models`, `research`), `version`, `givenAt`, `revokedAt?` |
| **LearningPath** | `languageCode`, `slug` (`parler-a-ma-grand-mere`, `decouverte`…), `goal`, `lessonIds[]`, `order` |
| **Lesson** | `pathId`, `title`, `objective`, `phraseIds[]`, `exerciseIds[]`, `order`, `estimatedMinutes` |
| **Exercise** | `lessonId`, `type` (`mcq` \| `match` \| `fill_blank` \| `listen_choose` \| `dialogue_turn`), `prompt`, `payload` (options/réponses par références `phraseId`), `difficulty` |
| **User** | `email`, `passwordHash` (argon2), `displayName`, `nativeLanguage`, `learningLanguage`, `level`, `goal` (`famille` \| `racines` \| `voyage` \| `courant`), `roles[]` (`learner`, `validator`, `admin`) |
| **UserProgress** | `userId`, `lessonId`, `completedAt`, `score`, `attempts`; + `ReviewItem` (`userId`, `phraseId`, `ease`, `intervalDays`, `dueAt`) pour la répétition espacée (SM-2) |
| **Feedback** | `userId?`, `targetType`, `targetId`, `kind` (`bug`, `translation_doubt`, `suggestion`), `message`, `consent` |

Index : `Phrase {languageCode, normalized}` (texte), `ReviewItem {userId, dueAt}`, `UserProgress {userId, lessonId}` unique.

**Publication** : l'API publique ne renvoie que `status: validated` en production. En développement/démo, `placeholder` peut être servi **avec le flag `isPlaceholder: true`**, que l'app affiche obligatoirement.

## 4. API v1 (extraits)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout` | JWT court (15 min) + refresh token rotatif (cookie httpOnly sur web, SecureStore sur mobile) |
| GET/PATCH | `/v1/me` | Profil + onboarding (langue parlée, langue apprise, niveau, objectif) |
| GET | `/v1/paths?lang=bax` | Parcours disponibles |
| GET | `/v1/paths/:slug` | Leçons du parcours + progression |
| GET | `/v1/lessons/:id` | Expressions (texte, traduction, audio URL signée), exercices |
| POST | `/v1/lessons/:id/attempts` | Soumettre les réponses → score, progression, mise à jour révisions |
| GET | `/v1/review/due` | Éléments à réviser |
| GET | `/v1/dictionary?q=…&from=fr&to=bax` | Recherche d'expressions **validées** (pas de traduction libre) |
| POST | `/v1/coach/next` | Prochaine activité recommandée + explication courte en français |
| POST | `/v1/feedback` | Signalement / doute de traduction |
| POST | `/v1/admin/phrases`, `/v1/admin/validations` | Back-office linguistes (rôle `validator`) |
| GET | `/v1/health` | Supervision |

Validation de chaque entrée/sortie par les schémas Zod de `@shupamom/shared`. Rate limiting sur auth et coach. Erreurs JSON uniformes `{ error: { code, message } }`.

## 5. Écrans (Expo Router)

1. **Accueil / QR** — « Retrouve ta langue. Reconnecte-toi à tes racines. » → Commencer (sans compte pour la démo) / Se connecter
2. **Onboarding** (4 étapes) — Je parle… / Je veux apprendre… / Mon niveau / Pourquoi ? (famille, racines, voyage, couramment)
3. **Tableau de bord** — mission du jour, progression, série de jours, révisions dues
4. **Parcours « Parler à ma grand-mère »** — missions : saluer, demander des nouvelles, se présenter, dire au revoir
5. **Leçon** — cartes expression (texte bamoun, traduction, ▶ audio natif), puis exercices
6. **Exercice** — QCM, associer, compléter, écouter-choisir, tour de dialogue
7. **Fin de mission** — progrès, invitation à créer un compte pour continuer
8. **Dictionnaire** — recherche français → bamoun (expressions validées)
9. **Coach** — recommandation + explication en français
10. **Profil** — objectif, langue, consentements, export/suppression des données

Parcours démo Nguon (≤ 3 min, sans inscription) : QR → « Je parle français, je veux apprendre le bamoun » → objectif « parler avec ma famille » → mission « Saluer ma grand-mère » → 3 expressions + audio → 3 exercices → écran de fin + inscription.

## 6. Risques et parades

| Risque | Impact | Parade |
|---|---|---|
| **Contenu bamoun validé + audios natifs arrivent tard** | Bloquant pour la démo | C'est le chemin critique : recruter 2–3 locuteurs/enseignants dès cette semaine ; outil d'import JSON + script d'enregistrement simple ; démo possible avec 30–50 expressions |
| IA qui invente du bamoun | Perte de crédibilité, faute culturelle | Coach contraint aux expressions validées + filtre de sortie + tests automatiques |
| Orthographe / écriture (latin vs écriture bamoum de Njoya) | Incohérences | Champ `script` par expression ; MVP en orthographe latine validée ; écriture bamoum en option affichée si fournie |
| Réseau faible au festival | Démo qui rame | Leçons + audios de la mission démo pré-cachés ; build web statique ; vidéo de secours |
| Reconnaissance vocale insuffisante | Fausse promesse | Module expérimental isolé, jamais présenté comme fiable sans métrique |
| Licences des corpus (Common Voice, autres) | Juridique / investisseurs | Vérifier chaque licence avant usage commercial ; privilégier nos propres enregistrements avec consentement écrit |
| Données personnelles (voix) | RGPD / confiance | Consentement explicite par usage, pseudonymisation, suppression sur demande |
| Délai (27 jours) | Périmètre | Périmètre gelé (section 7), tout le reste après le Nguon |

## 7. Critères d'acceptation du MVP Nguon

- [ ] Web (URL + QR) et APK Android installables, fonctionnant sur un Android d'entrée de gamme.
- [ ] Parcours démo complet en ≤ 3 min sans compte ; compte créable ensuite et progression conservée.
- [ ] Onboarding 4 étapes enregistré dans le profil.
- [ ] ≥ 6 mini-modules ; ≥ 50 expressions **toutes `validated`** avec audio natif (aucun `placeholder` en production — vérifié par un test).
- [ ] 5 types d'exercices fonctionnels, score et progression enregistrés.
- [ ] Dictionnaire français → bamoun sur les expressions validées.
- [ ] Coach : recommandation pertinente + explication en français ; jamais de bamoun hors corpus validé (test automatisé).
- [ ] Révision espacée opérationnelle.
- [ ] Mode hors-ligne de la mission démo (contenus + audio en cache).
- [ ] Sécurité : mots de passe argon2, JWT + refresh rotatif, rate limiting, aucun secret côté client, CORS restreint.
- [ ] Tests unitaires + intégration sur auth, leçons/tentatives, dictionnaire, garde-fou du coach ; CI verte.
- [ ] Consentements locuteurs enregistrés pour chaque audio publié.
- [ ] Documentation : installation, import de contenu, déploiement.

## 8. Plan de développement

| Dates | Livrable |
|---|---|
| 7–12 nov. | Monorepo, modèles, auth, onboarding, socle UI, import de contenu, **1 leçon + 1 exercice de bout en bout** |
| 13–19 nov. | Parcours, 5 types d'exercices, audio + cache, dictionnaire, progression, fin de mission |
| 20–26 nov. | Coach IA + garde-fou, révision espacée, back-office validation, hors-ligne |
| 27 nov.–3 déc. | Contenu validé final, tests sur vrais téléphones, build web + APK, QR, vidéo de secours, dossier investisseurs |
