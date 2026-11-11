# Phase 8 — Espace client

Sources : `ROADMAP.md` (phase 8), `PRD.md` (« Espace client : bonjour et suggestion de commande »), `API_SPEC.md` §6.2 (profil), §6.3 (solde, transactions), §6.5 (commandes), §6.7 (favoris), `DATA_MODEL.md` (`profiles`, `favorites`, `anonymize_user`), `docs/05-design-system.md` §6 bis et §11, `docs/reports/phase-7/bilan.md`.
Tout se fait avec le **faux fournisseur** (`PROVIDER_MODE=mock`) et le **faux SasPay** : aucun argent réel.

## Décisions du propriétaire (2026-11-11, ne pas redemander)
1. **Thème** : sombre seulement pour l'espace client (pas de bouton clair/sombre).
2. **Portée** : la palette sombre ne s'applique qu'à l'**espace client** (tableau de bord, commandes, recharge, transactions, favoris, compte). L'accueil, le catalogue et les pages de connexion gardent blanc, bleu `#1D4ED8` et jaune. Extension possible à la phase 14.
3. **Palette** (Radix Colors, générée) : accent `#425EFF`, gris `#D7D7DA`, fond `#111111`. **Aucune bibliothèque ajoutée** : les 12 nuances vont dans le CSS en variables, limitées à l'espace client (classe `.lp-app`). Pas de Radix Colors, pas de HeroUI, pas de serveur MCP ajouté. `LLD.md §1` inchangé.
4. **Documents** : mise à jour de `docs/05` (nouvelle §11) et de `CLAUDE.md` accordée. Les skills de design sont utilisés partout : `unslop`, `antislop-*`, `baseline-ui`, `improve-ui`, `fixing-accessibility`, `ui-ux-pro-max`, `apple-design-hig`, `ponytail`. `docs/05` (§11 incluse) prime en cas de conflit.
5. **Attention** : PRD, LLD, ARCHITECTURE et les fiches d'agents répètent « pas de mode sombre ». Pour l'espace client, `docs/05` §11 fait exception ; à rappeler à chaque sous-agent.

6. **Inspiration visuelle (2026-11-11)** : le propriétaire donne comme modèle https://template-dashboard.heroui.pro/ (structure seulement, **aucun code ni composant HeroUI copié**). On reprend : barre latérale à gauche avec avatar et nom en haut, « Aide » et « Déconnexion » en bas ; message « Bonjour, <prénom> » ; onglets de vue ; rangée de 4 cartes de chiffres avec pastille de variation (vert/rouge) ; cartes arrondies aérées ; tableau avec Filtrer, Trier, Colonnes et recherche. On la rend en **composants shadcn/ui** (https://ui.shadcn.com/docs/components : Sidebar, Card, Tabs, Table, Badge, Button, Dialog, Sheet, Skeleton, Sonner, etc.), habillés avec la palette `.lp-app`. Pas de faux chiffres : seulement les vrais.
7. **Suggestion désactivable sur tous les appareils (mobile et PC)** : le choix est gardé **en base** (colonne `profiles.suggestions_enabled boolean not null default true`, changement de schéma demandé par le propriétaire le 2026-11-11), modifiable par `PATCH /me` et lu par `GET /me`. Remplace l'idée d'un `localStorage`.
8. **shadcn/ui** : tous les composants ajoutés le 2026-11-11 sur accord explicite (« ajoute tout »), sans écraser les 7 existants (button, badge, card, dialog, field, input, table). Ajouter de nouveaux composants ensuite = demander.

## Points de départ déjà dans le code
- Pages `src/app/[locale]/(app)/` : `dashboard`, `orders`, `add-funds`, `transactions`, `favorites`, `account` existent ; plusieurs sont encore des « Bientôt » (`ComingSoon`). `greeting.tsx` existe.
- `src/components/order/*`, `src/hooks/use-order-polling.ts` (phase 7), `src/components/ui/button.tsx` avec états `loading` et `success` (docs/05 §6 bis).
- Endpoints à vérifier avec `graphify query` avant de coder : `GET/PATCH/DELETE /me`, solde et transactions, `/favorites` (API_SPEC §6.2, 6.3, 6.7).

## Règles
- **Suggestion de commande** : calculée **côté serveur** depuis la table `orders` du client (ex. service le plus commandé, quantité habituelle). Une carte discrète, bouton « Commander » (formulaire pré-rempli), croix pour fermer. **Jamais** de coût fournisseur, marge ni nom du fournisseur. Nouveau client sans commande : pas de carte.
- **Désactivable** : le choix est gardé **dans le navigateur** (pas de nouvelle colonne en base, donc pas de changement de schéma). À reprendre avec le propriétaire s'il le veut sur tous ses appareils.
- **États de chargement et de succès** sur chaque action du tableau de bord (recharger, commander, favori, enregistrer le compte, supprimer) : bouton `loading` → `success` (≤ 600 ms), `aria-busy`, `prefers-reduced-motion` respecté.
- **Compte** : devise (XAF, XOF, USD), langue (fr, en), téléphone (E.164, unique), suppression avec mot de passe → `anonymize_user`. Aucune modification de solde.
- **Mobile d'abord** : 360 px, menu du bas (Commander, Commandes, Recharger, Compte), cartes de chiffres en 2 × 2, aucune cible tactile sous 44 px, aucun débordement horizontal.
- Textes FR + EN via `antislop-copywriting` ; le client ne voit jamais le fournisseur.
- Points reportés de la phase 7 à traiter ici : (a) solde de l'en-tête affiché « — » ; (b) bouton « Nouvelle commande » sur 2 lignes sur ordinateur ; (c) nom de service « Abonnés TikTok #9747146 » : vérifier que le `#` n'est pas un identifiant fournisseur (`docs/01`, générateur de catalogue).
- Aucune nouvelle bibliothèque, aucun `any`, pas de `useEffect` pour charger des données.

