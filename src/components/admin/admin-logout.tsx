'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Ferme la session puis revient à la page de connexion cachée.
export function AdminLogout({ adminPath, label }: { adminPath: string; label: string }) {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign(`/${adminPath}`);
  }
  return (
    <Button variant="secondary" size="sm" className="min-h-11" onClick={logout} disabled={pending}>
      {label}
    </Button>
  );
}
