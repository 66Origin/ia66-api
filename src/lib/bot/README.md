# Bot – Logique conversationnelle

Ce module contient la logique conversationnelle propre au bot "IA 66 Origin".

## Fichiers

- `system.ts`

  - Contexte système stable (règles, posture, ton)

- `prompt.ts`

  - Construction du prompt utilisateur

- `run.ts`
  - Orchestration complète du chat :
    - validation
    - prompt
    - RAG
    - réponse finale

## Règle

- Aucun HTTP ici
- Aucune logique File Search bas niveau
- Le bot appelle des capacités, il ne les implémente pas
