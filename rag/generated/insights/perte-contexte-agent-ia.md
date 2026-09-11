---
title: "Mon IA avait la tête sous l’eau"
slug: "perte-contexte-agent-ia"
type: "insight"
source: "66origin.com"
source_url: "https://www.66origin.com/insights/perte-contexte-agent-ia"
source_hash: "sha256:3516729557f4f92747d66449913fc6eaafc43dd0531e663df4697fd3e958615d"
description: "Comment reconnaître la perte de contexte d’un agent IA, décider s’il faut le recadrer ou le remplacer, et préparer une passation propre."
---

# Mon IA avait la tête sous l’eau

Un agent IA ne se fatigue pas comme un humain. Pourtant, sur un projet long, son comportement peut finir par ressembler à celui de quelqu’un qui a passé la nuit sur le dossier : réponses plus lentes, règles oubliées, anciennes décisions qui réapparaissent et corrections qui ne corrigent plus rien.

Par :

[

Philippe Mihelic, cofondateur et CEO de 66 Origin

](/team/philippe-mihelic)

Date de publication :

8 août 2026

Catégorie :

Orchestrer humains et agents

Temps de lecture :

8 minutes

## Le premier signe n’était pas une panne. C’était une vieille couleur.

Ça fait bientôt deux ans que je travaille avec l’IA tous les jours, et je commence à reconnaître le moment où elle a la tête sous l’eau.

Je travaillais sur une application mobile avec un agent qui semblait extrêmement actif. Il posait beaucoup de questions, vérifiait énormément de choses, lançait du code et m’expliquait avec beaucoup d’assurance que le projet avançait. Sauf qu’il avançait surtout très lentement.

Les heures passaient, les échanges devenaient plus laborieux et j’avais de plus en plus la sensation que nous refaisions des choses déjà faites. Puis une ancienne couleur est réapparue dans l’interface.

Ce détail pourrait sembler anecdotique. Il ne l’était pas. Cette couleur appartenait à un premier jet réalisé plusieurs semaines auparavant. Depuis, l’application avait été entièrement rechartée. Les règles graphiques étaient précises, documentées et présentes dans les sources du projet. Cette ancienne décision n’avait donc aucune raison de revenir.

Et pourtant, elle était là.

Ce n’était pas seulement une erreur esthétique. C’était une régression : le retour d’une règle ou d’un état qui avait déjà été corrigé et validé. Dans un projet long, ce type de retour en arrière est souvent plus inquiétant qu’un bug nouveau. Un bug nouveau peut être local. Une ancienne décision qui ressurgit indique que plusieurs versions du projet sont peut-être encore en concurrence dans le contexte de travail.

## Quand « je comprends parfaitement » ne suffit plus

J’ai signalé l’erreur à l’agent. Il m’a répondu exactement ce que j’avais envie d’entendre : il comprenait, la règle était bien écrite dans les sources et il allait corriger le problème.

Puis il a relancé du code.

Et la couleur était toujours là.

C’est là que la relation devient étrange. L’agent peut reformuler correctement le problème, reconnaître l’erreur, citer la bonne règle et produire une réponse très rassurante, sans réussir à transformer cette compréhension apparente en correction effective.

Plus il me disait qu’il comprenait parfaitement, plus je m’énervais. J’ai essayé d’être patient, puis plus précis, puis plus directif. Je lui ai redonné la source, rappelé la décision et resserré la demande. Il acquiesçait à chaque fois et continuait à tourner en rond.

Techniquement, une IA ne fait pas de nuit blanche. Mais, dans l’expérience, tout se passait comme si je travaillais avec quelqu’un qui connaissait encore le dossier, sans savoir quelle version devait désormais faire autorité.

## Comment reconnaître qu’un agent IA a perdu le contexte d’un projet ?

Une erreur isolée ne suffit pas à conclure qu’un agent a perdu le projet. Il peut avoir mal compris une consigne, utilisé la mauvaise source ou produit un correctif incomplet.

Le problème devient plus profond lorsque plusieurs signaux apparaissent ensemble :

-   une décision ancienne réapparaît alors qu’elle avait été remplacée ;
-   la même erreur revient après plusieurs corrections explicites ;
-   une correction locale recrée un problème déjà résolu ailleurs ;
-   l’agent sait reformuler la règle, mais ne parvient plus à l’appliquer ;
-   les réponses et les actions deviennent plus lentes et plus laborieuses ;
-   plusieurs versions contradictoires du projet semblent coexister ;
-   le temps passé à expliquer et réparer commence à dépasser le temps nécessaire pour reprendre proprement.

