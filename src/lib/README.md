# lib – Logique métier

Ce dossier contient **toute la logique métier réutilisable**.

## Principes

- Aucune dépendance au HTTP (pas de Request/Response).
- Pas de CORS, auth, rate limiting ici.
- `lib` expose des fonctions/capacités appelées par `app/api/*` et par les scripts.

## Responsabilités

- Appels Gemini (client, RAG, File Search)
- Construction des prompts
- Opérations métier (list, delete, run chat)
- Normalisation des données

## Sous-modules

- `gemini/` : intégration Gemini (client, File Search ops, RAG)
- `bot/` : logique IA 66 (prompts, orchestration)
- `ratelimit/` : rate limiting (si mutualisé)
