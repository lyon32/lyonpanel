import {
  ArrowRight,
  Eye,
  Globe,
  Heart,
  ListChecks,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FaqAccordion } from '@/components/motion/faq-accordion';
import { HoverCards } from '@/components/motion/hover-cards';
import { Marquee } from '@/components/motion/marquee';
import { Reveal } from '@/components/motion/reveal';
import { SpotlightCard } from '@/components/motion/spotlight-card';
import { WordReveal } from '@/components/motion/word-reveal';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

const wrap = 'mx-auto max-w-6xl px-4 py-12 md:py-16';
const h2 = 'text-encre mb-8 text-center text-balance md:mb-12';

// Bandeau des réseaux : défile lentement, en pause au survol.
export async function HomeNetworks() {
  const t = await getTranslations('home');
  // Logos : simple-icons (licence CC0), copiés dans public/brand/networks/.
  const networks = ['tiktok', 'instagram', 'youtube', 'facebook'].map((id) => ({
    id,
    name: { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook' }[
      id
    ],
  }));
  // Quatre réseaux répétés pour que la bande soit plus large que l'écran.
  const items = [...networks, ...networks].map(({ id, name }, i) => (
    <span
      key={i}
      className="border-gris-200 bg-blanc text-encre hover:border-bleu-100 hover:bg-bleu-50 flex min-h-11 items-center gap-2 rounded-xl border py-1.5 pr-4 pl-1.5 text-base font-semibold transition-colors duration-150"
    >
      <span className="bg-bleu-50 flex size-8 items-center justify-center rounded-lg">
        <span
          aria-hidden="true"
          className="bg-bleu-600 size-[18px]"
          style={{
            maskImage: `url(/brand/networks/${id}.svg)`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
          }}
        />
      </span>
      {name}
    </span>
  ));
  return (
    <section className="py-6">
      <Marquee items={items} label={t('networks')} />
    </section>
  );
}

// Trois services : la surbrillance glisse d'une carte à l'autre.
export async function HomeServices() {
  const t = await getTranslations('home');
  const list = [
    { n: 1, Icon: Users },
    { n: 2, Icon: Heart },
    { n: 3, Icon: Eye },
  ] as const;
  return (
    <section className={wrap}>
      <WordReveal text={t('servicesTitle')} className={h2} />
      <HoverCards
        items={list.map(({ n, Icon }) => ({
          id: String(n),
          content: (
            <div className="flex flex-col gap-3">
              <span className="bg-bleu-50 text-bleu-600 flex size-11 items-center justify-center rounded-lg">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3 className="text-encre">{t(`service${n}`)}</h3>
              <p className="text-gris-600 text-base">{t(`service${n}Text`)}</p>
            </div>
          ),
        }))}
      />
    </section>
  );
}

// Atouts en grille « bento » : cartes de tailles différentes, halo qui suit le curseur sur ordinateur.
export async function HomeFeatures() {
  const t = await getTranslations('home');
  const icon = 'bg-bleu-50 text-bleu-600 mb-3 flex size-11 items-center justify-center rounded-lg';
  return (
    <section className={wrap}>
      <WordReveal text={t('featuresTitle')} className={h2} />
      <div className="grid gap-4 md:grid-cols-3">
        <SpotlightCard className="md:col-span-2">
          <span className={icon}>
            <WalletCards size={22} aria-hidden="true" />
          </span>
          <h3 className="text-encre">{t('feat1')}</h3>
          <p className="text-gris-600 mt-1 max-w-md text-base">{t('feat1Text')}</p>
          <div className="bg-gris-50 border-gris-200 mt-4 flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-gris-600 text-sm font-semibold">{t('feat1Balance')}</span>
            <span className="text-encre font-bold tabular-nums" data-no-motion="">
              15 000 XAF
            </span>
          </div>
        </SpotlightCard>
        <SpotlightCard>
          <span className={icon}>
            <Wallet size={22} aria-hidden="true" />
          </span>
          <h3 className="text-encre">{t('feat2')}</h3>
          <p className="text-gris-600 mt-1 text-base">{t('feat2Text')}</p>
        </SpotlightCard>
        <SpotlightCard>
          <span className={icon}>
            <ListChecks size={22} aria-hidden="true" />
          </span>
          <h3 className="text-encre">{t('feat3')}</h3>
          <p className="text-gris-600 mt-1 text-base">{t('feat3Text')}</p>
        </SpotlightCard>
        <SpotlightCard className="md:col-span-2">
          <span className={icon}>
            <Globe size={22} aria-hidden="true" />
          </span>
          <h3 className="text-encre">{t('feat4')}</h3>
          <p className="text-gris-600 mt-1 max-w-md text-base">{t('feat4Text')}</p>
          <div className="mt-4 flex gap-2">
            <Badge>FR</Badge>
            <Badge>EN</Badge>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}

export async function HomeFaq() {
  const t = await getTranslations('home');
  const items = [1, 2, 3].map((n) => ({
    q: t(`faq${n}q` as 'faq1q'),
    a: t(`faq${n}a` as 'faq1a'),
  }));
  return (
    <section className={`${wrap} max-w-3xl`}>
      <WordReveal text={t('faqTitle')} className={h2} />
      <FaqAccordion items={items} />
    </section>
  );
}

// Appel final : un seul bouton, la flèche avance et un fond bleu foncé balaie le bouton au survol.
export async function HomeCta() {
  const t = await getTranslations('home');
  return (
    <section className="bg-bleu-50 px-4 py-12 md:py-16">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <h2 className="text-encre text-balance">{t('ctaTitle')}</h2>
        <Link
          href="/register"
          className="group bg-bleu-600 text-blanc focus-visible:ring-bleu-100 relative inline-flex min-h-12 items-center gap-2 overflow-hidden rounded-lg px-6 text-base font-semibold outline-none focus-visible:ring-4 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <span
            aria-hidden="true"
            className="bg-bleu-700 absolute inset-0 -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0 motion-reduce:transition-none"
          />
          <span className="relative">{t('ctaButton')}</span>
          <ArrowRight
            size={18}
            aria-hidden="true"
            className="relative transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </Link>
      </Reveal>
    </section>
  );
}
