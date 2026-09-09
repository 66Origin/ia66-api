# Génération Markdown — API V1

Cette V1 transforme le contenu public de `66origin.com` en fichiers Markdown,
sans lire `rag/docs` et sans communiquer avec le File Search Store.

## Fonctionnement

1. `POST /api/v1/rag/generations` crée un traitement en arrière-plan.
2. Le crawler découvre les pages Works, Insights et Team depuis leurs index, puis
   ajoute les pages statiques configurées.
3. Les fichiers sont écrits dans `rag/generated/`, avec un manifeste et un
   rapport de génération.
4. Le dossier est compressé dans `data/rag-runs/`.
5. `GET /api/v1/rag/generations/{id}` permet de suivre le statut.
6. `GET /api/v1/rag/generations/{id}/download` retourne le ZIP dans le format
   `openaiFileResponse` attendu par une Action GPT. Ajouter `?format=raw` pour
   obtenir directement le ZIP depuis un client HTTP.

Les statuts possibles sont `queued`, `running`, `completed`,
`completed_with_errors` et `failed`. Une page individuelle en échec est
conservée dans le rapport et conduit à `completed_with_errors`; un échec global
du crawl conduit à `failed`.

## Configuration locale

Variables d'environnement :

```dotenv
RAG_ADMIN_TOKEN=remplacer-par-un-secret-long
RAG_SOURCE_URL=https://www.66origin.com
RAG_REQUEST_DELAY_MS=100
RAG_CRAWL_CONCURRENCY=4
```

`RAG_ADMIN_TOKEN` peut être remplacé par l'actuel `ADMIN_TOKEN`, mais la route
refuse de fonctionner si aucun des deux n'est défini.

```bash
npm install
RAG_ADMIN_TOKEN=secret npm run dev
```

Exemple de lancement :

```bash
curl -X POST http://localhost:3000/api/v1/rag/generations \
  -H 'Authorization: Bearer secret'
```

Utiliser ensuite l'identifiant reçu pour consulter le statut puis télécharger
l'archive.

## Limites assumées du prototype

- Le verrou d'exécution est local au processus Node.js.
- Les statuts et ZIP sont conservés sur le disque local.
- Un redémarrage conserve les fichiers existants, mais perd la notion de tâche
  active.
- Un hébergement serverless peut interrompre le travail après la réponse HTTP.
- La réponse destinée à une Action GPT est limitée à un ZIP de 10 Mo. Au-delà,
  il faudra un stockage durable et une URL de téléchargement temporaire.

Avant un usage partagé en production, remplacer le service local par un worker
durable et un stockage d'objets, sans modifier le contrat HTTP ni le crawler.
