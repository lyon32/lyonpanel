import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonLd } from '@/components/seo/json-ld';
import { escapeJsonLd } from '@/lib/seo/json-ld';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/fonts', () => ({
  atkinson: { variable: '' },
  plexMono: { variable: '' },
  publicSans: { variable: '' },
}));

// Traductions réelles, sans contexte de requête Next.
vi.mock('next-intl/server', () => {
  const dict = { fr, en } as Record<string, unknown>;
  const get = (o: unknown, path: string) =>
    path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
  return {
    setRequestLocale: () => undefined,
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const root = get(dict[locale], namespace);
      const t = (key: string, vars: Record<string, string> = {}) => {
        const v = get(root, key);
        if (typeof v !== 'string') return `${namespace}.${key}`;
        return v.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
      };
      t.has = (key: string) => typeof get(root, key) === 'string';
      return t;
    },
  };
});

const APP_DIR = join(process.cwd(), 'src', 'app');
const SITE = 'https://lyonpanel.com';

// Classement explicite : une nouvelle page.tsx absente de ces listes fait échouer le test.
const PUBLIC_INDEXABLE = [
  '[locale]/(public)/page.tsx',
  '[locale]/(public)/services/page.tsx',
  '[locale]/(public)/services/[network]/page.tsx',
  '[locale]/(public)/faq/page.tsx',
  '[locale]/(public)/contact/page.tsx',
];
// Publiques mais provisoires : lisibles, noindex voulu (option `noindex` de seoPageMetadata).
const PUBLIC_PROVISIONAL = [
  '[locale]/(public)/privacy/page.tsx',
  '[locale]/(public)/terms/page.tsx',
  '[locale]/(public)/blog/page.tsx',
];
// Pages catalogue dont les métadonnées dépendent de la base : couvertes par catalog-seo.test.tsx.
const PUBLIC_CATALOG_DB = [
  '[locale]/(public)/services/[network]/[type]/page.tsx',
  '[locale]/(public)/services/[network]/[type]/[id]/page.tsx',
];
const PRIVATE_LOCALE = [
  '[locale]/(app)/account/page.tsx',
  '[locale]/(app)/add-funds/[id]/page.tsx',
  '[locale]/(app)/add-funds/page.tsx',
  '[locale]/(app)/dashboard/page.tsx',
  '[locale]/(app)/favorites/page.tsx',
  '[locale]/(app)/order/page.tsx',
  '[locale]/(app)/orders/page.tsx',
  '[locale]/(app)/referral/page.tsx',
  '[locale]/(app)/tickets/[id]/page.tsx',
  '[locale]/(app)/tickets/page.tsx',
  '[locale]/(app)/transactions/page.tsx',
  '[locale]/(auth)/forgot-password/page.tsx',
  '[locale]/(auth)/login/page.tsx',
  '[locale]/(auth)/register/page.tsx',
  '[locale]/(auth)/reset-password/page.tsx',
  '[locale]/(public)/demo/page.tsx',
  '[locale]/prototypes/e/page.tsx',
];
// Admin : noindex porté par les layouts (`metadata.robots`), aucune page ne le remplace.
const ADMIN = [
  'gestion/[adminPath]/page.tsx',
  'gestion/[adminPath]/[...rest]/page.tsx',
  'gestion/[adminPath]/(panel)/audit/page.tsx',
  'gestion/[adminPath]/(panel)/orders/(list)/page.tsx',
  'gestion/[adminPath]/(panel)/orders/[id]/page.tsx',
  'gestion/[adminPath]/(panel)/payments/page.tsx',
  'gestion/[adminPath]/(panel)/services/(list)/page.tsx',
  'gestion/[adminPath]/(panel)/services/[id]/page.tsx',
  'gestion/[adminPath]/(panel)/settings/page.tsx',
  'gestion/[adminPath]/(panel)/stats/page.tsx',
  'gestion/[adminPath]/(panel)/storage/page.tsx',
  'gestion/[adminPath]/(panel)/tickets/[id]/page.tsx',
  'gestion/[adminPath]/(panel)/tickets/page.tsx',
  'gestion/[adminPath]/(panel)/users/(list)/page.tsx',
  'gestion/[adminPath]/(panel)/users/[id]/page.tsx',
];
// Pages 404 : statut 404, jamais indexées par construction.
const NOT_FOUND = ['[locale]/[...rest]/page.tsx'];

function listPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listPages(full);
    return name === 'page.tsx' ? [relative(APP_DIR, full).split(sep).join('/')] : [];
  });
}

type Meta = {
  title?: unknown;
  description?: string;
  robots?: { index?: boolean; follow?: boolean };
  alternates?: { canonical?: string; languages?: Record<string, string> };
  openGraph?: {
    url?: string;
    title?: string;
    locale?: string;
    images?: { url: string; width: number; height: number }[];
  };
  twitter?: { card?: string; images?: string[] };
};
type Module = {
  generateMetadata?: (a: { params: Promise<Record<string, string>> }) => Promise<Meta>;
  metadata?: Meta;
};

async function metaOf(file: string, locale: string, network = 'tiktok') {
  const mod = (await import(/* @vite-ignore */ `@/app/${file}`)) as Module;
  if (mod.generateMetadata) {
    return mod.generateMetadata({ params: Promise.resolve({ locale, id: '1', network }) });
  }
  if (!mod.metadata) throw new Error(`Ni generateMetadata ni metadata dans ${file}`);
  return mod.metadata;
}

const urlFor = (file: string, lang: string, network: string) => {
  const rest = file
    .replace('[locale]/(public)/', '')
    .replace(/\/?page\.tsx$/, '')
    .replace('[network]', network);
  return `${SITE}/${lang}${rest ? `/${rest}` : ''}`;
};

