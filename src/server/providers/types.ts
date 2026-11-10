import { z } from 'zod';

// Nombre envoyé en texte ou en nombre par le fournisseur ("0.756", 10, "10") : on le lit en nombre fini.
const numberLike = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((v) => Number(v))
  .pipe(z.number().finite());

const positiveInt = numberLike.pipe(z.number().int().positive());
// Plafond : un coût aberrant (erreur du fournisseur) est refusé au lieu de produire un prix absurde.
export const MAX_RATE_USD_1000 = 100_000;
const cost = numberLike.pipe(z.number().nonnegative().max(MAX_RATE_USD_1000));

/** Un service tel que l'API v2 le renvoie ; `rate` = coût en USD pour 1 000. */
export const providerServiceSchema = z
  .object({
    service: z.number().int().positive(),
    name: z.string(),
    type: z.string(),
    rate: cost,
    min: positiveInt,
    max: positiveInt,
    dripfeed: z.boolean().default(false),
    refill: z.boolean().default(false),
    cancel: z.boolean().default(false),
    category: z.string(),
  })
  .refine((s) => s.min <= s.max, { message: 'min > max', path: ['min'] });

export const providerServicesSchema = z.array(providerServiceSchema);
export type ProviderService = z.infer<typeof providerServiceSchema>;

export const providerBalanceSchema = z.object({
  balance: numberLike,
  currency: z.literal('USD'),
});
export type ProviderBalance = z.infer<typeof providerBalanceSchema>;

export const providerAddSchema = z.object({ order: z.number().int().positive() });

export const providerStatusSchema = z.object({
  status: z.string(),
  charge: numberLike.optional(),
  start_count: numberLike.optional(),
  remains: numberLike.optional(),
  currency: z.string().optional(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export interface ProviderAddInput {
  service: number;
  link: string;
  quantity: number;
  comments?: string[];
}

/** Contrat commun du vrai client et du faux. `add` ne doit JAMAIS être relancé automatiquement. */
export interface ProviderApi {
  services(): Promise<ProviderService[]>;
  balance(): Promise<ProviderBalance>;
  add(input: ProviderAddInput): Promise<{ order: number }>;
  status(ids: number[]): Promise<Record<number, ProviderStatus>>;
}
