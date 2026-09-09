# RAG — Sources documentaires de 66 Origin

Ce dossier regroupe les différentes sources documentaires utilisées ou préparées pour le système RAG de 66 Origin.

Il contient deux ensembles distincts :

- `rag/docs/` : contenus éditoriaux enrichis et maintenus manuellement ;
- `rag/generated/` : contenus générés automatiquement depuis le site public `66origin.com`.

La génération automatique reste séparée de l’ingestion dans le File Search Store. Aucun fichier généré n’est envoyé automatiquement au store.

---

## Structure

```
rag/
├── docs/
│   ├── case-studies/
│   ├── contenus/
│   └── personnalite/
│       └── storytelling/
├── generated/
│   ├── insights/
│   ├── pages/
│   ├── team/
│   ├── works/
│   ├── manifest.json
│   └── last-run.json
```

---

## `docs/` — Sources éditoriales enrichies

Le dossier `docs/` contient les connaissances maintenues manuellement pour le système RAG.

Ces fichiers peuvent inclure des informations plus détaillées que celles affichées sur le site public.

### `docs/case-studies/`

Ce dossier regroupe les études de cas enrichies des projets de 66 Origin.

Elles peuvent contenir des informations complémentaires absentes du site :

- contexte ;
- objectifs ;
- enjeux ;
- méthode ;
- résultats ;
- précisions métier.

### `docs/contenus/`

Ce dossier regroupe les connaissances générales exploitables par l’IA :

- identité et positionnement ;
- offres et piliers stratégiques ;
- méthode et approche ;
- équipe et écosystème ;
- références et projets ;
- freins à la transformation ;
- FAQ et informations pratiques ;
- branding et storytelling.

### `docs/personnalite/`

Ce dossier regroupe le cadre comportemental et la gouvernance de l’IA :

- règles comportementales ;
- identité principale ;
- fonctionnement du système RAG ;
- règles de sécurité.

### `docs/personnalite/storytelling/`

Ce dossier contient les systèmes narratifs et les modes de réponse :

- cartographie et exploitation du contenu ;
- modes de réponse ;
- règles de storytelling.

---

## `generated/` — Contenu public automatisé

Le dossier `generated/` est produit par le crawler de `66origin.com`.

Il contient une transcription structurée du contenu public des pages du site :

- `works/` : projets ;
- `insights/` : articles et publications ;
- `team/` : membres de l’équipe publiés ;
- `pages/` : pages statiques sélectionnées.

Ces fichiers ne remplacent pas les contenus enrichis présents dans `rag/docs/`.

Une fiche projet générée depuis le site peut, par exemple, être moins détaillée qu’une étude de cas maintenue manuellement dans `rag/docs/case-studies/`.

### `manifest.json`

Le manifeste conserve, pour chaque page :

- son type ;
- son slug ;
- son URL source ;
- son URL canonique ;
- le fichier Markdown correspondant ;
- l’empreinte de son contenu ;
- son numéro de version ;
- ses dates de détection et de génération ;
- son statut.

Les statuts possibles sont :

- `active` : page détectée et générée correctement ;
- `missing` : page absente de la dernière découverte ;
- `failed` : page détectée, mais impossible à traiter.

Une page `missing` ou `failed` n’est pas supprimée automatiquement. Son ancien fichier est conservé lorsqu’il existe.

### `last-run.json`

Ce fichier résume la dernière exécution du générateur :

- nombre de pages découvertes ;
- fichiers créés ;
- fichiers modifiés ;
- fichiers inchangés ;
- pages manquantes ;
- erreurs rencontrées.

`manifest.json`, `last-run.json` et les fichiers README ne sont pas destinés à être ajoutés au File Search Store.

---

## Principes documentaires

### Fichiers éditoriaux

Pour les fichiers de `rag/docs/` :

- utiliser le format Markdown ;
- consacrer chaque fichier à un sujet ou une étude de cas clairement identifié ;
- employer des titres hiérarchisés ;
- éviter les contradictions et les redondances inutiles ;
- ne pas indexer les fichiers explicitement marqués `OLD` ;
- vérifier manuellement toute modification importante.

### Fichiers générés

Pour les fichiers de `rag/generated/` :

- ne pas modifier leur contenu manuellement ;
- considérer que toute modification manuelle peut être écrasée au prochain crawl ;
- corriger le contenu sur le site ou dans le générateur ;
- vérifier les changements avant toute ingestion manuelle ;
- ne pas considérer automatiquement une page disparue comme définitivement supprimée.

Des recoupements peuvent exister entre les fichiers générés et les documents enrichis. Ils doivent être examinés avant leur ajout au store afin d’éviter des informations contradictoires ou inutilement répétées.

---

## Conventions de nommage

### Fichiers de `rag/docs/`

Format recommandé :

```
<ordre>_<theme>.md
```

Exemples :

```
01_identite_positionnement.md
02_offre_piliers.md
03_methode_approche.md
o_behavioral_rules.md
o_response_modes.md
```

Règles :

- utiliser des minuscules ;
- ne pas utiliser d’accents ;
- séparer les mots avec des underscores ;
- utiliser un préfixe numérique pour les contenus ordonnés.

### Fichiers de `rag/generated/`

Les noms sont produits automatiquement à partir des slugs du site.

Exemples :

```
works/taiji-kit-mains-libres-velo-securite-cycliste.md
insights/a-qui-tu-parles.md
team/philippe-mihelic.md
```

Ces noms ne doivent pas être modifiés manuellement.

---

## Workflow éditorial

Pour un fichier maintenu manuellement :

1. modifier le fichier concerné dans `rag/docs/` ;
2. vérifier sa cohérence avec les autres documents ;
3. contrôler les éventuelles redondances ou contradictions ;
4. valider le contenu ;
5. effectuer séparément les opérations nécessaires dans le File Search Store.

La synchronisation automatique avec le store n’est pas incluse dans la V1 du générateur.

---

## Workflow de génération

La génération peut être lancée directement avec :

```
npm run generate:rag
```

Elle peut également être lancée par l’API RAG. Sur Vercel, l'API travaille dans
`/tmp` et retourne un ZIP sans modifier ce dossier dans le déploiement.

Après une génération :

1. consulter `rag/generated/last-run.json` ;
2. vérifier les pages signalées comme `missing` ou `failed` ;
3. comparer les modifications des fichiers Markdown ;
4. contrôler les versions dans `manifest.json` ;
5. examiner l’archive ZIP produite ;
6. sélectionner humainement les fichiers à envoyer au store.

Aucun ajout, remplacement ou retrait dans le File Search Store n’est effectué automatiquement.

---

## API de génération

L’API lance le crawl de manière synchrone et retourne son rapport ainsi que
l'archive ZIP dans la même réponse.

Les routes disponibles sont :

```
POST /api/v1/rag/export
```

Toutes ces routes sont protégées par `RAG_ADMIN_TOKEN`, ou par `ADMIN_TOKEN` comme solution de repli.

Le fonctionnement détaillé est documenté dans :

```
docs/rag-generation-api.md
```

---

## Règles d’évolution

Toute modification significative des fichiers éditoriaux doit être commitée explicitement.

Les changements générés automatiquement doivent être examinés séparément des changements apportés au code.

La base éditoriale enrichie et la copie automatique du site doivent rester séparées :

```

rag/docs → connaissances enrichies et contrôlées
rag/generated → représentation automatique du site public

```

Le système de génération ne doit pas modifier automatiquement les fichiers éditoriaux existants.

L’ajout, la mise à jour et la suppression des fichiers dans le File Search Store feront l’objet d’un workflow distinct.

```

```