Ce diagnostic reste un diagnostic de travail, pas une mesure scientifique de la « fatigue » d’une IA. Il décrit un comportement observable dans une collaboration longue.

Les recherches sur les contextes longs montrent qu’accumuler davantage d’informations ne garantit pas qu’un modèle utilisera correctement la bonne. L’étude _Lost in the Middle_ a notamment observé une baisse de performance lorsque l’information utile se trouve noyée au milieu d’un long contexte. D’autres travaux, chez Google Research notamment, explorent donc des architectures dans lesquelles plusieurs agents traitent et se transmettent progressivement l’information plutôt que de tout confier à une seule conversation devenue gigantesque.

Autrement dit, donner davantage d’historique à un agent ne produit pas automatiquement davantage de mémoire.

## Recadrer ou remplacer : le vrai critère

Tout agent qui commet une erreur ne doit évidemment pas être remplacé. Un recadrage suffit lorsque l’écart est local, que la bonne source est identifiable et que la correction fonctionne au premier ou au deuxième passage.

Je commence à envisager un remplacement lorsque les erreurs reviennent, que les règles sont correctement reformulées mais mal appliquées, ou que chaque correction crée une nouvelle contradiction.

Le critère le plus utile reste assez pragmatique :

Si le coût de la réparation dépasse celui d’une reprise propre, il faut changer d’agent.

Changer d’agent ne veut pas dire jeter le travail. Cela veut dire séparer la continuité du projet de la continuité de la conversation.

Les architectures agentiques récentes accordent justement une place importante à la gestion de l’état, à la mémoire sélectionnée, aux passages de relais et aux validations humaines. Microsoft distingue plusieurs formes de contexte et de mémoire, tandis qu’OpenAI recommande d’adapter l’orchestration à la complexité réelle du projet et de prévoir des garde-fous et des points d’intervention humaine.

