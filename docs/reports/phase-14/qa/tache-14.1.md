# QA 14.1 - prototypes d'accueil (local :3100, Chromium, 360 px mobile et 1366 px)
Verdicts : A ACCEPTE, B ACCEPTE, C ACCEPTE (reserves mineures ci-dessous).
Mesures (12 pages) : erreurs console 0, requetes 4xx/5xx 0, debordement horizontal 0, cibles < 44 px 0, images sans alt 0, textes sous 4,5:1 0, bouton bleu #425EFF avec texte blanc = 4,91:1 (OK AA), chargement 360 px (sans limitation reseau) 0,8 a 3 s, aucun jaune, aucun apercu du tableau de bord, aucun nom de fournisseur.
Icones reseau : A filtre invert(1), B brightness(0) invert(1) : lisibles. C n'a pas d'icones (texte).
B : bouton fixe present a 360 px (bas, 73 px), invisible a 1366 px (voulu). Bascule de langue OK sur A et B ; C n'a pas de bascule FR/EN.
Liens : /inscription, /register, /connexion, /login = 200.
Defauts :
1. [Important, hors prototypes ou a verifier] /fr|en/services et /services/<reseau> renvoient 500 (probablement base locale Supabase arretee). Liens "Voir les services" de A, B, C et tuiles de C cassent tant que non verifie ; relancer avec la base.
2. [Important] C, src/components/prototypes/c/platform-grid.tsx : lien vers /services/TikTok (majuscule) ; verifier que la route attend bien ce slug (404/500 observe) ; utiliser le slug reel de la route.
3. [Mineur] C : pas de bascule de langue visible (A et B en ont une) ; vouvoiement alors que A et B tutoient : harmoniser.
4. [Mineur] C : "des 5 XAF" pour TikTok/Instagram : confirmer que c'est le vrai prix minimum du catalogue (pas de faux chiffre).
5. [Mineur] B : sur la capture pleine page le bouton fixe masque le texte de l'etape 1 (artefact de capture ; verifier au defilement reel).
