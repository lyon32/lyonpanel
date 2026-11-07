type LogoProps = {
  variant?: 'horizontal' | 'icon';
  alt: string;
  className?: string;
};

const SOURCES = {
  horizontal: '/brand/01-horizontal.svg',
  icon: '/brand/02-icone.svg',
} as const;

// <img> simple : les SVG n'ont pas besoin de l'optimisation next/image.
export function Logo({ variant = 'horizontal', alt, className }: LogoProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={SOURCES[variant]} alt={alt} className={className} />;
}