## Hors périmètre
Support / tickets (phase 9), parrainage et remises (phase 10), admin (phases 11-12), pages publiques et accueil (phase 14), vrai fournisseur et vrais paiements (phase 15), thème clair/sombre.

## Ordre des tâches
| # | Tâche | Agent | Fichiers | Statut |
|---|---|---|---|---|
| 8.0 | Plan, `CLAUDE.md`, `docs/05` §11 | chef de projet | `docs/plans/phase-8.md`, `CLAUDE.md`, `docs/05-design-system.md` | **Statut : rapportée** |
| 8.1 | Palette sombre : relever les 12 nuances Radix (accent 425EFF, gris D7D7DA, fond 111111) sur la page Radix, les écrire en variables sous `.lp-app`, contrôler les contrastes ≥ 4,5:1 | lp-designer | `src/styles/globals.css`, `docs/05` §11 (valeurs) | **Statut : rapportée (valeurs intermédiaires calculées)** |
| 8.2 | Tests d'abord : calcul de la suggestion (client sans/avec commandes, plusieurs services, jamais de champ fournisseur), `/me` PATCH (devise, langue, téléphone invalide ou déjà pris) et DELETE (mauvais mot de passe, anonymisation), favoris (ajout, retrait, doublon, service inconnu), transactions (pagination, filtre), composants (carte suggestion fermable, états loading/success), e2e `client-area.spec.ts` à 360 px | lp-tester | `tests/**` | **Statut : rapportée** |
| 8.3a | Serveur : suggestion + route associée ; `openapi.yaml` | lp-coder A | `src/server/orders/suggest-order.ts`, `src/app/api/**/suggestion/**`, `openapi.yaml` | **Statut : rapportée** |
| 8.3b | Serveur : `/me` (PATCH/DELETE), favoris, transactions (seulement ce qui manque) | lp-coder B | `src/server/accounts/**`, `src/server/favorites/**`, `src/app/api/me/**`, `src/app/api/favorites/**`, `src/app/api/wallet/**` | **Statut : rapportée** |
| 8.4 | Écrans : tableau de bord (4 cartes, suggestion), historique commandes (refonte sombre), transactions, favoris, compte, menu du bas, en-tête (solde, bouton sur 1 ligne), états loading/success, FR/EN | lp-designer (après 8.3 et 8.1) | `src/app/[locale]/(app)/**`, `src/components/{layout,wallet,order,shared,ui}/**`, `src/hooks/**`, `src/messages/**` | **Statut : rapportée** |
| 8.5 | Relecture, navigateur 360 px et ordinateur, sécurité (suppression de compte, droits sur `/me` et favoris) | lp-reviewer ∥ lp-qa ∥ lp-security | lecture seule | **Statut : rapportée (relecture, sécurité, QA acceptées)** |
| 8.6 | Rapports, bilan, `ROADMAP.md`, `CHANGELOG.md` (avant fusion) | lp-reporter | `docs/reports/phase-8/` | **Statut : rapportée** |

8.3a et 8.3b n'ont aucun fichier en commun : parallèle possible après 8.2. 8.1 peut tourner en parallèle de 8.2 et 8.3 (seul 8.1 touche `globals.css`). 8.4 attend 8.1 et 8.3. Pas de `lp-seo` : pages privées. Si 8.3b montre qu'une fonction SQL manque, `lp-db` intervient avant (à signaler au propriétaire : changement de schéma).

## Règle donnée à chaque sous-agent
« graphify : si `graphify-out/graph.json` existe, lancer `graphify query "<question>"` avant votre premier grep ou lecture de code ; lire un fichier brut seulement pour les lignes déjà repérées. Après toute modification de code, lancer `graphify update .`. »

## Terminé quand
- [x] Tout l'espace client fonctionne sur petit téléphone (360 px) et ordinateur, en sombre, FR et EN (QA 2e passage ACCEPTÉ ; anglais vérifié par la QA seulement).
- [x] Suggestion calculée côté serveur, fermable (visite seulement), désactivable (colonne en base), sans donnée fournisseur.
- [x] Compte : devise, langue, téléphone, suppression (anonymisation) fonctionnent ; favoris et transactions aussi (e2e 8/8, QA).
- [x] États de chargement et de succès sur chaque action du tableau de bord (ActionButton).
- [x] Solde de l'en-tête correct, bouton « Nouvelle commande » sur une ligne, nom de service vérifié (le « # » est un identifiant du fournisseur, GARDÉ par choix du propriétaire, affiché « Réf. N »).
- [x] Lint, types, tests, build verts ; `lp-security` accepté (2 passages).
- [x] CI GitHub lue sur la PR 18 (vraie CI) et verte (job `ci`, 11 min 34 s, commit 8a8d0d0).
- [x] Rapport dans `docs/reports/phase-8/` et résumé en français simple.
- [x] Validation du propriétaire (« valide », écrit par lui le 2026-11-11).
