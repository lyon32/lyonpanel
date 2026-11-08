import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { DemoBasics } from '@/components/shared/demo/demo-basics';
import { HomeHero } from '@/components/shared/home-hero';
import {
  HomeCta,
  HomeFaq,
  HomeFeatures,
  HomeNetworks,
  HomeServices,
} from '@/components/shared/home-sections';
import { HomeSteps } from '@/components/shared/home-steps';
import { DemoStates } from '@/components/shared/demo/demo-states';
import { LazyTimeline, LazyTrackE, LazyTrackF } from '@/components/shared/demo/demo-lazy';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';

type Props = { params: Promise<{ locale: string }> };

// Page interne de démonstration : jamais indexée.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'demo' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Reveal>
      <h2 className="text-encre mb-6 text-2xl font-bold">{children}</h2>
    </Reveal>
  );
}

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('demo');

  const steps = [1, 2, 3].map((n) => ({
    title: t(`step${n}` as 'step1'),
    content: <p className="text-gris-600 text-base">{t(`step${n}Text` as 'step1Text')}</p>,
  }));

  return (
    <>
      <HomeHero />
      <HomeNetworks />
      <HomeServices />
      <HomeSteps />
      <HomeFeatures />
      <HomeFaq />
      <HomeCta />
      <DemoBasics />

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <SectionTitle>{t('trackETitle')}</SectionTitle>
        <LazyTrackE />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <SectionTitle>{t('trackFTitle')}</SectionTitle>
        <LazyTrackF />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <SectionTitle>{t('stepsTitle')}</SectionTitle>
        <LazyTimeline data={steps} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <SectionTitle>{t('statesTitle')}</SectionTitle>
        <DemoStates />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <SectionTitle>{t('layoutTitle')}</SectionTitle>
        <p className="text-gris-600 mb-4 text-sm">{t('layoutText')}</p>
        {/* transform : le menu du bas (position fixed) reste dans ce cadre au lieu de coller à l'écran. */}
        <div
          data-testid="demo-layout-preview"
          className="border-gris-200 relative flex h-80 [transform:translateZ(0)] overflow-hidden rounded-xl border md:h-[30rem]"
        >
          <Sidebar />
          <div
            className="bg-gris-50 flex flex-1 flex-col gap-3 p-4 pb-20 md:p-6"
            aria-hidden="true"
          >
            <div className="bg-gris-200 h-6 w-1/3 rounded" />
            <div className="bg-blanc border-gris-200 h-20 rounded-lg border" />
            <div className="bg-blanc border-gris-200 h-20 rounded-lg border" />
          </div>
          <BottomNav />
        </div>
      </section>
    </>
  );
}
