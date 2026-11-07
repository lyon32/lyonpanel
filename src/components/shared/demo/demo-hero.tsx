import { Camera, Music2, Play, ReceiptText, ShoppingBag, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import AttractButton from '@/components/motion/attract-button';
import { DotBackground } from '@/components/motion/dot-background';
import { FloatingCards } from '@/components/motion/floating-cards';
import { Reveal } from '@/components/motion/reveal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// Héros « piste D » : points fixes, mini-écrans du panel qui flottent, tuiles de réseaux.
export async function DemoHero() {
  const t = await getTranslations('demo');

  const mini = [
    { id: 'balance', Icon: Wallet, title: t('miniBalance'), value: '10 000 XAF', example: true },
    { id: 'order', Icon: ReceiptText, title: t('miniOrder'), value: t('miniOrderValue') },
    { id: 'recharge', Icon: ShoppingBag, title: t('miniRecharge'), value: t('miniRechargeValue') },
    { id: 'services', Icon: Play, title: t('miniServices'), value: t('miniServicesValue') },
  ].map(({ id, Icon, title, value, example }) => ({
    id,
    content: (
      <Card className="flex items-center gap-3 p-4">
        <Icon size={20} aria-hidden="true" className="text-bleu-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-gris-600 text-xs font-semibold">{title}</p>
          <p className="text-encre text-sm font-bold" data-no-motion={example ? '' : undefined}>
            {value}
          </p>
        </div>
        {example ? <Badge className="ml-auto">{t('example')}</Badge> : null}
      </Card>
    ),
  }));

  const networks = [
    { Icon: Music2, name: t('network1') },
    { Icon: Camera, name: t('network2') },
    { Icon: Play, name: t('network3') },
  ];

  return (
    <DotBackground>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
        <div className="flex flex-col items-start gap-5">
          <Reveal>
            <h1 className="text-encre text-3xl font-bold md:text-4xl">{t('heroTitle')}</h1>
          </Reveal>
          <Reveal>
            <p className="text-gris-600 text-base">{t('heroText')}</p>
          </Reveal>
          <AttractButton>{t('createAccount')}</AttractButton>
          <ul aria-label={t('networks')} className="flex flex-wrap gap-2">
            {networks.map(({ Icon, name }) => (
              <li
                key={name}
                className="border-gris-200 bg-blanc text-encre flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
              >
                <Icon size={20} aria-hidden="true" className="text-bleu-600" />
                {name}
              </li>
            ))}
          </ul>
        </div>
        <FloatingCards cards={mini} className="sm:grid-cols-2" />
      </div>
    </DotBackground>
  );
}
