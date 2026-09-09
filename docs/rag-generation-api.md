# Génération Markdown — Export Vercel V1

Cette V1 transforme le contenu public de `66origin.com` en une archive de
fichiers Markdown. Elle ne lit jamais `rag/docs` et ne communique pas avec le
File Search Store.

## Fonctionnement

`POST /api/v1/rag/export` réalise toute l'opération avant de répondre :

1. copie du snapshot `rag/generated` dans un dossier unique sous `/tmp` ;
2. crawl des pages Works, Insights, Team et des pages statiques configurées ;
3. comparaison avec le manifeste du snapshot ;
4. génération des Markdown, de `manifest.json` et de `last-run.json` ;
5. création d'un ZIP ;
6. chargement du ZIP en mémoire puis suppression du dossier temporaire ;
7. retour du fichier à ChatGPT ou au client HTTP.

Le snapshot contenu dans le dépôt n'est jamais modifié par la route. Après
validation humaine, l'archive téléchargée doit remplacer `rag/generated` puis
être commitée pour devenir la référence du prochain déploiement.

## Configuration

```dotenv
RAG_ADMIN_TOKEN=remplacer-par-un-secret-long
RAG_SOURCE_URL=https://www.66origin.com
RAG_REQUEST_DELAY_MS=100
RAG_CRAWL_CONCURRENCY=4
```

Seul `RAG_ADMIN_TOKEN` est obligatoire. `ADMIN_TOKEN` peut servir de repli, mais
un token dédié est recommandé. La route refuse de fonctionner si aucun token
n'est configuré.

## Utilisation locale

```bash
npm install
npm run dev
```

Réponse compatible avec une Action GPT :

```bash
curl -X POST http://localhost:3000/api/v1/rag/export \
  -H "Authorization: Bearer $RAG_ADMIN_TOKEN"
```

Téléchargement direct :

```bash
curl -fSL -X POST \
  "http://localhost:3000/api/v1/rag/export?format=raw" \
  -H "Authorization: Bearer $RAG_ADMIN_TOKEN" \
  -o 66origin-rag.zip
```

## Réponse destinée à ChatGPT

La réponse JSON contient le rapport et `openaiFileResponse` :

```json
{
  "export": {
    "id": "rag_...",
    "status": "completed",
    "archiveSizeBytes": 160000,
    "report": {}
  },
  "openaiFileResponse": [
    {
      "name": "66origin-rag-rag_....zip",
      "mime_type": "application/zip",
      "content": "base64..."
    }
  ]
}
```

La route limite le ZIP à 3 Mo pour la réponse JSON : l'encodage Base64 augmente
sa taille et la réponse complète doit rester sous la limite Vercel de 4,5 Mo.
Le format `raw` reste lui-même soumis à la limite de réponse de Vercel.

## Limites assumées

- Le ZIP et le dossier de travail sont temporaires.
- Il n'existe pas d'historique de tâches côté Vercel.
- Une requête interrompue doit être relancée.
- Le versioning repart du snapshot inclus dans le dernier déploiement.
- Deux instances Vercel peuvent exécuter simultanément deux exports distincts.
- La route dispose d'une durée maximale configurée à 60 secondes.

Cette architecture est adaptée à la V1 observée (environ 42 pages, quelques
secondes et une archive très inférieure à 3 Mo). Une queue et un stockage
durable deviendront nécessaires si le crawl s'allonge, doit être planifié ou
doit conserver automatiquement ses résultats.
