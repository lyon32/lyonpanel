import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  loginSchema,
  normalizePhone,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/schemas/auth';
import { AFRICAN_COUNTRIES, isAfricanCountry } from '@/lib/countries';

const valid = {
  email: 'client-1@lyonpanel.test',
  password: 'Un-bon-mot-de-passe-42',
  phone: '+237600000001',
  country: 'CM',
  display_currency: 'XAF',
  language: 'fr',
  turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX',
};

function fieldsInError(input: unknown): string[] {
  const res = registerSchema.safeParse(input);
  return res.success ? [] : res.error.issues.map((i) => String(i.path[0]));
}

describe('normalizePhone', () => {
  it('retire espaces, points, tirets et parenthèses', () => {
    expect(normalizePhone('+237 6 90 00 00 12')).toBe('+237690000012');
    expect(normalizePhone('+237.690-000(012)')).toBe('+237690000012');
  });
  it('accepte 8 et 15 chiffres, refuse 7 et 16', () => {
    expect(normalizePhone('+12345678')).toBe('+12345678');
    expect(normalizePhone('+123456789012345')).toBe('+123456789012345');
    expect(normalizePhone('+1234567')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
  });
  it('refuse un numéro sans + initial, avec lettres ou vide', () => {
    expect(normalizePhone('690000012')).toBeNull();
    expect(normalizePhone('+2376900abc12')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('passwordSchema', () => {
  it('accepte 8 et 72 caractères', () => {
    expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
  });
  it('refuse 7 et 73 caractères', () => {
    expect(passwordSchema.safeParse('a'.repeat(7)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });
});

describe('countries', () => {
  it("liste les 54 pays d'Afrique en codes ISO à 2 lettres majuscules", () => {
    expect(AFRICAN_COUNTRIES).toHaveLength(54);
    for (const c of AFRICAN_COUNTRIES) expect(c).toMatch(/^[A-Z]{2}$/);
    expect(new Set(AFRICAN_COUNTRIES).size).toBe(54);
  });
  it('accepte CM, SN, CI, NG, EG, ZA et refuse FR, US, ZZ', () => {
    for (const c of ['CM', 'SN', 'CI', 'NG', 'EG', 'ZA']) expect(isAfricanCountry(c)).toBe(true);
    for (const c of ['FR', 'US', 'ZZ', 'CMR', '']) expect(isAfricanCountry(c)).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepte une inscription valide', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });
  it("met l'email en minuscules, retire les espaces et normalise le téléphone", () => {
    const res = registerSchema.parse({
      ...valid,
      email: '  Client-1@LyonPanel.TEST ',
      phone: '+237 600 000 001',
    });
    expect(res.email).toBe('client-1@lyonpanel.test');
    expect(res.phone).toBe('+237600000001');
  });
  it('refuse un email invalide ou de plus de 254 caractères', () => {
    expect(fieldsInError({ ...valid, email: 'pas-un-email' })).toContain('email');
    const long = `${'a'.repeat(250)}@x.co`;
    expect(fieldsInError({ ...valid, email: long })).toContain('email');
  });
  it('refuse un téléphone non E.164', () => {
    expect(fieldsInError({ ...valid, phone: '0600000001' })).toContain('phone');
  });
  it('refuse un pays hors Afrique', () => {
    expect(fieldsInError({ ...valid, country: 'FR' })).toContain('country');
  });
  it('refuse une devise ou une langue inconnue', () => {
    expect(fieldsInError({ ...valid, display_currency: 'EUR' })).toContain('display_currency');
    expect(fieldsInError({ ...valid, language: 'es' })).toContain('language');
  });
  it('accepte XAF, XOF et USD', () => {
    for (const c of ['XAF', 'XOF', 'USD'])
      expect(registerSchema.safeParse({ ...valid, display_currency: c }).success).toBe(true);
  });
  it("refuse un mot de passe égal à l'email", () => {
    const email = 'jean.dupont@lyonpanel.test';
    expect(fieldsInError({ ...valid, email, password: email })).toContain('password');
  });
  it('refuse un mot de passe égal au téléphone (avec ou sans espaces)', () => {
    expect(fieldsInError({ ...valid, password: '+237600000001' })).toContain('password');
    expect(
      fieldsInError({ ...valid, phone: '+237 600 000 001', password: '+237600000001' }),
    ).toContain('password');
  });
  it('exige le jeton Turnstile', () => {
    const sansJeton: Partial<typeof valid> = { ...valid };
    delete sansJeton.turnstile_token;
    expect(fieldsInError(sansJeton)).toContain('turnstile_token');
    expect(fieldsInError({ ...valid, turnstile_token: '' })).toContain('turnstile_token');
  });
  it('accepte un code de parrainage facultatif', () => {
    expect(registerSchema.safeParse({ ...valid, referral_code: 'ABC123' }).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepte un email ou un téléphone comme identifiant, normalisés', () => {
    const a = loginSchema.parse({
      identifier: ' Client@LyonPanel.test ',
      password: 'x',
      turnstile_token: 't',
    });
    expect(a.identifier).toBe('client@lyonpanel.test');
    const b = loginSchema.parse({
      identifier: '+237 600 000 001',
      password: 'x',
      turnstile_token: 't',
    });
    expect(b.identifier).toBe('+237600000001');
  });
  it('refuse un identifiant ni email ni téléphone', () => {
    expect(
      loginSchema.safeParse({ identifier: 'bonjour', password: 'x', turnstile_token: 't' }).success,
    ).toBe(false);
  });
  it('ne rejette pas un ancien mot de passe faible (règles de création seulement)', () => {
    expect(
      loginSchema.safeParse({ identifier: 'a@b.co', password: '123', turnstile_token: 't' })
        .success,
    ).toBe(true);
  });
  it('exige mot de passe et Turnstile', () => {
    expect(
      loginSchema.safeParse({ identifier: 'a@b.co', password: '', turnstile_token: 't' }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ identifier: 'a@b.co', password: 'x' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema et resetPasswordSchema', () => {
  it('forgot : email normalisé + Turnstile obligatoire', () => {
    expect(forgotPasswordSchema.parse({ email: ' A@B.CO ', turnstile_token: 't' }).email).toBe(
      'a@b.co',
    );
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
  });
  it('reset : jeton non vide et nouveau mot de passe 8–72', () => {
    const ok = (token: string, n: number) =>
      resetPasswordSchema.safeParse({ token, new_password: 'a'.repeat(n) }).success;
    expect(ok('abc', 8)).toBe(true);
    expect(ok('', 8)).toBe(false);
    expect(ok('abc', 7)).toBe(false);
    expect(ok('abc', 73)).toBe(false);
  });
});
