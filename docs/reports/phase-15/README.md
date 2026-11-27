# Bilan — Phase 15 : vrai fournisseur, tests finaux, lancement limité
Date : 2026-11-27 (mis à jour) · Statut : **partielle, en attente de ta décision** (jamais « validée » par l'équipe : seul ton « validé » compte)

## En une phrase
La partie « préparation » est faite (accueil, logo, image de partage, mesure de vitesse, audit de sécurité). La partie « vrai argent et vrai fournisseur » (15.6 à 15.9) **n'est pas démarrée** : elle attend tes actions et ton « validé ».

## Ce qu'il reste avant de dire « validé »
1. Régénérer la clé du fournisseur (et révoquer l'ancienne), la mettre dans Vercel Production, jamais dans un fichier.
2. Mettre le site en ligne en test (pas de Preview, ta décision du 2026-11-27), puis refaire la mesure de charge et la vitesse de l'accueil (3 passes Lighthouse + un vrai téléphone Android).
3. Décider de l'interrupteur « inscriptions ouvertes / fermées » (proposé, non fait).
4. Valider ou non la suppression de la fonction SQL `refund_canceled_order` (migration).
5. Lire la CI sur la PR et passer gitleaks en CI.
6. Dire « validé » pour chaque étape réelle (15.7, puis 15.8). Rien de réel ne démarre sans ce mot.

## Rappel important
**Aucun vrai fournisseur et aucun vrai paiement n'a été utilisé.** Tout a tourné en mode faux (`PROVIDER_MODE=mock`, SasPay test). Aucune clé réelle n'a été lue ni écrite.

## FAIT
- **15.1 Chiffres de l'accueil** : l'accueil affiche « 100+ clients » et « 2000+ commandes », en français et en anglais, sans la pastille « Exemple ». Il y a maintenant 5 tuiles de preuve. Sur ordinateur : 3 + 2. Sur téléphone 360 px : 2 + 2 + 1 (la dernière tuile prend toute la largeur).
- **15.2 Logo et image de partage** :
  - Logo en palette sombre, lisible sur téléphone et ordinateur.
  - `public/og/default.png` créée (1200 x 630, fond `#111111`, logo + « 1er panel SMM d'Afrique »). Elle est écrite en **Arial**, car la police Public Sans n'est pas disponible en local pour l'image. À refaire plus tard si tu veux la vraie police.
  - L'image de partage est aussi présente sur les pages du catalogue (accueil, services, pages par réseau, FR et EN).
- **15.3 Mesure de vitesse (Lighthouse officiel, en local)** :
  - Téléphone, français : score 76, blocage du navigateur (TBT) 390 ms.
  - Téléphone, anglais : score 91, TBT 260 ms.
  - Ordinateur : 99 (français) et 98 (anglais).
  - Objectif TBT : moins de 200 ms sur téléphone. **Non atteint** (390 et 260 ms), mais mieux que les 1,2 s de la phase 14 (autre méthode, pas comparable).
  - Score SEO 61 : normal, il vient du « ne pas indexer » voulu tant que le domaine n'est pas branché.
  - **Pas mesuré** : le vrai site `lyonpanel.com` et un vrai téléphone Android.
- **15.5 Audit de sécurité** : verdict **ACCEPTÉ**, sous réserve de 2 points moyens. Le point 1 est corrigé : le garde-fou « SasPay en réel exige le fournisseur en réel » est en place (sinon un client pourrait payer pour de vrai et sa commande partir vers le faux fournisseur : « il paie et ne reçoit rien »).
- **15.10 Rapport** : ce document.
- **Tests** : **2161** tests unitaires passent.

## DÉCISIONS DÉJÀ PRISES PAR TOI (2026-11-27)
- **Annulation par le client : TRANCHÉ.** Plus aucun remboursement automatique. Quand le client annule, la commande passe en examen (`to_review`) et c'est toi qui décides du remboursement. Fait dans le commit `4183fd9`. Audit de sécurité : ACCEPTÉ, avec 3 failles Basses : (1) un double clic simultané peut envoyer deux fois `provider.cancel` ; (2) la mise à jour finale du statut n'a pas de garde sur le statut précédent ; (3) l'alerte part même si cette mise à jour échoue. La fonction SQL `refund_canceled_order` est laissée en place : la supprimer demande une migration, à valider par toi.
- **Image de partage** : gardée en Arial.
- **Vitesse de l'accueil** : à mesurer d'abord en ligne, avant de changer le code.
- **Pas de Preview** : la mesure se fera à la mise en ligne de test.
- **Interrupteur d'inscriptions** : proposé, **pas fait**, il attend ton « validé ».

## INCIDENT
Un agent a copié par erreur le `.env.local` du dépôt principal, puis l'a supprimé. Jamais commité, aucune valeur affichée. La clé fournisseur reste à régénérer.

## PAS FAIT, HONNÊTEMENT
- **15.4 Test de charge (100 clients) et test de restauration : EXÉCUTÉS le 2026-11-27 en local, mode faux.** `npm run test:db` : **1333 tests de base verts**. Charge à 100 clients : argent cohérent (0 double crédit, 0 double débit, 0 solde négatif ou incohérent), mais **p95 entre 1641 et 1956 ms, au-dessus de l'objectif de 800 ms**, et **2 essais sur 4 à 100 clients ont perdu des commandes** en local (cause non prouvée, probablement la saturation du poste). Aux paliers 10 et 30 clients : OK, sous 800 ms. À refaire à la mise en ligne de test. Restauration : soldes et totaux identiques ; **comptes `auth` et règles RLS non prouvés** par ce test. Détail : `docs/reports/phase-15/charge-restauration.md`.
- **15.4 bis, montée progressive (2026-11-27, local, mode faux, PAS une mesure Preview/production)** : paliers 10, 30, 100 clients, création des comptes mesurée à part. Argent : 0 double crédit, 0 double débit, 0 solde négatif ou incohérent à tous les paliers et sur toutes les exécutions. Vitesse `place_order`/`credit_payment` : p95 337 ms (10), 328 ms (30), 1641 ms (100, objectif 800 ms non atteint à 100). Instabilité locale : sur 3 exécutions du palier 100, 2 ont perdu 79 puis 2 commandes (`fetch failed` côté client de test, pas d'erreur SQL). Détail : `charge-restauration.md`.
- **gitleaks** (recherche de secrets) : non installé ici, à passer en CI sur la PR.
- **CI GitHub** : à lire sur la PR (pas encore lue ici).
- **Mesure de vitesse sur le vrai site et sur Android** : non faite.

## DÉCISIONS À PRENDRE PAR TOI
1. **Vitesse sur téléphone** (à mesurer en ligne d'abord, décidé le 2026-11-27) : si le TBT est confirmé au-dessus de 200 ms sur le vrai site (3 passes), passer les sections fixes de l'accueil en « composants serveur » ? Conseil : d'abord confirmer le chiffre, puis décider.
2. **Fermer les inscriptions en cas de problème (pour 15.9)** : proposé, **NON fait, attend ton « validé »**. **Rien n'existe aujourd'hui**, sauf retirer la clé Turnstile (anti-robots), ce qui est un moyen détourné. Le réglage de Supabase « autoriser les inscriptions » ne bloquerait pas notre site. Proposition : un réglage « inscriptions ouvertes / fermées » dans l'admin (changement à valider, pas fait d'office).
3. ~~Annulation par le client avec remboursement immédiat~~ : **TRANCHÉ le 2026-11-27**, plus aucun remboursement automatique (voir plus haut).
4. **Point faible de sécurité, niveau bas** : la protection du navigateur (CSP) accepte des scripts « en ligne » (`unsafe-inline`). Acceptable pour l'instant ; à durcir plus tard.
5. **`chart.tsx`** : ce composant utilise `dangerouslySetInnerHTML`, ce que le projet interdit. Le contenu vient de la configuration, pas d'une saisie. À supprimer s'il est inutilisé, sinon à garder comme exception documentée.

## 15.6 à 15.9 : NON DÉMARRÉES (attendent ton « validé »)
### Vérifications préalables (plan 15.6, toutes obligatoires)
- Tests, charge 100 clients et restauration verts ; CI lue sur la PR. **Pas encore réunis** (voir ci-dessus).
- Audit sécurité ACCEPTÉ : **fait** (réserves à lever : essais de base à rejouer, gitleaks en CI).
- Clé fournisseur régénérée par toi, ancienne clé révoquée ; alerte du solde fournisseur à 5 $ active.
- Ton « validé » écrit pour chaque étape réelle (15.7, puis 15.8).
- Plafonds du test : 0,50 $ de commandes, solde fournisseur limité à 20 $ au départ.
- Aucun remboursement automatique : le remboursement du test se fait après ton examen.

### Ce que tu dois faire toi-même
1. **Régénérer la clé du fournisseur** chez lui et la mettre **directement dans Vercel (Production)**. Ne me la donne jamais et ne l'écris dans aucun fichier. Révoque l'ancienne tout de suite (celle vue en conversation).
2. **Recharger 20 $** de solde chez le fournisseur.
3. **Passer SasPay en production** et mettre la clé `sk_live_...` dans Vercel, jamais dans le dépôt.
4. Démarrer Docker (pour les tests de charge et de restauration) ou me dire de les lancer ailleurs.

### Ce qui suivra, étape par étape
- **15.7** : `PROVIDER_MODE=live`, 2 à 3 commandes réelles (~0,50 $ au total). Jamais de relance automatique de `provider.add`.
- **15.8** : 1 recharge Mobile Money réelle, puis 1 remboursement après ton examen.
- **15.9** : ouverture limitée (10 à 20 invités, 1 à 2 semaines), site toujours en « ne pas indexer ».

## À tester par toi (pas à pas)
1. Ouvre `/fr` et `/en` sur ton téléphone : les 5 tuiles (100+ clients, 2000+ commandes, etc.), pas de pastille « Exemple », logo lisible.
2. Ouvre `/og/default.png` : l'image de partage 1200 x 630.
3. Colle l'adresse d'une page dans un aperçu de partage (WhatsApp, par exemple) quand le domaine sera branché : l'image doit apparaître.
4. Lance toi-même Lighthouse : `npx lighthouse https://lyonpanel.com/fr --output=html --view` quand le site est en ligne.

## Décision attendue
Dis-moi : « validé » pour ce qui est fait, tes réponses aux 5 décisions, et quand tu as fait les actions 🧑 ci-dessus. Rien de réel ne démarre sans ton « validé » écrit.
