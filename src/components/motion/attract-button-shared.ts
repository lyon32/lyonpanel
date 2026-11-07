import { type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface AttractButtonProps extends ComponentProps<'button'> {
  /** Libellé obligatoire : aucun texte par défaut. */
  children: ReactNode;
  /** Filing density. 1 places a filing roughly every 12px; 2 doubles it. */
  density?: number;
  /** How far, in px, the field of filings extends past the button's edges. */
  radius?: number;
  /** Classes for the wrapper that holds the button and its field. */
  containerClassName?: string;
}

export const BUTTON_CLASS = cn(
  'relative inline-flex h-11 min-h-11 min-w-36 cursor-pointer select-none items-center justify-center gap-2 rounded-md px-4',
  'font-medium text-sm bg-bleu-600 text-blanc hover:bg-bleu-700 active:bg-bleu-900',
  'transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
  'outline-hidden focus-visible:ring-2 focus-visible:ring-bleu-600 focus-visible:ring-offset-2 focus-visible:ring-offset-blanc',
  'disabled:pointer-events-none disabled:opacity-50',
);
