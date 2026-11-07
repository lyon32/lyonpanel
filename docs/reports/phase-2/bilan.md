# Bilan — Phase 2 : Design system + mise en page
Date : 2026-11-07 · Statut : faite – en attente de validation

## Objectif de la phase (ROADMAP.md)
Un socle visuel et de navigation prêt à recevoir les écrans des phases 3 à 14 : couleurs et polices, composants de base, FR/EN avec adresses traduites, langue et devise mémorisées, en-tête, pied de page, barre latérale, états vide/chargement/erreur, logo, favicon, et une page de démonstration.

## Résultat : ce qui marche maintenant
- Le site s'ouvre en français ou en anglais, avec des adresses traduites. La langue et la devise (XAF, XOF, USD) sont retenues.
- Six composants de base, trois polices, logo et favicon.
- Navigation complète : en-tête (compact avec menu sur téléphone), pied de page, barre latérale sur ordinateur, menu du bas sur téléphone. Les pages pas encore faites affichent « Bientôt disponible ». Une vraie page 404 du site existe.
- Mouvement : léger sur téléphone, plus riche sur ordinateur, rien quand le système demande de réduire les animations, jamais sur un prix ou un solde.
- Page de démonstration `/fr/demo` et `/en/demo`, cachée de Google.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 2.1 Variables, polices, logo | rapportée | [2.1](2026-11-07-tache-2.1.md) |
| 2.2 Langues, adresses, cookies | rapportée | [2.2](2026-11-07-tache-2.2.md) |
| 2.3 Composants de base | rapportée | [2.3](2026-11-07-tache-2.3.md) |
| 2.4 Mise en page | rapportée | [2.4](2026-11-07-tache-2.4.md) |
| 2.5 États vide, chargement, erreur | rapportée | [2.5](2026-11-07-tache-2.5.md) |
| 2.6 Page de démonstration | rapportée | [2.6](2026-11-07-tache-2.6.md) |
| 2.7 Contrôles finaux | rapportée | [2.7](2026-11-07-tache-2.7.md) |
| 2.8 Mouvement | rapportée | [2.8](2026-11-07-tache-2.8.md) |

## Décisions du propriétaire prises pendant la phase
- Trois polices : Public Sans, Atkinson Hyperlegible, IBM Plex Mono (Montserrat seulement dans le logo).
- `class-variance-authority` accordé (nécessaire aux composants shadcn officiels).
- Mouvement : `motion` et GSAP peuvent coexister ; pour chaque animation, on garde ce qui rend le mieux et pèse le moins. GSAP est chargé à la demande.
- Composants copiés de Kokonut UI et d'Aceternity ; pistes D, E et F limitée retenues (A, B, C rejetées).
- Cookie de devise : `lp_currency`.
- Démo supprimée avant la mise en ligne (phase 13). Pas de mode sombre.

## Chiffres réels
- Tests Vitest : **247 verts**. Tests Playwright : **23 verts**, lancés sur le build de production.
- Lint : 0 erreur (avertissements `max-lines` sur les composants copiés, voir plus bas). Types : OK. Build : OK.
- Performance de la démo (build de production, téléphone lent), LCP en médiane : **5,85 s avant, 2,37 s après**.
- Longues tâches et TBT : **non améliorés** (point ouvert).
- Couverture en pourcentage et durée de la CI : non mesurées pour cette phase.

## Contrôles
- `lp-reviewer` : premier verdict **À CORRIGER**, puis corrigé (commit `77a19e7`).
- `lp-qa` : premier verdict **À CORRIGER**, puis corrigé (commit `77a19e7`).
- Corrections : pages d'attente pour toutes les adresses, 404 du site, focus, performance, cookie `lp_currency`.
- Pas d'audit sécurité prévu (pas d'argent, pas de compte).

## Problèmes rencontrés et solutions
- Démo trop lente sur téléphone lent (LCP 5,85 s) : chargement différé, bouton attirant allégé, `Reveal` retiré sur le titre du héros. Résultat 2,37 s.
- Adresses sans page : une page d'attente par adresse, et une 404 du site.

## Ce qui reste ouvert
- Vrais logos des réseaux à fournir (ceux de la démo sont provisoires).
- Avertissements `max-lines` sur les composants copiés : acceptés dans le plan pour garder le code d'origine, **à valider par toi**.
- Hydratation de la démo : à surveiller.
- Longues tâches et TBT non améliorés.
- « Glisser pour confirmer » non testé au lecteur d'écran.
- `Reveal` retiré sur le titre du héros (choix de performance).
- Textes provisoires (à passer par la relecture de rédaction avant la phase 14).
- Un serveur local sur le port 3000 vient d'un autre dossier : à arrêter avant de tester.
- `docs/05 §2` (polices) et `§6` (mouvement) à mettre à jour avec ton accord ; je n'y ai pas touché.
- Le MCP shadcn n'est pas initialisé.
- Aucun test sur un vrai petit Android.
- Au moment de ce rapport, `button.tsx` et `site-header.tsx` ont des changements non commités.
- La CI GitHub n'a pas encore tourné sur la PR.

## À tester par le propriétaire (pas à pas)
1. Sur ton téléphone, ouvre `/fr/demo` puis `/en/demo`. Fais défiler : ça doit être fluide, sans défilement de côté.
2. Ouvre le menu de l'en-tête.
3. Change la langue : tu restes sur la page équivalente.
4. Change la devise, recharge : le choix est gardé.
5. Essaie « glisser pour confirmer ».
6. Descends au pied de page et clique chaque lien (confidentialité, conditions, contact).
7. Ouvre une adresse qui n'existe pas : la 404 du site s'affiche.
8. Ouvre `/fr/orders` ou `/fr/dashboard` : « Bientôt disponible ».
9. Sur ordinateur : bouge la souris sur le bouton et les cartes ; la barre latérale est à gauche dans l'espace client.
10. Active « réduire les animations » dans ton système : plus de mouvement.

## Ce que le propriétaire doit préparer pour la phase suivante (🧑 de ROADMAP.md)
Voir la section Phase 3 de `ROADMAP.md` (non relue ici pour cette tâche). À fournir déjà : les vrais logos des réseaux.

## Décision attendue : « validé » ou corrections
Seul le propriétaire valide. Tant que tu n'as pas écrit « validé », la phase 3 ne démarre pas.
