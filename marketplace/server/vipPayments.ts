import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { DATABASE_URL } from './boxes';
import { confirmLive, verifyTicket } from './identity';

/**
 * Mu La Ronda: the VIP paid with Mercado Pago (silver and gold; bronze is bought with zen in the
 * game), and the public list of the grand reset shop.
 *
 *   POST /api/market/vip/checkout   the VIP window asks to pay a tier: the ticket names the
 *                                   account, the nonce proves the player is at it. An order goes
 *                                   to mlr.vip_payments and Mercado Pago makes the checkout
 *                                   (Checkout Pro); the window opens its link.
 *   POST /api/market/vip/webhook    Mercado Pago says a payment changed. Nothing in the call is
 *                                   believed: the payment is read back from Mercado Pago's API.
 *   GET  /api/market/vip/orders     the account's orders, for the window to show how they went.
 *   GET  /api/market/grand-shop     the grand reset shop (mlr.grand_shop), public.
 *
 * A paid order is granted at once: through OpenMU (Web/AdminPanel/API/MlrVipController.cs) when
 * the account is in the game - it holds the account in memory - or in the database when not.
 * Every 60 s the pending orders are looked up in Mercado Pago too (a webhook that never arrived)
 * and the paid ones not granted yet are tried again (OpenMU down, a tier in the way).
 *
 * Every order stays in mlr.vip_payments: it is what each account paid during the beta, to be
 * given again when the game goes to production.
 *
 * Needs MP_ACCESS_TOKEN (Mercado Pago, "Credenciales de produccion" or of a test user) and
 * PUBLIC_URL (https://<DOMAIN>, for the webhook and the way back to the game).
 */

const MP_API = 'https://api.mercadopago.com';
const MP_TOKEN = process.env.MP_ACCESS_TOKEN ?? '';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
const OPENMU_API_URL = process.env.OPENMU_API_URL || 'http://127.0.0.1:8090';

const TIERS = ['Sin VIP', 'Bronce', 'Plata', 'Oro'] as const;
/** Paid with Mercado Pago; bronze is zen in the game. */
const PAID_TIERS = new Set([2, 3]);
const DEFAULT_PRICES: Record<number, number> = { 2: 1, 3: 2 };
const MAX_MONTHS = 12;
const DAY_MS = 86_400_000;
const VIP_DAYS = 30;

const VIP_TIER = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e81';
const VIP_EXPIRES = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e82';
const VIP_NEXT_TIER = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e83';
const VIP_NEXT_DAYS = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e84';

const sql = postgres(DATABASE_URL, { max: 4 });

type Json = Record<string, unknown>;
type Cors = Record<string, string>;
type Order = {
  id: string;
  account_id: string;
  login: string;
  tier: number;
  months: number;
  amount: string;
  status: string;
  mp_payment_id: string | null;
};

const json = (body: unknown, status = 200, cors: Cors = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

async function readBody(req: Request): Promise<Json> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Json) : {};
  } catch {
    return {};
  }
}

