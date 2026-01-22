# Data seeds (optionnel)

Ce dossier contient des **données structurées de référence** (fallback / enrichissement).

## Usage

- Catalogue de projets (cases)
- Métadonnées structurées (secteur, services, année, tags)
- Fallback si le RAG ne remonte aucun document pertinent

## Important

- Ces données ne sont **pas critiques au runtime**
- Elles peuvent être supprimées si le bot repose uniquement sur le RAG

## Versioning

- Toujours versionner les fichiers (`cases.v01.json`, `cases.v02.json`)
- Ne jamais modifier un fichier existant
