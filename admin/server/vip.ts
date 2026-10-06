import type { Sql } from 'postgres';

/**
 * The account's VIP, as the game's VIP plugin keeps it
 * (marketplace/openmu/src/GameLogic/VipSystem/Vip.cs): two stat attributes of
 * the account, the tier (0 none, 1 bronze, 2 silver, 3 gold) and the expiry in
 * days since 1970-01-01 UTC. The panel can grant one by hand - and a payment
 * (Mercado Pago, later) will write the same two rows.
 */

export const VIP_TIER = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e81';
export const VIP_EXPIRES = '8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e82';
export const VIP_TIERS = ['Sin VIP', 'Bronce', 'Plata', 'Oro'] as const;

const DAY_MS = 86_400_000;

export type VipState = { tier: number; name: string; expiresAt: string | null; active: boolean };

export async function getVip(sql: Sql, accountId: string): Promise<VipState> {
  const rows = await sql<{ def: string; value: number }[]>`
    SELECT "DefinitionId"::text AS def, "Value" AS value FROM data."StatAttribute"
     WHERE "AccountId" = ${accountId}::uuid AND "DefinitionId" IN (${VIP_TIER}::uuid, ${VIP_EXPIRES}::uuid)`;
  const tier = Math.round(rows.find(r => r.def === VIP_TIER)?.value ?? 0);
  const days = rows.find(r => r.def === VIP_EXPIRES)?.value ?? 0;
  const expires = days > 0 ? new Date(days * DAY_MS) : null;
  const active = tier > 0 && tier < VIP_TIERS.length && !!expires && expires.getTime() > Date.now();
  return { tier: active ? tier : 0, name: VIP_TIERS[active ? tier : 0], expiresAt: expires?.toISOString() ?? null, active };
}

/** Sets the tier for `days` days from now (tier 0 takes it away). Only while the account is offline. */
export async function setVip(sql: Sql, accountId: string, tier: number, days: number): Promise<void> {
  if (!Number.isInteger(tier) || tier < 0 || tier >= VIP_TIERS.length) throw new Error('Nivel de VIP invalido');
  const span = Math.max(0, Math.min(3650, Number(days) || 0));
  const expires = tier === 0 ? 0 : (Date.now() + span * DAY_MS) / DAY_MS;
  await sql.begin(async tx => {
    const [account] = await tx`SELECT 1 FROM data."Account" WHERE "Id" = ${accountId}::uuid FOR UPDATE`;
    if (!account) throw new Error('Cuenta inexistente');
    for (const [def, value] of [
      [VIP_TIER, tier],
      [VIP_EXPIRES, expires],
    ] as const) {
      const updated = await tx`
        UPDATE data."StatAttribute" SET "Value" = ${value}
         WHERE "AccountId" = ${accountId}::uuid AND "DefinitionId" = ${def}::uuid RETURNING 1`;
      if (!updated.length) {
        await tx`
          INSERT INTO data."StatAttribute" ("Id", "AccountId", "DefinitionId", "Value")
          VALUES (gen_random_uuid(), ${accountId}::uuid, ${def}::uuid, ${value})`;
      }
    }
  });
}
