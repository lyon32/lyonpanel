import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { assertSameOrigin, clientIp } from '@/server/http/request';
import { ApiError } from '@/server/http/api-error';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/auth/login', { method: 'POST', headers });
}

describe('clientIp', () => {
  it('lit cf-connecting-ip (Cloudflare) en priorité', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '10.0.0.1' }))).toBe(
      '203.0.113.7',
    );
  });
  it('sinon lit x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });
  it('ignore x-forwarded-for, que le client peut falsifier', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '198.51.100.4' }))).toBe(
      '198.51.100.4',
    );
  });
  it("renvoie la valeur sentinelle 'unknown' sans aucun en-tête", () => {
    expect(clientIp(req())).toBe('unknown');
  });
  it('retire les espaces autour de la valeur', () => {
    expect(clientIp(req({ 'cf-connecting-ip': ' 203.0.113.7 ' }))).toBe('203.0.113.7');
  });
});

describe('assertSameOrigin', () => {
  it('accepte une requête de la même origine', () => {
    expect(() => assertSameOrigin(req({ origin: 'http://localhost:3000' }))).not.toThrow();
  });
  it('origine étrangère : FORBIDDEN 403 (et non NOT_ADMIN)', () => {
    try {
      assertSameOrigin(req({ origin: 'https://evil.example' }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('FORBIDDEN');
      expect((e as ApiError).status).toBe(403);
    }
  });
  it('en-tête Origin absent : FORBIDDEN 403', () => {
    expect(() => assertSameOrigin(req())).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
