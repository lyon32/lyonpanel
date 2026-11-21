# Bilan — Phase 14 : Accueil soigné + SEO
Date : 2026-11-21 · Statut : faite côté équipe, **en attente de ton « validé »**

## En une phrase
Le site public (accueil, services, FAQ, contact, connexion) est maintenant en palette sombre, rapide sur téléphone, et prêt pour Google : toutes les balises sont en place, mais le site reste en « ne pas indexer » tant que `lyonpanel.com` n'est pas branché.

## Tes décisions, respectées
- Prototype **E** choisi le 2026-11-21 ; les autres (A, B, C, D, F) sont supprimés.
- Palette sombre sur **tout le site public** (fond `#111111`, accent `#425EFF`, gris `#D7D7DA`), plus de blanc/bleu/jaune.
- Aucun aperçu du tableau de bord sur l'accueil.
- Tout est écrit au nom de `https://lyonpanel.com`, via une variable d'environnement.
- Confidentialité, conditions, Google Analytics : hors phase, non faits.
- Pas de nom de fournisseur, pas de faux « n°1 ».

## Ce qui a été fait, tâche par tâche
- **14.1 Prototypes** : 6 prototypes présentés, tu as choisi E. Captures dans `docs/reports/phase-14/prototypes/`.
- **14.2 Accueil final** (commit 28934ba) : accueil E en français et en anglais, textes dans les fichiers de traduction, palette sombre sur Services, Blog, connexion, inscription et page 404. Relecture et QA acceptées au 2e passage.
- **14.3 Pages réseaux et services** (c5d47f6) : une page par réseau avec prix en XAF calculés côté serveur et petite FAQ. Si le catalogue est indisponible, un message propre s'affiche (plus d'erreur 500).
- **14.4 FAQ et contact** (c5d47f6) : page FAQ (12 questions) et page contact qui renvoie vers le support existant. Aucun nouveau service ajouté. Données structurées protégées contre l'injection.
- **14.5 SEO technique** (21ed34a) : titre, description, adresse canonique, langues FR/EN, aperçu de partage (Open Graph, Twitter), plan du site, robots. Pages privées et admin toujours en « ne pas indexer ». Le site entier reste en « ne pas indexer » tant que `SITE_INDEXABLE` n'est pas à `true`.
- **14.6 Test automatique des balises** (21ed34a) : un test vérifie chaque page publique (balises) et chaque page privée (« ne pas indexer »). Il tourne dans la CI.
- **14.7 Durcissements, performance, rapport** (8b99d26, e2ec58f) : corrections après audit de sécurité, chargement différé de l'animation GSAP, retrait de la cascade du héros, logos de paiement chargés à la demande.

## Vérifications (résultats réels)
- Tests unitaires : **2146** passent.
- Tests e2e SEO : **24** passent.
- Types : OK. Lint : **0 erreur**. Build : OK.
- Relectures (`lp-reviewer`) : ACCEPTÉ. QA navigateur (`lp-qa`) : ACCEPTÉ (360 px et ordinateur, FR et EN, 0 erreur console, aucun débordement).
- Audit sécurité (`lp-security`) : ACCEPTÉ, avec 2 remarques de niveau bas, corrigées.
- **CI : à lire sur la PR** (pas encore ouverte, jamais lue ici).

## Performance (accueil sur téléphone émulé, 360 px, processeur ralenti ×4, 1,6 Mbit/s)
- Affichage du contenu principal (LCP) : **~1,6 s** (objectif 2,5 s : atteint).
- Décalage visuel (CLS) : **0** (objectif 0,1 : atteint).
- Poids de l'accueil : **532 Ko** (objectif 1,2 Mo : atteint).
- Blocage du navigateur (TBT) : **~1,2 s**, au-dessus de l'objectif de 200 ms : **non atteint**.
- Avant optimisation : chargement ~13 s en réseau très dégradé ; mesure du 2026-11-21 avant GSAP différé : 4,1 à 4,3 s (`docs/reports/phase-14/perf/mesures.md`).
- Cause du TBT : c'est un plancher dû à l'hydratation de React (la FAQ, presque sans animation, est déjà à ~0,66 s). Piste : passer les sections statiques en composants serveur. **À décider** (voir plus bas).
- Le TBT est mesuré sur un ordinateur de développement ralenti ; le vrai résultat sur un petit Android reste à confirmer en ligne.

## Ce qui est reporté ou ouvert
- **Pages par pays : reportées.** Les moyens de paiement par pays ne sont pas vérifiables avant la phase 5 de test réel ; on ne publie pas de contenu non vérifié.
- **`PLACEHOLDER_STATS`** (chiffres d'exemple sur l'accueil, avec pastille « Exemple ») : à remplacer par les vrais chiffres avant la mise en ligne. **Bloquant pour les phases 15 et 16.**
- **Image de partage** `public/og/default.png` (1200×630) : à créer.
- **Logo bleu/jaune** (identité de marque) : à trancher.
- **Magnific** non connecté : les images prévues n'ont pas été générées. Les prompts d'images sont-ils validés ?
- **Volumes de mots-clés** non mesurés (crédits OpenSEO épuisés).
- **Lighthouse officiel non lancé** (outil non installé, à demander). Les mesures ci-dessus viennent de Playwright.
- **`/services` complet** (« dès X XAF », « Autres réseaux », cartes) non vu avec un vrai catalogue : pas de base de test pendant la QA. À revoir en ligne.
- **Blog, confidentialité, conditions** : pages provisoires, en « ne pas indexer ».
- **Logos de paiement inutilisés** (`airtel-money-transparent.png` et fichiers sans « -clean ») : nettoyage à faire **avec ton accord**.
- **Bascule d'indexation (phase 16)** : `NEXT_PUBLIC_SITE_URL`, `SITE_INDEXABLE=true`, puis Search Console, Bing et IndexNow.
- Deux remarques mineures de QA : avertissement de qualité d'image 80 en développement ; pastille « N » de Next visible en développement seulement.

## À tester par le propriétaire (pas à pas)
1. Ouvre `/fr` et `/en` sur ton téléphone : héros, étapes, réseaux, paiements, FAQ, bouton fixe « Créer un compte », menu.
2. Ouvre `/fr/faq`, `/fr/contact`, `/fr/services` : lecture, ouverture des questions, liens.
3. Ouvre une page inexistante (ex. `/fr/nimportequoi`) : la 404 est sombre avec un bouton de retour.
4. Ouvre `/fr/login` : la connexion est en sombre.
5. Regarde les captures dans `docs/reports/phase-14/design/` si tu ne veux pas lancer le site.

## Décisions que toi seul peux prendre
1. Valider ou corriger la phase 14.
2. Performance : accepter ~1,2 s de TBT, ou lancer le passage en composants serveur ?
3. Logo bleu/jaune : garder, changer ?
4. Prompts d'images validés ? Connecter Magnific ?
5. Installer Lighthouse pour une mesure officielle ?
6. Nettoyage des logos de paiement inutilisés : ok ?
7. Fournir les vrais chiffres pour remplacer `PLACEHOLDER_STATS`.

## Pour la phase suivante (🧑)
Vrais chiffres, image de partage, domaine `lyonpanel.com`, textes légaux (avant la phase 16).

## Décision attendue : « validé » ou corrections
