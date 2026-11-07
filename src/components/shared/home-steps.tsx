import { Rocket, UserPlus, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';

// Trois étapes en cartes douces, reliées par un trait pointillé sur grand écran.
export async function HomeSteps() {
  const t = await getTranslations('home');
  const steps = [
    { n: 1, Icon: UserPlus, tone: 'bg-bleu-50 border-bleu-100', icon: 'bg-blanc text-bleu-600' },
    { n: 2, Icon: Wallet, tone: 'bg-jaune-50 border-jaune-50', icon: 'bg-blanc text-jaune-700' },
    { n: 3, Icon: Rocket, tone: 'bg-blanc border-gris-200', icon: 'bg-bleu-50 text-bleu-600' },
  ] as const;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <Reveal>
        <h2 className="text-encre mb-8 text-center text-balance md:mb-12">{t('stepsTitle')}</h2>
      </Reveal>
      <ol className="relative grid gap-4 md:grid-cols-3 md:gap-8">
        <div
          aria-hidden="true"
          className="border-bleu-100 absolute top-1/2 right-[16%] left-[16%] hidden border-t-2 border-dashed md:block"
        />
        {steps.map(({ n, Icon, tone, icon }) => (
          <li
            key={n}
            className={`relative flex flex-col gap-3 rounded-xl border p-6 shadow-sm ${tone}`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex size-11 items-center justify-center rounded-lg ${icon}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="text-gris-400 text-sm font-semibold tabular-nums">0{n}</span>
            </div>
            <h3 className="text-encre">{t(`step${n}`)}</h3>
            <p className="text-gris-600 text-base">{t(`step${n}Text`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
