import type { Sql } from 'postgres';

/**
 * Mu La Ronda: the grand reset shop (mlr.grand_shop, deploy/config/39-vip-grand-reset.sql) and the
 * VIP paid with Mercado Pago (mlr.vip_payments, marketplace/server/vipPayments.ts).
 *
 * The shop sells for grand reset coins only. The game reads a row when it is bought
 * (GameLogic/GrandReset/GrandShop.cs) and the window lists them from the marketplace service, so
 * a change here counts at once, without restarting.
 */

export type GrandShopRow = {
  id: number;
  definitionId: string;
  name: string;
  group: number;
  number: number;
  level: number;
  skill: boolean;
  luck: boolean;
  optionLevel: number;
  excellent: number;
  price: number;
  sort: number;
  active: boolean;
};

export async function listGrandShop(sql: Sql): Promise<GrandShopRow[]> {
  return sql<GrandShopRow[]>`
    SELECT s.id, s.definition_id::text AS "definitionId", d."Name" AS name, d."Group" AS "group", d."Number" AS number,
           s.level, s.skill, s.luck, s.option_level AS "optionLevel", s.excellent, s.price, s.sort, s.active
      FROM mlr.grand_shop s JOIN config."ItemDefinition" d ON d."Id" = s.definition_id
     ORDER BY s.sort, s.id`;
}

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function clean(input: Record<string, unknown>) {
  return {
    level: int(input.level, 0, 15, 0),
    skill: !!input.skill,
    luck: !!input.luck,
    option_level: int(input.optionLevel, 0, 7, 0),
    excellent: int(input.excellent, 0, 63, 0),
    price: int(input.price, 1, 1_000_000_000, 1),
    sort: int(input.sort, -1000, 1000, 0),
    active: input.active === undefined ? true : !!input.active,
  };
}

export async function addGrandShopItem(sql: Sql, input: Record<string, unknown>) {
  const definitionId = String(input.definitionId ?? '');
  const [def] = await sql`SELECT 1 FROM config."ItemDefinition" WHERE "Id"::text = ${definitionId}`;
  if (!def) throw new Error('Elegí un item');
  const row = clean(input);
  await sql`INSERT INTO mlr.grand_shop ${sql({ ...row, definition_id: definitionId })}`;
}

export async function updateGrandShopItem(sql: Sql, id: number, input: Record<string, unknown>) {
  const updated = await sql`UPDATE mlr.grand_shop SET ${sql(clean(input))} WHERE id = ${id} RETURNING 1`;
  if (!updated.length) throw new Error('Ese item ya no está');
}

export async function deleteGrandShopItem(sql: Sql, id: number) {
  await sql`DELETE FROM mlr.grand_shop WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// VIP with Mercado Pago
// ---------------------------------------------------------------------------

export type VipPaymentRow = {
  id: string;
  login: string;
  tier: number;
  months: number;
  amount: number;
  status: string;
  mpPaymentId: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  grantedAt: string | null;
};

/** The payments (newest first) and, per account, the paid months of each tier - what to give again in production. */
export async function vipPayments(sql: Sql) {
  const [exists] = await sql`SELECT to_regclass('mlr.vip_payments') IS NOT NULL AS ok`;
  if (!exists.ok) return { payments: [], totals: [], prices: await vipPriceSettings(sql) };
  const payments = await sql<VipPaymentRow[]>`
    SELECT id::text, login, tier, months, amount::float AS amount, status, mp_payment_id AS "mpPaymentId", note,
           created_at AS "createdAt", paid_at AS "paidAt", granted_at AS "grantedAt"
      FROM mlr.vip_payments ORDER BY created_at DESC LIMIT 300`;
  const totals = await sql<{ login: string; silverMonths: number; goldMonths: number; amount: number }[]>`
    SELECT login,
           COALESCE(sum(months) FILTER (WHERE tier = 2), 0)::int AS "silverMonths",
           COALESCE(sum(months) FILTER (WHERE tier = 3), 0)::int AS "goldMonths",
           sum(amount)::float AS amount
      FROM mlr.vip_payments WHERE status IN ('paid', 'granted')
     GROUP BY login ORDER BY amount DESC`;
  return { payments, totals, prices: await vipPriceSettings(sql) };
}

async function vipPriceSettings(sql: Sql) {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM mlr.settings WHERE key IN ('vip_price_2', 'vip_price_3')`;
  const get = (key: string, d: number) => Number(rows.find(r => r.key === key)?.value ?? d);
  return { silver: get('vip_price_2', 1), gold: get('vip_price_3', 2) };
}

/** The silver and gold prices in pesos (the marketplace service reads them for each checkout). */
export async function setVipPrices(sql: Sql, input: Record<string, unknown>) {
  for (const [key, field] of [['vip_price_2', 'silver'], ['vip_price_3', 'gold']] as const) {
    const value = Math.round(Number(input[field]) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) continue;
    await sql`INSERT INTO mlr.settings (key, value) VALUES (${key}, ${String(value)})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}
