-- Données de développement : réglages par défaut et services FICTIFS. Aucune donnée client, aucun vrai nom de fournisseur.
-- Rejouable : upsert sur les réglages, services d'ids 900001 à 900020 uniquement.

insert into public.settings (key, value) values
  ('usd_xaf_rate', '600'),
  ('min_recharge_xaf', '3000'),
  ('referral_pct', '5'),
  ('provider_low_balance_usd', '5'),
  ('limited_launch', 'false'),
  ('auto_discount', '{"threshold_xaf": 50000, "pct": 10}'),
  ('default_multiplier', '3'),
  -- Valeur provisoire : à confirmer par le propriétaire (phase 5, tarifs SasPay /pricing/my-rates/).
  ('saspay_fee_pct', '3'),
  -- Valeur provisoire : à confirmer par le propriétaire (phase 4, alerte si le coût fournisseur change de plus de X %).
  ('price_alert_pct', '20')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Prix client en XAF pour 1 000 = coût USD × 600 × 3 arrondi aux 5 XAF supérieurs.
insert into public.services
  (id, platform, category, name_fr, provider_name, provider_type, cost_usd_1000, price_xaf_1000,
   min_qty, max_qty, refill, cancel, dripfeed, active, available, sort_order)
select v.id, v.platform, v.category, v.name_fr, v.provider_name, 'Default', v.cost,
       (ceil(v.cost * 600 * 3 / 5) * 5)::bigint,
       v.min_qty, v.max_qty, v.refill, false, false, true, true, v.id - 900000
  from (values
    (900001, 'tiktok',    'followers', 'Abonnés TikTok',                 'SEED TikTok Followers',   1.2000,   50, 50000, true,  true),
    (900002, 'tiktok',    'followers', 'Abonnés TikTok qualité premium', 'SEED TikTok Followers HQ', 2.5000,   50, 20000, true,  false),
    (900003, 'tiktok',    'likes',     'J''aime TikTok',                 'SEED TikTok Likes',       0.4000,   20, 100000, false, true),
    (900004, 'tiktok',    'views',     'Vues TikTok',                    'SEED TikTok Views',       0.0500,  100, 1000000, false, true),
    (900005, 'tiktok',    'views',     'Vues TikTok rapides',            'SEED TikTok Views Fast',  0.1200,  100, 500000, false, false),
    (900006, 'tiktok',    'shares',    'Partages TikTok',                'SEED TikTok Shares',      0.3000,   50, 50000, false, false),
    (900007, 'tiktok',    'comments',  'Commentaires TikTok',            'SEED TikTok Comments',    6.0000,   10, 1000, false, false),
    (900008, 'instagram', 'followers', 'Abonnés Instagram',              'SEED Instagram Followers', 1.8000,  50, 50000, true,  true),
    (900009, 'instagram', 'followers', 'Abonnés Instagram garantis',     'SEED Instagram Followers Refill', 3.2000, 50, 30000, true, false),
    (900010, 'instagram', 'likes',     'J''aime Instagram',              'SEED Instagram Likes',    0.6000,   20, 100000, false, true),
    (900011, 'instagram', 'views',     'Vues Reels Instagram',           'SEED Instagram Reels Views', 0.0800, 100, 1000000, false, true),
    (900012, 'instagram', 'views',     'Vues stories Instagram',         'SEED Instagram Story Views', 0.2000, 100, 100000, false, false),
    (900013, 'instagram', 'comments',  'Commentaires Instagram',         'SEED Instagram Comments', 7.5000,   10, 1000, false, false),
    (900014, 'instagram', 'saves',     'Enregistrements Instagram',      'SEED Instagram Saves',    0.5000,   20, 50000, false, false),
    (900015, 'facebook',  'followers', 'Abonnés page Facebook',          'SEED Facebook Page Followers', 2.0000, 50, 50000, false, true),
    (900016, 'facebook',  'likes',     'J''aime page Facebook',          'SEED Facebook Page Likes', 1.6000,  50, 50000, false, true),
    (900017, 'facebook',  'likes',     'J''aime publication Facebook',   'SEED Facebook Post Likes', 0.7000,  20, 50000, false, true),
    (900018, 'facebook',  'views',     'Vues vidéo Facebook',            'SEED Facebook Video Views', 0.1500, 100, 500000, false, false),
    (900019, 'facebook',  'comments',  'Commentaires Facebook',          'SEED Facebook Comments',  8.0000,   10, 1000, false, false),
    (900020, 'facebook',  'shares',    'Partages Facebook',              'SEED Facebook Shares',    1.1000,   20, 20000, false, false)
  ) as v(id, platform, category, name_fr, provider_name, cost, min_qty, max_qty, refill, live)
on conflict (id) do update set
  platform = excluded.platform, category = excluded.category, name_fr = excluded.name_fr,
  provider_name = excluded.provider_name, provider_type = excluded.provider_type, cost_usd_1000 = excluded.cost_usd_1000,
  price_xaf_1000 = excluded.price_xaf_1000,
  min_qty = excluded.min_qty, max_qty = excluded.max_qty, refill = excluded.refill,
  active = excluded.active, available = excluded.available, sort_order = excluded.sort_order;

insert into public.price_multipliers (platform, category, multiplier) values
  ('instagram', 'followers', 3)
on conflict (platform, category) do update set multiplier = excluded.multiplier;
