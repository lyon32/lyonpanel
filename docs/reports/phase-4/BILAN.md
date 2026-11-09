# Bilan — Phase 4 : Prix + catalogue
Date : 2026-11-10 · Statut : faite – en attente de validation

## Objectif de la phase (ROADMAP.md)
Ranger le catalogue du fournisseur, calculer les prix de vente avec un multiplicateur, et afficher les services en XAF, XOF ou USD. Aucun nom de fournisseur ni prix d'achat visible côté client.

## Résultat : ce qui marche maintenant
- 2 188 services sont chargés (depuis un faux fournisseur, pas le vrai) et rangés par réseau puis par type.
- Chaque prix est calculé côté serveur : coût du fournisseur en XAF × multiplicateur, arrondi aux 5 XAF supérieurs.
- Pages publiques en français et en anglais : liste des réseaux, types d'un réseau, liste des services (pagination, recherche sans accents ni majuscules), fiche d'un service. Prix en XAF, XOF ou USD.
- Un fichier CSV de travail liste les 2 188 services (`data/catalogue-services.csv`). Les règles et tableaux par réseau sont dans `docs/01-catalogue-et-prix.md`.
- Pages inconnues : vraie page 404 avec en-tête et pied de page.

## Décisions du propriétaire appliquées
- Multiplicateur ×3 au départ, réglable par catégorie (réseau × type), avec surcharge possible par service.
- Taux 1 USD = 600 XAF, réglable (réglage `usd_xaf_rate`).
- Arrondi au multiple de 5 XAF supérieur (prix de 1 000 et total de commande), minimum 5 XAF.
- Tous les services sont actifs, sauf ceux que le fournisseur retire ou déclare indisponibles.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 4.0 Documents mis à jour (fournisseur à la place de JAP) | rapportée | (chef de projet) |
| 4.1 Tests d'abord | rapportée | `tache-4.1-tests.md` |
| 4.2 Base de données | rapportée | `tache-4.2-base.md` |
| 4.3 Prix, catalogue, fournisseur, synchro, routes | rapportée | `tache-4.3-prix-catalogue-fournisseur.md` |
| 4.4 Routes publiques | rapportée | incluse dans 4.3 |
| 4.5 CSV et documentation | rapportée | `tache-4.5-donnees.md` |
| 4.6 Pages catalogue et fiche | rapportée | `tache-4.6-pages.md` |
| 4.7 Relecture, QA, sécurité | rapportée | `tache-4.7-controles.md` |

## Chiffres du catalogue (data/catalogue-resume.json)
- 2 188 services, 1 051 noms affichés distincts.
- Par réseau : Instagram 822, TikTok 547, Facebook 308, YouTube 261, Telegram 144, X 57, Kick 11, Threads 7, Spotify 3, WhatsApp 3, Twitch 6, LinkedIn 4, Pinterest 4, trafic web 8, Autres réseaux 3.
- Par type (tous réseaux) : 136 services en type « Autres ».
- Prix extrêmes : 11 services au-dessus de 100 USD les 1 000 ; 12 commandes minimales au-dessus de 5 000 XAF ; le service 30786 coûte 8 709 120 XAF les 1 000.
- Prix les plus bas : 5 XAF les 1 000 (par exemple vues Instagram, service 36125).

## Vérifications réelles
- Lint : 0 erreur (8 avertissements de taille de fichier, déjà présents avant la phase).
- Types : propres. Build : OK.
- Tests unitaires : 1 048 verts.
- Tests de navigateur du catalogue : 13 sur 13 verts (avant la toute dernière retouche de redirection, vérifiée ensuite avec `curl`).
- Tests de base de données : 273 sur 278. Les 5 échecs concernent le stockage de fichiers : le conteneur de stockage Supabase local était arrêté. Aucun lien avec la phase 4.
- Un test de la phase 3 (limitation des essais) est lent : on lui a donné 20 secondes.
- Contrôles : relecture ACCEPTÉ ; sécurité ACCEPTÉ (2 remarques corrigées) ; QA « à corriger légèrement » puis corrigé.

## Ce qui n'est pas fait ou pas vérifié
- La mesure des cibles tactiles de 44 px n'a pas été refaite dans un navigateur après la correction. Le code a été corrigé, mais personne n'a remesuré.
- Les 13 tests de navigateur datent d'avant la dernière retouche (redirection des pages invalides).
- `npm audit` n'a pas été relancé dans l'audit sécurité (la CI le fait).
- CI GitHub : non vérifiée par ce rapport (pas de PR au moment de l'écriture).
- Le vrai fournisseur n'est jamais appelé (phase 15).

## Problèmes rencontrés et solutions
- Noms du fournisseur souvent identiques ou trop longs : noms reconstruits à partir de champs propres. Certains restent proches (voir plus bas).
- Pages lentes et sans cache (sécurité) : cache de 300 secondes sur la liste.
- Prix fournisseur absurde accepté (sécurité) : plafond de 100 000 USD.
- Recherche sensible aux accents et majuscules (QA) : corrigée. Boutons trop petits (QA) : corrigés dans le code. Pages `?page=` invalides : redirigées. 404 sans en-tête : corrigée.

## À surveiller
- Services extrêmes (11 à plus de 100 USD les 1 000, le 30786 à 8 709 120 XAF) : à désactiver ou corriger dans l'admin, phase 12.
- Trafic web : seulement 8 services.
- 136 services restent « Autres » faute de mot-clé reconnu.
- Certains noms restent proches les uns des autres (1 051 noms pour 2 188 services) ; un numéro `#id` les distingue.
- Les fiches de service sont en `noindex` pour l'instant.
- Le CSV contient coût et multiplicateur : fichier de travail, ne jamais le mettre dans `public/`.

## Décisions prises par Claude, à valider
- Fiches de service en `noindex` (à rouvrir en phase 14 avec le SEO).
- Redirection 307 (temporaire) pour les `?page=` invalides.
- Cache de 300 secondes sur le catalogue.
- Faux fournisseur de test : 150 services (fixture) pour le développement.
- Routes publiques sous `/api/v1/services` (et non `/api/services` comme dans le plan).

## À tester par le propriétaire (pas à pas)
1. Lance le site en local, ouvre `http://localhost:3000/fr/services`. Tu vois les réseaux avec le nombre de services.
2. Clique sur TikTok, puis Abonnés : la liste est paginée, chaque ligne a un prix.
3. Tape « abonnes » (sans accent) ou « ABONNÉS » dans la recherche : même résultat.
4. Ouvre une fiche (par exemple le service 35452). Change la devise (XAF, XOF, USD) : le prix change.
5. Passe en anglais (`/en/services`) : mêmes écrans traduits.
6. Essaie `/fr/services/zzz` : page 404 avec en-tête et pied de page.
7. Sur ton téléphone, vérifie que les boutons se touchent bien du doigt.
8. Ouvre `data/catalogue-services.csv` et `docs/01-catalogue-et-prix.md` : vérifie les prix et le multiplicateur de quelques services.
9. Vérifie qu'aucun nom de fournisseur ni prix d'achat n'apparaît dans les pages.

## Carte du code
`graphify-out/graph.html` existe (carte cliquable). Elle n'a pas été régénérée pour ce bilan.

## Ce que le propriétaire doit préparer pour la phase suivante (phase 5)
- Compte marchand SasPay, clés de test, secret de webhook ; installer `cloudflared`.

## Décision attendue : « validé » ou corrections
