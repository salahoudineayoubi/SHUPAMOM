# Données linguistiques — origine, droits, usage

Les jeux de données vivent dans `.data/datasets/` (ignoré par Git). **Ils ne sont jamais publiés tels quels** (dépôt, site, application) : ni CC0 Common Voice (conditions Mozilla : pas de redistribution du corpus, pas de ré-identification des locuteurs), ni NOODL.

| Jeu de données | Contenu | Licence d'origine | Autorisation SHUPAMOM | Usages |
|---|---|---|---|---|
| Mozilla Common Voice 27.0 — Bamun (`bax`) | 8 669 clips, 11,84 h, 14 locuteurs, 1 030 phrases validées, transcriptions bamoun | CC0 + conditions Mozilla Data Collective | — (CC0) | Évaluation et entraînement de la reconnaissance vocale. Pas utilisé comme contenu de leçon. |
| Bamun–French Parallel Corpus (v1, 2 300 lignes) — propriétaire Abdou Salam Ntieche Fifen, contact Emmanuel Ngué Um, Institute of African Digital Humanities | Phrases bamoun ↔ français | NOODL-1.0 (recherche ; redistribution, IA générative, dérivés soumis à permission) | **Autorisation obtenue par Pemi Salaoudine Ayoubi Ben Ali (selon le porteur du projet, 2026-11)** — ⚠️ copie écrite à archiver dans `docs/legal/` | Dictionnaire, entraînement/évaluation du modèle de traduction, exemples pour le coach |

## À faire (bloquant pour une levée de fonds)

- [ ] Archiver l'accord écrit des ayants droit du corpus bamoun–français (`docs/legal/`), précisant : usage commercial, entraînement de modèles, affichage d'extraits dans l'application, durée, attribution demandée.
- [ ] Mentionner l'attribution dans l'application (écran « À propos / Sources »).
- [ ] Choisir avec les linguistes **une norme orthographique** : les deux corpus n'écrivent pas le bamoun de la même manière (diacritiques, voyelles).

## Règles internes

- Une phrase issue d'un corpus est importée avec `source` = identifiant du corpus et `status = validated` (le corpus est produit et vérifié par des linguistes), sauf avis contraire des ayants droit.
- Les voix Common Voice ne sont pas diffusées aux apprenants (locuteurs anonymes, pas de consentement pédagogique spécifique) : elles servent uniquement à l'entraînement/évaluation.
- Toute nouvelle donnée suit le circuit `content/bamoun/README.md` (consentement des locuteurs, validation).
