# Tableau de bord LyonPanel
Mis à jour le 2026-11-07 (fin de la phase 0). Chiffres lus dans les comptes-rendus et les commandes de la tâche 0.6.

**En 5 secondes :** la phase 0 est faite, en attente de ton « validé ». Rien ne bloque côté technique. À faire par toi : protéger `main`, ouvrir/valider la PR, trancher `SASPAY_MODE=live`. Ensuite : phase 1, base de données.

## 1. Avancement des phases
Aucune date n'est prévue pour les phases 1 à 16 : seule la phase 0 a une date réelle (2026-11-07). Jaune : faite, en attente de validation. Gris : à faire. Bleu : validée (aucune pour l'instant).

```mermaid
flowchart LR
  P0["Phase 0 Socle<br/>faite, en attente de validation<br/>2026-11-07"] --> P1["1 Base de données"]
  P1 --> P2["2 Design system"]
  P2 --> P3["3 Comptes"]
  P3 --> P4["4 Prix et catalogue"]
  P4 --> P5["5 Recharge SasPay"]
  P5 --> P6["6 Commande"]
  P6 --> P7["7 Suivi et alertes"]
  P7 --> P8["8 Espace client"]
  P8 --> P9["9 Support"]
  P9 --> P10["10 Parrainage"]
  P10 --> P11["11 Admin 1"]
  P11 --> P12["12 Admin 2"]
  P12 --> P13["13 Mise en ligne de test"]
  P13 --> P14["14 Accueil et SEO"]
  P14 --> P15["15 Vrai JAP"]
  P15 --> P16["16 Ouverture publique"]
  classDef enattente fill:#FEF3C7,stroke:#B45309,color:#000
  classDef afaire fill:#E5E7EB,stroke:#6B7280,color:#000
  class P0 enattente
  class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,P16 afaire
```

## 2. Tâches de la phase 0 (tableau Kanban)
```mermaid
flowchart LR
  subgraph A["À faire"]
    direction TB
    a0["aucune"]
  end
  subgraph B["Tests écrits"]
    direction TB
    b0["aucune"]
  end
  subgraph C["Codée"]
    direction TB
    c0["aucune"]
  end
  subgraph D["Contrôles"]
    direction TB
    d0["aucune"]
  end
  subgraph E["À corriger"]
    direction TB
    e0["aucune"]
  end
  subgraph F["Acceptée"]
    direction TB
    f0["aucune"]
  end
  subgraph G["Rapportée"]
    direction TB
    g1["0.1 Projet et outils"]
    g2["0.2 Variables env"]
    g3["0.4 CI et secrets"]
    g4["0.5 Sentry"]
    g5["0.6 Rapport et documents"]
  end
  A --> B --> C --> D --> E --> F --> G
  classDef fait fill:#DBEAFE,stroke:#1D4ED8,color:#000
  classDef vide fill:#F3F4F6,stroke:#9CA3AF,color:#6B7280
  class g1,g2,g3,g4,g5 fait
  class a0,b0,c0,d0,e0,f0 vide
```

## 3. Répartition des tâches de la phase 0
```mermaid
pie showData
  title Tâches de la phase 0 par statut
  "Rapportée" : 5
  "Autres statuts" : 0
```

## 4. Qui fait quoi maintenant
Aucun agent n'est actif : toutes les tâches sont rapportées. Seul point d'attente : le propriétaire.

```mermaid
flowchart TD
  T01["0.1 Projet et outils<br/>lp-coder, lp-reviewer : fait"] --> T02["0.2 Variables env<br/>lp-security : fait"]
  T01 --> T04["0.4 CI et secrets<br/>lp-reviewer : fait"]
  T01 --> T05["0.5 Sentry<br/>lp-security : fait"]
  T02 --> T06["0.6 Rapport<br/>lp-reporter : fait"]
  T04 --> T06
  T05 --> T06
  T06 --> PR["PR feat/phase-0-socle vers main<br/>à ouvrir par le chef de projet"]
  PR --> OWN["Propriétaire : tester et dire validé"]
  OWN --> NEXT["Phase 1 Base de données"]
  classDef fait fill:#DBEAFE,stroke:#1D4ED8,color:#000
  classDef attente fill:#FEF3C7,stroke:#B45309,color:#000
  classDef afaire fill:#E5E7EB,stroke:#6B7280,color:#000
  class T01,T02,T04,T05,T06 fait
  class PR,OWN attente
  class NEXT afaire
```

## 5. Santé du projet
| Phase | Tests (écrits) | Tests verts | Couverture modules d'argent | Corrections demandées par les contrôles |
|---|---|---|---|---|
| 0 | 27 (26 Vitest + 1 Playwright) | 27 | sans objet (aucun module d'argent) | 2 correctifs après audit sécurité (`518d1b0`, `bd1a38a`) |

Couverture globale Vitest : 83,16 % des instructions, 81,57 % des branches.

```mermaid
xychart-beta
  title "Tests par phase"
  x-axis ["Phase 0"]
  y-axis "Nombre de tests" 0 --> 30
  bar [27]
  bar [27]
```
Première barre : tests écrits. Deuxième barre : tests verts.
