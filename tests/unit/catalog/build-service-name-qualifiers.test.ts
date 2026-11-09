import { describe, expect, it } from 'vitest';
import { loadProviderFixture } from '../../helpers/provider-fixture';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';
import { buildServiceName } from '@/server/catalog/build-name';
import { networkLabel, typeLabel, type Network, type ServiceType } from '@/server/catalog/labels';

// Signature attendue (src/server/catalog/build-name.ts) :
//   buildServiceName(s: NameableService, locale: 'fr' | 'en'): string
//   NameableService = { id, platform, category, refill, cancel, dripfeed, min_qty, max_qty,
//                       providerName?: string; providerCategory?: string }
// providerName / providerCategory : entrée serveur seulement, jamais renvoyés. Sans eux, le nom reste
// « <Type> <Réseau> · Recharge · Annulable · Goutte-à-goutte #id » (comportement actuel).
//
// Format : <Type> <Réseau> · <qualificatifs> · Recharge · Annulable · Goutte-à-goutte #id
// Qualificatifs, ordre fixe, un seul par famille, 4 au maximum (les premiers dans cet ordre) :
//   1 cible (Story, Reel, Live, Post, Profil, Page)
//   2 qualité (priorité : Réel > Haute qualité > Premium > Mixte > Économique > Organique)
//   3 origine (premier pays/région trouvé ; sinon Mondial pour Worldwide/Global/Mix countries)
//   4 garantie (« Garantie à vie » ou « Garantie N j » / « Lifetime refill » ou « N-day refill »)
//   5 chute (Sans chute > Chute faible)
//   6 départ (Départ instantané / Instant start)
// Le texte est cherché dans providerName ; providerCategory sert seulement d'appoint pour l'origine.
// N vient de « R30 », « Refill: 30 Days », « 30 Days Refill/Guarantee », « 30 Days ♻️ », « Refill 365D ».

interface Golden {
  id: number;
  platform: Network;
  category: ServiceType;
  providerName: string;
  providerCategory: string;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  fr: string;
  en: string;
}

