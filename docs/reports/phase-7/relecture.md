# Relecture 7.5 — Phase 7 (suivi des commandes et alertes)

Verdict : ACCEPTÉ

## Vérifications relancées
- lint : 0 erreur, 8 avertissements (anciens fichiers trop longs, dont types.ts généré ; aucun nouveau fichier de la phase concerné)
- typecheck : vert
- tests unitaires : 1312 sur 1313 verts. Un test (orders-rate-limit) a échoué une fois sous forte charge (94 fichiers en parallèle) ; relancé seul : 4/4 verts. Probablement un délai dépassé, à surveiller (voir suggestions).
- test:db (base 55321, clés locales, sans réinitialisation) : 23 fichiers, 493/493 verts
- build : vert

## Points vérifiés
- Pas de remboursement : aucune écriture de solde dans sync/recover/flag ; partiel, annulé, inconnu -> to_review.
- Jamais de 2e provider.add : recoverStuckOrders ne fait que passer en to_review.
- Une alerte par commande : update atomique avec alerted_at is null.
- Préfixe [TEST] hors production ; notifyOwner ne lève jamais et ne logue pas le jeton.
- TEST_ROUTE_SECRET : garde commune, 404 hors mock/production, 403 sinon, comparaison à temps constant ; .env.example et env.ts à jour.
- Migration : idem_key unique par (user_id, idem_key), colonne alerted_at ; petite et conforme au plan.
- Aucun secret, aucun nom de fournisseur côté client ; le client voit « En cours de vérification » (error jamais exposé).
- Textes FR et EN présents ; états vide, en cours, vérification gérés ; pas de any, ts-ignore, console.log.
- Polling 30 s, onglet visible, arrêt à l'état final ; le useEffect ne charge aucune donnée (il demande seulement un refresh serveur).

## Problèmes bloquants ou importants
Aucun.

## Suggestions (facultatives)
1. src/app/api/cron/orders/route.ts:6 — le commentaire dit « toutes les 5 min », le plan dit 10 min. Aligner. (lp-coder)
2. tests/unit/orders/orders-rate-limit.test.ts — test lent sous charge, ajouter un délai plus large pour éviter un échec aléatoire en CI. (lp-tester)
3. src/components/order/orders-list.tsx:21 — « partial » et « canceled » ne sont pas dans FINAL, donc le polling continuerait pour eux ; ces statuts n'arrivent pas côté client (le cron les convertit en to_review), sans effet réel. (lp-designer)

---

# Relecture 7.5, 2e passage (3 correctifs)

Verdict : ACCEPTÉ

## Vérifications relancées
- lint : 0 erreur, 8 avertissements (déjà connus)
- typecheck : vert
- tests unitaires : 94 fichiers, 1313/1313 verts (cette fois le test orders-rate-limit est passé, même en parallèle)
- test:db (base 55321, sans réinitialisation, pubeka non touché) : 23 fichiers, 493/493 verts
- build : vert

## Les 3 correctifs
1. Faux fournisseur : le compteur part de l'heure (secondes). Seul mock-provider.ts est concerné ; provider-client.ts (le vrai client) n'est pas modifié. Pas de régression.
2. Cron : le commentaire dit maintenant « toutes les 10 min ».
3. Polling : « partial » et « canceled » sont dans les états finaux de orders-list.tsx, donc le polling s'arrête pour eux.

Aucun problème bloquant ni important.
