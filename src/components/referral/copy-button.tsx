'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { value: string; label: string; copiedLabel: string; testId: string };

export function CopyButton({ value, label, copiedLabel, testId }: Props) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le texte reste affiché et sélectionnable.
    }
  }
  const Icon = copied ? Check : Copy;
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} data-testid={testId}>
      <Icon size={16} aria-hidden="true" />
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
