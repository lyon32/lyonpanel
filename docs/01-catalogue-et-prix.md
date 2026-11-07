# Catalogue et prix

## 1. Source

API JAP v2, action `services` : 5 740 services, 241 catégories JAP. Fichier produit : `data/catalogue-jap-usd-xaf.csv` (colonnes : id, plateforme, catégorie JAP, nom JAP, type, prix USD et XAF pour 1 000, min, max, dripfeed, refill, annulation). **Aucune marge n'est appliquée dans ce fichier.**

Taux provisoire : **1 USD = 600 XAF** (modifiable). XOF suit le même taux que XAF (parité fixe).

## 2. Classement par plateforme (provisoire, à affiner)

| Plateforme | Services | Min qté médian | Prix min (USD / XAF) | Médiane (USD / XAF) | Max (USD / XAF) |
|---|---|---|---|---|---|
| Instagram | 1509 | 10 | 0 $ / 1 | 2,75 $ / 1 648 | 6 875 $ / 4 125 000 |
| Trafic web / SEO | 991 | 500 | 0,15 $ / 90 | 0,44 $ / 263 | 375 000 $ / 225 000 000 |
| YouTube | 655 | 100 | 0,05 $ / 29 | 3 $ / 1 800 | 540 $ / 324 000 |
| TikTok | 647 | 50 | 0,01 $ / 3 | 0,88 $ / 525 | 156,25 $ / 93 750 |
| Facebook | 488 | 10 | 0,02 $ / 12 | 2,25 $ / 1 350 | 1 121,54 $ / 672 923 |
| Autres | 351 | 50 | 0,01 $ / 4 | 6,25 $ / 3 750 | 5 625 $ / 3 375 000 |
| Spotify | 311 | 500 | 0,13 $ / 75 | 0,63 $ / 378 | 1 275 $ / 765 000 |
| X (Twitter) | 265 | 50 | 0 $ / 2 | 3,75 $ / 2 250 | 437,5 $ / 262 500 |
| Telegram | 257 | 20 | 0 $ / 2 | 0,29 $ / 173 | 36 $ / 21 600 |
| Snapchat | 71 | 50 | 2,87 $ / 1 722 | 5,69 $ / 3 413 | 151,88 $ / 91 125 |
| Shopee | 58 | 10 | 0,23 $ / 135 | 10,5 $ / 6 300 | 5 400 $ / 3 240 000 |
| Twitch | 49 | 10 | 0,08 $ / 48 | 5 $ / 3 000 | 262,5 $ / 157 500 |
| SoundCloud | 29 | 20 | 0,28 $ / 169 | 6,5 $ / 3 900 | 62,5 $ / 37 500 |
| LinkedIn | 27 | 10 | 4,38 $ / 2 625 | 50 $ / 30 000 | 25 000 $ / 15 000 000 |
| WhatsApp | 18 | 10 | 2,5 $ / 1 500 | 6,56 $ / 3 938 | 6,56 $ / 3 938 |
| Discord | 14 | 1 | 5,63 $ / 3 375 | 192,5 $ / 115 500 | 7 500 $ / 4 500 000 |

Tous les prix sont **pour 1 000 unités**, au taux provisoire de 600 XAF pour 1 USD, sans marge. Répartition des minimums de commande (tous services) : 10 ou moins = 2 051 ; 11 à 100 = 2 006 ; 101 à 500 = 1 178 ; 1 000 = 355 ; plus de 1 000 = 149 ; médiane = 50 unités.

