VERDICT : ACCEPTÉ
Tâche : 5.4 — QA navigateur, recharge SasPay (mode test) — passe finale (après commit 7be10e5)
Environnement : local, faux SasPay (SASPAY_MODE=test, clé vide), PROVIDER_MODE=mock, Turnstile de test, Chromium Playwright, téléphone 360x740 (UA Android) et ordinateur 1366x768 (passe 1).

Résultats de la passe finale
1. npm run test:db : 372 / 373 au premier passage. Un échec isolé (payments-webhook, « Phone number already registered », collision de numéro aléatoire dans la fabrique de test, pas un défaut de recharge). Le fichier relancé seul : 39 / 39 verts. Fiabilité de la fabrique tests/factories/user.ts à surveiller (Mineur, lp-tester).
2. next dev + `npx playwright test tests/e2e/add-funds.spec.ts --workers=1` : 10 passés / 10 (1,9 min).
3. Vérification à la main, téléphone 360 px, FR et EN :
   - 499 : « Le montant minimum est de 500 XAF » / « The minimum amount is 500 XAF » : OK
   - 500 001 : « Le montant maximum est de 500 000 XAF » / « The maximum amount is 500,000 XAF » : OK
   - Champ vide + Payer : « Entrez un montant… » / « Enter an amount… » : OK
   - « Calcul du total… » absent sur erreur : OK. Débordement horizontal : non. Console : 0 erreur, 0 avertissement. Requêtes 4xx/5xx : 0 (plus de 422).
4. npm run build : réussi. next start (port 3101) : 8 tours de rechargement x 3 pages (/fr/recharger, /en/add-funds, /fr/tableau-de-bord), connecté, téléphone : 0 erreur et 0 avertissement en console, aucun avertissement d'hydratation, 0 requête en échec.

Statut des problèmes de la passe 1
1. Erreur 422 en console : CORRIGÉ.
2. Message maximum vague : CORRIGÉ.
3. Champ vide sans message : CORRIGÉ.
4. « Calcul du total… » figé : CORRIGÉ.
5. Avertissement d'hydratation : non reproduit en production après 24 rechargements (dev uniquement, clos).
6-7. Informations inchangées (redirection vers checkout.saspay.invalid en mode test, normale ; contrôle réel en phase 15).

Parcours de la passe 1 (inchangés, couverts aussi par Playwright) : page protégée -> connexion, devis 3 000 -> frais 90 / total 3 090, double clic = 1 seul paiement, webhook signé x3 = 3 000 XAF crédités une fois, signature fausse 403, échec/annulation sans débit, textes EN complets, identifiant inconnu -> page introuvable : OK.

Mesures : erreurs console 0, requêtes en échec 0, débordement non, cibles < 44 px 0 (passe 1), images sans alt 0, champs sans libellé 0.

Problèmes ouverts : aucun Bloquant ni Important. Mineur : collision rare de numéro de téléphone dans la fabrique de test (voir 1).

Captures : docs/reports/phase-5/qa/ (phone-*, desktop-* de la passe 1 ; final-phone-{fr,en}-{499,500001,vide}.png pour la passe finale)
Serveurs lancés par moi : tous arrêtés.
