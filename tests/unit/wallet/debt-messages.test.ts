import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

/*
 * Décision du propriétaire (11.1c) : un client en dette doit d'abord la rembourser, la recharge la rembourse en premier.
 * Clé attendue : wallet.debtNotice (fr.json et en.json), texte avec le marqueur {amount} (dette en XAF, formatée par l'écran).
 */

const notice = (m: typeof fr) => (m.wallet as Record<string, unknown>).debtNotice;

describe('message de dette de la page recharge', () => {
  it('FR : « ta recharge remboursera d’abord ta dette » (avec le montant)', () => {
    const text = String(notice(fr));
    expect(text).toMatch(/rembours/i);
    expect(text).toMatch(/d.abord/i);
    expect(text).toMatch(/dette/i);
    expect(text).toContain('{amount}');
  });

  it('EN : « your top-up will repay your debt first » (avec le montant)', () => {
    const text = String(notice(en as unknown as typeof fr));
    expect(text).toMatch(/debt/i);
    expect(text).toMatch(/first/i);
    expect(text).toMatch(/repay|pay off|clear/i);
    expect(text).toContain('{amount}');
  });
});
