'use client';

/** Source : Aceternity UI timeline (MIT), adapté : bleu du design system, sans titre en dur, ligne animée seulement au niveau rich. */
import { motion, useScroll, useTransform } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useMotionLevel } from '@/hooks/use-motion-level';
import { cn } from '@/lib/cn';

export interface TimelineEntry {
  title: string;
  content: ReactNode;
}

export function Timeline({ data, className }: { data: TimelineEntry[]; className?: string }) {
  const level = useMotionLevel();
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      setHeight(ref.current.getBoundingClientRect().height);
    }
  }, [data]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 10%', 'end 50%'],
  });
  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
  const animated = level === 'rich';

  return (
    <div className={cn('bg-blanc w-full md:px-10', className)} ref={containerRef}>
      <div className="relative mx-auto max-w-7xl pb-10" ref={ref}>
        {data.map((item) => (
          <div className="flex justify-start pt-10 md:gap-10 md:pt-24" key={item.title}>
            <div className="sticky top-40 z-10 flex max-w-xs items-center self-start md:w-full lg:max-w-sm">
              <div className="bg-blanc absolute left-3 flex h-10 w-10 items-center justify-center rounded-full">
                <div className="border-bleu-600 bg-bleu-100 h-4 w-4 rounded-full border" />
              </div>
              <h3 className="text-gris-600 hidden text-xl font-bold md:block md:pl-20 md:text-4xl">
                {item.title}
              </h3>
            </div>
            <div className="relative w-full pr-4 pl-20 md:pl-4">
              <h3 className="text-gris-600 mb-4 block text-left text-2xl font-bold md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}
        <div
          aria-hidden="true"
          className="bg-gris-200 absolute top-0 left-8 w-[2px] overflow-hidden"
          style={{ height: `${height}px` }}
        >
          {animated ? (
            <motion.div
              className="bg-bleu-600 absolute inset-x-0 top-0 w-[2px] rounded-full"
              style={{ height: heightTransform, opacity: opacityTransform }}
            />
          ) : (
            <div className="bg-bleu-600 absolute inset-0" />
          )}
        </div>
      </div>
    </div>
  );
}
