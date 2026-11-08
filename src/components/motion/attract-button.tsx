'use client';

/** Source : Kokonut UI (MIT), adapté au design system LyonPanel : bleu/jaune, libellés par props, sans mode sombre. */

import { lazy, Suspense } from 'react';
import { BUTTON_CLASS, type AttractButtonProps } from './attract-button-shared';
import { useMotionLevel } from '@/hooks/use-motion-level';
import { cn } from '@/lib/cn';

// Le champ de limaille (canvas + physique, ~400 lignes) ne se télécharge qu'au niveau rich.
const AttractButtonCanvas = lazy(() => import('./attract-button-canvas'));

function PlainButton(props: AttractButtonProps) {
  const { className, containerClassName, ...rest } = props;
  // density et radius ne servent qu'au champ de limaille (canvas) : on les écarte du bouton simple.
  delete (rest as Partial<AttractButtonProps>).density;
  delete (rest as Partial<AttractButtonProps>).radius;
  return (
    <div className={cn('relative inline-flex', containerClassName)}>
      <button type="button" {...rest} className={cn(BUTTON_CLASS, className)} />
    </div>
  );
}

export default function AttractButton(props: AttractButtonProps) {
  const level = useMotionLevel();
  if (level !== 'rich') {
    return <PlainButton {...props} />;
  }
  // Pendant le téléchargement du canvas, le bouton simple reste affiché : pas de saut.
  return (
    <Suspense fallback={<PlainButton {...props} />}>
      <AttractButtonCanvas {...props} />
    </Suspense>
  );
}
