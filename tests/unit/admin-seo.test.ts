import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-intl/middleware', () => ({ default: () => () => new Response(null) }));
vi.mock('@/lib/fonts', () => ({ publicSans: { variable: '' } }));
vi.mock('@/styles/globals.css', () => ({}));
vi.mock('@/server/env', () => ({ loadServerEnv: () => ({ ADMIN_PATH: 'test-admin-path-1234' }) }));

import proxy from '@/proxy';
import { metadata } from '@/app/gestion/[adminPath]/layout';

describe('admin : référencement', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('pose noindex + nofollow dans les métadonnées, avec un titre neutre', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe('LyonPanel');
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("ajoute X-Robots-Tag sur l'adresse secrète seulement", () => {
    vi.stubEnv('ADMIN_PATH', 'test-admin-path-1234');
    const secret = proxy(new NextRequest('http://localhost/test-admin-path-1234/stats'));
    expect(secret.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const other = proxy(new NextRequest('http://localhost/admin'));
    expect(other.headers.get('x-robots-tag')).toBeNull();
  });
});
