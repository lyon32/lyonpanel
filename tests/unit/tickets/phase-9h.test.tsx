import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES } from '@/components/tickets/attachment-upload';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

describe('9.3h', () => {
  it('limite la source à 8 Mo et a un message FR/EN', () => {
    expect(MAX_SOURCE_BYTES).toBe(8 * 1024 * 1024);
    expect(fr.support.errors.fileTooBig).toContain('8 Mo');
    expect(en.support.errors.fileTooBig).toContain('8 MB');
  });
  it('a les textes de pagination FR/EN', () => {
    expect(fr.support.list.more).toBe('Voir plus');
    expect(en.support.list.backToStart).toBeTruthy();
  });
});
