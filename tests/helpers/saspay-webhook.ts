import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

// Secret fictif, réservé aux tests : jamais une vraie valeur SasPay.
export const TEST_WEBHOOK_SECRET = 'whsec_test_only_not_a_real_secret';

/** Signature SasPay : HMAC-SHA256 hexadécimal minuscule de `timestamp + "." + corps brut`. */
export function signWebhook(
  rawBody: string,
  timestamp: string | number,
  secret: string = TEST_WEBHOOK_SECRET,
): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export type WebhookData = Record<string, unknown>;

/** Charge `data` d'un webhook SasPay en ADD_ON : le client paie `charged`, on reçoit `net_amount`. */
export function webhookData(over: WebhookData = {}): WebhookData {
  return {
    id: 'txn_test_1',
    reference: 'ref_test_1',
    status: 'SUCCESS',
    amount: '3000.00',
    fee: '90.00',
    charged: '3090.00',
    net_amount: '3000.00',
    fee_charge_mode: 'ADD_ON',
    currency: 'XAF',
    country: 'CM',
    network: 'mtn_cm',
    msisdn: '+237600000001',
    ...over,
  };
}

export type BuiltWebhook = {
  rawBody: string;
  timestamp: string;
  signature: string;
  headers: Headers;
};

/** Fabrique un webhook signé. `signature`, `timestamp`, `secret` modifiables pour les cas d'erreur. */
export function buildWebhook(
  opts: {
    event?: string;
    data?: WebhookData;
    rawBody?: string;
    timestamp?: number;
    secret?: string;
    signature?: string;
  } = {},
): BuiltWebhook {
  const event = opts.event ?? 'transaction.success';
  const rawBody = opts.rawBody ?? JSON.stringify({ event, data: opts.data ?? webhookData() });
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = opts.signature ?? signWebhook(rawBody, timestamp, opts.secret);
  const headers = new Headers({
    'content-type': 'application/json',
    'x-webhook-signature': signature,
    'x-webhook-timestamp': timestamp,
    'x-webhook-event': event,
  });
  return { rawBody, timestamp, signature, headers };
}

export function webhookRequest(built: BuiltWebhook): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/saspay', {
    method: 'POST',
    headers: built.headers,
    body: built.rawBody,
  });
}
