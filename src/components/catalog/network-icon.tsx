import { Share2 } from 'lucide-react';
import { NetworkLogo } from '@/components/shared/network-logo';
import { NETWORKS as LOGOS } from '@/components/shared/networks';

// Pastille bleu clair avec le logo du réseau ; icône neutre quand on n'en a pas (Kick, Pinterest…).
export function NetworkIcon({ network }: { network: string }) {
  const id = network === 'web_traffic' ? 'web' : network;
  const known = LOGOS.find((n) => n.id === id);
  return (
    <span className="bg-bleu-50 flex size-10 shrink-0 items-center justify-center rounded-lg">
      {known ? (
        <NetworkLogo id={known.id} size={24} />
      ) : (
        <Share2 size={20} aria-hidden="true" className="text-bleu-600" />
      )}
    </span>
  );
}
