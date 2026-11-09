# Catalogue et prix

Ce document explique d'où viennent les services, comment ils sont rangés, nommés et vendus, et comment le prix est calculé. Les chiffres sont ceux du catalogue fourni par le fournisseur au moment de la phase 4 (2 188 services). La liste complète, service par service, est dans `data/catalogue-services.csv`.

## 1. Source

- Le catalogue vient de l'API v2 du fournisseur, action `services`. Chaque service a un numéro, un nom, un type, un prix **en USD pour 1 000 unités**, une quantité minimum et maximum, et trois options : recharge, annulation, goutte-à-goutte.
- Le taux de change est **1 USD = 600 XAF**. Il est réglable (réglage `usd_xaf_rate`, écran admin en phase 12). Le XOF suit le même taux que le XAF (parité fixe).
- Le fichier `data/catalogue-services.csv` est **généré** par `npm run catalogue:build` à partir du fichier brut. Il contient les prix du fournisseur et nos prix de vente. Il ne contient jamais le nom d'origine d'un service. Ces chiffres sont internes : le client ne voit que son prix de vente.
- Résumé chiffré : `data/catalogue-resume.json`.

## 2. Classement par réseau et par type

Le fournisseur range ses services à sa façon. Nous les reclassons avec des règles sur le nom, dans `src/server/catalog/classify.ts`.

**Réseau.** Le texte est mis en minuscules, sans accent ni lettres stylisées. On cherche dans le **nom** du service le premier mot-clé de réseau (Instagram, Insta ou IG en mot entier, TikTok, Facebook ou FB, YouTube ou YT, Telegram, X ou Twitter, Kick, Threads, Twitch, LinkedIn, Pinterest, Spotify, WhatsApp, Discord, SoundCloud, trafic web). **Le mot-clé qui apparaît le plus tôt dans le nom gagne.** S'il n'y en a aucun, on regarde la catégorie du fournisseur. Sinon : « Autres réseaux ».

**Type.** Mots-clés dans le nom : abonnés (followers, subscribers, members), J'aime (likes), vues (views, plays, watch time), commentaires, partages (shares, reposts, saves). Le premier mot-clé du nom gagne. Deux types du fournisseur priment sur le nom : « commentaires personnalisés » devient Commentaires, « likes de commentaires » devient J'aime. Sans mot-clé : « Autres services ».

## 3. Noms reconstruits

Le nom affiché est **fabriqué** à partir de champs propres : type, réseau, quelques qualificatifs, options (Recharge, Annulable, Goutte-à-goutte), puis le numéro. Exemple : « Abonnés Instagram · Réel · États-Unis · Garantie 30 j · Recharge #35452 ».

Les qualificatifs (4 au maximum, dans cet ordre fixe) sont : cible (Story, Reel, Live, Post, Profil, Page), qualité (Réel, Haute qualité, Premium, Mixte, Économique, Organique), origine (pays ou région, ou Mondial), garantie (« Garantie à vie » ou « Garantie 30 j »), chute (Sans chute, Chute faible), Départ instantané. Ils sont cherchés dans le nom et la catégorie du fournisseur, mais **réécrits en mots propres** (FR/EN) : aucun texte du fournisseur n'est recopié. Le nom fait 95 caractères au plus avant le numéro.

Il ne reprend **jamais** le nom du fournisseur, ni ses étiquettes (`[Max: 1M]`, `[Start Time…]`), ni un prix, ni une promesse de qualité. Le client ne doit pas pouvoir deviner d'où vient le service. Avec les qualificatifs, le catalogue de 2 188 services compte **1 051 noms distincts** avant le numéro (au lieu d'une poignée), le plus répété l'étant 39 fois.

Un service déjà présent n'est jamais renommé par la synchronisation.

## 4. Règle du prix

1. Coût en XAF pour 1 000 = prix du fournisseur en USD × 600.
2. Prix de vente pour 1 000 = coût en XAF × **multiplicateur**.
3. Arrondi **au multiple de 5 XAF supérieur**, minimum 5 XAF.

Le multiplicateur est **3 au départ**. Il se choisit dans cet ordre : la surcharge du service s'il y en a une, sinon la règle du couple réseau × type, sinon le réglage par défaut (`default_multiplier`). Tout est réglable dans l'admin (phase 12). Quand le taux ou un multiplicateur change, tous les prix sont recalculés.

Exemple : un service à 1,50 $ les 1 000 coûte 900 XAF. Avec ×3 : 2 700 XAF les 1 000.

## 5. Total, minimum et maximum

- **Total d'une commande** = prix pour 1 000 × quantité ÷ 1 000, calculé **par le serveur**, arrondi lui aussi au multiple de 5 XAF supérieur, minimum 5 XAF. Le navigateur n'envoie jamais de prix.
- **Commande minimum** = total pour la quantité minimum du service.
- Chaque service a sa quantité minimum et maximum, reprises du fournisseur. Elles varient beaucoup d'un service à l'autre, et le formulaire de commande les affiche pour chaque service.
- Exemple : 100 abonnés à 2 700 XAF les 1 000 = 270 XAF.

