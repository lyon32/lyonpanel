import { describe, expect, it } from 'vitest';
import { fixtureService, loadProviderFixture } from '../../helpers/provider-fixture';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';
import { NETWORKS, SERVICE_TYPES } from '@/server/catalog/labels';

// Signatures attendues :
//   classifyNetwork(name: string, providerCategory: string): Network
//   classifyType(name: string, providerType: string): ServiceType
// Réseaux et types : constantes NETWORKS / SERVICE_TYPES de @/server/catalog/labels.

// Cas dorés tirés de vrais noms (tests/fixtures/provider-services.json) : [id, réseau, type].
const GOLDEN: [number, string, string][] = [
  [23, 'instagram', 'likes'],
  [42, 'instagram', 'views'],
  [105, 'instagram', 'views'], // catégorie « PEAKERR EXCLUSIVE » : sans effet
  [110, 'instagram', 'likes'],
  [722, 'facebook', 'likes'], // nom Facebook rangé par le fournisseur dans « Instagram - Likes »
  [868, 'instagram', 'other'],
  [1324, 'youtube', 'shares'],
  [1368, 'telegram', 'views'],
  [1393, 'spotify', 'views'],
  [1811, 'tiktok', 'followers'],
  [1865, 'youtube', 'likes'],
  [2423, 'instagram', 'shares'],
  [2425, 'tiktok', 'comments'],
  [2634, 'x', 'likes'],
  [3113, 'instagram', 'followers'],
  [3267, 'twitch', 'followers'],
  [3471, 'x', 'views'],
  [4763, 'youtube', 'followers'], // « Subscribes »
  [9116, 'web_traffic', 'other'], // réseau trouvé par la catégorie « Web - Traffic »
  [9121, 'web_traffic', 'other'],
  [10137, 'tiktok', 'shares'],
  [10714, 'x', 'other'],
  [10764, 'instagram', 'comments'],
  [13291, 'telegram', 'other'], // « Post Vote/Poll »
  [13292, 'telegram', 'likes'], // « Like … Reaction + Views » : like vient avant views
  [13655, 'youtube', 'followers'],
  [14453, 'telegram', 'followers'], // Members
  [15026, 'x', 'followers'], // nom Twitter rangé dans « Instagram - Likes »
  [15226, 'youtube', 'comments'], // Custom Comments
  [15974, 'telegram', 'views'],
  [16052, 'telegram', 'shares'],
  [16544, 'instagram', 'likes'], // type fournisseur « Subscriptions » sans effet
  [16611, 'facebook', 'views'],
  [17446, 'facebook', 'other'], // Reaction
  [18706, 'whatsapp', 'followers'], // Channel Member
  [19353, 'youtube', 'comments'],
  [19928, 'instagram', 'comments'],
  [19940, 'facebook', 'comments'], // type Custom Comments, mot-clé après « Facebook - MQ 1K »
  [20938, 'linkedin', 'likes'],
  [20944, 'linkedin', 'shares'], // Reshare
  [21850, 'twitch', 'views'],
  [22082, 'instagram', 'likes'], // type fournisseur Comment Likes
  [22136, 'instagram', 'views'],
  [22360, 'telegram', 'other'], // Bot Start
  [23343, 'telegram', 'other'],
  [24212, 'tiktok', 'shares'], // Saves
  [25105, 'instagram', 'views'],
  [25401, 'tiktok', 'likes'], // Comment Likes
  [27194, 'tiktok', 'comments'],
  [27732, 'tiktok', 'views'], // Viewers
  [27955, 'tiktok', 'other'],
  [27956, 'tiktok', 'likes'],
  [28717, 'youtube', 'followers'], // Subscriber
  [28890, 'facebook', 'likes'], // type Package
  [29060, 'tiktok', 'other'],
  [29406, 'facebook', 'other'], // type Poll
  [29557, 'threads', 'followers'],
  [29622, 'facebook', 'comments'],
  [29792, 'youtube', 'comments'],
  [30211, 'youtube', 'followers'], // « Subscribe »
  [30619, 'instagram', 'followers'], // « İnstagram » (I majuscule pointé)
  [30688, 'instagram', 'followers'],
  [30761, 'threads', 'shares'], // Reposts
  [30766, 'pinterest', 'followers'],
  [30769, 'pinterest', 'shares'], // Save
  [30779, 'instagram', 'shares'],
  [30786, 'other', 'comments'], // avis Google : aucun réseau connu
  [31552, 'kick', 'followers'],
  [31556, 'kick', 'views'],
  [31579, 'telegram', 'followers'], // emoji + lettres stylisées
  [31583, 'telegram', 'followers'],
  [31594, 'telegram', 'other'],
  [31602, 'telegram', 'other'], // Boost
  [31676, 'other', 'views'], // Audiomack : réseau inconnu ; « Plays » = vues
  [31842, 'instagram', 'followers'], // 𝐀𝐥𝐥 𝐅𝐥𝐚𝐠 𝐓𝐲𝐩𝐞𝐬
  [32038, 'youtube', 'views'], // type SEO
  [32110, 'facebook', 'shares'],
  [33413, 'linkedin', 'followers'],
  [33574, 'x', 'comments'],
  [33599, 'whatsapp', 'likes'],
  [35452, 'instagram', 'followers'],
  [36629, 'instagram', 'followers'], // « Instant 𝟭 𝗠𝗶𝗻𝘂𝘁𝗲𝘀 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗲𝗱 » ne donne ni commentaire ni autre réseau
  [36781, 'tiktok', 'likes'], // ᴺᴱᵂ
  [36787, 'instagram', 'views'],
  [36807, 'tiktok', 'views'],
];

