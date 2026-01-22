# RAG – Source documents

Ce dossier contient les **documents source** utilisés par Gemini File Search (RAG).

## Règles

- Les documents sont **versionnés** (jamais modifiés en place).
- Chaque mise à jour = **nouveau fichier** avec un nouveau numéro de version.
- Le dossier est la **source de vérité** documentaire pour l’IA.

## Naming convention

Format strict :

66origin**<type>**<scope>**vXX**YYYY-MM-DD.pdf

Exemples :

- 66origin**playbook**global**v01**2026-01-21.pdf
- 66origin**faq**standard**v01**2026-01-21.pdf
- 66origin**case**quipo**v01**2026-01-21.pdf

## Workflow

1. Modifier le contenu (Notion / Google Docs / InDesign)
2. Exporter un nouveau PDF (nouvelle version)
3. Ajouter le PDF ici
4. Lancer le script d’ingestion (`scripts/filesearch/upload-docs.ts`)
