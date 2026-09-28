# Convention des documents RAG manuels

Les documents présents dans `rag/docs/` sont des contenus ajoutés manuellement au corpus de O.

Les anciens fichiers peuvent avoir des structures différentes.  
Cette convention s'applique principalement aux nouveaux documents.

## Principes

- Le contenu reste en Markdown.
- Les métadonnées structurées sont placées dans un front matter YAML.
- Les clés utilisent le `snake_case`.
- Les dates utilisent le format ISO `YYYY-MM-DD`.
- Ne pas utiliser plusieurs noms pour la même donnée.
- Les champs métier spécifiques restent facultatifs sauf indication contraire.
- Les anciens documents hétérogènes ne sont pas à réécrire immédiatement.

## Version du schéma

Tous les nouveaux documents manuels suivant cette convention doivent déclarer :

```yaml
schema_version: 1
```

`schema_version` permet au système de synchronisation d'identifier les documents qui suivent explicitement la convention actuelle.

Les documents historiques sans `schema_version` restent compatibles et ne sont pas soumis aux validations strictes du nouveau schéma.

## Structure des dossiers

### Case studies

Dossier :

```text
rag/docs/case-studies/
```

Ces documents sont des contenus manuels enrichis liés aux projets / Works.

Métadonnées fonctionnelles :

```yaml
source_type: "docs"
content_type: "work"
```

Le dossier reste nommé `case-studies` afin de conserver la distinction avec :

```text
rag/generated/works/
```

qui contient les pages Works publiques générées automatiquement depuis le site.

### Contenus

Dossier :

```text
rag/docs/contenus/
```

Métadonnées fonctionnelles :

```yaml
source_type: "docs"
content_type: "content"
```

### Personnalité de O

Dossier :

```text
rag/docs/personnalite/
```

Métadonnées fonctionnelles :

```yaml
source_type: "docs"
content_type: "personality"
```

### Storytelling

Dossier :

```text
rag/docs/personnalite/storytelling/
```

Métadonnées fonctionnelles :

```yaml
source_type: "docs"
content_type: "personality"
content_subtype: "storytelling"
```

## Convention générale

Pour les nouveaux documents manuels, utiliser un front matter YAML au début du fichier.

Exemple :

```yaml
---
schema_version: 1
title: "Titre du document"
slug: "slug-du-document"
content_type: "..."
canonical_url: "https://www.66origin.com/..."
description: "Résumé court du document."
tags:
  - "mot-clé 1"
  - "mot-clé 2"
---
```

`canonical_url` peut être omise si aucune page publique ne correspond au document.

## Nommage des champs

Utiliser les noms suivants :

```text
schema_version
content_type
content_subtype
category
agency
partner
awards
canonical_url
date_published
date_modified
author_name
```

Éviter notamment :

```text
categorie
studio
partenaire
award
```

Préférer :

```text
category
agency
partner
awards
```

## Dates

Les dates structurées utilisent le format ISO :

```text
YYYY-MM-DD
```

Exemple :

```yaml
date_published: "2026-08-13"
date_modified: "2026-09-28"
```

Ne pas utiliser dans les métadonnées structurées :

```text
13 août 2026
13/08/2026
08/13/2026
```

Le contenu Markdown peut toutefois afficher une date dans un format lisible pour l'utilisateur.

## Types de contenu

Les valeurs normalisées de `content_type` sont :

```text
work
content
personality
insight
team
page
```

Mapping actuel :

```text
rag/docs/case-studies/*
→ source_type = docs
→ content_type = work

rag/docs/contenus/*
→ source_type = docs
→ content_type = content

rag/docs/personnalite/*
→ source_type = docs
→ content_type = personality

rag/docs/personnalite/storytelling/*
→ source_type = docs
→ content_type = personality
→ content_subtype = storytelling

rag/generated/works/*
→ source_type = generated
→ content_type = work

rag/generated/insights/*
→ source_type = generated
→ content_type = insight

rag/generated/team/*
→ source_type = generated
→ content_type = team

rag/generated/pages/*
→ source_type = generated
→ content_type = page
```

## Case studies

Pour un nouveau document dans :

```text
rag/docs/case-studies/
```

utiliser ce format :

```yaml
---
schema_version: 1
title: "Nom du projet"
slug: "slug-du-projet"
content_type: "work"
canonical_url: "https://www.66origin.com/..."
client: "Nom du client"
agency: "66 Origin"
category: "Catégorie principale"
tags:
  - "mot-clé 1"
  - "mot-clé 2"
description: "Résumé court et factuel du projet."
date_published: "YYYY-MM-DD"
date_modified: "YYYY-MM-DD"
---
```

### Champs obligatoires pour les nouveaux case studies

- `schema_version`
- `title`
- `slug`
- `content_type`
- `client`
- `category`
- `tags`
- `description`

`canonical_url` est obligatoire si une page publique existe.

### Champs facultatifs

- `agency`
- `partner`
- `awards`
- `distribution`
- `event`
- `date_published`
- `date_modified`

Exemple avec champs métier supplémentaires :

```yaml
---
schema_version: 1
title: "Delivery Safe : sac de livraison connecté pour sécuriser les livreurs à vélo"
slug: "delivery-safe-sac-livraison-connecte-securite-livreurs-velo"
content_type: "work"
canonical_url: "https://www.66origin.com/..."
client: "KFC"
agency: "66 Origin"
partner: "Havas Paris"
category: "Design produit / Innovation mobilité"
tags:
  - "sac de livraison connecté"
  - "sécurité des livreurs à vélo"
  - "innovation mobilité urbaine"
description: "66 Origin conçoit Delivery Safe pour KFC et Havas Paris."
awards:
  - "2x Bronze Lion — Cannes Lions"
  - "Bronze — LIA"
---
```

## Personnalité et storytelling

Les documents de personnalité ne sont pas des contenus publics au même titre que les pages du site.

Exemple :

```yaml
---
schema_version: 1
title: "O Storytelling Mode"
content_type: "personality"
content_subtype: "storytelling"
description: "Règles de narration et de formulation utilisées par O."
---
```

Ces documents pourront à terme être traités différemment du corpus factuel public.

## Règle de priorité des sources

Les documents générés depuis le site représentent l'état public actuel de `66origin.com`.

Les documents présents dans `rag/docs/` sont des contenus manuels, enrichis, historiques ou complémentaires.

En cas de contradiction sur une information publique actuelle :

```text
generated
```

doit être considéré comme prioritaire par rapport à :

```text
docs
```

sauf règle métier spécifique documentée.

## Champs spécifiques

Tous les documents n'ont pas besoin d'avoir les mêmes champs métier.

Exemples de champs spécifiques autorisés :

```yaml
client: "..."
partner: "..."
awards:
  - "..."
distribution:
  - "..."
event: "..."
```

Ces champs ne doivent être ajoutés que lorsqu'ils sont utiles au contenu.

## Compatibilité avec les anciens fichiers

Les documents existants dans `rag/docs/` peuvent utiliser des formats différents :

- YAML complet
- champs avec des noms différents
- pseudo front matter en Markdown
- absence de front matter structuré

Ils ne sont pas à migrer immédiatement.

Le système de synchronisation doit :

- accepter les anciens fichiers
- extraire les métadonnées disponibles lorsque c'est possible
- garantir au minimum `source_path`, `source_type` et `content_type`
- appliquer les conventions strictes principalement aux nouveaux documents
