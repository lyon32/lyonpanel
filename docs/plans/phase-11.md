# Plan — Phase 11 : Admin (1) — accès, stats, clients

Branche : `feat/phase-11-admin-1` (depuis `main`, a093598). Statut : **plan écrit, rien de codé (2026-11-16)**.

## Objectif (ROADMAP.md)
`ADMIN_PATH` secret, code à 6 chiffres sur 2 appareils (secours), `/admin` = 404, `noindex`. Tableau de bord : ventes, bénéfice, solde JAP, pays. Clients : recherche, fiche, blocage, remise perso, plafond journalier, notes privées.
**Terminé quand** : le propriétaire entre dans l'admin avec son code, voit ses chiffres et bloque un client de test.

## Décisions du propriétaire (2026-11-16)
1. **Accès** : comme prévu dans `SECURITY_NOTES.md` : adresse secrète `ADMIN_PATH`, `/admin` et toute autre adresse = 404, `noindex, nofollow`, hors sitemap et `robots.txt`, mot de passe + code à 6 chiffres (`aal2`). **2 appareils TOTP** enregistrés (téléphone + gestionnaire de mots de passe). Session admin 12 h. Appli d'authentification déjà installée.
2. **Tableau de bord** : vues **aujourd'hui / 7 jours / 30 jours** (pas de dates libres). Ventes, bénéfice, nb de commandes, recharges, nouveaux clients, répartition par pays, solde JAP avec alerte à 5 $.
3. **Clients** : recherche, fiche, blocage avec motif, remise perso, plafond journalier, notes privées. **Pas d'ajustement de solde ni de remboursement** (phase 12, avec journal d'audit).
4. **Reportés des phases 9-10, tous retenus** : (a) `referral_pct` borné 0 à 100 en base ; (b) annulation d'un bonus de parrainage depuis la fiche client, avec trace ; (c) signal « même téléphone / même IP » entre parrain et filleul, sans blocage automatique ; (d) défaut D mineur des captures de tickets ; (e) une alerte Telegram par message client ; (f) purge des fichiers orphelins de tickets.
5. **Documents** : `ROADMAP.md`, `CLAUDE.md`, `docs/reports/TABLEAU-DE-BORD.md` corrigés (phase 10 validée, PR 22).

## Points de vigilance (à trancher à l'exécution, avec accord si besoin)
- **Purge (f)** : suppression définitive. Action manuelle, avec liste des fichiers affichée et confirmation avant chaque purge ; jamais automatique ; `lp-security` la vérifie.
- **Alerte Telegram (e)** : risque de bruit. Prévoir un regroupement ou une limite de fréquence par ticket et le préfixe `[TEST]` hors production. Décision du propriétaire : **un client ne peut pas envoyer plus de 3 messages d'affilée sans réponse du propriétaire** ; quand le propriétaire répond, le client peut de nouveau écrire. Une alerte par message (donc 3 au maximum d'affilée). Purge manuelle confirmée et migrations annoncées avant : accord du propriétaire.
- **Annulation d'un bonus (b)** : passe par une fonction SQL d'argent (pas de `update` direct du solde). Décision du propriétaire : si le parrain a déjà dépensé le bonus, on retire quand même le montant et **son solde peut passer négatif** (ex. -500 XAF) ; il ne peut plus commander tant qu'il n'a pas rechargé. Le test et la fonction SQL doivent autoriser ce cas, et la fiche client affiche la dette.
- **Signal 2e compte (c)** : n'enregistrer que ce qui existe déjà ou est nécessaire ; pas de blocage seul ; vérifier la confidentialité de l'IP (`SECURITY_NOTES.md`).
- **Schéma** : toute migration est annoncée avant (blocage, plafond, remise perso, notes, bonus annulé, borne `referral_pct`) ; vérifier d'abord ce qui existe déjà dans `DATA_MODEL.md`.
- Un seul admin (`is_admin`), routes `/api/v1/admin/*` renvoient **404** (pas 403) aux non-admins. Aucun champ fournisseur hors `/admin`.

## Décisions complémentaires après les tests (2026-11-16)
- **Solde négatif** : seule `cancel_referral_bonus` peut descendre sous 0 ; commandes, retraits et ajustements restent interdits. Les deux contraintes `>= 0` sont assouplies pour ce seul cas ; le test `tests/db/schema.test.ts:156` est adapté en conséquence (accord du propriétaire).
- **Signal 2e compte** : « même IP à l'inscription » seulement (empreinte HMAC `profiles.signup_ip_hash`, jamais l'IP). « Même téléphone » abandonné (`profiles.phone` est unique). Indice, pas preuve.
- **Limite 3 messages** : par ticket, le message d'ouverture compte pour 1.
- **Stats** : `?range=today|7d|30d`, « aujourd'hui » en UTC+1. `API_SPEC.md` §8 et `openapi.yaml` corrigés (accord du propriétaire).
- Mon choix : mauvais code à 6 chiffres = 401 `MFA_REQUIRED` ; événement Telegram `admin_login_failed` après 5 échecs ; l'enrôlement des 2 appareils passe par l'API MFA de Supabase.

## Hors périmètre
Ajustement de solde, remboursements, commandes `to_review`, services, réglages, réponse aux tickets, journal d'audit complet (phase 12) ; mise en ligne (13) ; pages publiques (14) ; vrais paiements (15).

## Tâches (ordre de TEAM.md)
| # | Tâche | Agent | Statut |
|---|---|---|---|
| 11.0 | Plan, décisions, documents, CLAUDE.md | chef de projet | faite |
| 11.1 | Tests d'abord : accès (404, aal2, 2 appareils), stats, clients, bonus annulé, borne `referral_pct`, purge, alerte (unit, base, e2e) | lp-tester | à faire |
| 11.2 | Migration (annoncée avant) : colonnes client, notes, borne `referral_pct`, fonction d'annulation de bonus | lp-db | à faire |
| 11.3 | Serveur : garde admin, `/admin/mfa/*`, `/admin/stats`, `/admin/users*`, annulation bonus, purge, alerte Telegram ; défaut D | lp-coder (jusqu'à 3 en parallèle) | à faire |
| 11.4 | Écrans admin : connexion cachée, tableau de bord, liste et fiche client | lp-coder puis lp-designer ∥ lp-seo (`noindex`) | à faire |
| 11.5 | Contrôles : relecture ∥ QA navigateur ∥ sécurité (admin + argent) | lp-reviewer ∥ lp-qa ∥ lp-security | à faire |
| 11.6 | Rapports, bilan, ROADMAP, CHANGELOG, Obsidian | lp-reporter | à faire |

## À faire par le propriétaire (🧑)
Enregistrer ses **2 appareils** de code à 6 chiffres au premier accès à l'admin ; tester le blocage d'un client de test.

Fin de phase : PR vers `main`, CI réelle lue, `lp-security` ACCEPTÉ, rapports à jour, fusion seulement sur « validé » écrit du propriétaire.
