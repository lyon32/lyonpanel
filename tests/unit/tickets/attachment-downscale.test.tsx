// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '@/messages/fr.json';
import { AttachmentUpload, MAX_SOURCE_BYTES } from '@/components/tickets/attachment-upload';

// 9.3h : refus au-delà de 8 Mo, réduction à 1600 px avant compression, délai de 20 s.
const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

const wrap = () =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AttachmentUpload onChange={vi.fn()} />
    </NextIntlClientProvider>,
  );

function pick(file: File) {
  fireEvent.change(screen.getByTestId('ticket-attach'), { target: { files: [file] } });
}
const png = (size = 1000) => {
  const f = new File(['x'], 'a.png', { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

function stubCanvas() {
  const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  const canvases: HTMLCanvasElement[] = [];
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = real(tag);
    if (tag === 'canvas') {
      const c = el as HTMLCanvasElement;
      c.getContext = (() => ctx) as unknown as typeof c.getContext;
      c.toBlob = (cb: BlobCallback) => cb(new Blob(['j'], { type: 'image/jpeg' }));
      canvases.push(c);
    }
    return el;
  }) as typeof document.createElement);
  return { ctx, canvases };
}

beforeEach(() => {
  compress.mockReset();
  compress.mockResolvedValue(new File(['s'], 'a.jpg', { type: 'image/jpeg' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ id: 'att-1' }), { status: 201 })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AttachmentUpload : réduction et limites', () => {
  it('refuse un fichier de plus de 8 Mo sans rien décoder ni compresser', async () => {
    const bitmap = vi.fn();
    vi.stubGlobal('createImageBitmap', bitmap);
    wrap();
    pick(png(MAX_SOURCE_BYTES + 1));
    expect(await screen.findByText(fr.support.errors.fileTooBig)).toBeTruthy();
    expect(bitmap).not.toHaveBeenCalled();
    expect(compress).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepte exactement 8 Mo', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    wrap();
    pick(png(MAX_SOURCE_BYTES));
    await waitFor(() => expect(compress).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(fr.support.errors.fileTooBig)).toBeNull();
  });

  it('image large : réduite à 1600 px sur canvas, envoyée sans imageCompression', async () => {
    const close = vi.fn();
    const bitmap = vi.fn(async () => ({ width: 4000, height: 3000, close }));
    vi.stubGlobal('createImageBitmap', bitmap);
    const { ctx, canvases } = stubCanvas();
    wrap();
    pick(png());
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    expect(bitmap).toHaveBeenCalledTimes(1);
    expect(canvases[0]?.width).toBe(1600);
    expect(canvases[0]?.height).toBe(1200);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(close).toHaveBeenCalled();
    expect(compress).not.toHaveBeenCalled();
  });

  it('image déjà petite : réencodée quand même par le canvas, sans agrandir', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    );
    const { canvases } = stubCanvas();
    wrap();
    pick(png());
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    expect(canvases).toHaveLength(1);
    expect(canvases[0]?.width).toBe(800);
    expect(canvases[0]?.height).toBe(600);
    expect(compress).not.toHaveBeenCalled();
  });

  it('sans createImageBitmap : retombe sur imageCompression seule', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const { canvases } = stubCanvas();
    wrap();
    pick(png());
    await waitFor(() => expect(compress).toHaveBeenCalledTimes(1));
    expect(canvases).toHaveLength(0);
    expect(compress.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it('délai de 20 s toujours actif : message d’attente dépassée', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('createImageBitmap', undefined);
    compress.mockImplementation(() => new Promise(() => undefined));
    wrap();
    pick(png());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(19_999);
    });
    expect(screen.queryByText(fr.support.errors.compressTimeout)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(screen.getByText(fr.support.errors.compressTimeout)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('délai de 20 s actif aussi quand le décodage ne répond jamais', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => new Promise(() => undefined)),
    );
    wrap();
    pick(png());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_001);
    });
    expect(screen.getByText(fr.support.errors.compressTimeout)).toBeTruthy();
  });
});
