import { z } from 'zod';
import { isAfricanCountry } from '@/lib/countries';

/** E.164 : « + » puis 8 à 15 chiffres (le premier ≠ 0, comme la contrainte de la base). */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Retire espaces, points, tirets et parenthèses ; renvoie null si le résultat n'est pas E.164. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.\-()]/g, '');
  return E164.test(cleaned) ? cleaned : null;
}

// Les messages sont des codes stables : le site les traduit, le serveur ne dicte pas la langue ici.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'INVALID_EMAIL')
  .pipe(z.email('INVALID_EMAIL'));

const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
    return z.NEVER;
  }
  return phone;
});

/** Création de mot de passe : 8 à 72 caractères (72 = limite de bcrypt). */
export const passwordSchema = z.string().min(8, 'PASSWORD_TOO_SHORT').max(72, 'PASSWORD_TOO_LONG');

const turnstileSchema = z.string().min(1, 'TURNSTILE_REQUIRED');

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema,
    country: z.string().refine(isAfricanCountry, 'INVALID_COUNTRY'),
    display_currency: z.enum(['XAF', 'XOF', 'USD']),
    language: z.enum(['fr', 'en']),
    referral_code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'INVALID_REFERRAL_CODE')
      .optional(),
    turnstile_token: turnstileSchema,
  })
  .superRefine((data, ctx) => {
    // Un mot de passe égal à l'email ou au téléphone se devine en une seconde.
    if (data.password.toLowerCase() === data.email || data.password === data.phone) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'PASSWORD_TOO_WEAK' });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/** Identifiant de connexion : email (en minuscules) ou téléphone (E.164). */
const identifierSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    if (email.length <= 254 && z.email().safeParse(email).success) return email;
  } else {
    const phone = normalizePhone(trimmed);
    if (phone) return phone;
  }
  ctx.addIssue({ code: 'custom', message: 'INVALID_IDENTIFIER' });
  return z.NEVER;
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  // Pas de règle de création ici : un ancien mot de passe faible doit pouvoir se connecter.
  password: z.string().min(1, 'PASSWORD_REQUIRED').max(128),
  turnstile_token: turnstileSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  turnstile_token: turnstileSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'TOKEN_REQUIRED').max(2048, 'TOKEN_REQUIRED'),
  new_password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
