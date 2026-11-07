'use client';

import { ReceiptText, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import CardStack, { type DeckCard } from '@/components/motion/card-stack';

function Art({ Icon }: { Icon: LucideIcon }) {
  return (
    <div className="bg-bleu-50 text-bleu-600 flex size-full items-center justify-center">
      <Icon size={64} aria-hidden="true" />
    </div>
  );
}

// Piste F limitée : une pile de 3 écrans du panel.
export function DemoTrackF() {
  const t = useTranslations('demo');

  const cards: DeckCard[] = [
    {
      id: 'balance',
      title: t('card1Title'),
      subtitle: t('card1Sub'),
      art: <Art Icon={Wallet} />,
      description: t('card1Desc'),
      specs: [{ label: t('specStep'), value: '2' }],
    },
    {
      id: 'order',
      title: t('card2Title'),
      subtitle: t('card2Sub'),
      art: <Art Icon={ShoppingBag} />,
      description: t('card2Desc'),
      specs: [{ label: t('specStep'), value: '3' }],
    },
    {
      id: 'tracking',
      title: t('card3Title'),
      subtitle: t('card3Sub'),
      art: <Art Icon={ReceiptText} />,
      description: t('card3Desc'),
      specs: [{ label: t('specStep'), value: '4' }],
    },
  ];

  return (
    <div className="flex justify-center overflow-hidden">
      <CardStack
        cards={cards}
        accent="var(--bleu-600)"
        actionLabel={t('deckAction')}
        closeLabel={t('deckAction')}
        labels={{
          deck: t('deck'),
          previous: t('deckPrev'),
          next: t('deckNext'),
          close: t('deckAction'),
          openDetails: (card) => t('deckOpen', { title: card.title }),
        }}
      />
    </div>
  );
}
