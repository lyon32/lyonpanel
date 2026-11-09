import 'server-only';
import { loadServerEnv } from '@/server/env';

export type OwnerEvent =
  | 'order_failed'
  | 'low_provider_balance'
  | 'price_jump'
  | 'payment_mismatch'
  | 'new_ticket'
  | 'internal_error';

/**
 * Alerte le propriétaire sur Telegram. Ne lève jamais : une alerte ratée
 * ne doit pas aggraver l'erreur d'origine. Sans variables : ne fait rien.
 */
export async function notifyOwner(event: OwnerEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = loadServerEnv();
    if (!token || !chatId) return;
    const text = `[LyonPanel] ${event}\n${JSON.stringify(data)}`.slice(0, 4000);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Volontairement muet : le message d'erreur pourrait contenir le jeton du bot.
  }
}