describe('classement : cas dorés (vrais noms du fournisseur)', () => {
  it('compte au moins 40 cas dorés', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(40);
  });

  it.each(GOLDEN)('service %s -> réseau %s, type %s', (id, network, type) => {
    const s = fixtureService(id);
    expect(classifyNetwork(s.name, s.category)).toBe(network);
    expect(classifyType(s.name, s.type)).toBe(type);
  });
});

describe('classement : toute la fixture', () => {
  it('renvoie toujours un réseau et un type connus', () => {
    for (const s of loadProviderFixture()) {
      expect(NETWORKS, `service ${s.service}`).toContain(classifyNetwork(s.name, s.category));
      expect(SERVICE_TYPES, `service ${s.service}`).toContain(classifyType(s.name, s.type));
    }
  });

  it('couvre au moins 14 réseaux et les 6 types', () => {
    const all = loadProviderFixture();
    expect(
      new Set(all.map((s) => classifyNetwork(s.name, s.category))).size,
    ).toBeGreaterThanOrEqual(14);
    expect(new Set(all.map((s) => classifyType(s.name, s.type))).size).toBe(6);
  });

  it('est déterministe', () => {
    for (const s of loadProviderFixture()) {
      expect(classifyNetwork(s.name, s.category)).toBe(classifyNetwork(s.name, s.category));
    }
  });
});

