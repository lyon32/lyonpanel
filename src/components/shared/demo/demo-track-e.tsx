'use client';

import { List, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import SlideToConfirm from '@/components/motion/slide-to-confirm';
import SmoothTab from '@/components/motion/smooth-tab';
import { StatusIsland, type IslandTask } from '@/components/motion/status-island';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Piste E : onglets animés, recharge simulée (aucun appel réseau, aucun argent) et métriques fixes.
export function DemoTrackE() {
  const t = useTranslations('demo');
  const [tasks, setTasks] = useState<IslandTask[]>([]);

  // Simulation pure : on affiche une tâche « en cours » puis « terminée ».
  async function fakeTopUp() {
    const base = { id: 'demo-topup', label: t('islandTask') };
    setTasks([{ ...base, status: 'running' }]);
    await wait(1200);
    setTasks([{ ...base, status: 'done' }]);
  }

  const items = [
    {
      id: 'new',
      title: t('tabNew'),
      icon: Plus,
      content: (
        <div className="grid gap-4 p-1 md:grid-cols-2">
          <Field label={t('orderLinkLabel')} placeholder={t('fieldPlaceholder')} />
          <Field label={t('orderQuantityLabel')} inputMode="numeric" placeholder="1 000" />
        </div>
      ),
    },
    {
      id: 'search',
      title: t('tabSearch'),
      icon: Search,
      content: (
        <div className="p-1">
          <Field label={t('searchLabel')} hint={t('searchHint')} type="search" />
        </div>
      ),
    },
    {
      id: 'batch',
      title: t('tabBatch'),
      icon: List,
      content: (
        <div className="flex flex-col gap-2 p-1">
          <label htmlFor="demo-batch" className="text-encre text-sm font-semibold">
            {t('batchLabel')}
          </label>
          <textarea
            id="demo-batch"
            rows={3}
            className="border-gris-200 bg-blanc text-encre focus-visible:ring-bleu-100 w-full rounded-lg border p-3 text-base outline-none focus-visible:ring-4"
          />
        </div>
      ),
    },
  ];

  const metrics = [
    { key: 'metricBalance', value: '10 000 XAF' },
    { key: 'metricOrders', value: '12' },
    { key: 'metricSpent', value: '8 500 XAF' },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div className="min-w-0 overflow-hidden">
        <SmoothTab items={items} label={t('tabsLabel')} />
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <h3 className="text-encre text-lg font-bold">{t('slideTitle')}</h3>
        <p className="text-gris-600 text-sm">{t('slideText')}</p>
        <SlideToConfirm
          label={t('slideLabel')}
          confirmingLabel={t('slideConfirming')}
          doneLabel={t('slideDone')}
          onConfirm={fakeTopUp}
          resetAfter={3000}
        />
        <div className="relative flex min-h-16 justify-center">
          <StatusIsland
            tasks={tasks}
            onDismiss={(id) => setTasks((list) => list.filter((task) => task.id !== id))}
            listLabel={t('islandList')}
            pillLabel={(task, count) => t('islandPill', { label: task.label, count })}
          />
        </div>
      </Card>

      <div>
        <h3 className="text-encre mb-3 text-lg font-bold">{t('metricsTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {metrics.map(({ key, value }) => (
            <Card key={key} className="flex flex-col gap-1 p-4">
              <span className="text-gris-600 text-sm font-semibold">{t(key)}</span>
              <span className="text-encre text-2xl font-bold tabular-nums" data-no-motion>
                {value}
              </span>
              <Badge className="self-start">{t('example')}</Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
