import { Globe } from 'lucide-react';
import type { NetworkId } from './networks';

// Logo en masque CSS (couleur du design system). « web » : icône neutre, pas de marque.
export function NetworkLogo({ id, size = 18 }: { id: NetworkId; size?: number }) {
  if (id === 'web') return <Globe size={size} aria-hidden="true" className="text-bleu-600" />;
  return (
    <span
      aria-hidden="true"
      className="bg-bleu-600 block"
      style={{
        width: size,
        height: size,
        maskImage: `url(/brand/networks/${id}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}
