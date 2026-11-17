# Bilan — Phase 11 : Admin (1) : accès, stats, clients
Date : 2026-11-16 · Statut : faite – en attente de validation du propriétaire · Branche `feat/phase-11-admin-1` (dernier commit 1786e64 ; rien de commité dans ce lot de rapports)

## Objectif de la phase (ROADMAP.md)
Adresse secrète `ADMIN_PATH`, code à 6 chiffres sur 2 appareils, `/admin` = 404, `noindex`. Tableau de bord : ventes, bénéfice, solde fournisseur, pays. Clients : recherche, fiche, blocage, remise perso, plafond, notes privées. Terminé quand : tu entres dans l'admin avec ton code, tu vois tes chiffres et tu bloques un client de test.

## Décisions du propriétaire (2026-11-16)
- **Accès** : adresse secrète, `/admin` et toute autre adresse = 404, `noindex, nofollow`, hors `robots.txt` et sitemap, mot de passe + code à 6 chiffres sur **2 appareils**, session de 12 h.
- **Tableau de bord** : vues aujourd'hui, 7 jours, 30 jours (pas de dates libres), « aujourd'hui » à l'heure UTC+1. Alerte du solde fournisseur à 5 $.
- **Clients** : recherche, fiche, blocage avec motif, remise perso, plafond journalier, notes privées. **Pas d'ajustement de solde ni de remboursement** (phase 12).
- **Reportés des phases 9 et 10, tous retenus** : `referral_pct` borné de 0 à 100 ; annulation d'un bonus de parrainage ; signal « même IP » ; défaut D des captures ; une alerte Telegram par message ; purge des fichiers orphelins (manuelle, confirmée).
- **Dette remboursée d'abord** : si un bonus annulé laisse un parrain en dette (ex. -500 XAF), il ne peut plus commander ; sa prochaine recharge rembourse d'abord la dette, le reste arrive sur son solde.
- **Limite de 3 messages** par ticket sans réponse du propriétaire (le message d'ouverture compte pour 1).
- **Plafond de 1 000 ms** : une connexion échouée prend au moins 1 seconde, pour qu'on ne puisse pas deviner quels comptes existent grâce au temps de réponse.
- **Signal même IP** : empreinte de l'IP à l'inscription seulement (jamais l'IP elle-même). « Même téléphone » abandonné (le téléphone est déjà unique). C'est un indice, pas une preuve, et il ne bloque rien.
- **Documents d'API corrigés** (`API_SPEC.md`, `openapi.yaml`) : plage de stats `today / 7d / 30d`, connexion admin, enrôlement des appareils, `debt_xaf`, code `ALREADY_CANCELLED`.

## Résultat : ce qui marche maintenant
- Adresse secrète : seule l'adresse exacte de `ADMIN_PATH` ouvre la page de connexion. `/admin`, `/fr/admin`, toute autre adresse, et toutes les pages et routes admin sans session admin : 404. En-tête et balise `noindex, nofollow`. Rien dans `robots.txt`, le sitemap ni les fichiers envoyés au navigateur.
- Connexion en deux temps : mot de passe + widget anti-robot, puis code à 6 chiffres. Enrôlement guidé des 2 appareils (QR + clé de secours), pas de 3e appareil. Mauvais code ou mauvais mot de passe : message neutre. 5 mauvais codes en 15 minutes : verrou de 15 minutes. 5 échecs de connexion : une alerte Telegram, sans aucune donnée.
- Tableau de bord : ventes, bénéfice, commandes, recharges, nouveaux clients, répartition par pays, solde fournisseur en dollars avec bannière rouge sous 5 $.
- Clients : recherche (email, téléphone, code de parrainage), liste paginée, fiche complète (solde, dette, commandes, notes, filleuls masqués), blocage avec motif obligatoire, déblocage, remise perso (0 à 50 %), plafond journalier, notes privées.
- Un client bloqué voit « Ce compte est bloqué. Contactez le support. » et ne peut plus commander. Un client en dette ne peut plus commander ; sa recharge rembourse d'abord la dette (message visible sur l'écran de recharge).
- Annulation d'un bonus de parrainage depuis la fiche (motif + case de confirmation), une seule fois même avec plusieurs clics simultanés. Le solde peut alors passer sous zéro, et seulement dans ce cas.
- Tickets : 3 messages d'affilée maximum, une alerte Telegram par message accepté (sans le texte). Chemin des captures vérifié strictement en base (défaut D).
- Fichiers orphelins : liste d'abord, purge seulement avec case cochée, fichiers de plus de 60 minutes et non rattachés, trace dans le journal d'audit avec les chemins supprimés.
- Écrans mis en forme mobile d'abord (360 px), FR et EN, sans défilement horizontal, cibles de 44 px.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 11.0 Plan, décisions, documents | rapportée | `2026-11-16-tache-11.0.md` |
| 11.1 Tests d'abord | rapportée | `2026-11-16-tache-11.1.md` |
| 11.2 Migration | rapportée | `2026-11-16-tache-11.2.md` |
| 11.3 Serveur (A accès, B connexion admin, C tickets) | rapportée | `2026-11-16-tache-11.3A.md`, `11.3B.md`, `11.3C.md` |
| 11.4 Écrans admin | rapportée | `2026-11-16-tache-11.4.md` |
| 11.5 Contrôles | rapportée | `11.5-relecture.md`, `11.5-qa.md`, `11.5-design.md`, `11.5-seo.md`, `securite-admin.md`, captures `qa/` et `design/` |
| 11.6 Rapports, bilan, suivi | rapportée | `2026-11-16-tache-11.6.md`, ce fichier |
| Correctifs tests | rapportée | `11.1b`, `11.1c`, `11.1d`, `11.1e`, `11.1f` |
| Correctifs base | rapportée | `11.2b` (solde négatif), `11.2c` (dette et recharge) |
| Correctifs code | rapportée | `11.3b`, `11.3c-correctifs`, `11.3d`, `11.3e` |
| Correctif design | rapportée | `11.5b-design` |

## Chiffres réels
Dernier passage lu dans les comptes-rendus :
- Build de production : OK. Types : aucune erreur. Lint : 0 erreur, 13 avertissements anciens (fichiers trop longs, hors phase). Prettier : OK.
- Tests unitaires : 1 670 sur 1 670 verts (phase 10 : 1 545, soit 125 de plus).
- Tests de base : 1 014 sur 1 014 verts (54 fichiers).
- Premier lot de tests écrits en 11.1 : environ 283 (unitaires, base, navigateur), tous rouges au départ pour la bonne raison, puis complétés par les tests des correctifs.
- Tests navigateur Playwright de l'accès (404, noindex, adresse absente de robots et sitemap) : 17 écrits ; le parcours complet avec compte admin et code a été fait à la main par lp-qa, pas automatisé.
- CI GitHub : **pas encore lue** (la PR n'est pas ouverte dans ce lot). Couverture : **non relancée**. Durée de la CI : non lue.
- Mesures de lp-qa (build de production, téléphone 360 px lent) : connexion admin environ 2,5 à 3 s ; stats, liste, fiche, stockage environ 0,5 à 1,3 s ; 0 erreur console inattendue, 0 réponse 5xx, 0 débordement horizontal, 0 cible tactile sous 44 px.
- `npm audit` (lp-security) : 0 haute ou critique, 7 moyennes dans des outils de développement ; aucune dépendance ajoutée.

## Problèmes rencontrés et solutions
- **Faille du solde négatif (CHECK à NULL)** : la première règle du solde laissait passer un solde négatif tant qu'un réglage n'avait pas été posé (en SQL, « faux OU inconnu » est accepté). Cela rouvrait la porte « modifier un solde avec un simple update ». Corrigé par une nouvelle migration (`120000`) avec une valeur par défaut explicite.
- **Faille dette × recharge (gravité Haute, trouvée par lp-security)** : un client en dette qui rechargeait moins que sa dette (ou le filleul d'un parrain en dette) payait, mais son crédit échouait. C'est le pire échec du projet. Corrigé (migration `130000`) : le solde ne peut descendre sous zéro que par l'annulation d'un bonus ; toute hausse est acceptée. Preuves rejouées par lp-security : crédit -1 000 + 500 = -500, rejeu sans double crédit, filleul crédité, bonus du parrain de -1 000 à -950.
- **Bug du filtre du proxy** : une barre oblique perdue dans l'expression du `matcher` faisait que le proxy (langue + adresse secrète) ne tournait plus que sur `/`, donc la page de connexion admin répondait 404. Corrigé, avec un test de régression.
- **Énumération par le temps de réponse** : un compte existant répondait environ 100 ms plus lentement qu'un inconnu. Plancher de durée ajouté (300 ms, puis relevé à 1 000 ms sur la recommandation de lp-security). Les tests devenus lents ont été adaptés.
- **Sentry et `ADMIN_PATH`** : une erreur sur une page admin aurait envoyé l'adresse secrète à Sentry. Elle est remplacée par `[admin]` partout (adresse, transaction, fil d'Ariane, spans).
- **Enrôlement du 1er appareil** : avec le mot de passe seul, on pouvait enregistrer le premier appareil. Variable `ADMIN_ENROLL_OPEN` (fermée = 404), limiteur, et consigne : enrôler les 2 appareils avant d'utiliser l'adresse.
- **Pas de limite sur les essais de code** : verrou ajouté (5 échecs en 15 min, puis 429 sans appeler Supabase). Message dédié sur l'écran quand le verrou est actif (jusque-là, le bon code semblait faux).
- **Alertes Telegram provocables** : le compteur ne compte plus les tentatives refusées par le limiteur et envoie une seule alerte au 5e échec par fenêtre.
- **Recherche** : le caractère `_` n'était pas échappé (un antislash perdu en JavaScript). Corrigé.
- **Statuts de commande en anglais** dans la fiche FR : traduits FR et EN.
- **Fiche client sur téléphone** : le tableau des commandes cachait le statut ; remplacé par des cartes empilées.
- **Fiche inconnue** : renvoyait un 200 au lieu d'un 404 (squelette de chargement) ; vrai 404 maintenant, squelettes gardés sur les autres écrans.
- **Divers** : le dossier `src/app/[adminPath]` du LLD était impossible avec Next (deux segments dynamiques à la racine) ; remplacé par `src/app/gestion/[adminPath]` et une réécriture dans le proxy (LLD corrigé). Un tableau des pays sans séparateur de milliers, le bandeau « Enregistré. » qui restait, la bulle du navigateur pour la remise : corrigés.

## Contrôles
- **lp-reviewer** : 1re relecture À CORRIGER (4 points importants : statuts, alertes provocables, enrôlement, tests de base non exécutables) ; 2e relecture À CORRIGER (2 points : `debt_xaf` non documenté dans l'API, trois fichiers de tests à reformater). Les deux points ont été traités dans le commit 4f62321. **Aucune 3e relecture par l'agent** : ces deux points ont été vérifiés par Prettier, lint, types et tests.
- **lp-security** : 1er audit À CORRIGER (1 Haute, 4 Moyennes, 5 Basses) ; nouvel audit **ACCEPTÉ**. Failles closes : 1, 2, 3, 5, 6, 7, 8, 10. Faille 4 (temps de réponse) : réserve Basse (plancher de 300 ms insuffisant ; relevé à 1 000 ms ensuite, **non re-mesuré par lp-security**). Faille 9 : acceptée (voir « reportés »). Aucun secret trouvé.
- **lp-qa** : 1re QA À CORRIGER (2 importants : statuts et tableau mobile ; 5 mineurs). QA ciblée après correctifs : À CORRIGER avec 1 point important mais petit (message du verrou du code) et 2 mineurs (bandeau, milliers par pays). Ces trois points ont été corrigés (tâche 11.3e, commit 1786e64) **sans nouveau passage visuel de lp-qa**.
- **lp-seo** : TERMINÉ, aucune correction (noindex en balise et en-tête, rien dans robots, sitemap ni fichiers du navigateur, titre neutre).
- **lp-designer** : mise en forme (11.5-design) puis fiche en cartes sur mobile et squelettes (11.5b).

## Ce qui n'a PAS été vérifié
- **Les trois derniers petits correctifs** (message du verrou du code, bandeau « Enregistré. », milliers par pays, commit 1786e64) : vérifiés par les tests seulement ; la QA visuelle n'a pas été refaite.
- **`error.tsx`** (page d'erreur de l'admin) : jamais provoquée dans le navigateur.
- **`ADMIN_ENROLL_OPEN=false` en réel** : relu dans le code et couvert par les tests unitaires, mais pas rejoué sur un serveur démarré avec la variable.
- **Vrai envoi Telegram** : les messages ont été interceptés (préfixe `[TEST]` vérifié), aucun vrai envoi.
- **Vraie vérification Turnstile en production** : seules les clés de test ont servi.
- **Rejeu complet des migrations** : `db reset` a bien rejoué toutes les migrations jusqu'à `120000` (tâche 11.2b) ; **la migration `130000` a été appliquée sans reset**, donc le rejeu depuis zéro avec elle n'est pas prouvé.
- **CI GitHub** : à lire sur la PR. Couverture : non relancée. Carte graphify : non relancée.
- **Contraste et focus clavier** : relus à l'œil, pas par script. Bannière de solde bas, purge avec de vrais fichiers sur plusieurs pages : vus avec des données de test locales seulement.
- **Parcours automatique** « mot de passe, 2 appareils, code, tableau de bord » : fait à la main par lp-qa, pas de test Playwright automatique.

## Points reportés ou à décider
- **Faille 9 (Basse)** : sur les routes admin, la vérification de l'origine passe avant la garde ; un visiteur peut donc deviner qu'une route admin existe. Les chemins d'API ne sont pas secrets, l'adresse des pages reste protégée. Reporté en phase 12.
- **Audit et modification en deux écritures** : pour la fiche client, si l'écriture du journal échoue, le changement reste sans trace. À fusionner en une seule fonction SQL en phase 12 (journal d'audit complet).
- **« Réservations »** : reportées en phase 12.
- **Un seul admin** : l'administrateur est unique, mais aucune contrainte en base ne l'impose ; reporté.
- **Migrations `20261116110000`, `20261116120000`, `20261116130000`** : appliquées en **local seulement**. À appliquer en production en phase 15, avec celles des phases 9 et 10.
- **Documents validés modifiés, à valider par toi** : `ENV_SETUP.md` (adresse secrète, `ADMIN_ENROLL_OPEN`, consigne des 2 appareils, sortie de secours), `LLD.md` (`src/app/gestion/[adminPath]`), `API_SPEC.md` et `openapi.yaml` (stats, connexion admin, enrôlement, `debt_xaf`, `ALREADY_CANCELLED`), `DATA_MODEL.md` (solde négatif dans un seul cas, nouvelles colonnes, déclencheur, contraintes), `TESTING.md` (redémarrage de la base de test avec la clé de test anti-robot). `supabase/config.toml` : session de 12 h, TOTP activé, clé obsolète `[inbucket]` remplacée.
- **Notes de sécurité** (hors phase) : à la mise en ligne, vérifier que l'origine n'accepte que Cloudflare (l'adresse IP est lue dans un en-tête) ; `src/components/ui/chart.tsx` utilise `dangerouslySetInnerHTML` (phase 8, valeurs en dur) : à garder en tête.
- **Sortie de secours** si l'admin est verrouillé : attendre 15 minutes, ou script local avec la clé `service_role` (documenté dans `ENV_SETUP.md`).

## À tester par le propriétaire (pas à pas)
1. Lance le site en local (faux fournisseur, faux SasPay). Vérifie que ton compte administrateur local existe et que `ADMIN_PATH` est rempli dans `.env.local` (8 caractères minimum). Pendant les contrôles, le mot de passe et les appareils du compte admin local ont été remplacés : il faudra peut-être les refaire (voir `ENV_SETUP.md`).
2. Ouvre `http://localhost:3000/admin` : tu dois voir une page « introuvable ». Même chose pour `/fr/admin` et pour une adresse au hasard.
3. Ouvre l'adresse secrète (`http://localhost:3000/` suivie de ta valeur de `ADMIN_PATH`) : la page de connexion s'affiche.
4. Connecte-toi avec ton email et ton mot de passe. Le site te demande d'enregistrer un premier appareil : scanne le QR avec ton appli d'authentification, entre le code. Fais pareil pour un 2e appareil (téléphone puis gestionnaire de mots de passe, par exemple). Un 3e appareil n'est pas proposé.
5. Déconnecte-toi, puis reconnecte-toi : mot de passe, puis **ton code à 6 chiffres**. Tu arrives sur le tableau de bord.
6. Regarde tes chiffres : change entre Aujourd'hui, 7 jours et 30 jours. Ventes, bénéfice, commandes, recharges, nouveaux clients, pays, solde fournisseur (« inconnu » en local avec le faux fournisseur).
7. Ouvre « Clients ». Cherche un client de test par morceau d'email ou par téléphone.
8. Ouvre sa fiche. Bloque-le avec un motif (le bouton reste inactif sans motif). Connecte-toi avec ce client dans une fenêtre privée et essaie de commander : le message dit que le compte est bloqué, rien n'est débité. Débloque-le.
9. Sur la fiche, mets une remise de 10 % et un plafond journalier, ajoute une note privée. Essaie 51 % : refusé avec un message du site.
10. Prends un parrain de test qui a reçu un bonus. Sur sa fiche, annule le bonus (motif + case à cocher). Si le parrain avait déjà dépensé son bonus, son solde devient négatif (ex. -500 XAF) et la fiche affiche la dette.
11. Connecte-toi avec ce parrain : il voit son solde négatif, ne peut pas commander, et la page de recharge dit que sa recharge remboursera d'abord sa dette. Fais-lui recharger 500 XAF (faux SasPay) : le solde remonte de 500 XAF, sans paiement perdu. Recharge plus que la dette : le reste arrive sur son solde.
12. Ouvre « Stockage » : la liste des fichiers orphelins s'affiche sans rien supprimer. La purge exige la case cochée.
13. Saisis 5 mauvais codes à 6 chiffres : au 6e essai, même le bon code est refusé, avec un message qui dit d'attendre 15 minutes.
14. Réduis la fenêtre à 360 px : pas de défilement horizontal, le statut des commandes est visible sur la fiche.
15. Regarde les captures : `docs/reports/phase-11/qa/` et `docs/reports/phase-11/design/`.

## Ce que le propriétaire doit préparer pour la phase suivante
- Rien d'obligatoire. Ton appli d'authentification est déjà utilisée.
- Phase 12 (Admin 2 : commandes, services, réglages) : à ouvrir en **nouvelle session**, avec la discussion habituelle avant de créer le plan.
- À garder pour la phase 15 : appliquer en production les migrations des phases 9, 10 et 11, et enregistrer tes 2 appareils **avant** d'utiliser l'adresse secrète en ligne.

## Décision attendue
« validé » ou corrections. La phase n'est pas validée tant que tu ne l'as pas écrit. Fusion de la PR seulement après ton « validé » et la lecture de la CI.
