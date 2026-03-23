# Mr Tracer — Application de tracking colis multi-transporteurs

**Type de projet :** Application mobile B2C  
**Client :** La Poste (groupe)  
**Studio :** 66 Origin  
**Statut :** Prototype intégré à l'application officielle La Poste

---

## Résumé

Mr Tracer est une application mobile de suivi de colis multi-transporteurs conçue par 66 Origin pour le groupe La Poste. Elle centralise dans une seule interface le suivi des colis de La Poste, Chronopost, DPD, DHL, FedEx et UPS, via une expérience conversationnelle portée par un chatbot à personnage.

---

## Contexte et problème

- Chaque transporteur dispose de son propre outil de tracking, avec son vocabulaire et ses statuts propriétaires.
- L'utilisateur final ne sait souvent pas quel transporteur gère sa livraison.
- Le besoin utilisateur est simple : savoir où est le colis, quand il arrive, et si un problème bloque la livraison.
- La Poste cherchait à proposer un service agrégateur, pas un outil de tracking supplémentaire.

---

## Conviction produit

> Personne n'a envie de télécharger quatre ou cinq applications pour suivre ses commandes.

L'objectif était un point d'entrée unique capable de :
- Identifier automatiquement le bon transporteur
- Récupérer les données utiles
- Transformer des statuts techniques en langage clair et compréhensible

---

## Solution — Mr Tracer

### Fonctionnalités clés

| Fonctionnalité | Description |
|---|---|
| Suivi multi-transporteurs | La Poste, Chronopost, DPD, DHL, FedEx, UPS dans une seule interface |
| Chatbot avec personnage | Onboarding conversationnel, échange de fiche contact, intégration quotidienne |
| Lecture d'emails marchands | L'utilisateur transfère ses emails ; l'app détecte le n° de suivi et lance le tracking automatiquement |
| Traduction des statuts | Jargon logistique retranscrit en français clair et actionnable |
| Géolocalisation | Visualisation du parcours du colis sur carte, y compris passage en douane |
| Notifications push | Alertes à chaque étape clé de la livraison |
| Organisation en folders | Classement des livraisons par catégories personnelles (ex : cadeaux, vélo, animaux…) |
| Système de rating | Notation post-livraison via curseur animé avec morphing visuel |

### Suivi sans numéro de tracking

L'utilisateur transfère ses emails marchands à Mr Tracer. L'application identifie le transporteur, récupère les données et lance automatiquement le suivi — sans saisie manuelle.

---

## Stack technologique et UX

- Lecture et parsing d'emails transférés
- Identification automatique du transporteur
- Normalisation des statuts entre transporteurs
- Notifications push
- Visualisation cartographique du parcours colis
- UX writing spécialisé (traduction du jargon transport)
- Animations dédiées aux moments clés : arrivée imminente, passage en douane, recherche de l'opérateur
- React native, node js, open graph, postgresql

---

## Périmètre de mission (66 Origin)

- Conseil stratégique
- Concept produit
- Branding
- UX / UI
- Direction artistique
- Animations
- Logique conversationnelle (chatbot)
- Notifications
- Développement mobile

---

## Impact

### Stratégique
La Poste choisit de prioriser l'utilité utilisateur sur une logique fermée par opérateur, ce qui renforce sa légitimité dans un usage où la marque du transporteur importe peu pour le grand public.

### Produit
Le prototype a convaincu au point d'être intégré dans l'application officielle de La Poste, validant la pertinence du concept.

---

## Transporteurs supportés

- La Poste
- Chronopost
- DPD
- DHL
- FedEx
- UPS

---

## Mots-clés SEO et intentions associées

application tracking colis, tracking colis multi-transporteurs, suivi colis La Poste et concurrents, application suivi colis DHL FedEx UPS, chatbot suivi colis, application suivi livraison mobile, suivi colis sans numéro de tracking, géolocalisation colis sur carte, notifications suivi colis, centraliser plusieurs transporteurs, UX conversationnelle logistique, traduction statuts tracking colis, suivi colis Chronopost DPD La Poste, application réception colis B2C, cas client innovation service La Poste

---

## FAQ

**Qu'est-ce que Mr Tracer ?**  
Une application mobile conçue pour le groupe La Poste permettant de suivre des colis de plusieurs transporteurs dans une seule interface conversationnelle.

**Quels transporteurs peuvent être suivis ?**  
La Poste, Chronopost, DPD, DHL, FedEx et UPS.

**Comment fonctionne le suivi sans numéro de tracking ?**  
L'utilisateur transfère ses emails marchands à Mr Tracer. L'application identifie le transporteur, récupère les données et lance automatiquement le suivi.

**Quelle est la valeur ajoutée principale ?**  
Simplification du tracking, traduction des statuts techniques en langage clair, géolocalisation des envois, et centralisation de plusieurs opérateurs en un seul point d'entrée.

**Quel a été le rôle de 66 Origin ?**  
Conseil, concept, branding, UX, UI, animations, chatbot, notifications et développement mobile — du strategy au produit livrable.