Remarques :
- La plateforme est déduite du nom de catégorie JAP par mots-clés. 351 services tombent dans « Autres » et 991 dans « Trafic web / SEO » (le mot « Google » ou « website » y a peut-être attiré des services qui n'en sont pas) : **à relire**.
- Des prix extrêmes (375 000 $ pour 1 000) existent : ce sont sans doute des forfaits ou des unités spéciales. À examiner avant publication.
- Mise en avant au lancement : Facebook, TikTok, Instagram (décidé).

## 2 bis. Prix client avec marge (décidé)

**Marge par plateforme (prioritaire)** : TikTok +120 %, Instagram +75 %, Facebook +75 %.
**Autres plateformes** : entre 60 % et 70 % selon le prix JAP : +70 % sous 1 $, +65 % de 1 à 5 $, +60 % au-dessus de 5 $ (paliers exacts = mon choix).
Taux provisoire 600 XAF pour 1 USD, prix client arrondis au multiple de 5 XAF (minimum 5 XAF), pour 1 000 unités.

Bénéfice sur 1 000 unités au prix médian de chaque plateforme :

- **Instagram** : JAP 1 648 XAF, client 2 885 XAF, **bénéfice 1 237 XAF** (+75 %)
- **Trafic web / SEO** : JAP 263 XAF, client 445 XAF, **bénéfice 182 XAF** (+69 %)
- **YouTube** : JAP 1 800 XAF, client 2 970 XAF, **bénéfice 1 170 XAF** (+65 %)
- **TikTok** : JAP 525 XAF, client 1 155 XAF, **bénéfice 630 XAF** (+120 %)
- **Facebook** : JAP 1 350 XAF, client 2 365 XAF, **bénéfice 1 015 XAF** (+75 %)
- **Autres** : JAP 3 750 XAF, client 6 000 XAF, **bénéfice 2 250 XAF** (+60 %)

Le détail de chaque service (marge, prix client) est dans le CSV. Ces chiffres sont internes : le client ne voit que son prix. La marge d'un service peut être changée à la main dans l'admin (elle prime sur la règle par plateforme).

## 3. Réorganisation du catalogue sur le site

Chaque service est présenté ainsi : **Plateforme → Type de service** (Abonnés, Likes, Vues, Commentaires, Partages, Direct/Live, Autres) **→ Qualité** (garantie / non garantie / ciblée par pays).
- Noms réécrits simplement en français (décidé), par exemple : « Abonnés Instagram — qualité garantie, recharge 30 jours ».
- Les étiquettes JAP (`[Max: 1M] [Start Time…]`) deviennent des champs lisibles : délai de départ, vitesse, garantie, minimum, maximum.
- Types spéciaux (commentaires personnalisés, abonnements, mentions, sondages, trafic) ont un formulaire de commande adapté.
- Les services doublons ou clairement trop chers peuvent être masqués côté admin (« on prend tout mais on arrange » — décidé).

## 4. Méthode de prix (à valider avec toi)

1. Table USD : prix JAP pour 1 000 (déjà faite).
2. Conversion XAF au taux choisi (déjà faite, provisoire).
3. **Marge par paliers** (décidée par le propriétaire) : plus le prix JAP est bas, plus le pourcentage est élevé, pour que le prix final reste cohérent :

| Prix JAP (USD/1000) | Marge |
|---|---|
| moins de 1 $ | +70 % |
| 1 à 5 $ | +65 % |
| plus de 5 $ | +60 % |

Fourchette décidée : 60 % à 70 %. Ces paliers sont **validés**.
4. Arrondi : au multiple de 5 ou 10 XAF pour un prix net.
5. Contrôle de cohérence : un contrôle automatique vérifie qu'aucun prix client n'est inférieur au coût JAP et qu'aucun service similaire n'a un prix plus élevé pour une qualité plus basse.
6. Remises gros clients : en plus de la marge, appliquées sur le prix client, jamais sous le coût JAP + marge minimale.

## 4 bis. Quantité, minimum et calcul du total

- Le prix JAP est exprimé **pour 1 000 unités**, mais chaque service a son propre minimum et maximum. Les minimums varient beaucoup : seuls 355 services sur 5 740 (environ 6 %) ont un minimum de 1 000. Médiane : 50 unités. 2 051 services ont un minimum de 10 ou moins, 2 006 entre 11 et 100, 1 178 entre 101 et 500, 149 au-dessus de 1 000.
- **Formule** : `total client = prix client pour 1000 × quantité ÷ 1000`, calculée côté serveur, arrondie au multiple de 5 ou 10 XAF. La marge s'applique au prix pour 1 000 avant ce calcul.
- Exemple : 100 followers à 5 $ les 1 000 chez JAP = 0,50 $ de coût, plus la marge.
- Le coût d'une commande minimale est faible : médiane de 0,11 $ chez JAP, 90 % des services sous 1,75 $. Beaucoup de commandes seront petites, d'où le minimum de recharge distinct du prix d'une commande.
- Le formulaire de commande affiche le prix pour 1 000 comme repère, recalcule le total en direct pendant la saisie de la quantité, et refuse toute quantité hors du min/max du service. Le serveur revérifie.
- Les colonnes `min` et `max` du CSV sont celles de chaque service.

## 5. Synchronisation

- Tâche planifiée (par exemple toutes les heures) : récupère `services` chez JAP, met à jour les coûts, détecte les services ajoutés ou retirés, recalcule les prix clients.
- Un service retiré chez JAP passe en « indisponible » sur LyonPanel.
- Si le coût JAP change de plus de X % (à fixer), alerte Telegram avant publication du nouveau prix.

## 6. Cohérence entre nom, prix et formulaire (décidé)

Chez JAP, le prix est écrit dans le nom du service (par exemple « … - $1.00 ») et le nom contient des étiquettes qui peuvent contredire les champs de l'API (par exemple « Max: 10K » dans le nom alors que l'API donne un maximum de 100 000). Chez LyonPanel :
- Le **prix n'est jamais écrit dans le nom**. Il est calculé et affiché séparément, avec notre marge, dans la devise du client.
- Le **nom est reconstruit** à partir des champs de l'API (plateforme, type, qualité, minimum, maximum, garantie, vitesse, délai), jamais copié tel quel avec ses étiquettes.
- Le formulaire, la fiche à droite et le total affichent **les mêmes chiffres** : min et max viennent des champs `min` et `max` de l'API, et le total vient de la formule de la section 4 bis.
- Un test automatique vérifie qu'aucun nom publié ne contient un prix JAP ni un min/max différent des champs.
