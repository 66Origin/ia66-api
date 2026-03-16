# Bot – Logique conversationnelle

Ce module contient la logique conversationnelle propre au bot "IA 66 Origin".

## Fichiers

- `system.ts`
  - Contexte système stable (règles, posture, ton)

- `prompt.ts`
  - Construction du prompt utilisateur injecté au modèle

## Architecture

- La génération Gemini et le RAG sont gérés dans `src/lib/gemini/rag.ts`
- Le module bot ne contient que la couche conversationnelle

## Règles

- Aucun appel HTTP ici
- Aucune logique Gemini bas niveau
- Aucune logique File Search
- Le bot formule, la couche gemini exécute
