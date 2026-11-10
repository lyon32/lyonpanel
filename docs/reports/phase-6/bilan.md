# Bilan — Phase 6 : Commande
Date : 2026-11-10 · Statut : validée par le propriétaire (2026-11-10)

## Objectif de la phase (ROADMAP.md)
Commander : le solde baisse du bon montant, un double clic = une seule commande, solde insuffisant = message clair. Tout avec le faux fournisseur, sans argent réel.

## Résultat : ce qui marche maintenant
- Le client choisit un service, colle son lien, met une quantité, et voit le prix avant de payer.
  Exemple : 1 000 abonnés à 1 155 XAF. Solde 5 000 XAF, puis 3 845 XAF après la commande.
- Le lien doit être de la bonne plateforme (un service TikTok n'accepte qu'un lien TikTok).
- La quantité doit rester entre le minimum et le maximum du service, sans exception.
- Double clic ou envoi répété : une seule commande, un seul débit.
- Solde insuffisant : « Il vous manque 775 XAF » et un bouton vers la recharge. Rien n'est débité.
- Plafond de 100 000 XAF par client sur 24 heures. C'est un réglage, pas un chiffre figé.
- Commentaires personnalisés : seulement pour les services qui les acceptent.
- Si le fournisseur échoue : la commande passe en « à vérifier », tu es alerté, aucun remboursement ni renvoi automatique. Le client voit « en cours de vérification ».
- Limite de 10 commandes par minute et par client.
- Le client ne voit jamais le coût, la marge ni le nom du fournisseur.
- Nouveau (ta décision du 2026-11-10) : le total est arrondi au multiple de 5 XAF supérieur, minimum 5 XAF.
- Écrans en français et en anglais, sur téléphone et ordinateur.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 6.0 Plan et CLAUDE.md | rapportée | `docs/plans/phase-6.md` |
| 6.1 Tests d'abord | rapportée | `tache-6.1.md` |
| 6.2 Migration (plafond, arrondi) | rapportée | `tache-6.2.md` |
| 6.3 Code serveur | rapportée | `tache-6.3.md` |
| 6.4 Écran de commande | rapportée | `tache-6.4.md` |
| 6.5 Contrôles | rapportée | `tache-6.5.md`, `securite-commande.md`, `qa/rapport-qa.md` |
| 6.6 Rapports, bilan, CHANGELOG | rapportée | ce fichier |

## Chiffres réels
- Tests unitaires : 1 252 sur 1 252 verts.
- Tests de base de données : 473 réussis ou plus, 1 échec connu et sans lien avec la commande. C'est le test `seed.test` « aucun faux client » : il échoue parce que ta base locale contient un vrai compte (`panel@gmail.com`).
- Tests de navigateur (Playwright, `order.spec.ts`) : 6 sur 6 verts.
- Lint : 0 erreur. Types : propres. Build : réussi.
- Couverture : pas 100 % strict. `place-order.ts` : 97,5 % des lignes (les lignes 95 et 225 sont des protections qui ne devraient jamais servir). `submit-to-provider.ts` : pas 100 % strict non plus. La règle « 100 % sur l'argent » n'est donc pas tenue à la lettre.
- `npm audit` : 7 vulnérabilités modérées dans des outils de développement, aucune haute ni critique.
- CI GitHub lue sur la PR 15 : job `ci` réussi (environ 12 minutes), Vercel vert.

## Problèmes rencontrés et solutions
- Contrôle sécurité, 1er passage : 5 failles Basses. Trois corrigées (limite des commentaires, limite de débit du devis, valeur explicite de `PROVIDER_MODE` en production). Deux acceptées pour la phase 6 et reportées (voir plus bas).
- Docker et la CLI Supabase locale 3.1.0 refusent `supabase/config.toml` (section `[inbucket]`). La CI utilise la version 2.75.0. Les tests de base ont donc tourné contre la base locale déjà lancée.
- La QA voit 3 erreurs « 422 » en console par essai. C'est normal : ce sont les refus voulus (quantité, lien, plafond).

## Ce qui a été contrôlé
- Relecture : ACCEPTÉ au 2e passage.
- QA navigateur : ACCEPTÉ au 2e passage (téléphone 360 px et ordinateur, FR et EN, captures dans `qa/`).
- Sécurité : ACCEPTÉ au 2e passage, aucune faille critique, haute ou moyenne. Essais : 10 commandes simultanées pour un solde qui n'en couvre qu'une, une seule passe ; même clé 10 fois, un seul débit.

## Ce qui n'a PAS été fait ou testé
- Rien de bloquant côté CI : elle est lue et verte (voir plus haut).
- Aucun vrai fournisseur, aucun vrai paiement (phase 15).
- Obsidian : le serveur était injoignable pendant la phase ; les notes ont été écrites après sa reconnexion (dossier LyonPanel/Phase 6).
- La carte du code (graphify) a été mise à jour localement, sans lancer d'analyse payante.

## Points ouverts reportés en phase 7
- Rattrapage et alerte des commandes restées « pending » avec `error='submitting'` après un plantage du serveur. L'argent est débité, rien n'est perdu ni envoyé deux fois, mais personne n'est prévenu.
- Rendre la clé `idem_key` unique par client (et non pour toute la base) : sans risque d'argent aujourd'hui.
- Donner un nom dédié au secret de la route de test `fail-next`.
- Alerte solde fournisseur à 5 $ : l'alerte existe dans la commande ; l'affichage côté espace client vient en phase 8.
- Phase 15 : interdire `PROVIDER_MODE=mock` quand `SASPAY_MODE=live`.

## À tester par le propriétaire (pas à pas)
1. Lancer le site en local avec le faux fournisseur et te connecter. Recharge d'abord 5 000 XAF si besoin.
2. Ouvrir `http://localhost:3000/fr/commander`. Choisir un service d'abonnés, coller un lien de la bonne plateforme, mettre la quantité 1 000. Le prix s'affiche.
3. Commander. Le solde baisse du montant affiché (exemple : 5 000 devient 3 845).
4. Double-cliquer vite sur « Commander » : une seule commande apparaît.
5. Mettre une quantité trop grande ou trop petite : un message clair apparaît.
6. Coller un lien d'une autre plateforme : il est refusé.
7. Essayer de commander pour plus que ton solde : « Il vous manque X XAF » avec le bouton de recharge.
8. Même chose en anglais : `http://localhost:3000/en/order`.

## Ce que le propriétaire doit préparer pour la phase suivante (🧑 de ROADMAP.md)
- Phase 7 : créer le bot Telegram avec @BotFather, récupérer le jeton et le `chat_id` (`ENV_SETUP.md §4`).

## Décision attendue : « validé » ou corrections
Validé par le propriétaire le 2026-11-10 (message « valide » dans la session).
