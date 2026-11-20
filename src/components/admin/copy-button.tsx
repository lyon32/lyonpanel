'use client';

import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Copie une valeur dans le presse-papiers ; le résultat est annoncé aux lecteurs d'écran.
export function CopyButton({ value }: { value: string }) {
  const t = useTranslations('admin.orders');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-11"
        onClick={() => void copy()}
      >
        {state === 'copied' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {t('copy')}
      </Button>
      <span role="status" className="text-gris-600 text-sm">
        {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : ''}
      </span>
    </>
  );
}