C’est aussi l’un des principes de [Project Casting](https://www.66origin.com/insights/project-casting-methode-agents-ia) : le projet doit pouvoir continuer même lorsqu’un spécialiste sort du casting.

## Une passation n’est pas l’historique de la conversation

La dernière mission de l’ancien agent a donc été de préparer sa relève. Je lui ai demandé de reconstituer ce qui avait été fait, de solliciter un dernier audit technique, d’identifier les problèmes ouverts et de transformer l’ensemble en un brief de passation Markdown.

Le nouvel agent n’a pas reçu tout l’historique brut. Il a reçu ce qui devait faire autorité :

-   l’état réel du chantier ;
-   les décisions validées ;
-   les sources applicables ;
-   les erreurs connues ;
-   les problèmes encore ouverts ;
-   la prochaine action ;
-   les éléments qu’il n’avait pas le droit de modifier.

Une bonne passation ne cherche pas à tout conserver. Elle cherche à transporter ce qui permet de reprendre correctement.

L’historique raconte comment nous en sommes arrivés là. La documentation dit où nous en sommes, ce qui est vrai et ce qu’il faut faire ensuite. Confondre les deux revient à donner les cartons du déménagement à quelqu’un sans lui indiquer ce qui doit réellement entrer dans la nouvelle maison.

## Le problème ne venait pas uniquement de l’agent

Le changement d’agent a débloqué le projet. Mais il m’a aussi obligé à regarder ma propre façon de travailler.

Mon défaut, c’est d’être bavard. J’ai beaucoup d’idées, j’aime ouvrir des pistes et je vois souvent un problème futur avant d’avoir terminé celui du jour. Dans une conversation humaine, mon interlocuteur comprend généralement qu’une idée évoquée pour plus tard n’est pas une instruction immédiate.

Une IA peut être beaucoup plus littérale. Je lui parlais du chantier en cours, d’une évolution possible, d’un risque futur, d’une idée à tester un jour et d’une autre direction qui venait de me traverser l’esprit. Pour moi, certaines de ces choses n’étaient que des pensées à garder dans un coin. Pour elle, elles pouvaient toutes devenir des éléments du projet présent.

J’avais transformé son contexte en salade de fruits.

Cette tendance est d’autant plus forte que l’IA facilite le [travail en dérivation](https://www.66origin.com/insights/avec-ia-mon-cerveau-travaille-en-derivation). Elle permet d’ouvrir rapidement plusieurs pistes, ce qui est très stimulant. Mais toutes les pistes ne doivent pas entrer en même temps dans la mémoire opérationnelle du chantier.

## Un chantier à la fois

Depuis, j’essaie d’être plus carré avec une IA qu’avec un humain.

Je définis un chantier. Je précise son objectif, ses sources, ses limites et le livrable attendu. Nous le réalisons. Nous le contrôlons. Nous le clôturons. Puis seulement nous ouvrons le suivant.

Quand une idée future apparaît, je peux la noter dans une roadmap ou une mémoire temporaire, mais je ne la mélange plus automatiquement avec l’instruction présente. Cette discipline évite qu’une suggestion devienne une décision, qu’une hypothèse devienne une règle ou qu’une version future commence à contaminer celle que nous essayons encore de terminer.

Au fond, cela revient à appliquer au travail avec les agents la même discipline que dans [notre approche des projets d’innovation](https://www.66origin.com/approche) : clarifier ce que nous cherchons à produire avant de multiplier les solutions, les rôles ou les directions.

C’est moins spontané qu’une grande conversation où tout se mélange. Mais c’est beaucoup plus efficace dès que le projet devient long, technique ou partagé entre plusieurs agents.

La bonne collaboration humain–IA ne consiste donc pas seulement à mieux écrire les prompts. Elle consiste à concevoir une organisation dans laquelle les idées, les décisions, les règles et les tâches n’ont pas toutes le même statut.

Mon IA avait la tête sous l’eau.

Mais, soyons honnêtes, j’avais aussi rempli la piscine.

## À retenir

-   Une décision ancienne qui réapparaît peut signaler que plusieurs versions du projet sont encore en concurrence dans le contexte de l’agent.
-   Le remplacement devient pertinent lorsque les corrections répétées coûtent davantage qu’une reprise structurée ; la passation doit transporter l’état validé, pas tout l’historique.
-   La responsabilité humaine consiste aussi à séparer les idées futures du chantier présent, afin de ne pas transformer le contexte de l’agent en salade de fruits.

## Sources

-   Google Research — _Chain of Agents: Large language models collaborating on long-context tasks_, janvier 2025
[https://research.google/blog/chain-of-agents-large-language-models-collaborating-on-long-context-tasks/](https://research.google/blog/chain-of-agents-large-language-models-collaborating-on-long-context-tasks/?utm_source=chatgpt.com)
Cette recherche montre une manière de traiter un contexte long en le répartissant entre plusieurs agents, avec transmission et agrégation progressive de l’information. Elle soutient l’idée qu’un projet complexe ne doit pas nécessairement être confié à un seul contexte toujours plus volumineux.
-   Microsoft — _Managing Context Retention in Agentic AI_, 2025
[https://techcommunity.microsoft.com/blog/azureinfrastructureblog/managing-context-retention-in-agentic-ai/4458586](https://techcommunity.microsoft.com/blog/azureinfrastructureblog/managing-context-retention-in-agentic-ai/4458586?utm_source=chatgpt.com)
Ce contenu distingue la conversation courante, la mémoire conservée et la sélection des informations réellement utiles à l’agent. Il est pertinent pour ton passage sur la nécessité d’organiser le contexte plutôt que de simplement l’accumuler.
-   OpenAI — _A practical guide to building AI agents_, 2025
[https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/?utm_source=chatgpt.com)
Le guide recommande de partir d’une architecture simple, de ne passer au multi-agent que lorsque la complexité le justifie et d’intégrer des garde-fous ainsi que des interventions humaines. Cela soutient la partie sur le recadrage, le remplacement et la responsabilité humaine.
-   Nelson F. Liu et al. — _Lost in the Middle: How Language Models Use Long Contexts_, Transactions of the Association for Computational Linguistics, 2024
[https://aclanthology.org/2024.tacl-1.9/](https://aclanthology.org/2024.tacl-1.9/?utm_source=chatgpt.com)
L’étude montre que la présence d’une information dans un contexte long ne garantit pas qu’elle sera mobilisée correctement, notamment lorsqu’elle se trouve noyée au milieu d’autres éléments.

## Sur le même sujet

[

### Avec l’IA, mon cerveau travaille en dérivation, plus en série.

Reformuler, contredire, rebondir : l’IA ouvre davantage de pistes et donne parfois une nouvelle ambition aux projets. À condition de garder le jugement.

](/insights/avec-ia-mon-cerveau-travaille-en-derivation)

[

### L’IA me met dans les starting-blocks

L’IA ne fait pas disparaître le travail : elle réduit la barrière de démarrage et permet de transformer plus vite une intuition en première forme concrète que l’on peut juger et améliorer

](/insights/l-ia-me-met-dans-les-starting-blocks)

[

### Je ne travaille plus avec une IA. Je caste des équipes.

Comment une conversation peut faire émerger un projet, ses rôles IA, sa mémoire commune et ses contrôles, tout en laissant le final cut à l’humain.

](/insights/project-casting-methode-agents-ia)
