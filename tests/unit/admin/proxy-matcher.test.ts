import { describe, expect, it } from 'vitest';
import { config } from '@/proxy';

// Régression : une barre oblique manquante (« \. » au lieu de « \. ») excluait toutes les adresses,
// donc le proxy (langue + adresse secrète de l'admin) ne tournait plus nulle part.
describe('matcher du proxy', () => {
  const regex = new RegExp(`^${config.matcher[0]}$`);

  it('couvre les pages, y compris l’adresse secrète et ses sous-pages', () => {
    for (const path of [
      '/',
      '/fr',
      '/en/catalogue',
      '/secret-admin-1234',
      '/secret-admin-1234/stats',
    ]) {
      expect(regex.test(path), path).toBe(true);
    }
  });

  it('laisse passer l’API, les fichiers statiques et les fichiers avec extension', () => {
    for (const path of ['/api/v1/services', '/_next/static/a.js', '/robots.txt', '/icon.svg']) {
      expect(regex.test(path), path).toBe(false);
    }
  });
});
