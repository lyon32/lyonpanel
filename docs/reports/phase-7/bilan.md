# Bilan — Phase 7 : Suivi des commandes + alertes
Date : 2026-11-10 · Statut : en attente de validation du propriétaire

## Objectif de la phase (ROADMAP.md)
Une commande passe seule de « en cours » à « terminée ». Quand quelque chose cloche, tu reçois une alerte. Tout avec le faux fournisseur et un faux Telegram : aucun argent réel.

## Résultat : ce qui marche maintenant
- Un « cron » (une tâche automatique qui se déclenche toutes les 10 minutes) interroge le fournisseur pour toutes les commandes « en cours ». Il les traite par lots de 100, avec un seul appel par lot.
  Exemple : 250 commandes en cours = 3 appels (100 + 100 + 50).
- Une commande passe seule de « En cours » à « Terminée ». La page `/fr/commandes` (ou `/en/orders`) se met à jour sans recharger, toutes les 30 secondes, tant que l'onglet est visible. Elle s'arrête quand la commande est finie ou à vérifier. En QA, le changement est apparu en 34 secondes.
- Commande partielle (livrée en partie) ou annulée chez le fournisseur : elle passe en « à vérifier » et tu reçois une seule alerte. **Aucun remboursement automatique.** Le client lit : « Nous vérifions cette commande. Nous revenons vers vous dès que c'est réglé. »
- Commande restée bloquée « en envoi » plus de 5 minutes après un plantage du serveur : elle passe en « à vérifier » et tu reçois une alerte. **Le site ne renvoie jamais la commande au fournisseur** (pas de risque de double commande).
- Une seule alerte par commande, même si le cron repasse 100 fois (colonne `orders.alerted_at`).
- Échec du fournisseur à la commande : alerte Telegram. Hors production, le message commence par `[TEST]`.
- Liste des commandes : cartes blanches, pastilles de couleur (vert terminée, bleu en cours, jaune pâle en attente ou à vérifier), barre de progression avec pourcentage, état vide avec bouton « Commander ». FR et EN, téléphone et ordinateur.
- Le client ne voit jamais le nom du fournisseur ni le message brut d'erreur.
- Une clé de commande (`idem_key`) n'est plus unique pour toute la base, mais **par client**. Un client ne peut ni rejouer ni voler la commande d'un autre.
- Les routes de test ont leur propre secret (`TEST_ROUTE_SECRET`) au lieu de réutiliser celui de SasPay.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 7.0 Plan et CLAUDE.md | rapportée | `docs/plans/phase-7.md` |
| 7.1 Tests d'abord (+ correctif) | rapportée | `tache-7.1.md`, `tache-7.1-correctif.md` |
| 7.2 Migration (`idem_key` par client, `alerted_at`) | rapportée | `tache-7.2.md` |
| 7.3a Faux fournisseur qui avance, routes de test, alertes Telegram | rapportée | `tache-7.3a.md` |
| 7.3b Synchro des statuts, rattrapage, route cron | rapportée | `tache-7.3b.md` |
| 7.3c Ajustement du gestionnaire de routes (`handler`) | rapportée | `tache-7.3c.md` |
| 7.3d Affichage du suivi (badge, barre, polling, liste) | rapportée | `tache-7.3d.md` |
| 7.4 Design de la liste des commandes | rapportée | `tache-7.4.md` |
| 7.5 Contrôles (relecture 2 passages, QA, sécurité) + correctifs | rapportée | `relecture.md`, `securite-suivi.md`, `qa/rapport-qa.md`, `tache-7.5-correctifs.md` |
| 7.6 Rapports, bilan, CHANGELOG | rapportée | ce fichier |

## Chiffres réels
- Tests unitaires : 1 313 sur 1 313 verts (94 fichiers, relecture 2e passage).
  Au 1er passage : 1 312 sur 1 313. Le test `orders-rate-limit` avait échoué une fois sous forte charge ; relancé seul il passait (4 sur 4), et il est passé au 2e passage.
- Tests de base de données : 493 sur 493 verts (23 fichiers, base locale 55321).
- Tests de navigateur (`order-tracking.spec.ts`) : 2 sur 2 verts (1,4 minute).
- Lint : 0 erreur, 8 avertissements déjà connus (fichiers trop longs). Types : propres. Build : réussi.
- `npm audit` : 0 faille haute, 7 modérées (outils de développement).
- QA navigateur : 0 erreur console, 0 requête en échec inattendue, aucun débordement à 360 px, aucune cible tactile sous 44 px.
- Contrôles : relecture ACCEPTÉ (2e passage), QA ACCEPTÉ, sécurité ACCEPTÉ (aucune faille critique, haute ou moyenne).

