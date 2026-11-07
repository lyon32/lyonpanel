'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMotionLevel } from '@/hooks/use-motion-level';

type RevealProps = { children: ReactNode; className?: string };

// Apparition (opacité + léger décalage) du conteneur au montage. Si un enfant porte
// data-no-motion (prix, solde), le bloc s'affiche tout de suite : aucun montant n'est jamais animé.
export function Reveal({ children, className }: RevealProps) {
  const level = useMotionLevel();
  const ref = useRef<HTMLDivElement>(null);
  const [hasAmount, setHasAmount] = useState(false);

  useEffect(() => {
    setHasAmount(ref.current?.querySelector('[data-no-motion]') != null);
  }, [children]);

  if (level === 'none') return <div className={className}>{children}</div>;
  const distance = level === 'rich' ? 16 : 8;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: hasAmount ? 0 : 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
