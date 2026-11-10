# Tableau de bord LyonPanel
Mis à jour le 2026-11-10 (phase 4 faite). Chiffres lus dans les comptes-rendus des phases 1 à 4.

**En 5 secondes :** les phases 0 à 4 sont validées (prix et catalogue, fusionnée dans main). Rien ne bloque. Points à regarder : services à prix extrêmes (à traiter en phase 12), mesure des boutons de 44 px non refaite dans un navigateur. Ensuite : phase 5, recharge SasPay (il faut préparer le compte marchand de test).

## 1. Avancement des phases
Bleu : validée. Jaune : faite, en attente de validation. Gris : à faire. Dates réelles : phases 0 et 1 le 2026-11-07, phase 2 le 2026-11-08, phase 3 le 2026-11-09, phase 4 le 2026-11-10.

```mermaid
flowchart LR
  P0["Phase 0 Socle<br/>validée<br/>2026-11-07"] --> P1["Phase 1 Base de données<br/>validée<br/>2026-11-07"]
  P1 --> P2["Phase 2 Design system<br/>validée<br/>2026-11-08"]
  P2 --> P3["Phase 3 Comptes<br/>validée<br/>2026-11-09"]
  P3 --> P4["Phase 4 Prix et catalogue<br/>validée<br/>2026-11-10"]
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
  P14 --> P15["15 Vrai fournisseur"]
  P15 --> P16["16 Ouverture publique"]
  classDef valide fill:#DBEAFE,stroke:#1D4ED8,color:#000
  classDef enattente fill:#FEF3C7,stroke:#B45309,color:#000
  classDef afaire fill:#E5E7EB,stroke:#6B7280,color:#000
  class P0,P1,P2,P3,P4 valide
  class P5,P6,P7,P8,P9,P10,P11,P12,P13,P14,P15,P16 afaire
```

## 2. Tâches de la phase 4 (tableau Kanban)
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
    g0["4.0 Documents"]
    g1["4.1 Tests"]
    g2["4.2 Base"]
    g3["4.3 Prix et fournisseur"]
    g4["4.4 Routes publiques"]
    g5["4.5 CSV et docs"]
    g6["4.6 Pages catalogue"]
    g7["4.7 Contrôles"]
    g8["4.8 Rapport et bilan"]
  end
  A --> B --> C --> D --> E --> F --> G
  classDef fait fill:#DBEAFE,stroke:#1D4ED8,color:#000
  classDef vide fill:#F3F4F6,stroke:#9CA3AF,color:#6B7280
  class g0,g1,g2,g3,g4,g5,g6,g7,g8 fait
  class a0,b0,c0,d0,e0,f0 vide
```

## 3. Répartition des tâches de la phase 4
```mermaid
pie showData
  title Tâches de la phase 4 par statut
  "Rapportée" : 9
```

## 4. Qui fait quoi maintenant
Plus aucun agent actif. Le chef de projet vérifie la CI sur la PR, puis le propriétaire teste et dit « validé ».

```mermaid
flowchart TD
  T0["4.0 Documents<br/>agent général"] --> T1["4.1 Tests<br/>lp-tester"]
  T1 --> T2["4.2 Base<br/>lp-db"]
  T2 --> T3["4.3 et 4.4 Prix, fournisseur, routes<br/>lp-coder"]
  T3 --> T5["4.5 CSV et docs<br/>lp-coder"]
  T3 --> T6["4.6 Pages<br/>lp-coder, lp-designer, lp-seo"]
  T6 --> R["4.7 Relecture<br/>lp-reviewer : acceptée"]
  T6 --> Q["4.7 QA<br/>lp-qa : corrigée"]
  T6 --> S["4.7 Sécurité<br/>lp-security : acceptée"]
  T5 --> RP["4.8 Rapport<br/>lp-reporter : fait"]
  R --> RP
  Q --> RP
  S --> RP
  RP --> PR["PR vers main<br/>CI à vérifier"]
  PR --> OWN["Propriétaire : tester et dire validé"]
  OWN --> NEXT["Phase 5 Recharge SasPay"]
  classDef fait fill:#DBEAFE,stroke:#1D4ED8,color:#000
  classDef attente fill:#FEF3C7,stroke:#B45309,color:#000
  classDef afaire fill:#E5E7EB,stroke:#6B7280,color:#000
  class T0,T1,T2,T3,T5,T6,R,Q,S,RP fait
  class PR,OWN attente
  class NEXT afaire
```

## 5. Santé du projet
| Phase | Tests écrits | Tests verts | Couverture modules d'argent | Corrections demandées par les contrôles |
|---|---|---|---|---|
| 0 | 29 (28 Vitest + 1 Playwright) | 29 | sans objet | 2 correctifs après audit sécurité |
| 1 | 253 (225 base + 28 Vitest) | 253 | un test nommé par cas d'argent, pas de pourcentage | 2 failles moyennes, 1 fuite de colonnes, 1 paiement failed, tous corrigés |
| 2 | 270 (247 Vitest + 23 Playwright) | 270 | sans objet (aucun module d'argent) | 2 verdicts À CORRIGER (relecture, QA), corrigés |
| 3 | 543 (488 Vitest + 55 Playwright) | 543 (tests de base non relancés) | sans objet (aucun module d'argent) | sécurité : 2 passes À CORRIGER puis acceptée avec réserves ; QA : plusieurs passes, 2 points importants alors en correction |
| 4 | 1 048 Vitest + 13 Playwright (catalogue) + 278 base | 1 048 Vitest, 13 Playwright, 273 base (5 échecs : stockage de fichiers, conteneur arrêté) | calcul des prix testé (pas de pourcentage mesuré dans les comptes-rendus) | sécurité : 2 remarques corrigées ; QA : 1 passe À CORRIGER légèrement, corrigée |

Lire chaque ligne comme « état de la phase », pas comme un cumul. Phase 4 : le total Vitest (1 048) compte aussi les tests des phases précédentes ; les 278 tests de base incluent ceux de la phase 1. Les 13 tests Playwright datent d'avant la dernière retouche de redirection.

Performance de la démo (LCP médian, téléphone lent, build de production) : 5,85 s avant, 2,37 s après (phase 2).

```mermaid
xychart-beta
  title "Tests Vitest par phase (écrits puis verts)"
  x-axis ["Phase 0", "Phase 1", "Phase 2", "Phase 3", "Phase 4"]
  y-axis "Nombre de tests" 0 --> 1100
  bar [29, 253, 270, 543, 1048]
  bar [29, 253, 270, 543, 1048]
```
Première barre : tests écrits. Deuxième barre : tests verts. Phase 4 : Vitest seulement (1 048 verts) ; les autres phases comptent aussi les tests de base et de navigateur.
