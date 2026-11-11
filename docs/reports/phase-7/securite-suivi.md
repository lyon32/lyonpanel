VERDICT : ACCEPTÉ
Tâche : 7.5 — Sécurité du suivi des commandes

Surface : GET /api/cron/orders, routes de test fail-next et force-status, recover-stuck-orders, sync-order-statuses, flag-for-review, notifyOwner, migration order_tracking, droits sur orders.

Résultats (lecture du code + test cron relancé : 4/4 verts)
- Cron : exige "Bearer CRON_SECRET", comparaison à temps constant (empreintes SHA-256). Sans secret configuré : tout est refusé (401). OK
- Cron rejouable : les mises à jour sont gardées par le statut et par alerted_at is null. Un double passage ne fait rien de plus. Aucune écriture de solde. OK
- recover-stuck-orders : aucun appel à provider.add. Il passe en to_review et alerte. OK
- sync-order-statuses : lit seulement le statut chez le fournisseur. Partial, Canceled ou inconnu vont en to_review, sans remboursement. Une seule alerte (alerted_at). OK
- Routes de test : 404 si PROVIDER_MODE n'est pas mock ou si production ; 403 sans le bon TEST_ROUTE_SECRET (temps constant, refus si le secret n'est pas défini). OK
- notifyOwner : le jeton n'est que dans l'URL, jamais dans le texte. L'erreur est avalée, rien n'est journalisé. Le texte contient seulement id, numéro court, service, montant, raison. Pas d'email ni de lien client. OK
- Migration unique(user_id, idem_key) : place_order cherche par (idem_key ET user_id) et n'utilise aucun "on conflict (idem_key)". Un client ne peut ni rejouer ni voler la commande d'un autre. OK
- Droits : le client n'a le droit de lire que des colonnes listées (migration column_privileges). alerted_at, error, cost_usd, provider_order_id ne sont pas lisibles, ni par l'API ni en direct avec la clé publique. OK
- Fuite : la liste des commandes ne charge que les colonnes publiques, aucun nom de fournisseur ni message brut côté client. OK
- Secrets : aucun motif (sk_live, service_role, Bearer long, hexadécimal long) dans les fichiers nouveaux. .env.example contient TEST_ROUTE_SECRET vide. OK
- npm audit (niveau haut) : 0 haute, 7 moyennes seulement. OK

Limites : pas de psql sur la machine, donc je n'ai pas interrogé la base locale (55321) ; les droits ont été vérifiés dans les migrations. Rien n'a été modifié ni réinitialisé.

Failles
1. [Basse] src/app/api/cron/orders/route.ts — pas de limite de fréquence ; sans CRON_SECRET valide, aucune action possible, donc risque faible. Aucune correction exigée.
2. [Basse] guard.ts — en préversion Vercel (VERCEL_ENV=preview) avec PROVIDER_MODE=mock, les routes de test restent accessibles avec le secret. Garder TEST_ROUTE_SECRET vide ou fort hors local.
Aucune faille Critique, Haute ou Moyenne.