## 6. Quels services sont vendus

**Tous** les services sont vendus et actifs, sauf ceux qui disparaissent de la liste du fournisseur (ils passent « indisponibles », sans être supprimés, car des commandes passées y renvoient). L'administrateur peut aussi désactiver un service à la main ; la synchronisation ne le réactive pas.

## 7. Synchronisation

Le serveur compare régulièrement la liste du fournisseur à notre base :

- nouveau service : il est ajouté, classé, nommé et prix calculé ;
- prix, minimum, maximum ou options modifiés : mise à jour, historique des prix conservé ;
- service disparu : marqué indisponible.

**Garde-fous.** Si le fournisseur répond par une erreur ou une **liste vide**, on n'écrit rien : sinon tout le catalogue deviendrait indisponible d'un coup. **Alerte** au propriétaire (Telegram) quand le prix de vente d'un service varie de plus de `price_alert_pct` %.

## 8. Cohérence nom, prix, formulaire

Le nom, le prix et le formulaire viennent de la **même ligne** de la base. Si le fournisseur change un service (type, options, minimum), la synchronisation met tout à jour d'un seul coup : on ne peut pas afficher un nom qui promet « Recharge » avec un prix ou un formulaire d'un autre service. Les formulaires spéciaux (commentaires personnalisés, par exemple) suivent le type fournisseur.

## 9. Contrôle des prix extrêmes (pour information)

À regarder avant la mise en ligne. Ces services sont vendus comme les autres ; le propriétaire peut les désactiver ou changer leur multiplicateur.

### Services à plus de 100 $ les 1 000 chez le fournisseur (11)

| Numéro | Nom | Prix de vente pour 1 000 (XAF) | Commande minimum (XAF) |
|---:|---|---:|---:|
| 30786 | Commentaires Autres réseaux · Mondial · Garantie 7 j #30786 | 8 709 120 | 8 710 |
| 36540 | Commentaires Instagram · Réel · Europe #36540 | 973 730 | 3 895 |
| 28486 | Autres services Telegram · Story · Premium · Annulable #28486 | 503 970 | 5 040 |
| 22623 | Commentaires Instagram · Réel · États-Unis · Sans chute #22623 | 451 475 | 2 260 |
| 36046 | Commentaires Instagram · États-Unis #36046 | 320 635 | 1 605 |
| 36047 | Commentaires Instagram · États-Unis #36047 | 320 635 | 1 605 |
| 36048 | Commentaires Instagram · États-Unis #36048 | 320 635 | 1 605 |
| 27594 | Vues YouTube · Live #27594 | 319 335 | 15 970 |
| 31603 | Autres services Telegram · Annulable #31603 | 204 750 | 205 |
| 35464 | Commentaires Instagram · Haute qualité #35464 | 194 750 | 195 |
| 32563 | Commentaires Instagram · Réel #32563 | 189 000 | 945 |

### Services dont la commande minimum dépasse 5 000 XAF (12)

| Numéro | Nom | Prix de vente pour 1 000 (XAF) | Commande minimum (XAF) |
|---:|---|---:|---:|
| 27913 | Vues YouTube · Garantie à vie · Sans chute #27913 | 2 295 | 22 950 |
| 27594 | Vues YouTube · Live #27594 | 319 335 | 15 970 |
| 30786 | Commentaires Autres réseaux · Mondial · Garantie 7 j #30786 | 8 709 120 | 8 710 |
| 34592 | Vues YouTube · Garantie à vie · Annulable #34592 | 8 130 | 8 130 |
| 28717 | Abonnés YouTube · Réel · États-Unis · Garantie 30 j · Sans chute #28717 | 78 750 | 7 875 |
| 32025 | Vues YouTube · États-Unis #32025 | 7 530 | 7 530 |
| 30754 | Vues YouTube · Réel · Départ instantané #30754 | 14 490 | 7 245 |
| 33511 | Vues YouTube · Garantie à vie · Recharge · Annulable #33511 | 1 350 | 6 750 |
| 34607 | Vues YouTube · États-Unis · Garantie à vie #34607 | 11 560 | 5 780 |
| 33621 | Vues YouTube · Garantie 30 j · Sans chute #33621 | 56 855 | 5 690 |
| 30848 | Vues YouTube · Garantie 30 j #30848 | 53 225 | 5 325 |
| 28486 | Autres services Telegram · Story · Premium · Annulable #28486 | 503 970 | 5 040 |

## 10. Récapitulatif réseau × type

Nombre de services par réseau et par type (2 188 au total).

