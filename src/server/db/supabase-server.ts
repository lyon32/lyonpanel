import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { loadServerEnv, requireEnv } from '@/server/env';

const SESSION_SECONDS = 7 * 24 * 60 * 60;

/** Client lié à la session du visiteur (cookies httpOnly, SameSite=Lax, Secure en production). */
export async function createSessionClient() {
  const env = loadServerEnv();
  const store = await cookies();
  return createServerClient(
    requireEnv(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          // Pendant le rendu d'une page, Next interdit d'écrire des cookies : on ignore l'écriture
          // (le jeton rafraîchi sera réécrit à la prochaine route ou action), au lieu de planter la page.
          try {
            for (const { name, value, options } of items) {
              store.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                // Un cookie supprimé (maxAge 0) garde sa durée ; les autres durent 7 jours.
                maxAge: options.maxAge === 0 ? 0 : SESSION_SECONDS,
              });
            }
          } catch {
            // Rendu serveur : écriture interdite, voir ci-dessus.
          }
        },
      },
    },
  );
}

/** Client anonyme sans cookie ni mémoire : pour vérifier un mot de passe sans ouvrir de session. */
export function createStatelessClient() {
  const env = loadServerEnv();
  return createClient(
    requireEnv(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
