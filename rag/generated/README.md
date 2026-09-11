# Documents générés depuis 66origin.com

Ce dossier est produit par le crawler V1. Il est entièrement séparé de
`rag/docs/` et n'est pas envoyé automatiquement dans le File Search Store.

## Utilisation

```bash
npm run generate:rag
```

La commande découvre les pages publiques suivantes :

- projets (`/works/*`)
- Insights (`/insights/*`)
- membres publiés (`/team/*`)
- pages Home, Notre approche, La Maison 66 et Diagnostic IA

Les fichiers sont rangés dans `works/`, `insights/`, `team/` et `pages/`.
`manifest.json` conserve leur hash et leur version. `last-run.json` résume la
dernière exécution.

## Garanties de la V1

- aucune lecture ni modification de `rag/docs/`
- aucun appel à Gemini ou au File Search Store
- aucun enrichissement ou réécriture par une IA
- aucune suppression automatique lorsqu'une page disparaît
- contenu limité à l'élément `<main>` de chaque page publique

Une page absente de la nouvelle découverte reste sur le disque et passe à
l'état `missing` dans le manifeste afin de permettre une vérification humaine.

## Configuration facultative

- `RAG_SOURCE_URL` : origine du site, par défaut `https://www.66origin.com`
- `RAG_GENERATED_DIR` : dossier de sortie, par défaut `rag/generated`
- `RAG_REQUEST_DELAY_MS` : délai entre les requêtes, par défaut `100`
- `RAG_CRAWL_CONCURRENCY` : nombre maximal de pages traitées en parallèle,
  par défaut `4`

Les index `/works`, `/insights` et `/team` servent uniquement à découvrir les
pages de détail. Ils ne sont pas générés comme documents RAG.