afterEach(() => vi.unstubAllEnvs());

describe('classement exhaustif des pages', () => {
  it('chaque page.tsx du dépôt est classée, sans entrée obsolète', () => {
    const classified = [
      ...PUBLIC_INDEXABLE,
      ...PUBLIC_PROVISIONAL,
      ...PUBLIC_CATALOG_DB,
      ...PRIVATE_LOCALE,
      ...ADMIN,
      ...NOT_FOUND,
    ].sort();
    expect(listPages(APP_DIR).sort()).toEqual(classified);
  });
});

const PUBLIC_CASES = [...PUBLIC_INDEXABLE, ...PUBLIC_PROVISIONAL].flatMap((file) =>
  file.includes('[network]')
    ? Object.keys(fr.seo.networks).map((n) => [file, n] as const)
    : [[file, 'tiktok'] as const],
);

describe.each(['fr', 'en'] as const)('pages publiques (%s), site indexable', (lang) => {
  it.each(PUBLIC_CASES)('%s (%s) : balises complètes', async (file, network) => {
    vi.stubEnv('SITE_INDEXABLE', 'true');
    const m = await metaOf(file, lang, network);
    const title = String(m.title);
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(m.description?.length).toBeGreaterThanOrEqual(70);
    expect(m.description?.length).toBeLessThanOrEqual(160);
    const canonical = urlFor(file, lang, network);
    expect(m.alternates?.canonical).toBe(canonical);
    expect(m.alternates?.languages).toEqual({
      fr: urlFor(file, 'fr', network),
      en: urlFor(file, 'en', network),
      'x-default': urlFor(file, 'fr', network),
    });
    expect(m.openGraph?.url).toBe(canonical);
    expect(m.openGraph?.title).toBe(title);
    expect(m.openGraph?.locale).toBe(lang === 'fr' ? 'fr_FR' : 'en_US');
    expect(m.openGraph?.images?.[0]).toMatchObject({ width: 1200, height: 630 });
    expect(m.openGraph?.images?.[0]?.url).toMatch(/^https:\/\//);
    expect(m.twitter?.card).toBe('summary_large_image');
    expect(m.twitter?.images?.[0]).toMatch(/^https:\/\//);
    // Provisoires (privacy, terms, blog) : noindex voulu même en mode indexable.
    expect(m.robots?.index).toBe(!PUBLIC_PROVISIONAL.includes(file));
  });
});

describe('pages publiques, site non indexable (défaut)', () => {
  it.each(PUBLIC_CASES)('%s (%s) : noindex, nofollow en FR et EN', async (file, network) => {
    vi.stubEnv('SITE_INDEXABLE', '');
    for (const lang of ['fr', 'en']) {
      const m = await metaOf(file, lang, network);
      expect(m.robots).toMatchObject({ index: false, follow: false });
    }
  });
});

describe('pages privées (app, auth, demo, prototypes)', () => {
  const cases = PRIVATE_LOCALE.flatMap((f) => [[f, 'fr'] as const, [f, 'en'] as const]);
  it.each(cases)('%s (%s) : noindex, nofollow, site non indexable', async (file, lang) => {
    vi.stubEnv('SITE_INDEXABLE', '');
    expect((await metaOf(file, lang)).robots).toEqual({ index: false, follow: false });
  });
  it.each(cases)('%s (%s) : noindex, nofollow, site indexable', async (file, lang) => {
    vi.stubEnv('SITE_INDEXABLE', 'true');
    expect((await metaOf(file, lang)).robots).toEqual({ index: false, follow: false });
  });
});

describe('admin (gestion)', () => {
  it.each(['gestion/[adminPath]/layout.tsx', 'gestion/[adminPath]/(panel)/layout.tsx'])(
    '%s : metadata.robots noindex, nofollow, même site indexable',
    async (file) => {
      vi.stubEnv('SITE_INDEXABLE', 'true');
      expect((await metaOf(file, 'fr')).robots).toEqual({ index: false, follow: false });
    },
  );
  it.each(ADMIN)('%s ne déclare aucun robots indexable', (file) => {
    const src = readFileSync(join(APP_DIR, file), 'utf8');
    expect(src).not.toMatch(/index:\s*true/);
  });
});

describe('JSON-LD', () => {
  it('JsonLd produit un script application/ld+json valide, sans « < » brut', () => {
    const data = { '@context': 'https://schema.org', name: '</script><b>x</b>' };
    const html = renderToStaticMarkup(createElement(JsonLd, { data }));
    const m = /^<script type="application\/ld\+json">(.*)<\/script>$/s.exec(html);
    expect(m).not.toBeNull();
    const body = (m as RegExpExecArray)[1] as string;
    expect(body).not.toContain('<');
    const decoded = body
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(JSON.parse(decoded)).toEqual(data);
  });
  it('escapeJsonLd garde un JSON équivalent sans « < »', () => {
    expect(JSON.parse(escapeJsonLd({ a: '<' }))).toEqual({ a: '<' });
    expect(escapeJsonLd({ a: '<' })).not.toContain('<');
  });
  // contact : pas de JSON-LD aujourd'hui (écart signalé dans le rapport 14.6, test volontairement absent).
  it.each(PUBLIC_INDEXABLE.filter((f) => !f.includes('/contact/')))(
    '%s publie du JSON-LD, sans dangerouslySetInnerHTML',
    (file) => {
      const src = readFileSync(join(APP_DIR, file), 'utf8');
      expect(src).toMatch(/<JsonLd\b|application\/ld\+json/);
      expect(src).not.toContain('dangerouslySetInnerHTML');
    },
  );
});
