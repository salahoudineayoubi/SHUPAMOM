# Contenu shüpamom (bamoun) — guide pour les locuteurs et validateurs

SHUPAMOM n'invente **aucun** mot de bamoun. Tout le contenu vient de locuteurs natifs et est vérifié avant d'être montré aux apprenants.

## Ce dont nous avons besoin

Pour chaque expression :

| Champ | Exemple | Obligatoire |
|---|---|---|
| `key` | `salut.bonjour_grand_mere` (identifiant stable, minuscules) | oui |
| `bamoun` | l'expression écrite en bamoun (orthographe latine validée) | oui |
| `french` | `Bonjour grand-mère` | oui |
| `context` | `salutation`, `nouvelles`, `presentation`, `au_revoir`, `famille`, `marche`… | conseillé |
| `register` | `respect` (aînés), `familier`, `neutre` | conseillé |
| `usageNote` | « À dire le matin, en s'inclinant légèrement » | facultatif |
| `audio.file` | `bonjour_grand_mere_L01.mp3` (fichier dans `audio/`) | conseillé |
| `audio.speaker` | `L01` (pseudonyme du locuteur, jamais son nom) | si audio |
| `status` | `validated` **uniquement** après vérification par un locuteur compétent | oui |

## Locuteurs et consentement

Chaque voix enregistrée doit avoir un consentement écrit. Dans le fichier, le locuteur apparaît sous un **pseudonyme** :

```json
"speakers": [
  { "pseudonym": "L01", "ageBand": "70+", "region": "Foumban",
    "consent": { "version": "2026-11", "givenAt": "2026-11-10", "scopes": ["publish_audio"] } }
]
```

`publish_audio` est nécessaire pour qu'un audio soit publié dans l'application. `train_models` (entraîner des modèles de reconnaissance vocale) est une autorisation **séparée**, à demander explicitement.

## Enregistrements audio

- Format MP3 ou M4A, mono, 44,1 kHz, pièce calme, téléphone à 20 cm de la bouche.
- Un fichier par expression, dit naturellement, puis une seconde fois plus lentement si possible (deux fichiers).
- Nom : `<key>_<pseudonyme>.mp3`.

## Importer

```bash
npm run import:content -w @shupamom/api -- content/bamoun/mon_fichier.json
```

L'import est idempotent : relancer le même fichier met à jour les expressions par `key`.

`demo_placeholder.json` est un fichier de **démonstration** : toutes ses expressions bamoun sont des emplacements `placeholder`. L'application les affiche avec la mention « Contenu de démonstration — expression bamoun non encore validée », et la production refuse de les servir.
