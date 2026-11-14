// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { AttachmentUpload } from '@/components/tickets/attachment-upload';

// 9.3i : réencodage JPEG natif avec qualités décroissantes, sans la bibliothèque.
const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

const MB = 1024 * 1024;

function stubCanvas(sizes: number[]) {
  const qualities: number[] = [];
  const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = real(tag);
    if (tag === 'canvas') {
      const c = el as HTMLCanvasElement;
      c.getContext = (() => ctx) as unknown as typeof c.getContext;
      c.toBlob = ((cb: BlobCallback, _type?: string, q?: number) => {
        qualities.push(q ?? -1);
        const blob = new Blob(['j'], { type: 'image/jpeg' });
        Object.defineProperty(blob, 'size', {
          value: sizes[Math.min(qualities.length, sizes.length) - 1],
        });
        cb(blob);
      }) as typeof c.toBlob;
    }
    return el;
  }) as typeof document.createElement);
  return qualities;
}

function setup() {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AttachmentUpload onChange={vi.fn()} />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByTestId('ticket-attach'), {
    target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
  });
}

beforeEach(() => {
  compress.mockReset();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1400, height: 1400, close: vi.fn() })),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ id: 'att-1' }), { status: 201 })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AttachmentUpload : encodage natif', () => {
  it('essaie 0,8 puis 0,6 puis 0,4 jusqu’à 1 Mo', async () => {
    const qualities = stubCanvas([3 * MB, 1.5 * MB, 0.9 * MB]);
    setup();
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    expect(qualities).toEqual([0.8, 0.6, 0.4]);
    expect(compress).not.toHaveBeenCalled();
  });

  it('s’arrête dès que 1 Mo est atteint', async () => {
    const qualities = stubCanvas([0.5 * MB]);
    setup();
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    expect(qualities).toEqual([0.8]);
  });

  it('envoie le résultat entre 1 et 2 Mo à 0,4', async () => {
    stubCanvas([5 * MB, 3 * MB, 1.5 * MB]);
    setup();
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
  });

  it('abandonne si 0,4 dépasse 2 Mo, avec le message dédié, sans envoi', async () => {
    stubCanvas([5 * MB, 4 * MB, 3 * MB]);
    setup();
    expect(await screen.findByText(fr.support.errors.tooHeavyToReduce)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(compress).not.toHaveBeenCalled();
  });

  it('message d’abandon en FR et EN, vouvoiement', () => {
    expect(fr.support.errors.tooHeavyToReduce).toContain('Veuillez');
    expect(en.support.errors.tooHeavyToReduce).toBeTruthy();
  });
});