/** The prices in pesos, per tier (mlr.settings vip_price_2 / vip_price_3, the panel edits them). */
export async function vipPrices(): Promise<Record<number, number>> {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM mlr.settings WHERE key IN ('vip_price_2', 'vip_price_3')`;
  const prices = { ...DEFAULT_PRICES };
  for (const row of rows) {
    const value = Number(row.value);
    if (Number.isFinite(value) && value > 0) prices[Number(row.key.slice(-1))] = value;
  }
  return prices;
}

// ---------------------------------------------------------------------------
// The account's VIP, as the game keeps it (GameLogic/VipSystem/Vip.cs)
// ---------------------------------------------------------------------------

type VipRows = { tier: number; expires: number; nextTier: number; nextDays: number };

async function readVip(tx: postgres.Sql | postgres.TransactionSql, accountId: string): Promise<VipRows> {
  const rows = await tx<{ def: string; value: number }[]>`
    SELECT "DefinitionId"::text AS def, "Value" AS value FROM data."StatAttribute"
     WHERE "AccountId" = ${accountId}::uuid
       AND "DefinitionId" IN (${VIP_TIER}::uuid, ${VIP_EXPIRES}::uuid, ${VIP_NEXT_TIER}::uuid, ${VIP_NEXT_DAYS}::uuid)`;
  const value = (def: string) => Number(rows.find(r => r.def === def)?.value ?? 0);
  let tier = Math.round(value(VIP_TIER));
  let expires = value(VIP_EXPIRES);
  let nextTier = Math.round(value(VIP_NEXT_TIER));
  let nextDays = value(VIP_NEXT_DAYS);
  const today = Date.now() / DAY_MS;
  // The waiting tier starts where the current one ended (Vip.Of).
  if (expires <= today && nextTier > 0 && nextDays > 0) {
    expires = (tier > 0 ? expires : today) + nextDays;
    tier = nextTier;
    nextTier = 0;
    nextDays = 0;
  }
  if (tier <= 0 || expires <= today) tier = 0;
  return { tier, expires, nextTier, nextDays };
}

/** Why the account can't get this tier now (Vip.AddMonths' rules), or null. */
function refusal(vip: VipRows, tier: number): string | null {
  if (vip.tier > tier) return `Tenés VIP ${TIERS[vip.tier]} activo: no podés sumar uno más bajo.`;
  if (vip.tier > 0 && tier > vip.tier && vip.nextTier > 0 && vip.nextTier !== tier) {
    return `Ya tenés VIP ${TIERS[vip.nextTier]} esperando a que termine el ${TIERS[vip.tier]}.`;
  }
  return null;
}

async function writeAttribute(tx: postgres.TransactionSql, accountId: string, definition: string, value: number) {
  const updated = await tx`
    UPDATE data."StatAttribute" SET "Value" = ${value}
     WHERE "AccountId" = ${accountId}::uuid AND "DefinitionId" = ${definition}::uuid RETURNING 1`;
  if (!updated.length) {
    await tx`
      INSERT INTO data."StatAttribute" ("Id", "DefinitionId", "Value", "AccountId")
      VALUES (gen_random_uuid(), ${definition}::uuid, ${value}, ${accountId}::uuid)`;
  }
}

/** Adds the months in the database, for an account that is not in the game. */
async function grantInDatabase(accountId: string, tier: number, months: number): Promise<string | null> {
  return sql.begin(async tx => {
    const vip = await readVip(tx, accountId);
    const why = refusal(vip, tier);
    if (why) return why;
    const days = VIP_DAYS * months;
    if (vip.tier > 0 && tier > vip.tier) {
      // Waits for the current one to end.
      await writeAttribute(tx, accountId, VIP_TIER, vip.tier);
      await writeAttribute(tx, accountId, VIP_EXPIRES, vip.expires);
      await writeAttribute(tx, accountId, VIP_NEXT_TIER, tier);
      await writeAttribute(tx, accountId, VIP_NEXT_DAYS, (vip.nextTier === tier ? vip.nextDays : 0) + days);
    } else {
      const from = vip.tier === tier ? vip.expires : Date.now() / DAY_MS;
      await writeAttribute(tx, accountId, VIP_TIER, tier);
      await writeAttribute(tx, accountId, VIP_EXPIRES, from + days);
      await writeAttribute(tx, accountId, VIP_NEXT_TIER, vip.nextTier);
      await writeAttribute(tx, accountId, VIP_NEXT_DAYS, vip.nextDays);
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// OpenMU's API, for an account in the game (its own key, as admin/server/openmuApi.ts makes)
// ---------------------------------------------------------------------------

const KEY_SETTING = 'openmu_api_key_payments';
const KEY_NAME = 'Mu La Ronda pagos';
let cachedKey: string | null = null;
const hashOf = (key: string) => createHash('sha256').update(key, 'utf8').digest('base64');

async function apiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const [stored] = await sql<{ value: string }[]>`SELECT value FROM mlr.settings WHERE key = ${KEY_SETTING}`;
  if (stored) {
    const [row] = await sql`SELECT 1 FROM admin."ApiKey" WHERE "KeyHash" = ${hashOf(stored.value)} AND NOT "IsDisabled"`;
    if (row) return (cachedKey = stored.value);
  }
  const key = randomBytes(36).toString('base64url');
  await sql.begin(async tx => {
    await tx`DELETE FROM admin."ApiKey" WHERE "Name" = ${KEY_NAME}`;
    await tx`
      INSERT INTO admin."ApiKey" ("Id", "Name", "KeyHash", "KeyPrefix", "Roles", "IsDisabled", "CreatedAt")
      VALUES (gen_random_uuid(), ${KEY_NAME}, ${hashOf(key)}, ${key.slice(0, 12)}, 'Operator', false, now())`;
    await tx`
      INSERT INTO mlr.settings (key, value) VALUES (${KEY_SETTING}, ${key})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  });
  return (cachedKey = key);
}

