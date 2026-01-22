# API Routes

Ce dossier contient uniquement les **adaptateurs HTTP**.

## Responsabilités

- CORS
- Auth admin (`ADMIN_TOKEN`)
- Rate limit
- Validation HTTP
- Mapping Request → lib → Response

## Règles

- Pas de logique métier
- Pas d’appels Gemini directs
- Pas de traitement complexe

## Structure

- `/v1/chat` : endpoint public (prod)
- `/v1/filesearch/*` : endpoints admin / debug
