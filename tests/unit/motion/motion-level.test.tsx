// @vitest-environment jsdom
// getMotionLevel({ width, reducedMotion, saveData?, deviceMemory? }) -> 'none' | 'light' | 'rich'  (src/lib/motion/level.ts)
// useMotionLevel() -> MotionLevel (src/hooks/use-motion-level.ts) ; 'light' côté serveur et au premier rendu.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, renderToString } from './_helpers';
import { getMotionLevel } from '@/lib/motion/level';
import { useMotionLevel } from '@/hooks/use-motion-level';

describe('getMotionLevel', () => {
  it('rend none si le visiteur réduit les animations, même sur grand écran', () => {
    expect(getMotionLevel({ width: 1920, reducedMotion: true })).toBe('none');
  });
  it('rend none avant toute autre règle (saveData, mobile)', () => {
    expect(
      getMotionLevel({ width: 320, reducedMotion: true, saveData: true, deviceMemory: 1 }),
    ).toBe('none');
  });
  it('rend light sous 768 px', () => {
    expect(getMotionLevel({ width: 767, reducedMotion: false })).toBe('light');
  });
  it('rend rich à 768 px pile', () => {
    expect(getMotionLevel({ width: 768, reducedMotion: false })).toBe('rich');
  });
  it('rend light sur grand écran si saveData est actif', () => {
    expect(getMotionLevel({ width: 1440, reducedMotion: false, saveData: true })).toBe('light');
  });
  it('rend light sur grand écran si la mémoire est de 2 Go ou moins', () => {
    expect(getMotionLevel({ width: 1440, reducedMotion: false, deviceMemory: 2 })).toBe('light');
    expect(getMotionLevel({ width: 1440, reducedMotion: false, deviceMemory: 1 })).toBe('light');
  });
  it('rend rich sur grand écran avec 4 Go et sans saveData', () => {
    expect(
      getMotionLevel({ width: 1440, reducedMotion: false, saveData: false, deviceMemory: 4 }),
    ).toBe('rich');
  });
  it('rend rich quand saveData et deviceMemory sont absents', () => {
    expect(getMotionLevel({ width: 1440, reducedMotion: false })).toBe('rich');
  });
});

function mockEnv(width: number, reduce: boolean) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

describe('useMotionLevel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rend light au rendu serveur (pas de flash)', () => {
    mockEnv(1920, false);
    expect(renderToString(useMotionLevel)).toBe('light');
  });
  it('passe à rich sur grand écran après montage', () => {
    mockEnv(1440, false);
    const { result } = renderHook(() => useMotionLevel());
    expect(result.current).toBe('rich');
  });
  it('passe à none si prefers-reduced-motion: reduce', () => {
    mockEnv(1440, true);
    const { result } = renderHook(() => useMotionLevel());
    expect(result.current).toBe('none');
  });
  it('reste light sur mobile', () => {
    mockEnv(390, false);
    const { result } = renderHook(() => useMotionLevel());
    expect(result.current).toBe('light');
  });
  it('interroge matchMedia avec (prefers-reduced-motion: reduce)', () => {
    const spy = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('matchMedia', spy);
    renderHook(() => useMotionLevel());
    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
