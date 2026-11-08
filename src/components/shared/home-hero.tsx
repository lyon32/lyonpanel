import { CheckCircle2, Clock, LayoutDashboard, ListOrdered, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { DotBackground } from '@/components/motion/dot-background';
import { HeroStage } from '@/components/motion/hero-stage';
import { FloatingCards } from '@/components/motion/floating-cards';
import { HeroCtas } from '@/components/shared/hero-ctas';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type T = Awaited<ReturnType<typeof getTranslations<'home'>>>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-gris-600 text-xs font-semibold">{label}</span>
      <span className="border-gris-200 bg-blanc text-encre truncate rounded-lg border px-3 py-2 text-sm">
        {value}
      </span>
    </div>
  );
}

// Maquette du vrai panel en HTML/CSS (aucune image) : décorative, donc cachée aux lecteurs d'écran.
function PanelMockup({ t }: { t: T }) {
  return (
    <div
      aria-hidden="true"
      className="border-gris-200 bg-blanc flex overflow-hidden rounded-xl border shadow-xl"
    >
      <div className="border-gris-200 bg-gris-50 hidden w-14 flex-col items-center gap-4 border-r py-4 sm:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/02-icone.svg" alt="" className="size-8" />
        <LayoutDashboard size={20} className="text-bleu-600" />
        <ListOrdered size={20} className="text-gris-600" />
        <Wallet size={20} className="text-gris-600" />
      </div>
      <div className="bg-gris-50 flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-encre text-sm font-bold">{t('mockPlace')}</span>
          <Badge>{t('example')}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border-gris-200 bg-blanc rounded-lg border p-3">
            <p className="text-gris-600 text-xs font-semibold">{t('mockBalance')}</p>
            <p className="text-encre text-base font-bold tabular-nums sm:text-xl">10 000 XAF</p>
          </div>
          <div className="border-gris-200 bg-blanc rounded-lg border p-3">
            <p className="text-gris-600 text-xs font-semibold">{t('mockOrders')}</p>
            <p className="text-encre text-base font-bold tabular-nums sm:text-xl">12</p>
          </div>
        </div>
        <div className="border-gris-200 bg-blanc flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('mockCategory')} value={t('mockCategoryValue')} />
            <Field label={t('mockService')} value={t('mockServiceValue')} />
          </div>
          <Field label={t('mockLink')} value={t('mockLinkValue')} />
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field label={t('mockQuantity')} value="1 000" />
            </div>
            <div className="text-right">
              <p className="text-gris-600 text-xs font-semibold">{t('mockTotal')}</p>
              <p className="text-encre text-base font-bold tabular-nums">2 500 XAF</p>
            </div>
          </div>
          <span className="bg-bleu-600 text-blanc flex h-10 items-center justify-center rounded-lg text-sm font-semibold">
            {t('mockOrderBtn')}
          </span>
        </div>
      </div>
    </div>
  );
}

function miniCard(
  id: string,
  Icon: typeof Clock,
  title: string,
  value: string,
  tone: string,
  hideOnPhone: boolean,
) {
  return {
    id,
    content: (
      <Card
        className={`items-center gap-3 p-3 shadow-md ${hideOnPhone ? 'hidden xl:flex' : 'flex'}`}
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-gris-600 text-xs font-semibold">{title}</p>
          <p className="text-encre text-sm font-bold" data-no-motion="">
            {value}
          </p>
        </div>
      </Card>
    ),
  };
}

// Héros d'accueil : titre, deux boutons, grande maquette du panel, cartes qui flottent.
export async function HomeHero() {
  const t = await getTranslations('home');

  const left = [
    miniCard(
      'done',
      CheckCircle2,
      t('cardDone'),
      t('cardDoneValue'),
      'bg-succes-fond text-succes',
      false,
    ),
    miniCard('balance', Wallet, t('cardBalance'), '15 000 XAF', 'bg-bleu-50 text-bleu-600', true),
  ];
  const right = [
    miniCard(
      'recharge',
      Wallet,
      t('cardRecharge'),
      t('cardRechargeValue'),
      'bg-bleu-50 text-bleu-600',
      false,
    ),
    miniCard(
      'running',
      Clock,
      t('cardRunning'),
      t('cardRunningValue'),
      'bg-jaune-50 text-jaune-700',
      true,
    ),
  ];

  return (
    <DotBackground>
      <HeroStage>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-10 pb-12 text-center md:pt-16 md:pb-16">
          {/* Pas de Reveal : le titre est le LCP, visible dès le HTML. */}
          <h1 className="text-encre max-w-3xl text-3xl font-bold text-balance md:text-5xl">
            {t.rich('heroTitle', {
              accent: (chunks) => (
                <span className="decoration-jaune-500 underline decoration-4 underline-offset-8">
                  {chunks}
                </span>
              ),
            })}
          </h1>
          <p className="text-gris-600 max-w-xl text-base text-pretty md:text-lg">{t('heroText')}</p>
          <HeroCtas primary={t('createAccount')} secondary={t('seeServices')} />

          <div className="relative mt-4 w-full max-w-3xl text-left xl:mt-8">
            <div data-tilt="" className="will-change-transform">
              <PanelMockup t={t} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:mt-0 xl:contents">
              <FloatingCards
                cards={left}
                className="max-xl:gap-0 xl:absolute xl:top-10 xl:-left-60 xl:w-56"
              />
              <FloatingCards
                cards={right}
                className="max-xl:gap-0 xl:absolute xl:top-32 xl:-right-60 xl:w-56"
              />
            </div>
          </div>
        </div>
      </HeroStage>
    </DotBackground>
  );
}
