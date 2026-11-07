# Phase 2 — Mouvement (tâche 2.8) : 3 nouvelles pistes

Les pistes A, B, C (flèche, trois pas, décompte) sont rejetées : trop basiques, trop « IA ». Celles-ci partent des 7 images de référence (surtout quso.ai, SMMspot, Lumen).

**Ce qu'on retient des images :** héros très aéré avec points discrets ; vrais écrans du panel en petites cartes autour du titre ; tuiles de réseaux (TikTok, Instagram, YouTube) posées comme des objets ; formulaire de commande avec onglets et fiche service ; 4 cartes de chiffres.

**Règles communes :** seulement `transform` et `opacity`. Rien d'animé sur prix, solde, total. `prefers-reduced-motion` : tout est fixe. Aucun faux chiffre ni fausse notification : les cartes du héros montrent de vrais composants du panel avec des données d'exemple clairement marquées « Exemple ». Couleurs : bleu et jaune seulement. Poids = taille du code source du registre, pas du site final (non mesuré après build).

---

## Piste D — « Les écrans autour du titre » (accueil d'abord)
**Idée.** Le héros de quso.ai, en bleu : fond clair, points discrets, 4 à 5 vraies cartes du panel (une commande, une carte solde, une pastille « Terminée ») autour du titre, et 3 tuiles de réseaux posées en bas.
- **Composants.** Kokonut `halftone-background` (points, 16 Ko, canvas, 0 dépendance) ou `dot-field` (24 Ko) ; `motion` pour l'entrée décalée et les tuiles (ressort court) ; Aceternity `timeline` (4 Ko) pour « 3 étapes ».
- **Téléphone.** Points figés (une image CSS, pas de canvas). 3 cartes seulement, entrée décalée de 80 ms, une fois. Tuiles de réseaux : un petit rebond au toucher.
- **Ordinateur.** Points qui s'écartent doucement sous la souris. Les cartes bougent de 6 à 10 px en parallaxe selon la souris. Les tuiles rebondissent en place à l'arrivée.
- **Usages.** Héros : oui. Bouton Recharger : pression 0,97. Changement de page : fondu 150 ms. État vide : une tuile de réseau + « Aucune commande ». Tuiles : rebond.
- **Poids.** ~25 Ko de code source + `motion` (~5 Ko en version allégée).
- **Lenteur sur petit Android.** Faible sur téléphone (pas de canvas). Moyen sur ordinateur (canvas : à couper si l'onglet est caché).
- **Propre à LyonPanel.** Les cartes sont nos vrais écrans, avec XAF et Mobile Money. Aucun visage, aucune note.

## Piste E — « Le panel qui répond » (commander, espace client)
**Idée.** Le formulaire Lumen devient vivant sans toucher aux montants : on anime le choix, pas l'argent.
- **Composants.** Kokonut `smooth-tab` (22 Ko) : onglets Nouvelle commande / Recherche / En lot, avec indicateur qui glisse ; `metric-card` (30 Ko) pour les 4 cartes de chiffres (animation du survol seulement, pas du nombre) ; `status-island` (23 Ko) pour l'état d'une commande (En attente → En cours → Terminée) ; `slide-to-confirm` (15 Ko) pour valider une recharge ; Aceternity `tabs` (4 Ko) en secours ; `animated-tooltip` (4 Ko) pour l'aide sur Lien et Quantité.
- **Téléphone.** Onglets qui glissent, état de commande qui change de forme, bouton « Recharger 5 000 XAF » avec « Chargement… ». Slide-to-confirm seulement si le test au clavier et lecteur d'écran passe, sinon bouton normal.
- **Ordinateur en plus.** Fiche service à droite qui glisse de 12 px quand on change de service ; cartes de chiffres qui se soulèvent de 2 px au survol.
- **Usages.** Bouton Recharger : oui. Formulaire : oui (onglets, fiche, état). Changement de page : glissement 16 px entre onglets de la barre. États vides : carte « Aucune commande » + bouton Commander.
- **Poids.** ~90 Ko de code source pour le lot, `motion` partagé.
- **Lenteur.** Faible à moyenne. `metric-card` contient un graphique : à utiliser sans graphique côté client.
- **Propre à LyonPanel.** C'est un vrai outil, pas une vitrine : le mouvement dit « votre commande avance » (Finexy et Lumen).

## Piste F — « Pile d'écrans et tuiles magnétiques » (la plus riche)
**Idée.** Sur téléphone, les écrans du panel sont une pile qu'on fait glisser ; sur ordinateur, l'accueil réagit à la souris sur tout l'écran.
- **Composants.** Kokonut `card-stack` (36 Ko, glisser les cartes), `attract-button` (16 Ko, le bouton principal attire légèrement le curseur), `scroll-index` (21 Ko, index de sections sur le côté), `notification-stack` (25 Ko, seulement pour les vraies alertes de l'utilisateur connecté : « Recharge reçue », « Commande terminée »), `topo-background` (24 Ko) ; Aceternity `sticky-scroll-reveal` (4 Ko) pour les 3 étapes, `following-pointer` (4 Ko).
- **Téléphone.** Pile de 3 écrans à faire glisser (geste naturel), pas d'index, pas de fond animé.
- **Ordinateur.** Magnet sur le bouton principal, index de sections, étapes qui se révèlent au défilement (Lenis).
- **Usages.** Héros : pile ou tuiles. Bouton Recharger : magnet (ordinateur). Changement de page : fondu. Vide : une carte de la pile. Tuiles : ressort.
- **Poids.** ~130 Ko de code source, plus `motion` et Lenis (déjà prévu).
- **Lenteur.** Moyenne à forte sur petit Android si on garde la pile + fond. Il faut tester sur un vrai téléphone d'entrée de gamme avant de valider.
- **Propre à LyonPanel.** Les alertes sont de vraies notifications de compte ; la pile montre nos vrais écrans.

---

## Recommandation
**D pour l'accueil + E pour l'espace client et Commander.** C'est ce qui ressemble le plus à tes références (quso pour le héros, Lumen pour le formulaire), avec le moins de risque sur petit Android. F reste une option pour plus tard si D paraît trop sage sur ordinateur ; je n'y prendrais que `attract-button` et `card-stack`.

## Ce que je refuse
- Aceternity : aurora, spotlight, beams, meteors, sparkles, `hover-border-gradient`, `background-beams`, `lamp` (tape-à-l'œil « IA »).
- Verre flou, dégradés animés, cercles flottants, violet.
- Compteurs qui montent, faux avis, fausses notifications « Nouvel abonné ».
- `amount-pad`, `liquid-gauge`, `spending-ring` animés sur un montant ou solde.
- Canvas et Lenis sur petit téléphone.

## Ce que je n'ai pas pu vérifier
- Les noms et tailles viennent des fichiers de registre (le code source), pas d'un build : le poids réel dans l'application est à mesurer après installation.
- Aucun effet n'a été installé ni testé sur un vrai petit Android.
- Je n'ai pas relu chaque composant en entier : j'ai seulement vu qu'ils gèrent `prefers-reduced-motion`, ce qui reste à confirmer composant par composant (`dot-field`, `halftone`, `attract-button` oui ; `card-stack`, `slide-to-confirm` utilisent `useReducedMotion`).
- Je n'ai pas testé le clavier et le lecteur d'écran sur `slide-to-confirm`.
- Aceternity `3d-card-effect` n'est pas dans le registre (réponse vide) ; les autres noms Aceternity cités répondent.
- Le propriétaire a cité d'autres noms Kokonut (`swoosh-text`, `particle-button`, etc.) : ils existent mais je ne les ai pas retenus.
