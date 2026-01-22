# Gemini – Intégration IA

Ce module regroupe toute l’intégration Gemini.

## Fichiers

- `client.ts`

  - Initialisation du client Gemini

- `env.ts`

  - Accès centralisé aux variables d’environnement (store name)

- `filestore.ts`

  - Opérations File Search :
    - listStores
    - listDocuments
    - deleteDocument
    - deleteAllDocumentsFromStore
    - deleteStore
    - deleteAllStores

- `index.ts`

  - Exports publics du module

- `rag.ts`

  - Exécution des requêtes RAG (generateContent + fileSearch)

## Règles

- Pas de logique HTTP
- Pas de CORS/auth ici
- Les routes `app/api/*` appellent ces fonctions