## Problèmes rencontrés et solutions
- Relecture, 1er passage : 3 suggestions, toutes corrigées (commentaire du cron « 5 min » devenu « 10 min » ; polling arrêté aussi pour partiel et annulé ; compteur du faux fournisseur).
- QA, problème « Important » : le faux fournisseur repartait de 10001 à chaque lancement et réutilisait des numéros déjà en base. La commande restait « en attente d'envoi » alors que l'écran disait « en cours ». Corrigé : le compteur part maintenant de l'heure. Ne peut pas arriver avec le vrai fournisseur.
- Base locale polluée par les tests : des commandes de test restaient « en cours » et faussaient les tests « 250 commandes » et « alerte unique ». Les tests ont été rendus indépendants de ces résidus.
- Incident sur la base locale (données de test seulement) :
  - `lp-qa` a nettoyé avec une requête trop large : **96 commandes de test** non terminées sont passées en « annulée ». Statut seulement, rien de supprimé.
  - `lp-coder` a remis « en cours » un lot de 254 anciennes commandes de test lors d'un essai.
  - **Aucun solde touché**, aucun remboursement, aucune écriture d'argent.
- Le type du `handler` empêchait d'appeler les routes de test avec 2 arguments : corrigé (7.3c), comportement inchangé.
- QA mineur : sur téléphone très lent, le rafraîchissement peut prendre jusqu'à environ 30 secondes de plus. Accepté (polling voulu à 30 s).

## Ce qui n'a PAS été fait ou testé
- **Vrai Telegram non testé** : le bot n'existe pas encore. Les alertes ont été vérifiées avec un faux Telegram seulement. Un vrai message `[TEST]` reste à faire (voir plus bas).
- **CI GitHub à lire sur la PR** : pas encore de PR pour la phase 7, donc la vraie CI n'a pas tourné. La case reste non cochée dans le plan.
- **Couverture non relancée** : le taux de couverture (règle « 100 % sur l'argent ») n'a pas été remesuré pendant cette phase. Aucune fonction d'argent n'a été modifiée.
- Aucun vrai fournisseur, aucun vrai paiement (phase 15).
- Obsidian : voir le compte-rendu de la tâche (état du serveur noté à la fin).
- Carte du code (graphify) : non régénérée dans cette tâche (pas de commande lancée).

## Points reportés
- Deux failles Basses de sécurité acceptées :
  1. La route du cron n'a pas de limite de fréquence. Sans `CRON_SECRET` valide, rien n'est possible : risque faible.
  2. Sur une préversion Vercel avec `PROVIDER_MODE=mock`, les routes de test restent accessibles avec leur secret. Garder `TEST_ROUTE_SECRET` vide ou fort hors local.
- `TEST_ROUTE_SECRET` doit rester vide ou fort hors local (voir ci-dessus).
- Phase 15 : interdire `PROVIDER_MODE=mock` quand `SASPAY_MODE=live`.
- Phase 13 : le Worker Cloudflare réel qui appelle le cron toutes les 10 minutes. Pour l'instant le cron s'appelle à la main ou par test.
- Phase 12 : remboursement, renvoi ou clôture d'une commande « à vérifier » (décision du propriétaire).
- À vérifier avec le vrai catalogue : le nom du service s'affiche « Abonnés TikTok #9747146 ». Il faut s'assurer que ce numéro n'est pas un identifiant du fournisseur montré au client.
- Hors phase 7 : le solde dans l'en-tête affiche « — » (pas de montant) même après recharge, et le bouton « Nouvelle commande » passe sur deux lignes sur ordinateur. À traiter en phase 8 (espace client).

## À tester par le propriétaire (pas à pas)
1. Lance le site en local avec le faux fournisseur (`PROVIDER_MODE=mock`) et renseigne dans `.env.local` un `CRON_SECRET` et un `TEST_ROUTE_SECRET` (valeurs de test de ton choix). Connecte-toi et recharge 5 000 XAF si besoin.
2. Ouvre `http://localhost:3000/fr/commander` et passe une commande (abonnés, quantité 1 000).
3. Ouvre `http://localhost:3000/fr/commandes` : la commande apparaît avec le badge « En cours » et une barre de progression.
4. Déclenche le cron à la main, par exemple 4 fois : `curl -H "Authorization: Bearer <ton CRON_SECRET>" http://localhost:3000/api/cron/orders`.
5. Sans recharger la page, attends jusqu'à 30 secondes : le badge passe à « Terminée ».
6. Cas à vérifier : passe une deuxième commande, force-la en partielle avec la route de test (`POST /api/test/provider/force-status`, en-tête `x-test-secret`), relance le cron : le badge devient « En cours de vérification », avec le message d'attente, et le solde ne bouge pas.
7. Sans connexion, ouvre `http://localhost:3000/fr/commandes` : tu es renvoyé vers la page de connexion.
8. Même chose en anglais : `http://localhost:3000/en/orders`.
9. Appelle le cron sans secret : tu dois recevoir une erreur 401.

## Ce que le propriétaire doit préparer pour la phase suivante (🧑 de ROADMAP.md)
- Créer le bot Telegram avec @BotFather (`ENV_SETUP.md §4`). Récupérer le **jeton** et le **chat_id**.
- Les mettre dans `.env.local` (variables Telegram de `.env.example`). **Jamais** dans le dépôt, **jamais** dans le chat.
- Ensuite, un vrai message `[TEST]` pourra être envoyé pour confirmer que l'alerte arrive bien sur ton téléphone.
- Pour la phase 8 (espace client) : rien d'autre à préparer.

## Décision attendue : « validé » ou corrections
En attente de ta décision. Seul le propriétaire écrit « validé ».