/** 'granted', 'offline' (not in the game), or the reason OpenMU refused; throws when it can't be asked. */
async function grantInGame(accountId: string, tier: number, months: number, message: string): Promise<'granted' | 'offline' | { refused: string }> {
  const send = async () =>
    fetch(`${OPENMU_API_URL}/api/mlr/vip/${accountId}/grant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Api-Key': await apiKey() },
      body: JSON.stringify({ tier, months, message }),
      signal: AbortSignal.timeout(8000),
    });
  let res = await send();
  if (res.status === 401 || res.status === 403) {
    cachedKey = null;
    await sql`DELETE FROM mlr.settings WHERE key = ${KEY_SETTING}`;
    res = await send();
  }
  if (res.ok) return 'granted';
  const body = (await res.json().catch(() => null)) as { error?: string; online?: boolean } | null;
  if (res.status === 404 && body?.online === false) return 'offline';
  if (res.status === 409 && body?.error) return { refused: body.error };
  throw new Error(`OpenMU respondió ${res.status}`);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

async function grant(order: Order): Promise<void> {
  const message = `VIP ${TIERS[order.tier]} acreditado: gracias por tu pago. Lo guardamos para devolvértelo al salir a producción.`;
  let result: Awaited<ReturnType<typeof grantInGame>>;
  try {
    result = await grantInGame(order.account_id, order.tier, order.months, message);
  } catch (error) {
    // OpenMU can't be asked: whether the account plays is unknown, so nothing is written now.
    console.error(`vip: order ${order.id} not granted yet:`, error instanceof Error ? error.message : error);
    return;
  }
  const refused = result === 'offline' ? await grantInDatabase(order.account_id, order.tier, order.months) : result === 'granted' ? null : result.refused;
  if (refused) {
    await sql`UPDATE mlr.vip_payments SET note = ${refused} WHERE id = ${order.id}::uuid`;
    console.error(`vip: order ${order.id} paid but not granted: ${refused}`);
    return;
  }
  await sql`UPDATE mlr.vip_payments SET status = 'granted', granted_at = now(), note = NULL WHERE id = ${order.id}::uuid AND status = 'paid'`;
  console.info(`vip: order ${order.id} granted (${order.login}, ${TIERS[order.tier]} x${order.months})`);
}

type MpPayment = { id: number; status: string; external_reference?: string; transaction_amount?: number; currency_id?: string };

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Takes what Mercado Pago says about one payment to its order. */
async function settle(payment: MpPayment): Promise<void> {
  const id = payment.external_reference;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const [order] = await sql<Order[]>`SELECT * FROM mlr.vip_payments WHERE id = ${id}::uuid`;
  if (!order) return;

  if (payment.status === 'approved') {
    if (payment.currency_id !== 'ARS' || Number(payment.transaction_amount ?? 0) + 0.001 < Number(order.amount)) {
      console.error(`vip: payment ${payment.id} for order ${id} is ${payment.transaction_amount} ${payment.currency_id}, not ${order.amount} ARS`);
      await sql`UPDATE mlr.vip_payments SET note = 'el monto pagado no coincide' WHERE id = ${id}::uuid`;
      return;
    }
    const [paid] = await sql<Order[]>`
      UPDATE mlr.vip_payments SET status = 'paid', paid_at = now(), mp_payment_id = ${String(payment.id)}
       WHERE id = ${id}::uuid AND status = 'pending' RETURNING *`;
    if (paid) await grant(paid);
  } else if ((payment.status === 'rejected' || payment.status === 'cancelled') && order.status === 'pending') {
    await sql`UPDATE mlr.vip_payments SET status = ${payment.status}, mp_payment_id = ${String(payment.id)} WHERE id = ${id}::uuid AND status = 'pending'`;
  }
}

/** The webhook that never came, and the paid orders that could not be granted. */
export async function sweepVipPayments(): Promise<void> {
  if (!MP_TOKEN) return;
  try {
    const pending = await sql<{ id: string }[]>`
      SELECT id::text FROM mlr.vip_payments
       WHERE status = 'pending' AND created_at > now() - interval '3 days' ORDER BY created_at DESC LIMIT 50`;
    for (const { id } of pending) {
      const found = await mp<{ results: MpPayment[] }>(`/v1/payments/search?external_reference=${id}&sort=date_created&criteria=desc`);
      const best = found.results.find(p => p.status === 'approved') ?? found.results[0];
      if (best) await settle(best);
    }
    const paid = await sql<Order[]>`SELECT * FROM mlr.vip_payments WHERE status = 'paid' ORDER BY paid_at LIMIT 50`;
    for (const order of paid) await grant(order);
  } catch (error) {
    console.error('vip: sweep failed:', error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** The routes of this file, or null for a path that is not one of them. */
export async function handleVipRoute(req: Request, url: URL, cors: Cors): Promise<Response | null> {
  const path = url.pathname;

  if (path === '/api/market/grand-shop' && req.method === 'GET') {
    const items = await sql`
      SELECT s.id, d."Group" AS "group", d."Number" AS number, d."Name" AS name, s.level, s.skill, s.luck,
             s.option_level AS "optionLevel", s.excellent, s.price
        FROM mlr.grand_shop s JOIN config."ItemDefinition" d ON d."Id" = s.definition_id
       WHERE s.active ORDER BY s.sort, s.id`;
    return json({ items }, 200, { ...cors, 'Cache-Control': 'no-store' });
  }

  if (path === '/api/market/vip/prices' && req.method === 'GET') {
    return json({ prices: await vipPrices(), currency: 'ARS', enabled: !!MP_TOKEN }, 200, cors);
  }

  if (path === '/api/market/vip/webhook' && req.method === 'POST') {
    // Mercado Pago's two shapes: {type: 'payment', data: {id}} and ?topic=payment&id=.
    const body = await readBody(req);
    const type = String(body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '');
    const id = String((body.data as Json | undefined)?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '');
    if (type === 'payment' && /^\d+$/.test(id) && MP_TOKEN) {
      try {
        await settle(await mp<MpPayment>(`/v1/payments/${id}`));
      } catch (error) {
        console.error('vip: webhook', id, error instanceof Error ? error.message : error);
        return json({ ok: false }, 500);
      }
    }
    return json({ ok: true });
  }

  if (path === '/api/market/vip/orders' && req.method === 'GET') {
    const verified = verifyTicket(url.searchParams.get('ticket'));
    if (!verified.ok) return json({ error: 'Tu sesión venció.', retry: true }, 401, cors);
    const orders = await sql`
      SELECT id, tier, months, amount::float AS amount, status, created_at AS "createdAt", granted_at AS "grantedAt", note
        FROM mlr.vip_payments WHERE lower(login) = ${verified.account} ORDER BY created_at DESC LIMIT 10`;
    return json({ orders }, 200, cors);
  }

  if (path === '/api/market/vip/checkout' && req.method === 'POST') {
    const body = await readBody(req);
    const verified = verifyTicket(body.ticket);
    if (!verified.ok) return json({ error: 'Tu sesión venció.', retry: true }, 401, cors);
    const live = await confirmLive(body.session, verified.account);
    if (!live.ok) return json({ error: live.message, retry: live.reason === 'unknown' }, 403, cors);
    if (!MP_TOKEN || !PUBLIC_URL) return json({ error: 'Los pagos con Mercado Pago no están habilitados todavía.' }, 503, cors);

    const tier = Number(body.tier);
    const months = Number(body.months ?? 1);
    if (!PAID_TIERS.has(tier) || !Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
      return json({ error: 'Elegí VIP Plata u Oro y de 1 a 12 meses.' }, 400, cors);
    }

    const [account] = await sql<{ id: string; login: string }[]>`
      SELECT "Id"::text AS id, "LoginName" AS login FROM data."Account" WHERE lower("LoginName") = ${verified.account}`;
    if (!account) return json({ error: 'No encontramos tu cuenta.' }, 404, cors);

    const why = refusal(await readVip(sql, account.id), tier);
    if (why) return json({ error: why }, 409, cors);

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM mlr.vip_payments
       WHERE account_id = ${account.id}::uuid AND status = 'pending' AND created_at > now() - interval '1 hour'`;
    if (count >= 5) return json({ error: 'Tenés varios pagos sin terminar; esperá un rato.' }, 429, cors);

    const prices = await vipPrices();
    const amount = Math.round(prices[tier] * months * 100) / 100;
    const id = randomUUID();
    await sql`
      INSERT INTO mlr.vip_payments (id, account_id, login, tier, months, amount)
      VALUES (${id}::uuid, ${account.id}::uuid, ${account.login}, ${tier}, ${months}, ${amount})`;

    try {
      const preference = await mp<{ id: string; init_point: string }>('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            {
              id: `vip-${tier}`,
              title: `VIP ${TIERS[tier]} - ${months} ${months === 1 ? 'mes' : 'meses'} - Mu La Ronda`,
              description: `Cuenta ${account.login}`,
              quantity: 1,
              unit_price: amount,
              currency_id: 'ARS',
            },
          ],
          external_reference: id,
          notification_url: `${PUBLIC_URL}/api/market/vip/webhook`,
          back_urls: { success: `${PUBLIC_URL}/vip.html?estado=ok`, pending: `${PUBLIC_URL}/vip.html?estado=pending`, failure: `${PUBLIC_URL}/vip.html?estado=failed` },
          auto_return: 'approved',
          statement_descriptor: 'MU LA RONDA',
        }),
      });
      await sql`UPDATE mlr.vip_payments SET mp_preference = ${preference.id} WHERE id = ${id}::uuid`;
      return json({ order: id, url: preference.init_point, amount }, 200, cors);
    } catch (error) {
      await sql`UPDATE mlr.vip_payments SET status = 'cancelled', note = 'no se pudo crear el pago' WHERE id = ${id}::uuid`;
      console.error('vip: checkout', error instanceof Error ? error.message : error);
      return json({ error: 'Mercado Pago no respondió, probá de nuevo en un rato.' }, 502, cors);
    }
  }

  return null;
}
