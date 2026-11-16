import { notFound } from 'next/navigation';

// Les écrans admin (stats, users, storage) ont leurs propres dossiers et contrôlent requireAdmin.
// Toute autre sous-adresse répond 404, sans redirection vers la connexion.
export default function AdminInnerPage() {
  notFound();
}
