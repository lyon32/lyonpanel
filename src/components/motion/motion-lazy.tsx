'use client';

import { LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Les fonctions d'animation arrivent après l'affichage : le héros ne les attend pas pour être lisible.
const loadFeatures = () => import('./motion-features').then((mod) => mod.default);

export function MotionLazy({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
