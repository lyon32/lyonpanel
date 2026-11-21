# Phase 14 — Mots-clés SEO et prompts d'images (brouillon, à valider)

Date : 2026-11-21. Source des mots-clés : suggestions de recherche Google (outil gratuit, pas de volumes chiffrés). OpenSEO (13 crédits), DataForSEO (403) et SerpApi (clé invalide) n'ont pas répondu. Les volumes restent à mesurer quand un outil sera disponible.

## 1. Mots-clés observés (recherches réellement suggérées)

**Français (Cameroun, Sénégal, Côte d'Ivoire)**
- acheter likes instagram · acheter like instagram pas cher · acheter j'aime instagram · acheter 50 likes instagram
- gagner des abonnés tiktok · acheter abonnés tiktok · augmenter abonnés instagram
- À tester : booster instagram, panel smm, acheter vues tiktok, acheter abonnés instagram

**Anglais (Nigeria, Ghana, Kenya)**
- buy tiktok followers · buy tiktok followers cheap · buy tiktok followers nigeria · buy tiktok followers with naira
- buy instagram followers in nigeria · buy instagram followers cheap · buy instagram followers app
- smm panel · smm panel ghana · smm panel tiktok · smm panel instagram · smm panel cheapest
- how to grow instagram followers (organically / fast / for business)

**Lecture** : la demande africaine mélange « acheter » (intention d'achat) et « grandir » (intention d'aide). Le héros reste sur « grandir sur les réseaux sociaux » ; les pages plateformes portent « acheter abonnés / likes / vues TikTok / Instagram » ; l'anglais vise « smm panel » + pays (Ghana, Nigeria).
- Mot-clé « numéro 1 en Afrique » : pas dans le texte visible ; à placer en meta description seulement si le propriétaire peut le justifier.

## 2. Prompts d'images (version détaillée, à valider par le propriétaire AVANT toute génération Magnific)

Les prompts sont écrits en anglais (les modèles d'image comprennent mieux), chacun suivi de ses paramètres et de ses « negative prompts ». Coût : 3 à 4 images maximum (décision du 2026-11-21).

**Cadre commun à toutes les images** : fond #111111 (noir doux), accent bleu #425EFF, gris clair #D7D7DA ; jamais de jaune, de vert citron ni de néon ; aucun texte lisible, aucun logo ni marque réelle ; rendu photographique propre, peau réaliste avec texture visible (pas de lissage plastique), mains anatomiquement correctes ; cohérence entre toutes les images (même grain, même éclairage froid de contre-jour bleu, même fond).

### Image 1 — Visuel du héros (`hero-visual`), portrait, ratio 4:5, 2048×2560

**Prompt** :
"Editorial studio photograph of a young Black African woman, about 25 years old, medium-dark skin with a natural healthy glow, short natural curly hair, a warm genuine smile with slightly raised cheeks, eyes looking down-left at the smartphone she holds with both hands at chest height. She wears a dark indigo denim shirt with the top button open over a plain charcoal t-shirt, a thin small gold-free silver hoop earring, no other jewelry, short clean natural nails. Framing: waist-up, subject placed on the right third of the frame, the left 40% of the frame left as clean empty dark space for headline text. Camera: full-frame mirrorless, 85mm lens at f/2, ISO 200, 1/200s, eye level, very shallow depth of field with the eyes in razor-sharp focus, subtle natural skin texture and fine pores preserved. Lighting: a large soft key light from the front-left at 45 degrees with a neutral-warm 5000K tone on the face; a strong cool blue rim light (#425EFF) from behind-right creating a thin glowing edge on the shoulder, hair and cheek; a very faint blue bounce on the shirt; no harsh shadows under the eyes. Background: seamless matte near-black backdrop (#111111) with a soft large out-of-focus deep navy halo (#1C2247) behind her shoulder, no props, no objects, no text. The smartphone has a black screen with no visible interface and no brand marks, matte black frame. Mood: confident, calm, modern, aspirational, authentic everyday African entrepreneur and creator, not a stock-photo smile. Color grading: cinematic, slightly desaturated, deep blacks, cool highlights on edges, warm natural skin tones, fine film grain 3%. Photorealistic, high detail."

**Negative prompt** : "text, letters, watermark, logo, brand names, social media icons, extra fingers, deformed hands, fused fingers, asymmetrical eyes, plastic skin, airbrushed skin, over-smoothing, uncanny face, yellow, lime green, neon colors, rainbow gradients, busy background, stock photo cliché, thumbs up, fake smile, heavy makeup, cartoon, illustration, 3d render, oversaturated, HDR look, lens flare, sparkles, emoji"

### Image 2 — Téléphone « recharge » (`carte-recharge`), téléphone tenu en main, ratio 1:1, 2048×2048 — VERSION 2 (avec références)

**Pourquoi la v1 (plus bas) était laide** : téléphone isolé qui flotte, rendu 3D générique, sans main ni échelle. La v2 montre un téléphone TENU EN MAIN, comme la réf. 1 (SMM1ST), avec de petites pastilles-icônes bleues autour.

**Images de référence à fournir à Magnific (référence de composition/style)** :
- Réf. A, `images/1.png` (SMM1ST) : main tenant un smartphone incliné, pastilles rondes bleues lumineuses autour. À reprendre : composition, inclinaison (environ 15° vers la droite), échelle main/téléphone, ombre portée. À ne pas reprendre : le noir et blanc intégral, le bleu néon saturé.
- Réf. B, `images/4.png` (SNFollows) : deux téléphones inclinés, halo circulaire derrière. À reprendre : la profondeur (un téléphone net devant, un second plus flou derrière si voulu). À ne pas reprendre : fond clair, couleurs orange et vert.
- Réf. C, à fournir par le propriétaire : une photo produit d'un smartphone récent tenu à une main (visuel officiel de fabricant, éclairage studio doux). À reprendre : proportions réalistes, bords fins, reflets propres.
- Les fichiers 1.png à 5.png sont dans le dossier `images` de la session (`C:\Users\DELL\AppData\Local\Temp\claude\aca922360a4aa623\2599c0fa-0869-40ae-9ea4-a22ba58c8f62\images\`). Réglage conseillé : poids de la référence 0,5 (composition seulement), le texte du prompt prime sur les couleurs.

**Prompt v2** :
"Photorealistic studio photograph of a right hand, dark brown African skin with natural texture and short clean nails, holding a modern flagship smartphone upright in the palm with the thumb resting on the left edge and four fingers curved behind the back of the phone, the phone tilted 15 degrees to the right and slightly toward the viewer, three-quarter hand-and-phone view cropped at the wrist. Phone: slim matte graphite titanium frame with softly rounded corners, uniform very thin bezels, flat glass, no brand marks, no logo. The screen is lit and shows a clean dark mobile payment top-up interface: near-black #111111 background, a large rounded card in blue #425EFF with a smooth subtle inner gradient to #3A55F2, on the card a thick progress bar about 70% filled and two short light grey lines standing for text, below it a row of three small rounded squares in dark grey #222223 with simple abstract white pictograms (a phone handset, a card, a coin) and one large full-width blue button with a plain white check mark; strictly NO readable letters, NO numbers, NO real logos on the screen. Around the phone, five small perfectly round glossy blue badges (#425EFF, diameter 8 to 14% of the phone height) float at different depths, each with a simple white abstract symbol (a heart, a play triangle, a person silhouette, a chat bubble, a plus sign), the nearer ones slightly out of focus, each casting a soft blue glow no larger than its own radius. Behind the hand, one large soft out-of-focus circular halo of deep navy #1C2247 about three times the phone width. Lighting: large soft key light from the upper left at neutral 5000K on the hand and phone body, a cool blue rim light (#425EFF) from behind-right tracing a thin line along the phone edge, the thumb and the finger tips, gentle falloff to near black, subtle realistic reflection of a softbox on the screen glass without hiding the interface. Camera: full-frame, 100mm lens at f/4, focus on the phone screen and the thumb, shallow depth of field for the badges and halo, eye-level product angle, ISO 100, 2048x2048. Background: seamless matte near-black #111111 with a very faint dot grid in #3B3B3E. Mood: premium, trustworthy, calm, modern, a real everyday mobile-money moment, never a futuristic hologram. Color grade: deep blacks, cool highlights, warm natural skin, fine film grain 2%. Hand anatomically correct with exactly five fingers, natural knuckle and skin creases."

**Negative prompt v2** : "readable text, numbers, letters, brand logo, apple logo, android logo, notch, extra fingers, six fingers, fused fingers, deformed hand, wrong thumb joint, floating disconnected hand, mannequin hand, plastic skin, airbrushed skin, cartoon, 3d icon style, glossy toy phone, neon glow, bloom, purple, magenta, yellow, lime green, orange, rainbow gradient, lens flare, sparkles, particles, hologram, fingerprints on screen, cracked screen, cluttered background, low resolution, melted edges, distorted proportions, oversized phone, thick bezels, old phone, emoji"

**Contrôles propres à l'image 2** : exactement 5 doigts ; le pouce a deux articulations ; aucun texte sur l'écran ; pastilles rondes et nettes ; bleu = #425EFF (pas violet).

*(Ci-dessous : v1 abandonnée, gardée pour mémoire.)*

**Prompt v1 (abandonné)** :
"Photorealistic product render of a modern flagship smartphone, matte black aluminum frame with slightly rounded corners, thin uniform bezels, seen in a three-quarter view rotated about 25 degrees to the left and tilted back 10 degrees, floating slightly above a dark surface with a soft contact shadow. The screen is lit and shows an abstract dark user interface: a deep #111111 background, a rounded-corner blue card (#425EFF, subtle inner gradient to #3A55F2) holding a thick horizontal progress bar and three short grey lines representing text (no readable letters, no numbers, no logos), below it two small rounded rectangles in dark gray (#222223) and a circular blue button with a plain white check mark. The glass has crisp but subtle reflections of a softbox, a thin cool blue edge highlight (#9DB0FF) running along the right metal edge, and fine micro-scratches absent (brand new). Lighting: one large softbox top-left, one strip light behind-right creating a blue rim (#425EFF), low ambient light, deep falloff to near black at the corners. Camera: 100mm macro-style product lens at f/5.6, focus stacked so that the whole phone is sharp, very slight vignette. Background: seamless matte dark gradient from #191919 center to #111111 corners, subtle reflection on the floor, no other objects, no hands, no text. Realistic physically-based materials, accurate reflections, no bloom, premium tech product photography look, Octane/Blender Cycles quality."

**Negative prompt** : "readable text, numbers, brand logo, apple logo, android logo, notch with camera brand, social media icons, fingerprints, hands, cartoon, glossy plastic, neon glow, purple, yellow, lime, rainbow, lens flare, sparkles, floating particles, emoji, cluttered background, low-poly, melted edges, distorted proportions"

### Image 3 — Fond de section (`fond-section`), texture, ratio 16:9, 2560×1440

**Prompt** :
"Abstract seamless dark background texture for a website section. A very fine regular grid of tiny round dots, each dot about 2 pixels, spaced 28 pixels apart, in dark gray #3B3B3E at 60% opacity, covering the whole canvas on a near-black #111111 base. In the lower right quadrant a very large, very soft, out-of-focus radial glow of blue #425EFF at about 15% opacity, fading smoothly to transparent with no visible banding, plus a second smaller glow of #1C2247 in the upper left at 25% opacity. Extremely subtle fine film grain at 2% over everything to prevent banding. Flat design, no objects, no shapes, no lines, no text, no perspective, no depth of field, no light rays, perfectly even and calm so that white text on top stays readable. Edges identical on all four sides (tileable). Minimalist, technical, quiet."

**Negative prompt** : "objects, people, text, logo, icons, perspective grid, 3d, stars, particles, sparkles, light rays, lens flare, gradient banding, purple, pink, yellow, lime, neon, bright spots, busy pattern, noise too strong, vignette, border, frame"

### Image 4 (optionnelle) — Créateur de contenu (`hero-visual-b`), portrait, ratio 4:5, 2048×2560

**Prompt** :
"Editorial studio photograph of a young Black African man, about 28 years old, dark skin with natural highlights, neat short fade haircut and a light well-groomed beard, an open confident half-smile, looking straight into the front camera lens of the smartphone he holds at arm's length as if recording a selfie video, the phone seen from behind showing a plain matte black back with no logo. He wears an olive-green cotton overshirt with rolled sleeves over a white crew-neck t-shirt, a simple black analog wristwatch on the left wrist. Framing: chest-up, slightly low angle, subject centered-right, empty dark space on the left 40%. Camera: full-frame, 85mm at f/2, ISO 200, razor-sharp focus on the eyes, shallow depth of field, preserved skin texture. Lighting: soft front key from the left at 5000K, cool blue rim light (#425EFF) from behind right outlining the shoulder and beard, same lighting setup, backdrop and color grading as the portrait of the young woman so both images belong to the same series. Background: seamless matte near-black (#111111) with a soft deep navy halo (#1C2247). Mood: friendly, authentic, entrepreneurial, relaxed, genuine energy. Photorealistic, fine film grain 3%."

**Negative prompt** : "text, watermark, logo, brand names, social media icons, extra fingers, deformed hands, plastic skin, airbrushed, uncanny valley, asymmetrical eyes, yellow, lime green, neon, rainbow, cartoon, 3d render, HDR, lens flare, sparkles, emoji, stock photo cliché, thumbs up, heavy filter"

### Après génération (contrôles avant de garder une image)
- Pas de texte ni de logo caché, mains et yeux corrects, aucun jaune/vert citron.
- Contraste du texte blanc posé sur l'image ≥ 4,5:1 (zone vide à gauche).
- Export en WebP/AVIF, ≤ 150 Ko pour le héros, `alt` descriptif, dimensions fixées (docs/03 §3 ter).
- Le propriétaire valide chaque image avant intégration.
