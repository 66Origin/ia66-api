# RAG – Source Documents (V2)

Ce dossier contient les **documents source Markdown (.md)** utilisés par le système RAG de 66 Origin.

Les anciens fichiers PDF ont été supprimés.  
Les documents sont désormais structurés par typologie et optimisés pour l’ingestion vectorielle.

---

## Structure

## Structure

rag/
├── docs/
│ ├── contenus/
│ ├── personnalite/
│ │ └── storytelling/
└── index/

### `docs/contenus/`

Regroupe la **connaissance métier exploitable** par l’IA :

- Identité & positionnement
- Offres & piliers stratégiques
- Méthode & approche
- Équipe & écosystème
- Références & projets
- Freins à la transformation
- FAQ & informations pratiques
- Branding & storytelling

---

### `docs/personnalite/`

Regroupe le **cadre comportemental et la gouvernance** :

- Règles comportementales
- Identité core
- Système RAG & sécurité

#### `docs/personnalite/storytelling/`

Systèmes narratifs et modes de réponse :

- Cartographie & exploitation du contenu
- Système de modes de réponse
- Mode récit (storytelling)

---

## Principes

- Format unique : **Markdown (`.md`)**
- 1 fichier = **1 thème structuré**
- Titres hiérarchisés (`H2` / `H3`) obligatoires
- Aucun doublon inter-document
- Les fichiers marqués `OLD` ne doivent pas être indexés

Le dossier constitue la **source documentaire officielle** du système RAG.

---

## Naming Convention

Format recommandé :
<ordre>\_<theme>.md

Exemples :
01_identite_positionnement.md
02_offres_piliers_strategiques.md
03_methode_approche.md
o_regles_comportementales.md
o_systeme_modes_reponse.md

### Règles

- minuscules uniquement
- pas d’accents
- underscore `_` uniquement
- préfixe numérique pour les contenus métier

---

## Workflow

1. Modifier le fichier Markdown concerné
2. Vérifier la cohérence globale et l’absence de redondance
3. Mettre à jour l’index si nécessaire (`rag/index/rag_index_66origin.json`)
4. Lancer le script d’ingestion (`scripts/filesearch/upload-docs.ts`)
5. Régénérer les embeddings

---

## Règle d’évolution

Toute modification significative :

- doit être commitée explicitement
- nécessite une régénération complète des embeddings
- ne doit pas casser la séparation logique : `contenus` / `personnalite`

---

Cette V2 remplace entièrement l’ancienne logique basée sur des PDF versionnés.
