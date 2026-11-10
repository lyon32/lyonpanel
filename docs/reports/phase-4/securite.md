VERDICT : ACCEPTÉ (avec 2 remarques Moyenne/Basse, non bloquantes)
Tâche : Phase 4 — Prix + catalogue
Surface : /api/v1/services, /api/v1/services/[id], pages /services/**, sitemap, vue services_public, table price_multipliers, client fournisseur, syncServices, JSON-LD, CSV.

Essais réels (base locale, clé anon) :
- anon lit price_multipliers, services, settings, service_price_history, provider_balance_snapshots, orders -> 42501 refusé : OK
- anon écrit price_multipliers / modifie services -> 42501 : OK
- services_public ne montre que id, platform, category, name_fr, prix, min/max, options, sort_order ; cost_usd_1000 / multiplier / provider_name -> colonne inexistante : OK
- Aucune ancienne migration modifiée (une seule migration ajoutée) : OK
Code :
- Nom du service reconstruit depuis des libellés propres (jamais le nom fournisseur) ; PublicService = liste blanche : OK
- CSV data/catalogue-services.csv contient coût et multiplicateur mais c'est un fichier de travail du propriétaire, hors public/ et hors build : OK (à ne jamais déplacer dans public/)
- check-client-bundle.mjs couvre PROVIDER_API_KEY et les valeurs des variables ; exécuté sur .next/static : propre ; aucune trace de cost_usd, price_multipliers, provider_name, JAP : OK
- Recherche ?q= faite en mémoire côté serveur (pas de filtre PostgREST -> pas d'injection), coupée à 60 caractères, page bornée : OK
- ?currency / ?locale en enum Zod, id en regex 1-10 chiffres : OK
- Client fournisseur : clé dans le corps du POST, délai 10 s, aucune reprise, erreurs génériques, URL uniquement depuis l'environnement ; PROVIDER_MODE=live refusé hors VERCEL_ENV=production ; défaut mock : OK
- syncServices : liste vide refusée, rate négatif/NaN refusé par Zod et computePrice, aucune suppression : OK
- JSON-LD : React échappe le contenu du script (testé avec </script><script>) : OK
Secrets : diff main...HEAD (hors graphify-out) sans motif de clé ; .env.local non suivi (seul .env.example) : OK
npm audit : non relancé dans cet audit (voir CI).

Remarques :
1. [Moyenne] src/server/catalog/load-catalog.ts:21-33 — les pages /services/** lisent le cookie de devise, donc sont dynamiques : chaque visite relit les 2 188 lignes (3 requêtes) sans cache. Un robot qui martèle peut charger la base. Correctif : mettre en cache la liste (unstable_cache/revalidate 300 s) et/ou règle de limitation Cloudflare sur /services. Responsable : lp-coder.
2. [Basse] syncServices accepte un rate énorme sans plafond ; un prix aberrant déclenche seulement l'alerte price_alert_pct. Correctif : plafonner rate (ex. 1000 USD/1000) dans providerServiceSchema. Responsable : lp-coder.