// Vrais noms de la fixture (id < 900000), de l'instantané complet (25685, 27905, 28865, 32912, 35745,
// 35885) et noms courts synthétiques (id >= 900001) pour les mots-clés absents de la fixture.
const GOLDEN: Golden[] = [
  {
    id: 110,
    platform: 'instagram',
    category: 'likes',
    providerName: 'Instagram - Likes | Real | MQ 50K🔝',
    providerCategory: 'Instagram TOP Services [PEAKERR EXCLUSIVE]',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: "J'aime Instagram · Réel · Recharge · Annulable #110",
    en: 'Likes Instagram · Real · Refill · Cancellable #110',
  },
  {
    id: 722,
    platform: 'facebook',
    category: 'likes',
    providerName: 'Facebook - Photo/Post Likes | MQ 10K 🔥🔥🔝',
    providerCategory: 'Instagram - Likes | Refill',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Facebook · Post #722",
    en: 'Likes Facebook · Post #722',
  },
  {
    id: 1324,
    platform: 'youtube',
    category: 'shares',
    providerName: 'Youtube - Shares | MQ 150K | 0-1H | LifeTime Guranteed🔥🔥🔝',
    providerCategory: 'Testing Youtube',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Partages YouTube · Garantie à vie · Annulable #1324',
    en: 'Shares YouTube · Lifetime refill · Cancellable #1324',
  },
  {
    id: 1811,
    platform: 'tiktok',
    category: 'followers',
    providerName: 'TikTok - Followers | MQ 100K | R30 | Recommended 🔥🔥 🔝',
    providerCategory: 'TikTok - Recommended',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés TikTok · Garantie 30 j #1811',
    en: 'Followers TikTok · 30-day refill #1811',
  },
  {
    id: 2423,
    platform: 'instagram',
    category: 'shares',
    providerName: 'Instagram - Share | MQ 50K | R30 | Real 100% | Recommended 🔥🔥',
    providerCategory: 'Instagram - 100% Human',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Partages Instagram · Réel · Garantie 30 j #2423',
    en: 'Shares Instagram · Real · 30-day refill #2423',
  },
  {
    id: 2634,
    platform: 'x',
    category: 'likes',
    providerName: 'Twitter - Likes (Favorite) | MQ 3K | Speed 3K P/H | Instant | Real 🔥🔥🔝',
    providerCategory: 'New Services 2025 ⭐️⭐️⭐️⭐️⭐️',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: "J'aime X · Réel · Départ instantané · Annulable #2634",
    en: 'Likes X · Real · Instant start · Cancellable #2634',
  },
  {
    id: 6811,
    platform: 'facebook',
    category: 'likes',
    providerName:
      'Facebook - Post/Photo Likes | MQ 2M | Speed 10K P/D | Non Drop | Lifetime 🔥🔥🔝',
    providerCategory: 'Instagram - Likes | Refill',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: "J'aime Facebook · Post · Garantie à vie · Sans chute · Annulable #6811",
    en: 'Likes Facebook · Post · Lifetime refill · No drop · Cancellable #6811',
  },
  {
    id: 9116,
    platform: 'web_traffic',
    category: 'other',
    providerName: 'Worldwide - Traffic | MQ 1M | From Social Networks 🔥🔥🔝',
    providerCategory: 'Web - Traffic',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Autres services Trafic web · Mondial · Annulable #9116',
    en: 'Other services Web traffic · Worldwide · Cancellable #9116',
  },
  {
    id: 10714,
    platform: 'x',
    category: 'other',
    providerName:
      'Twitter - Impression | MQ 100M | Instant | Speed 1M P/H | Instant | No Drop | R45 🔥🔥🔝',
    providerCategory: 'Twitter  - Impressions',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Autres services X · Garantie 45 j · Sans chute · Départ instantané #10714',
    en: 'Other services X · 45-day refill · No drop · Instant start #10714',
  },
  {
    id: 13291,
    platform: 'telegram',
    category: 'other',
    providerName: 'Telegram - Post Vote/Poll | MQ 300K | Instant 🔥🔥🔝',
    providerCategory: 'Telegram - Poll',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Autres services Telegram · Post · Départ instantané #13291',
    en: 'Other services Telegram · Post · Instant start #13291',
  },
  {
    id: 13655,
    platform: 'youtube',
    category: 'followers',
    providerName: 'YouTube - Subscriber | MQ 20K | 100% Turkish | Fast 🔥🔥🔝',
    providerCategory: 'YouTube - Subscribers',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés YouTube · Turquie #13655',
    en: 'Followers YouTube · Turkey #13655',
  },
  {
    id: 14453,
    platform: 'telegram',
    category: 'followers',
    providerName: 'Telegram - Members | Mix | MQ 50K | Real | R60 🔥🔥🔝',
    providerCategory: 'Telegram- Members/Followers/Subscribers',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Telegram · Réel · Garantie 60 j · Annulable #14453',
    en: 'Followers Telegram · Real · 60-day refill · Cancellable #14453',
  },
  {
    id: 15223,
    platform: 'youtube',
    category: 'comments',
    providerName: 'Youtube - Comment Likes | MQ 100K | Upvotes | Fast and Instant🔥🔥🔝',
    providerCategory: 'YouTube - Comments',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Commentaires YouTube · Départ instantané · Annulable #15223',
    en: 'Comments YouTube · Instant start · Cancellable #15223',
  },
  {
    id: 15974,
    platform: 'telegram',
    category: 'views',
    providerName: 'Telegram - Post Views | MQ 100K | Any Post | No Drop | Speed 100M P/D 🔝',
    providerCategory: 'Testing Telegram',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues Telegram · Post · Sans chute #15974',
    en: 'Views Telegram · Post · No drop #15974',
  },
  {
    id: 16052,
    platform: 'telegram',
    category: 'shares',
    providerName: 'Telegram - Post Shares | MQ 1M | Real🔥🔥🔝',
    providerCategory: 'New Services 2025 [ February ]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Partages Telegram · Post · Réel #16052',
    en: 'Shares Telegram · Post · Real #16052',
  },
  {
    id: 16611,
    platform: 'facebook',
    category: 'views',
    providerName: 'Facebook - Video/Reel Views | MQ 10M | Monetizable | Emergency 🔥🔥🔝',
    providerCategory: 'Facebook - Views',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues Facebook · Reel #16611',
    en: 'Views Facebook · Reel #16611',
  },
  {
    id: 17974,
    platform: 'facebook',
    category: 'likes',
    providerName:
      'Facebook - Emoticons Post Likes | Love | MQ 100K | 100% Real | Instant | Speed 100K/D | R30🔥🔥🔝',
    providerCategory: 'Instagram - Likes | Refill',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Facebook · Post · Réel · Garantie 30 j · Départ instantané #17974",
    en: 'Likes Facebook · Post · Real · 30-day refill · Instant start #17974',
  },
  {
    id: 18141,
    platform: 'telegram',
    category: 'views',
    providerName:
      'Telegram - Auto View From Search + Statistic | Indian | MQ 100K | Real view to improve search position 🔥🔥🔝',
    providerCategory: 'Telegram - Views',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Vues Telegram · Réel · Inde · Annulable #18141',
    en: 'Views Telegram · Real · India · Cancellable #18141',
  },
  {
    id: 18517,
    platform: 'facebook',
    category: 'likes',
    providerName: 'Facebook - Post Likes | MQ 100K | Cheapest | Instant | Speed: 20K/Day 🔥🔥🔝',
    providerCategory: 'Instagram - Likes | Refill',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Facebook · Post · Économique · Départ instantané #18517",
    en: 'Likes Facebook · Post · Budget · Instant start #18517',
  },
  {
    id: 18706,
    platform: 'whatsapp',
    category: 'followers',
    providerName:
      'Whatsapp - Global Channel Member | MQ 1K | 100% Real HQ Premium | No Drop | Speed 1K P/D🔥🔥🔝',
    providerCategory: 'Whatsapp',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés WhatsApp · Réel · Mondial · Sans chute #18706',
    en: 'Followers WhatsApp · Real · Worldwide · No drop #18706',
  },
  {
    id: 19353,
    platform: 'youtube',
    category: 'comments',
    providerName: 'YouTube - Video Custom Comments | Real | 10K / Day | Non Drop |  R30 🔝',
    providerCategory: 'YouTube - Custom Comments',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Commentaires YouTube · Réel · Garantie 30 j · Sans chute #19353',
    en: 'Comments YouTube · Real · 30-day refill · No drop #19353',
  },
  {
    id: 19883,
    platform: 'instagram',
    category: 'likes',
    providerName: 'Instagram - Likes | USA | MQ 15K | Real | Instant 🔝',
    providerCategory: 'Instagram TOP Services [PEAKERR EXCLUSIVE]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Instagram · Réel · États-Unis · Départ instantané #19883",
    en: 'Likes Instagram · Real · USA · Instant start #19883',
  },
  {
    id: 19919,
    platform: 'instagram',
    category: 'likes',
    providerName: 'Instagram - Likes | India | MQ 10K | Real | Instant',
    providerCategory: 'Instagram TOP Services [PEAKERR EXCLUSIVE]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Instagram · Réel · Inde · Départ instantané #19919",
    en: 'Likes Instagram · Real · India · Instant start #19919',
  },
  {
    id: 19949,
    platform: 'youtube',
    category: 'comments',
    providerName: 'YouTube - Custom Comments | MQ 50K | Non Drop | Instant | Lifetime🔝',
    providerCategory: 'YouTube - Custom Comments',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Commentaires YouTube · Garantie à vie · Sans chute · Départ instantané #19949',
    en: 'Comments YouTube · Lifetime refill · No drop · Instant start #19949',
  },
  {
    id: 20894,
    platform: 'x',
    category: 'views',
    providerName: 'Twitter - Views | USA | MQ 5M',
    providerCategory: 'Twitter - Views',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues X · États-Unis #20894',
    en: 'Views X · USA #20894',
  },
  {
    id: 20902,
    platform: 'x',
    category: 'other',
    providerName: 'Twitter - Organic Impressions | MQ 5M | Bundle | New🔝',
    providerCategory: 'Twitter - Others',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Autres services X · Organique #20902',
    en: 'Other services X · Organic #20902',
  },
  {
    id: 21850,
    platform: 'twitch',
    category: 'views',
    providerName:
      'Twitch - Live Stream Views | MQ 1K | 60 Minutes | 100% Concurrent | Instant Start 🔝',
    providerCategory: 'Twitch - Live Stream Views',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues Twitch · Live · Départ instantané #21850',
    en: 'Views Twitch · Live · Instant start #21850',
  },
  {
    id: 22362,
    platform: 'telegram',
    category: 'other',
    providerName: 'Telegram - Bot Start | India | MQ 100K | Accept Referral Code',
    providerCategory: 'Telegram Start Bot [SV1]',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Autres services Telegram · Inde · Annulable #22362',
    en: 'Other services Telegram · India · Cancellable #22362',
  },
  {
    id: 27732,
    platform: 'tiktok',
    category: 'views',
    providerName: 'TikTok Live Stream Viewers [120 Mins]',
    providerCategory: 'TikTok Live Stream Views [Working Good - Latest]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues TikTok · Live #27732',
    en: 'Views TikTok · Live #27732',
  },
  {
    id: 27906,
    platform: 'youtube',
    category: 'views',
    providerName: 'YouTube Views [Non Drop] [Speed: 2K/Day] [Lifetime Refill] ✅ VIP',
    providerCategory: 'YouTube Views | Best services',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Vues YouTube · Premium · Garantie à vie · Sans chute · Recharge #27906',
    en: 'Views YouTube · Premium · Lifetime refill · No drop · Refill #27906',
  },
  {
    id: 27955,
    platform: 'tiktok',
    category: 'other',
    providerName: 'Tiktok PK Battle Points [ Max 5K ] | Non Drop | Instant Start 🚀',
    providerCategory: 'Tiktok Services [ Cheapest 💥] ᴺᴱᵂ',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Autres services TikTok · Sans chute · Départ instantané #27955',
    en: 'Other services TikTok · No drop · Instant start #27955',
  },
  {
    id: 27956,
    platform: 'tiktok',
    category: 'likes',
    providerName:
      'Tiktok Comment Likes [ Max 100K ] | Cancel Enable | 30 Days ♻️ | Instant Start | Day 50K',
    providerCategory: 'Tiktok Services [ Cheapest 💥] ᴺᴱᵂ',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: "J'aime TikTok · Garantie 30 j · Départ instantané · Recharge · Annulable #27956",
    en: 'Likes TikTok · 30-day refill · Instant start · Refill · Cancellable #27956',
  },
  {
    id: 28717,
    platform: 'youtube',
    category: 'followers',
    providerName:
      'Youtube Subscriber USA 🇺🇸 | Speed 15000-20000+/day | Refill: 30 Days | 100% Real - Non Drop - NEW',
    providerCategory: 'Youtube Subscriber [ New ] Best Price',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés YouTube · Réel · États-Unis · Garantie 30 j · Sans chute #28717',
    en: 'Followers YouTube · Real · USA · 30-day refill · No drop #28717',
  },
  {
    id: 29311,
    platform: 'tiktok',
    category: 'likes',
    providerName: 'Tiktok Likes [ Super Fast ] [ Mixed Quanlity ]',
    providerCategory: '➡️ Tik Tok Likes',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: "J'aime TikTok · Mixte · Annulable #29311",
    en: 'Likes TikTok · Mixed · Cancellable #29311',
  },
  {
    id: 29449,
    platform: 'facebook',
    category: 'views',
    providerName:
      'Facebook Views [ Video / Reels ] [ Max Unlimited ] | Drop 0% | Lifetime ♻️ | Instant Start | Day 30K',
    providerCategory: 'Facebook Views [ Cheapest Price ]',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Vues Facebook · Reel · Garantie à vie · Sans chute · Départ instantané · Annulable #29449',
    en: 'Views Facebook · Reel · Lifetime refill · No drop · Instant start · Cancellable #29449',
  },
  {
    id: 29557,
    platform: 'threads',
    category: 'followers',
    providerName:
      'Threads Organic Followers [ Max 50K ] | HQ Accounts | Low Drop | No Refill ⚠️ | Start Time:0-2 Hr | Day 250-500 🚀',
    providerCategory: 'Threads Services [ MAİN PROVİDER ]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Threads · Haute qualité · Chute faible #29557',
    en: 'Followers Threads · High quality · Low drop #29557',
  },
  {
    id: 29578,
    platform: 'facebook',
    category: 'likes',
    providerName:
      'Facebook Post Likes [ Max 1M ] | HQ Accounts | Cancel Enable | Low Drop | 30 Days ♻️ | Instant Start | Day 100K 🚀',
    providerCategory: 'Facebook Post Likes [ Low Drops ]  [ Provider 🚀 ] ᴺᴱᵂ',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: "J'aime Facebook · Post · Haute qualité · Garantie 30 j · Chute faible · Recharge · Annulable #29578",
    en: 'Likes Facebook · Post · High quality · 30-day refill · Low drop · Refill · Cancellable #29578',
  },
  {
    id: 29612,
    platform: 'instagram',
    category: 'likes',
    providerName:
      'Instagram Likes + Impression [ English Names ] [ Max 20K ] | 100% Old Accounts | Insights USA 🇺🇸 | Non Drop | Cancel Enable | No Refill ⚠️ | Instant Start | Day 20K 🚀',
    providerCategory: 'Instagram Likes [ English Names - USA Insights ] 100% Provider ᴺᴱᵂ',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: "J'aime Instagram · États-Unis · Sans chute · Départ instantané · Annulable #29612",
    en: 'Likes Instagram · USA · No drop · Instant start · Cancellable #29612',
  },
  {
    id: 29622,
    platform: 'facebook',
    category: 'comments',
    providerName:
      'Facebook Comments [ Custom ] [ Max 500K ] | HQ Accounts | Drop 0% | No Refill ⚠️ | Instant Start | Day 2K 🚀',
    providerCategory: 'Facebook Comments [ High Quality ] ᴺᴱᵂ',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Commentaires Facebook · Haute qualité · Sans chute · Départ instantané · Annulable #29622',
    en: 'Comments Facebook · High quality · No drop · Instant start · Cancellable #29622',
  },
  {
    id: 29792,
    platform: 'youtube',
    category: 'comments',
    providerName:
      'YouTube Video/Shorts Comments Created by AI [ Max 10K ] | 100% Real Accounts | Auto-Generate Comments Based on Video Content | Non Drop | 365 Days ♻️| Instant Start | Day 10K 🚀',
    providerCategory: 'YouTube Video/Shorts Comments Created by AI 🤖 ᴺᴱᵂ',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Commentaires YouTube · Réel · Garantie 365 j · Sans chute · Départ instantané · Recharge #29792',
    en: 'Comments YouTube · Real · 365-day refill · No drop · Instant start · Refill #29792',
  },
  {
    id: 30211,
    platform: 'youtube',
    category: 'followers',
    providerName: 'Youtube Subscribe [100K] [7 Day Refill] [Instant Superfast]',
    providerCategory: 'Youtube Subscribe',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés YouTube · Garantie 7 j · Départ instantané · Annulable #30211',
    en: 'Followers YouTube · 7-day refill · Instant start · Cancellable #30211',
  },
  {
    id: 30645,
    platform: 'instagram',
    category: 'followers',
    providerName: '[App Real SaudiArabia ][Mix] İnstagram Followers 1000',
    providerCategory: 'ᴺᴱᵂ🏷️🇸🇦-Saudi Arabia Instagram Followers [Mix] (Always Stable)',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Réel · Pays arabes · Annulable #30645',
    en: 'Followers Instagram · Real · Arab countries · Cancellable #30645',
  },
  {
    id: 31245,
    platform: 'instagram',
    category: 'followers',
    providerName:
      'Instagram Followers [ Max 100K ] | 100% Real Accounts | Cancel Enable | Low Drop | No Refill ⚠️ | Instant Start | Day 50K 🚀 ᴺᴱᵂ',
    providerCategory: 'Instagram Followers [ Best Price ] ᴺᴱᵂ',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Réel · Chute faible · Départ instantané · Annulable #31245',
    en: 'Followers Instagram · Real · Low drop · Instant start · Cancellable #31245',
  },
  {
    id: 31365,
    platform: 'facebook',
    category: 'other',
    providerName:
      'Facebook Post Reactions [ Angry 😡 ] [ Max 500K ] | HQ Accounts | No Refill ⚠️ | Instant Start | Day 50K 🚀',
    providerCategory: 'Facebook Post Reactions [ Best Price 🚀 ] ᴺᴱᵂ',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Autres services Facebook · Post · Haute qualité · Départ instantané #31365',
    en: 'Other services Facebook · Post · High quality · Instant start #31365',
  },
  {
    id: 31552,
    platform: 'kick',
    category: 'followers',
    providerName: 'Kick Followers | Global Users | ♻️ 30 Days Refill |',
    providerCategory: 'Kick ➜ Followers',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Kick · Mondial · Garantie 30 j #31552',
    en: 'Followers Kick · Worldwide · 30-day refill #31552',
  },
  {
    id: 31581,
    platform: 'telegram',
    category: 'followers',
    providerName: '🔥Telegram Members | Real Accounts | 𝟗𝟎 𝐃𝐚𝐲𝐬 𝐑𝐞𝐟𝐢𝐥𝐥 ♻️',
    providerCategory: 'Telegram ➜ Members',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Telegram · Réel · Garantie 90 j · Annulable #31581',
    en: 'Followers Telegram · Real · 90-day refill · Cancellable #31581',
  },
  {
    id: 31582,
    platform: 'telegram',
    category: 'followers',
    providerName: '🔥Telegram Members | Real Accounts | 𝟏𝟖𝟎 𝐃𝐚𝐲𝐬 𝐑𝐞𝐟𝐢𝐥𝐥 ♻️',
    providerCategory: 'Telegram ➜ Members',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Telegram · Réel · Garantie 180 j · Annulable #31582',
    en: 'Followers Telegram · Real · 180-day refill · Cancellable #31582',
  },
  {
    id: 31589,
    platform: 'telegram',
    category: 'followers',
    providerName: '💎 Telegram Premium Members + Online | ♻️ 30 Days Guarantee | 🔥 𝐅𝐀𝐒𝐓',
    providerCategory: 'Telegram ➜ Premium Members',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Telegram · Premium · Garantie 30 j · Annulable #31589',
    en: 'Followers Telegram · Premium · 30-day refill · Cancellable #31589',
  },
  {
    id: 31594,
    platform: 'telegram',
    category: 'other',
    providerName: '💎 Telegram Bot Start | ♻️ 10 Days Guarantee + Event | 🔥 𝐅𝐀𝐒𝐓',
    providerCategory: 'Telegram ➜ Premium Bot',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Autres services Telegram · Garantie 10 j · Annulable #31594',
    en: 'Other services Telegram · 10-day refill · Cancellable #31594',
  },
  {
    id: 32092,
    platform: 'facebook',
    category: 'followers',
    providerName: 'Facebook Followers | Low Drop | Day 20K | No Refill',
    providerCategory: 'Facebook Followers [Cheapest]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Facebook · Chute faible #32092',
    en: 'Followers Facebook · Low drop #32092',
  },
  {
    id: 32110,
    platform: 'facebook',
    category: 'shares',
    providerName:
      'Facebook Post Shares [English Names] [Cancel Enabled Working] [High Quality] [30 Days Refill] [30K] [Instant]',
    providerCategory: 'Facebook USA Insights All Countries [Provider] [Best Working USA Service]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Partages Facebook · Post · Haute qualité · États-Unis · Garantie 30 j #32110',
    en: 'Shares Facebook · Post · High quality · USA · 30-day refill #32110',
  },
  {
    id: 33413,
    platform: 'linkedin',
    category: 'followers',
    providerName:
      'LinkedIn Profile / Company Followers [No Drop So Far] [30 Days Refill] [5-10K/D] [Instant]',
    providerCategory: 'Linkedin Followers [No Drop So Far]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés LinkedIn · Profil · Garantie 30 j · Sans chute · Départ instantané #33413',
    en: 'Followers LinkedIn · Profile · 30-day refill · No drop · Instant start #33413',
  },
  {
    id: 33607,
    platform: 'x',
    category: 'followers',
    providerName:
      'Twitter Followers [No Drop So Far] [Refill: 15 Days Working Button] [50K/D] [Instant]',
    providerCategory: 'Twitter Followers [No Drop So Far]',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés X · Garantie 15 j · Sans chute · Départ instantané · Annulable #33607',
    en: 'Followers X · 15-day refill · No drop · Instant start · Cancellable #33607',
  },
  {
    id: 36629,
    platform: 'instagram',
    category: 'followers',
    providerName:
      'Instagram Channel Member | Global 🌎 | [ Max 100K ] | HQ Real | Instant 𝟭 𝗠𝗶𝗻𝘂𝘁𝗲𝘀 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗲𝗱',
    providerCategory: 'Instagram Channel Member [Country Targeted]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Instagram · Réel · Mondial · Départ instantané #36629',
    en: 'Followers Instagram · Real · Worldwide · Instant start #36629',
  },
  {
    id: 36783,
    platform: 'tiktok',
    category: 'likes',
    providerName:
      'TikTok Likes [ Max 5M ] | Hidden Account | Cancel Enable | 60 Days ♻️ | Instant Start | Day 50K 🚀',
    providerCategory: 'TikTok Likes [ Hidden Account ] ᴺᴱᵂ ✨',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: "J'aime TikTok · Garantie 60 j · Départ instantané · Recharge · Annulable #36783",
    en: 'Likes TikTok · 60-day refill · Instant start · Refill · Cancellable #36783',
  },
  {
    id: 35885,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram USA Followers [Insights USA] [With Stories] [5-10K/D] [Instant] ',
    providerCategory: 'Instagram USA',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Story · États-Unis · Départ instantané · Annulable #35885',
    en: 'Followers Instagram · Story · USA · Instant start · Cancellable #35885',
  },
  {
    id: 25685,
    platform: 'tiktok',
    category: 'likes',
    providerName:
      'TikTok - Likes | Nigeria | MQ 500K | Super Instant | Speed: 10K/Day | Quality High | R365',
    providerCategory: 'Tiktok Likes [ Targeted ] [ Guaranteedd ]',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: "J'aime TikTok · Nigeria · Garantie 365 j · Départ instantané · Annulable #25685",
    en: 'Likes TikTok · Nigeria · 365-day refill · Instant start · Cancellable #25685',
  },
  {
    id: 28865,
    platform: 'telegram',
    category: 'followers',
    providerName:
      'Telegram Members [ Instant start ] 100k/day Speed [ Max 500k ] Refill 365 days ♻️ - Non Drop',
    providerCategory: 'Telegram Members [ Non Drop Working ]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Telegram · Garantie 365 j · Sans chute · Départ instantané #28865',
    en: 'Followers Telegram · 365-day refill · No drop · Instant start #28865',
  },
  {
    id: 32912,
    platform: 'youtube',
    category: 'likes',
    providerName: 'Youtube Likes [ High Base ] [ 0% Drop ] [ Instant start ] [ lifetime Refill ]',
    providerCategory: 'YouTube - Likes',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: "J'aime YouTube · Garantie à vie · Sans chute · Départ instantané · Recharge #32912",
    en: 'Likes YouTube · Lifetime refill · No drop · Instant start · Refill #32912',
  },
  {
    id: 27905,
    platform: 'youtube',
    category: 'followers',
    providerName:
      'YouTube Subscribers [👤 Real] [Non Drop] [Speed: 2500/Day] [Lifetime Refill] ✅ VIP',
    providerCategory: 'YouTube Subscribers | Best services',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés YouTube · Réel · Garantie à vie · Sans chute · Recharge #27905',
    en: 'Followers YouTube · Real · Lifetime refill · No drop · Refill #27905',
  },
  {
    id: 35745,
    platform: 'instagram',
    category: 'likes',
    providerName:
      'Instagram Brazil Female Likes FAST [30 Days Refill] [Cancel Enabled] [5-20K/D] [0-1/H]',
    providerCategory: 'Instagram Brazil [Latest New Servces]',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Instagram · Brésil · Garantie 30 j #35745",
    en: 'Likes Instagram · Brazil · 30-day refill #35745',
  },
  {
    id: 900001,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers [Africa] [Real] [Instant]',
    providerCategory: 'Instagram Followers',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Réel · Afrique · Départ instantané · Recharge · Annulable #900001',
    en: 'Followers Instagram · Real · Africa · Instant start · Refill · Cancellable #900001',
  },
  {
    id: 900002,
    platform: 'tiktok',
    category: 'views',
    providerName: 'TikTok Views Cameroon Real Forever Guarantee',
    providerCategory: 'TikTok',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues TikTok · Réel · Cameroun · Garantie à vie #900002',
    en: 'Views TikTok · Real · Cameroon · Lifetime refill #900002',
  },
  {
    id: 900003,
    platform: 'instagram',
    category: 'likes',
    providerName: 'Instagram Likes Ivory Coast Mix',
    providerCategory: 'Instagram Likes',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: "J'aime Instagram · Mixte · Côte d'Ivoire · Recharge #900003",
    en: 'Likes Instagram · Mixed · Ivory Coast · Refill #900003',
  },
  {
    id: 900004,
    platform: 'facebook',
    category: 'followers',
    providerName: 'Facebook Page Followers Egypt Premium',
    providerCategory: 'Facebook',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Facebook · Page · Premium · Égypte · Annulable #900004',
    en: 'Followers Facebook · Page · Premium · Egypt · Cancellable #900004',
  },
  {
    id: 900005,
    platform: 'instagram',
    category: 'views',
    providerName: 'Instagram Story Views VIP Ghana',
    providerCategory: 'Instagram',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Vues Instagram · Story · Premium · Ghana · Recharge #900005',
    en: 'Views Instagram · Story · Premium · Ghana · Refill #900005',
  },
  {
    id: 900006,
    platform: 'tiktok',
    category: 'likes',
    providerName: 'TikTok Likes Kenya Bot Cheap',
    providerCategory: 'TikTok',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: "J'aime TikTok · Économique · Kenya #900006",
    en: 'Likes TikTok · Budget · Kenya #900006',
  },
  {
    id: 900007,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers South Africa HQ Refill 365D',
    providerCategory: 'Instagram',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Haute qualité · Afrique du Sud · Garantie 365 j · Recharge · Annulable #900007',
    en: 'Followers Instagram · High quality · South Africa · 365-day refill · Refill · Cancellable #900007',
  },
  {
    id: 900008,
    platform: 'youtube',
    category: 'views',
    providerName: 'YouTube Views Morocco Lifetime Refill 0% Drop',
    providerCategory: 'YouTube',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Vues YouTube · Maroc · Garantie à vie · Sans chute #900008',
    en: 'Views YouTube · Morocco · Lifetime refill · No drop #900008',
  },
  {
    id: 900009,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers Europe No Refill',
    providerCategory: 'Instagram',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Instagram · Europe · Recharge #900009',
    en: 'Followers Instagram · Europe · Refill #900009',
  },
  {
    id: 900010,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers UK Non Drop',
    providerCategory: 'Instagram',
    refill: false,
    cancel: true,
    dripfeed: false,
    fr: 'Abonnés Instagram · Royaume-Uni · Sans chute · Annulable #900010',
    en: 'Followers Instagram · UK · No drop · Cancellable #900010',
  },
  {
    id: 900011,
    platform: 'tiktok',
    category: 'followers',
    providerName: 'TikTok Followers Brazil Low Drop',
    providerCategory: 'TikTok',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés TikTok · Brésil · Chute faible · Recharge #900011',
    en: 'Followers TikTok · Brazil · Low drop · Refill #900011',
  },
  {
    id: 900012,
    platform: 'tiktok',
    category: 'followers',
    providerName: 'TikTok Followers Worldwide Mixed',
    providerCategory: 'TikTok',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés TikTok · Mixte · Mondial #900012',
    en: 'Followers TikTok · Mixed · Worldwide #900012',
  },
  {
    id: 900013,
    platform: 'instagram',
    category: 'views',
    providerName: 'Instagram Reels Views Middle East',
    providerCategory: 'Instagram',
    refill: true,
    cancel: true,
    dripfeed: false,
    fr: 'Vues Instagram · Reel · Pays arabes · Recharge · Annulable #900013',
    en: 'Views Instagram · Reel · Arab countries · Refill · Cancellable #900013',
  },
  {
    id: 900014,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers Nigeria Organic',
    providerCategory: 'Instagram',
    refill: false,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Instagram · Organique · Nigeria #900014',
    en: 'Followers Instagram · Organic · Nigeria #900014',
  },
  {
    id: 900015,
    platform: 'instagram',
    category: 'followers',
    providerName: 'Instagram Followers Instant Start',
    providerCategory: 'Instagram',
    refill: true,
    cancel: false,
    dripfeed: false,
    fr: 'Abonnés Instagram · Départ instantané · Recharge #900015',
    en: 'Followers Instagram · Instant start · Refill #900015',
  },
];

