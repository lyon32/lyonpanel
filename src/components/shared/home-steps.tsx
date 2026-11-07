import { Rocket, UserPlus, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ScrollSteps } from '@/components/motion/scroll-steps';
import { WordReveal } from '@/components/motion/word-reveal';

// Trois étapes qui s'allument au défilement, avec un panneau fixe à droite sur ordinateur.
export async function HomeSteps() {
  const t = await getTranslations('home');
  const icons = [UserPlus, Wallet, Rocket];
  const steps = icons.map((Icon, i) => ({
    id: `step${i + 1}`,
    title: t(`step${i + 1}` as 'step1'),
    text: t(`step${i + 1}Text` as 'step1Text'),
    icon: <Icon size={32} aria-hidden="true" />,
  }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <WordReveal
        text={t('stepsTitle')}
        className="text-encre mb-8 text-center text-balance md:mb-12"
      />
      <ScrollSteps steps={steps} />
    </section>
  );
}
