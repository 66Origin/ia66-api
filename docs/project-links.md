# Liens projets dans les réponses de O

L'API `/api/v1/chat` fournit `projectLinks: Array<{ label, url }>` pour les noms
de projets présents dans le texte de la réponse. Les URL proviennent uniquement
des Works actifs du manifeste `rag/generated/manifest.json`, importé dans le
bundle serveur. Aucun appel CMS ni appel supplémentaire au modèle n'est requis.

`data/project-aliases.json` associe les slugs aux noms courts et variantes
utilisés dans les réponses. Le titre complet et sa partie avant la première
virgule sont également reconnus. Les noms ambigus sont exclus. L'absence de
sources de grounding ne bloque pas la résolution d'un projet connu.

Le navigateur transforme les noms en liens avec les données de l'API, en
préservant leur casse et les liens existants. Les URL sont validées côté serveur
et navigateur (HTTPS, domaine `www.66origin.com`, chemin `/works/<slug>`).
Les liens sont construits avec les API DOM, sans injecter les labels en HTML.

## Mise à jour

Après ajout, suppression ou changement d'URL d'un projet Webflow :

1. Actualiser puis intégrer le manifeste avec le workflow d'export RAG existant.
2. Ajouter ou adapter les noms courts dans `data/project-aliases.json` si nécessaire.
3. Déployer l'API pour embarquer le nouveau catalogue.

Il s'agit d'un instantané versionné, pas d'une lecture en direct du CMS.
Les slugs absents ou marqués inactifs dans le manifeste ne sont pas utilisés.

## Déploiement et recette

Déployer d'abord l'API, puis vérifier que Webflow charge le nouveau `ia.js`.
Un nouveau navigateur face à une ancienne API affiche du texte sans liens ;
un ancien navigateur face à la nouvelle API conserve son fonctionnement actuel.

Sur le staging, exécuter `delete window.PROJECTS`, puis demander un projet
connu : son nom doit rester cliquable. Contrôler `projectLinks` dans la réponse
réseau, puis tester plusieurs projets, une nouvelle conversation et le mobile.

L'ancien code Webflow qui remplit `window.PROJECTS` peut être retiré après
validation de cette évolution et vérification qu'aucun autre script ne l'utilise.

## Validation locale

```bash
node --import tsx --test tests/project-links.test.ts tests/webflow-project-links.test.ts tests/webflow-chat.test.ts
npx tsc --noEmit
```