| Réseau | Abonnés | J'aime | Vues | Commentaires | Partages | Autres services | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Instagram | 215 | 269 | 184 | 64 | 64 | 26 | 822 |
| TikTok | 119 | 183 | 211 | 17 | 13 | 4 | 547 |
| Facebook | 99 | 96 | 59 | 14 | 2 | 38 | 308 |
| YouTube | 29 | 64 | 119 | 30 | 2 | 17 | 261 |
| Telegram | 59 | 1 | 49 | 0 | 1 | 34 | 144 |
| X | 11 | 7 | 29 | 1 | 0 | 9 | 57 |
| Kick | 2 | 0 | 9 | 0 | 0 | 0 | 11 |
| Threads | 3 | 1 | 0 | 0 | 3 | 0 | 7 |
| Twitch | 1 | 0 | 5 | 0 | 0 | 0 | 6 |
| LinkedIn | 2 | 1 | 0 | 0 | 1 | 0 | 4 |
| Pinterest | 1 | 1 | 1 | 0 | 1 | 0 | 4 |
| Spotify | 0 | 0 | 3 | 0 | 0 | 0 | 3 |
| WhatsApp | 2 | 1 | 0 | 0 | 0 | 0 | 3 |
| Trafic web | 0 | 0 | 0 | 0 | 0 | 8 | 8 |
| Autres réseaux | 1 | 0 | 1 | 1 | 0 | 0 | 3 |
| **Total** | 544 | 624 | 670 | 127 | 87 | 136 | **2188** |

## 11. Détail par réseau

Pour chaque type : nombre de services, prix de vente médian pour 1 000 unités, et prix médian de la commande minimum. Au taux de 600 XAF et avec le multiplicateur de départ (×3).

#### Instagram (822 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 215 | 4 665 | 85 |
| J'aime | 269 | 775 | 10 |
| Vues | 184 | 25 | 5 |
| Commentaires | 64 | 15 120 | 145 |
| Partages | 64 | 313 | 5 |
| Autres services | 26 | 123 | 8 |

#### TikTok (547 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 119 | 3 730 | 45 |
| J'aime | 183 | 1 390 | 15 |
| Vues | 211 | 125 | 15 |
| Commentaires | 17 | 8 720 | 105 |
| Partages | 13 | 230 | 5 |
| Autres services | 4 | 3 655 | 58 |

#### Facebook (308 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 99 | 885 | 40 |
| J'aime | 96 | 873 | 15 |
| Vues | 59 | 1 260 | 30 |
| Commentaires | 14 | 8 065 | 45 |
| Partages | 2 | 17 663 | 180 |
| Autres services | 38 | 485 | 5 |

#### YouTube (261 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 29 | 6 175 | 65 |
| J'aime | 64 | 2 345 | 35 |
| Vues | 119 | 2 280 | 260 |
| Commentaires | 30 | 5 933 | 43 |
| Partages | 2 | 2 280 | 798 |
| Autres services | 17 | 3 025 | 155 |

#### Telegram (144 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 59 | 1 480 | 25 |
| J'aime | 1 | 235 | 5 |
| Vues | 49 | 50 | 5 |
| Partages | 1 | 35 | 5 |
| Autres services | 34 | 475 | 15 |

#### X (57 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 11 | 8 470 | 440 |
| J'aime | 7 | 17 695 | 180 |
| Vues | 29 | 15 | 5 |
| Commentaires | 1 | 71 125 | 75 |
| Autres services | 9 | 560 | 60 |

#### Kick (11 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 2 | 1 248 | 8 |
| Vues | 9 | 885 | 10 |

#### Threads (7 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 3 | 9 955 | 100 |
| J'aime | 1 | 3 315 | 35 |
| Partages | 3 | 4 990 | 50 |

#### Twitch (6 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 1 | 2 520 | 55 |
| Vues | 5 | 8 540 | 90 |

#### LinkedIn (4 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 2 | 21 170 | 215 |
| J'aime | 1 | 81 970 | 410 |
| Partages | 1 | 132 065 | 665 |

#### Pinterest (4 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 1 | 9 940 | 100 |
| J'aime | 1 | 3 315 | 35 |
| Vues | 1 | 3 315 | 35 |
| Partages | 1 | 3 315 | 35 |

#### Spotify (3 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Vues | 3 | 845 | 845 |

#### WhatsApp (3 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 2 | 7 828 | 83 |
| J'aime | 1 | 105 | 5 |

#### Trafic web (8 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Autres services | 8 | 505 | 148 |

#### Autres réseaux (3 services)

| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |
|---|---:|---:|---:|
| Abonnés | 1 | 8 820 | 180 |
| Vues | 1 | 1 260 | 30 |
| Commentaires | 1 | 8 709 120 | 8 710 |

La liste complète des 2 188 services est dans `data/catalogue-services.csv`.
