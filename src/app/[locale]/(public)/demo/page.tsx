import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Timeline } from '@/components/motion/timeline';
import { Reveal } from '@/components/motion/reveal';
import { DemoBasics } from '@/components/shared/demo/demo-basics';
import { DemoHero } from '@/components/shared/demo/demo-hero';
import { DemoStates } from '@/components/shared/demo/demo-states';
import { DemoTrackE } from '@/components/shared/demo/demo-track-e';
import { DemoTrackF } from '@/components/shared/demo/demo-track-f';
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
      <DemoHero />
      <DemoBasics />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle>{t('trackETitle')}</SectionTitle>
        <DemoTrackE />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle>{t('trackFTitle')}</SectionTitle>
        <DemoTrackF />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle>{t('stepsTitle')}</SectionTitle>
        <Timeline data={steps} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle>{t('statesTitle')}</SectionTitle>
        <DemoStates />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle>{t('layoutTitle')}</SectionTitle>
        <p className="text-gris-600 mb-4 text-sm">{t('layoutText')}</p>
        {/* transform : le menu du bas (position fixed) reste dans ce cadre au lieu de coller à l'écran. */}
        <div
          data-testid="demo-layout-preview"
          className="border-gris-200 relative flex h-96 [transform:translateZ(0)] overflow-hidden rounded-xl border"
        >
          <Sidebar />
          <div className="bg-gris-50 flex-1" aria-hidden="true" />
          <BottomNav />
        </div>
      </section>
    </>
  );
}
