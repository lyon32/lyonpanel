import { ArrowRight, Globe, ListChecks, Wallet, WalletCards } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FaqAccordion } from '@/components/motion/faq-accordion';
import { FeatureTabs } from '@/components/motion/feature-tabs';
import { Marquee } from '@/components/motion/marquee';
import { Reveal } from '@/components/motion/reveal';
import { WordReveal } from '@/components/motion/word-reveal';
import { NetworkLogo } from '@/components/shared/network-logo';
import { NETWORKS } from '@/components/shared/networks';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

const wrap = 'mx-auto max-w-6xl px-4 py-12 md:py-16';
const h2 = 'text-encre mb-8 text-center text-balance md:mb-12';

// Bandeau des réseaux : défile lentement, en pause au survol.
export async function HomeNetworks() {
  const t = await getTranslations('home');
  const items = NETWORKS.map((n) => (
    <span
      key={n.id}
      className="border-gris-200 bg-blanc text-encre hover:border-bleu-100 hover:bg-bleu-50 flex min-h-11 items-center gap-2 rounded-xl border py-1.5 pr-4 pl-1.5 text-base font-semibold transition-colors duration-150"
    >
      <span className="bg-bleu-50 flex size-8 items-center justify-center rounded-lg">
        <NetworkLogo id={n.id} />
      </span>
      {n.name ?? t('webName')}
    </span>
  ));
  return (
    <section className="py-6">
      <Marquee items={items} label={t('networks')} />
    </section>
  );
}

// Une carte par réseau du catalogue : logo, nom, types de services. Ni prix ni nombre de services.
export async function HomeServices() {
  const t = await getTranslations('home');
  return (
    <section className={wrap}>
      <WordReveal text={t('servicesTitle')} className="text-encre mb-3 text-center text-balance" />
      <p className="text-gris-600 mx-auto mb-8 max-w-xl text-center text-base text-pretty md:mb-12">
        {t('servicesIntro')}
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {NETWORKS.map((n) => (
          <li
            key={n.id}
            className="border-gris-200 bg-blanc hover:border-bleu-100 hover:bg-bleu-50 flex flex-col gap-3 rounded-xl border p-4 transition-[background-color,border-color,transform] duration-150 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="bg-bleu-50 flex size-11 items-center justify-center rounded-lg">
              <NetworkLogo id={n.id} size={22} />
            </span>
            <div>
              <h3 className="text-encre text-base md:text-lg">{n.name ?? t('webName')}</h3>
              <p className="text-gris-600 mt-1 text-sm">{t(`nets.${n.id}`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Atouts en onglets : le choix à gauche, le détail à droite (grille 2 x 2 sur téléphone).
export async function HomeFeatures() {
  const t = await getTranslations('home');
  const tabs = [
    {
      id: 'pay',
      Icon: WalletCards,
      title: t('feat1'),
      text: t('feat1Text'),
      extra: (
        <div className="border-gris-200 bg-blanc flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-gris-600 text-sm font-semibold">{t('feat1Balance')}</span>
          <span className="text-encre font-bold tabular-nums" data-no-motion="">
            15 000 XAF
          </span>
        </div>
      ),
    },
    { id: 'balance', Icon: Wallet, title: t('feat2'), text: t('feat2Text') },
    { id: 'tracking', Icon: ListChecks, title: t('feat3'), text: t('feat3Text') },
    {
      id: 'lang',
      Icon: Globe,
      title: t('feat4'),
      text: t('feat4Text'),
      extra: (
        <div className="flex gap-2">
          <Badge>FR</Badge>
          <Badge>EN</Badge>
        </div>
      ),
    },
  ];
  return (
    <section className={wrap}>
      <WordReveal text={t('featuresTitle')} className={h2} />
      <FeatureTabs
        label={t('featuresTitle')}
        tabs={tabs.map(({ Icon, ...tab }) => ({
          ...tab,
          icon: <Icon size={22} aria-hidden="true" />,
        }))}
      />
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
