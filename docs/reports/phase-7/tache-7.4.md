# Tâche 7.4 — Design de la liste des commandes

- Badges : pastille avec point de couleur. Terminée = vert, en cours = bleu, attente et vérification = fond jaune pâle + texte encre (le jaune 700 seul donne ~3,6:1, sous AA), remboursée = gris.
- Barre de progression : ajout du pourcentage chiffré (tabular-nums), aria inchangé.
- Liste : cartes blanches, titre qui passe à la ligne sans déborder, badge qui ne rétrécit pas, message « en cours de vérification » pour partiel/annulé/à vérifier.
- État vide : message, aide et bouton bleu « Commander » (zone ≥ 44 px) vers /order.
- Textes FR/EN : emptyHint, emptyCta, reviewHint ajoutés (pas de promesse de remboursement).
- Chargement : déjà géré par `(app)/loading.tsx`, non modifié. Page `orders/page.tsx` inchangée.
- Non fait : captures avant/après (pas de navigateur lancé).
- Contrôles : vitest components+hooks 39/39 verts, typecheck et lint OK.
