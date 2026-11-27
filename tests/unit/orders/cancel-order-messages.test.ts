import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

/* Aucun remboursement automatique : le texte client ne promet plus de remboursement immédiat. */
const tr = (m: unknown) => (m as { orderTracking: Record<string, string> }).orderTracking;

describe('messages d annulation client', () => {
  it('FR : la confirmation et le succès parlent d une demande examinée par l équipe', () => {
    expect(tr(fr).cancelDone).toMatch(/demande d.annulation reçue/i);
    expect(tr(fr).cancelDone).toMatch(/examin/i);
    expect(tr(fr).cancelDone).not.toMatch(/solde rembours/i);
    expect(tr(fr).cancelConfirm).not.toMatch(/serez rembours/i);
  });

  it('EN : la confirmation et le succès parlent d une demande examinée par l équipe', () => {
    expect(tr(en).cancelDone).toMatch(/cancellation request received/i);
    expect(tr(en).cancelDone).toMatch(/review/i);
    expect(tr(en).cancelDone).not.toMatch(/balance refunded/i);
    expect(tr(en).cancelConfirm).not.toMatch(/will be refunded/i);
  });
});
