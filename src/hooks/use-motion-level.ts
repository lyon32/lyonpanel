'use client';

import { useEffect, useState } from 'react';
import { getMotionLevel, type MotionLevel } from '@/lib/motion/level';

type NavigatorHints = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

// 'light' au rendu serveur et au premier rendu : pas de saut visuel, et un petit téléphone ne charge jamais le lourd.
export function useMotionLevel(): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>('light');

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hints = navigator as NavigatorHints;
    const update = () =>
      setLevel(
        getMotionLevel({
          width: window.innerWidth,
          reducedMotion: query.matches,
          saveData: hints.connection?.saveData,
          deviceMemory: hints.deviceMemory,
        }),
      );
    update();
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return level;
}
