import { getTranslations } from 'next-intl/server';
import { PinnedSteps } from '@/components/motion/pinned-steps';
import { WordReveal } from '@/components/motion/word-reveal';

// Trois étapes, une par une au défilement (section épinglée, voir PinnedSteps).
export async function HomeSteps() {
  const t = await getTranslations('home');
  const steps = [1, 2, 3].map((n) => ({
    id: `step${n}`,
    title: t(`step${n}` as 'step1'),
    text: t(`step${n}Text` as 'step1Text'),
  }));

  return (
    <PinnedSteps
      steps={steps}
      hint={t('stepsHint')}
      title={
        <WordReveal
          text={t('stepsTitle')}
          className="text-encre mb-8 text-center text-balance md:mb-12"
        />
      }
    />
  );
}
