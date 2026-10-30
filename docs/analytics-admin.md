# Analytics et administration de O

Les analytics comptent les demandes et les conversations, classent les sujets
et intentions, et conservent 90 jours les questions sans réponse. Rien n'est
écrit ni lu sur l'appareil du visiteur : l'identifiant de conversation vit en
mémoire dans `ia.js`.

## Base de données

Migrations dans `db/migrations/`, à appliquer dans l'ordre. `007` nécessite
l'extension `pg_cron`.

| Rôle | Utilisé par | Droits |
| --- | --- | --- |
| `o_analytics_writer` | API du chat | Insère demandes, conversations, classifications et questions en échec ; ne relit pas les questions ; ne supprime rien |
| `o_analytics_reader` | Pages `/admin/analytics` | Lecture seule |
| propriétaire de la base | `pg_cron`, scripts de vérification | Agrégats et purges |

Les identifiants de connexion des rôles sont configurés hors du dépôt.

Rétention, exécutée chaque nuit par `analytics.run_retention()` :

- statistiques mensuelles anonymes calculées pour chaque mois terminé ;
- questions en échec supprimées après 90 jours ;
- demandes, classifications et conversations supprimées après 12 mois.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `O_ANALYTICS_ENABLED` | Active l'enregistrement des demandes (`true`) |
| `O_ANALYTICS_CLASSIFICATION_ENABLED` | Active la classification par Gemini |
| `O_ANALYTICS_UNANSWERED_ENABLED` | Active la conservation des questions en échec |
| `O_ANALYTICS_DATABASE_URL` | Connexion du rôle writer |
| `O_ANALYTICS_READER_DATABASE_URL` | Connexion du rôle reader (tableau de bord) |
| `ADMIN_PASSWORD` | Mot de passe partagé de `/admin` |
| `ADMIN_SESSION_SECRET` | Secret de signature de la session, 32 caractères au moins |
| `ADMIN_TOKEN` | Jeton des routes `/api/v1/filesearch` ; tout est refusé s'il manque |
| `RAG_ADMIN_TOKEN` | Jeton de l'export RAG pour l'action du GPT et `curl` |
| `O_ANALYTICS_CLEANUP_DATABASE_URL` | `.env.local` uniquement : connexion privilégiée des scripts de vérification |

Le chat Webflow n'envoie les métadonnées analytics que si l'élément du chat
porte l'attribut `data-o-analytics="true"`.

## Administration

`/admin` est protégé par `src/proxy.ts` et par une vérification dans chaque
page (`requireAdminPage`). La connexion pose un cookie de session signé,
`HttpOnly`, `Secure`, `SameSite=Strict`, valable 8 heures. Les tentatives sont
limitées par adresse IP.

`/api/v1/rag/export` accepte la session d'administration, utilisée par le
générateur Markdown, ou `RAG_ADMIN_TOKEN` en en-tête, utilisé par l'action du
GPT d'export. `/api/v1/filesearch` garde `ADMIN_TOKEN` en en-tête pour les
scripts.

Dans les tableaux croisés du tableau de bord, les valeurs inférieures à 10
sont masquées.

## Vérifications

```sh
npm run analytics:check
npm run analytics:check-recording
npm run analytics:check-concurrency
npm run analytics:check-retention
npm run analytics:check-unanswered
npm run analytics:check-reader
node --import tsx scripts/analytics/check-writer-permissions.ts
node --import tsx scripts/analytics/check-writer-operations.ts
node --import tsx scripts/analytics/check-classification.ts
node --import tsx scripts/analytics/check-classification-model.ts
```
