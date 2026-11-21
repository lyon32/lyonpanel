import { describe, expect, it } from 'vitest';
import { buildFaqJsonLd, serializeJsonLd } from '@/components/faq/faq-jsonld';
import { escapeJsonLd } from '@/lib/seo/json-ld';

const evil = '</script><img onerror=x>';
const escapedLt = String.fromCharCode(92) + 'u003c';

describe('échappement JSON-LD', () => {
  it('serializeJsonLd ne laisse aucun caractère < avec du HTML hostile', () => {
    const out = serializeJsonLd(buildFaqJsonLd([{ question: `Q ${evil}`, answer: `R ${evil}` }]));
    expect(out).not.toContain('<');
    expect(JSON.parse(out).mainEntity[0].name).toBe('Q');
  });

  it('un < isolé (non balise) est échappé et reste réversible', () => {
    const out = serializeJsonLd(buildFaqJsonLd([{ question: 'a < b ?', answer: 'oui, 1 < 2' }]));
    expect(out).not.toContain('<');
    expect(out).toContain(escapedLt);
    expect(JSON.parse(out).mainEntity[0].name).toBe('a < b ?');
  });

  it('escapeJsonLd (composant JsonLd) échappe < et reste réversible', () => {
    const data = { name: evil };
    const out = escapeJsonLd(data);
    expect(out).not.toContain('<');
    expect(out).toContain(escapedLt);
    expect(JSON.parse(out)).toEqual(data);
  });
});
