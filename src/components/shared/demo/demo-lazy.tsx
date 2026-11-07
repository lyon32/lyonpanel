'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { TimelineEntry } from '@/components/motion/timeline';

// Ces blocs sont sous la ligne de flottaison et lourds (animations, glisser-déposer) :
// leur code n'est téléchargé que lorsqu'on s'en approche. Page de démo non indexée,
// donc ne pas les rendre côté serveur ne coûte rien en référencement.
const TrackE = dynamic(() => import('./demo-track-e').then((m) => m.DemoTrackE), { ssr: false });
const TrackF = dynamic(() => import('./demo-track-f').then((m) => m.DemoTrackF), { ssr: false });
const TimelineLazy = dynamic(() => import('@/components/motion/timeline').then((m) => m.Timeline), {
  ssr: false,
});

// Réserve la place du bloc (évite un saut de page) et ne monte l'enfant qu'à 300 px de l'écran.
function OnVisible({ minHeightClass, children }: { minHeightClass: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={near ? undefined : minHeightClass}>
      {near ? children : null}
    </div>
  );
}

export function LazyTrackE() {
  return (
    <OnVisible minHeightClass="min-h-[40rem]">
      <TrackE />
    </OnVisible>
  );
}

export function LazyTrackF() {
  return (
    <OnVisible minHeightClass="min-h-[30rem]">
      <TrackF />
    </OnVisible>
  );
}

export function LazyTimeline({ data }: { data: TimelineEntry[] }) {
  return (
    <OnVisible minHeightClass="min-h-[20rem]">
      <TimelineLazy data={data} />
    </OnVisible>
  );
}
