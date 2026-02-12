# File Search – Scripts d’administration

Scripts internes pour gérer les File Search Stores et Documents Gemini.

⚠️ À utiliser uniquement en local ou en environnement admin.

## Scripts disponibles

- `setup-store.ts`
  - Crée un File Search Store s’il n’existe pas déjà (idempotent).
  - Utilise `FILE_SEARCH_STORE_NAME` (normalisé automatiquement en `fileSearchStores/<name>`).
  - À exécuter avant l’upload des documents si le store n’est pas encore créé.

- `upload-docs.ts`
  - Upload tous les fichiers Markdown (`.md`) présents dans `rag/docs/` (récursif) vers le File Search Store.
  - Idempotent via `displayName` (le chemin relatif est utilisé comme displayName).

## Pré-requis

Variables d’environnement :

- `GEMINI_API_KEY`
- `FILE_SEARCH_STORE_NAME`

## Usage

```bash
node scripts/filesearch/upload-docs.ts
```
