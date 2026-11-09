import type { ReactNode } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';

// Pages de compte : la carte (panneau + formulaire) reste en place entre les pages.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