function nameable(g: Golden) {
  return {
    id: g.id,
    platform: g.platform,
    category: g.category,
    refill: g.refill,
    cancel: g.cancel,
    dripfeed: g.dripfeed,
    min_qty: 10,
    max_qty: 100000,
    providerName: g.providerName,
    providerCategory: g.providerCategory,
  };
}

describe('buildServiceName : qualificatifs extraits du nom fournisseur (cas dorés)', () => {
  it('compte au moins 40 cas dorés', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(40);
  });

  it.each(GOLDEN)('service $id en français', (g) => {
    expect(buildServiceName(nameable(g), 'fr')).toBe(g.fr);
  });

  it.each(GOLDEN)('service $id en anglais', (g) => {
    expect(buildServiceName(nameable(g), 'en')).toBe(g.en);
  });
});

describe('buildServiceName : providerName / providerCategory facultatifs', () => {
  const g = GOLDEN.find((x) => x.id === 31581)!;
  const full = nameable(g);
  const bare = {
    id: full.id,
    platform: full.platform,
    category: full.category,
    dripfeed: full.dripfeed,
    min_qty: full.min_qty,
    max_qty: full.max_qty,
    refill: true,
    cancel: true,
  };

  it('sans providerName ni providerCategory, le nom ne contient aucun qualificatif', () => {
    expect(buildServiceName(bare, 'fr')).toBe('Abonnés Telegram · Recharge · Annulable #31581');
    expect(buildServiceName(bare, 'en')).toBe('Followers Telegram · Refill · Cancellable #31581');
  });

  it('un nom fournisseur sans mot-clé connu ne change rien au nom', () => {
    const unknown = { ...bare, providerName: 'Zorglub Quux', providerCategory: 'Blorp' };
    expect(buildServiceName(unknown, 'fr')).toBe(buildServiceName(bare, 'fr'));
    expect(buildServiceName(unknown, 'en')).toBe(buildServiceName(bare, 'en'));
  });

  it('est déterministe avec des qualificatifs', () => {
    expect(buildServiceName(nameable(g), 'fr')).toBe(buildServiceName({ ...nameable(g) }, 'fr'));
  });

  it('ne reprend jamais un mot inconnu du nom fournisseur', () => {
    const name = buildServiceName(
      { ...bare, providerName: 'Telegram Members Real SecretNom Zorglub 30 Days Refill' },
      'fr',
    );
    expect(name).not.toMatch(/secretnom|zorglub/i);
    expect(name).toContain('Réel');
    expect(name).toContain('Garantie 30 j');
  });

  it('« No Refill » ne produit aucune garantie', () => {
    const name = buildServiceName({ ...bare, providerName: 'Telegram Members | No Refill' }, 'fr');
    expect(name).not.toMatch(/garantie/i);
  });
});

