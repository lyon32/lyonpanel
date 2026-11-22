# Bilan — Phase 15 : vrai fournisseur, tests finaux, lancement limité
Date : 2026-11-22 · Statut : **partielle, en attente de ta décision** (jamais « validée » par l'équipe : seul ton « validé » compte)

## En une phrase
La partie « préparation » est faite (accueil, logo, image de partage, mesure de vitesse, audit de sécurité). La partie « vrai argent et vrai fournisseur » (15.6 à 15.9) **n'est pas démarrée** : elle attend tes actions et ton « validé ».

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

## PAS FAIT, HONNÊTEMENT
- **15.4 Test de charge (100 clients) et test de restauration de sauvegarde : NON EXÉCUTÉS.** Docker est arrêté sur la machine, donc pas de base locale. Les scripts sont prêts et vérifiés pour leur syntaxe, mais **aucun résultat chiffré n'existe**. Détail : `docs/reports/phase-15/charge-restauration.md`.
- **Essais de base de données (`npm run test:db`) non rejoués** : double commande simultanée, webhook rejoué deux fois, droits d'accès. Ils ont été vérifiés par lecture du code seulement.
- **gitleaks** (recherche de secrets) : non installé ici, à passer en CI sur la PR.
- **CI GitHub** : à lire sur la PR (pas encore lue ici).
- **Mesure de vitesse sur le vrai site et sur Android** : non faite.

## DÉCISIONS À PRENDRE PAR TOI
1. **Vitesse sur téléphone** : si le TBT est confirmé au-dessus de 200 ms sur le vrai site (3 passes), passer les sections fixes de l'accueil en « composants serveur » ? Conseil : d'abord confirmer le chiffre, puis décider.
2. **Fermer les inscriptions en cas de problème (pour 15.9)** : **rien n'existe aujourd'hui**, sauf retirer la clé Turnstile (anti-robots), ce qui est un moyen détourné. Le réglage de Supabase « autoriser les inscriptions » ne bloquerait pas notre site. Proposition : un réglage « inscriptions ouvertes / fermées » dans l'admin (changement à valider, pas fait d'office).
3. **Annulation par le client avec remboursement immédiat** : aujourd'hui, si le fournisseur confirme l'annulation et que rien n'a démarré, le client est remboursé tout de suite. Or la règle du projet est « jamais de remboursement automatique, toujours après examen ». À toi de dire : on garde l'exception, ou on repasse par ton examen.
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
