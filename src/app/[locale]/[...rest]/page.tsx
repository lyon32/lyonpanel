import { notFound } from 'next/navigation';

// Toute adresse inconnue passe ici pour afficher le 404 du site (not-found.tsx du dossier [locale]).
export default function CatchAllPage() {
  notFound();
}
