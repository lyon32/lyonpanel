'use client';

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

// Retour au repos après le succès : 500 ms, sous la limite de 600 ms du design system (§6 bis).
const SUCCESS_MS = 500;

type Props = Omit<
  ComponentProps<typeof Button>,
  'onClick' | 'loading' | 'success' | 'loadingLabel' | 'successLabel' | 'children'
> & {
  // Rejette la promesse en cas d'échec : le bouton revient alors au repos, sans succès.
  onAction: () => Promise<void>;
  label: string;
  // Icône décorative avant le libellé au repos.
  icon?: ReactNode;
  loadingLabel: string;
  successLabel: string;
};

type Phase = 'idle' | 'loading' | 'success';

// Bouton d'une action qui prend du temps : repos, chargement (aria-busy), succès bref, repos.
// Un second clic pendant l'attente n'appelle pas l'action une deuxième fois.
export function ActionButton({
  onAction,
  label,
  icon,
  loadingLabel,
  successLabel,
  ...props
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const running = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function run() {
    if (running.current) return;
    running.current = true;
    setPhase('loading');
    try {
      await onAction();
      setPhase('success');
      timer.current = window.setTimeout(() => setPhase('idle'), SUCCESS_MS);
    } catch {
      setPhase('idle');
    } finally {
      running.current = false;
    }
  }

  return (
    <Button
      type="button"
      {...props}
      loading={phase === 'loading'}
      loadingLabel={loadingLabel}
      success={phase === 'success'}
      successLabel={successLabel}
      onClick={() => void run()}
    >
      {icon}
      {label}
    </Button>
  );
}
