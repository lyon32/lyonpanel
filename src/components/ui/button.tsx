import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-base font-semibold whitespace-nowrap transition-colors duration-150 ease-out outline-none focus-visible:ring-4 focus-visible:ring-bleu-100 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-bleu-600 text-blanc hover:bg-bleu-700',
        secondary: 'bg-blanc border border-gris-200 text-encre hover:bg-gris-50',
        ghost: 'bg-transparent text-bleu-600 hover:bg-bleu-50',
        destructive: 'bg-erreur text-blanc hover:opacity-90',
        // Alias shadcn : "default" = primary, "outline" = secondary, "link" = lien souligné.
        default: 'bg-bleu-600 text-blanc hover:bg-bleu-700',
        outline: 'bg-blanc border border-gris-200 text-encre hover:bg-gris-50',
        link: 'bg-transparent text-bleu-600 underline-offset-4 hover:underline',
      },
      // "default" garde la taille historique (44 px de haut minimum, cible tactile).
      size: {
        default: 'min-h-11 px-4',
        xs: 'min-h-6 px-2 text-xs',
        sm: 'min-h-9 px-3 text-sm',
        lg: 'min-h-12 px-6',
        icon: 'size-11 p-0',
        'icon-xs': 'size-6 p-0',
        'icon-sm': 'size-9 p-0',
        'icon-lg': 'size-12 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  // Libellé affiché pendant le chargement (fourni par l'appelant, déjà traduit).
  loadingLabel?: string;
  // Succès : coche + libellé bref avant une redirection (l'appelant gère le délai).
  success?: boolean;
  successLabel?: string;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  success = false,
  successLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size }),
        (loading || success) && 'disabled:opacity-100',
        className,
      )}
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
      {...props}
    >
      {success && !asChild ? (
        <>
          <Check className="size-5" aria-hidden="true" />
          {successLabel}
        </>
      ) : loading && !asChild ? (
        <>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
