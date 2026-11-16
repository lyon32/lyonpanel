import { notFound } from 'next/navigation';

// Provisoire : les écrans internes arrivent en 11.4 et contrôleront chacun requireAdmin.
// D'ici là, toute sous-adresse répond 404, sans redirection vers la connexion.
export default function AdminInnerPage() {
  notFound();
}