describe('classifyNetwork', () => {
  it('le réseau dont le mot-clé apparaît en premier dans le nom gagne', () => {
    expect(classifyNetwork('TikTok - Followers pour votre Instagram', 'Provider')).toBe('tiktok');
    expect(classifyNetwork('Instagram Followers - aussi bon que TikTok', 'Provider')).toBe(
      'instagram',
    );
    expect(classifyNetwork('YouTube Views vers Telegram', '')).toBe('youtube');
  });

  it('le nom passe avant la catégorie du fournisseur', () => {
    expect(classifyNetwork('Facebook - Photo/Post Likes', 'Instagram - Likes | Refill')).toBe(
      'facebook',
    );
  });

  it('retombe sur la catégorie du fournisseur quand le nom ne dit rien', () => {
    expect(classifyNetwork('Likes', 'Telegram - Members')).toBe('telegram');
    expect(classifyNetwork('Likes Super Fast', '➡️ Tik Tok Likes')).toBe('tiktok');
  });

  it('retombe sur other quand ni le nom ni la catégorie ne disent rien', () => {
    expect(classifyNetwork('Followers', 'Services divers')).toBe('other');
    expect(classifyNetwork('', '')).toBe('other');
  });

  it('ignore la casse', () => {
    for (const n of ['TIKTOK Likes', 'tiktok likes', 'TiKtOk likes']) {
      expect(classifyNetwork(n, '')).toBe('tiktok');
    }
  });

  it('normalise le Unicode : I pointé, pleine chasse, lettres stylisées, emoji', () => {
    expect(classifyNetwork('İnstagram Followers', '')).toBe('instagram');
    expect(classifyNetwork('Ｔikｔok Likes', '')).toBe('tiktok');
    expect(classifyNetwork('𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 Followers', '')).toBe('instagram');
    expect(classifyNetwork('ＹＯＵＴＵＢＥ Views', '')).toBe('youtube');
    expect(classifyNetwork('🔥💎Telegram🔥 Members', '')).toBe('telegram');
    expect(classifyNetwork('ᴺᴱᵂ Facebook Likes', '')).toBe('facebook');
  });

  it('« Instant » ne donne pas Instagram', () => {
    expect(classifyNetwork('Instant Followers', 'Provider Services')).toBe('other');
    expect(classifyNetwork('Instant Likes | Fast', '')).toBe('other');
  });

  it('« Instant » dans le nom ne masque pas la catégorie Instagram', () => {
    expect(classifyNetwork('Instant Likes', 'Instagram - Likes')).toBe('instagram');
  });

  it('« Telegram - Post Vote » est telegram', () => {
    expect(classifyNetwork('Telegram - Post Vote', 'Telegram - Poll')).toBe('telegram');
  });

  it('reconnaît X et Twitter, sans confondre le x de « Max » ou « Mix »', () => {
    expect(classifyNetwork('X Followers', '')).toBe('x');
    expect(classifyNetwork('X (Twitter) Views', '')).toBe('x');
    expect(classifyNetwork('Twitter Likes', '')).toBe('x');
    expect(classifyNetwork('Premium Mix Followers Max 5M', 'Provider')).toBe('other');
  });

  it('reconnaît les réseaux rares', () => {
    expect(classifyNetwork('Discord Members', '')).toBe('discord');
    expect(classifyNetwork('SoundCloud Plays', '')).toBe('soundcloud');
    expect(classifyNetwork('Website Traffic Worldwide', '')).toBe('web_traffic');
    expect(classifyNetwork('Twitch Followers', '')).toBe('twitch');
    expect(classifyNetwork('Pinterest Likes', '')).toBe('pinterest');
  });
});

describe('classifyType', () => {
  it('le type fournisseur « Custom Comments » donne comments, même si un autre mot vient avant', () => {
    expect(classifyType('Likes Package Custom Comments', 'Custom Comments')).toBe('comments');
    expect(classifyType('TikTok Custom Comments', 'Custom Comments')).toBe('comments');
  });

  it('le type fournisseur « Comment Likes » donne likes', () => {
    expect(classifyType('Instagram - Comment Likes', 'Comment Likes')).toBe('likes');
    expect(classifyType('Comment Likes', 'Comment Likes')).toBe('likes');
  });

  it('sinon, le premier mot-clé du nom gagne', () => {
    expect(classifyType('YouTube Likes + Views', 'Default')).toBe('likes');
    expect(classifyType('TikTok Views + Likes', 'Default')).toBe('views');
    expect(classifyType('Followers puis Likes', 'Default')).toBe('followers');
  });

  it.each([
    ['Instagram Comments', 'comments'],
    ['Instagram Share', 'shares'],
    ['TikTok Repost', 'shares'],
    ['TikTok Saves', 'shares'],
    ['Telegram Subscribers', 'followers'],
    ['Telegram Members', 'followers'],
    ['Instagram Followers', 'followers'],
    ['Facebook Likes', 'likes'],
    ['Instagram Views', 'views'],
    ['Twitch Watch Time', 'views'],
    ['Spotify Plays', 'views'],
  ])('« %s » -> %s', (name, expected) => {
    expect(classifyType(name, 'Default')).toBe(expected);
  });

  it.each([
    'Telegram Bot Start',
    'Telegram Boost Channel',
    'Worldwide Traffic',
    'Reach and Impressions',
  ])('« %s » -> other', (name) => {
    expect(classifyType(name, 'Default')).toBe('other');
  });

  it('renvoie other pour un nom vide', () => {
    expect(classifyType('', 'Default')).toBe('other');
  });

  it('normalise le Unicode (lettres stylisées, pleine chasse, emoji)', () => {
    expect(classifyType('𝐅𝐨𝐥𝐥𝐨𝐰𝐞𝐫𝐬 🔥', 'Default')).toBe('followers');
    expect(classifyType('ＬＩＫＥＳ ❤️', 'Default')).toBe('likes');
    expect(classifyType('🔥 Ｖｉｅｗｓ', 'Default')).toBe('views');
  });

  it('ignore la casse', () => {
    expect(classifyType('INSTAGRAM FOLLOWERS', 'Default')).toBe('followers');
  });
});
