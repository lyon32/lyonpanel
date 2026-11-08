// Même écran de chargement que les pages publiques. Il n'est pas placé à la racine de [locale] :
// sinon il ouvre l'envoi de la page avant que notFound() ne s'exécute et le 404 partirait en code 200.
export { default } from '../(public)/loading';