describe('buildServiceName : distinction et propreté sur la fixture réelle', () => {
  const all = loadProviderFixture();
  const toNameable = (s: (typeof all)[number]) => ({
    id: s.service,
    platform: classifyNetwork(s.name, s.category),
    category: classifyType(s.name, s.type),
    refill: s.refill,
    cancel: s.cancel,
    dripfeed: s.dripfeed,
    min_qty: Number(s.min),
    max_qty: Number(s.max),
    providerName: s.name,
    providerCategory: s.category,
  });
  const head = (name: string) => name.replace(/\s*#\d+$/, '');

  // Mesuré avec une implémentation de contrôle : 128 noms distincts sur 148 (86 %). Seuil : 80 %.
  it.each(['fr', 'en'] as const)(
    'donne au moins 80 % de noms distincts avant « #id » (%s)',
    (locale) => {
      const distinct = new Set(all.map((s) => head(buildServiceName(toNameable(s), locale))));
      expect(distinct.size).toBeGreaterThanOrEqual(Math.ceil(all.length * 0.8));
    },
  );

  it('invariants de propreté sur chaque service (fr et en)', () => {
    for (const s of all) {
      for (const locale of ['fr', 'en'] as const) {
        const name = buildServiceName(toNameable(s), locale);
        const label = `service ${s.service} (${locale}) : ${name}`;
        expect(name, label).not.toMatch(/peakerr|justanotherpanel|\bjap\b|provider|fournisseur/i);
        expect(name, label).not.toMatch(/[[\]|]|\$|&amp;|max\s*:|min\s*:|\bmq\b|https?|www\./i);
        expect(name, label).not.toMatch(/\d+(\.\d+)?\s*(\$|usd|xaf|fcfa)|(\$|usd)\s*\d/i);
        expect(name, label).not.toMatch(
          /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1D400}-\u{1D7FF}]|️/u,
        );
        expect(name, label).toMatch(new RegExp(`#${s.service}$`));
        const prefix = `${typeLabel(classifyType(s.name, s.type), locale)} ${networkLabel(classifyNetwork(s.name, s.category), locale)}`;
        expect(name.startsWith(prefix), label).toBe(true);
        // Lisible sur mobile : mesuré 92 au maximum avec 4 qualificatifs au plus.
        expect(head(name).length, label).toBeLessThanOrEqual(95);
        // « Type Réseau » + 4 qualificatifs + 3 options au maximum.
        expect(name.split(' · ').length, label).toBeLessThanOrEqual(8);
      }
    }
  });

  it('ne reprend aucun mot brut du texte fournisseur', () => {
    const RAW =
      /speed|recommended|gurant|emergency|monetiz|cheapest|working|retention|concurrent|stable|super|fast|exclusive|testing|\bbest\b|button|enable/i;
    for (const s of all) {
      for (const locale of ['fr', 'en'] as const) {
        const name = buildServiceName(toNameable(s), locale);
        expect(name, `service ${s.service} (${locale}) : ${name}`).not.toMatch(RAW);
      }
    }
  });

  it('donne un nom français différent du nom anglais pour chaque service', () => {
    for (const s of all) {
      expect(buildServiceName(toNameable(s), 'fr')).not.toBe(buildServiceName(toNameable(s), 'en'));
    }
  });
});
