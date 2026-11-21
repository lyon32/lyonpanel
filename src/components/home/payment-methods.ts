// Moyens de paiement : logos officiels PNG dans public/brand/payments/ (jamais recolorés).
// Les « -clean » sont les mêmes logos sans le fond blanc parasite.
// Si l'image ne charge pas, la tuile affiche le nom en texte.
export const PAYMENTS = [
  { id: 'wave', name: 'Wave', file: 'wave-clean.png', shape: 'round', glow: '#26BFEF' },
  {
    id: 'orange',
    name: 'Orange Money',
    file: 'orange-money.png',
    shape: 'square',
    glow: '#FF7900',
  },
  { id: 'mtn', name: 'MTN MoMo', file: 'mtn-momo.png', shape: 'square', glow: '#FFC521' },
  { id: 'moov', name: 'Moov Money', file: 'moov-money-clean.png', shape: 'free', glow: '#F37021' },
  {
    id: 'airtel',
    name: 'Airtel Money',
    file: 'airtel-money.png',
    shape: 'square',
    glow: '#E8212F',
  },
  { id: 'visa', name: 'Visa', file: 'visa.png', shape: 'free', glow: '#3B7BFF' },
  {
    id: 'mastercard',
    name: 'Mastercard',
    file: 'mastercard-clean.png',
    shape: 'free',
    glow: '#EB6A1F',
  },
] as const;
