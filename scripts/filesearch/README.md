# File Search – Scripts d’administration

Scripts internes pour gérer les File Search Stores et Documents Gemini.

⚠️ **À utiliser uniquement en local ou en environnement admin**.

## Scripts disponibles

- `setup-store.ts`
  - Crée un File Search Store s’il n’existe pas

- `upload-docs.ts`
  - Upload tous les PDF présents dans `rag/docs/` vers le store

- `list-stores.ts`
  - Liste les File Search Stores existants

- `list-docs.ts`
  - Liste les documents d’un store

- `purge-store-docs.ts`
  - Supprime tous les documents d’un store (dangereux)

- `purge-stores.ts`
  - Supprime tous les stores (très dangereux)

## Règles

- Ne jamais exposer ces scripts via le front
- Toujours vérifier l’environnement ciblé
- Préférer un dry-run quand c’est possible

## Architecture

La gestion File Search est implémentée dans :

- src/lib/gemini/filestore.ts (logique métier)
- src/app/api/v1/filesearch/... (exposition HTTP sécurisée)

Aucun script CLI dédié n’est requis à ce stade.
