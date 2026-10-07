import type { Sql } from 'postgres';

/**
 * VIP discount codes (mlr.vip_codes, deploy/config/10-vip.sql). The game's VIP plugin reads the
 * table on every purchase (marketplace/openmu/src/GameLogic/VipSystem/VipDiscountCodes.cs), so a
 * code made or changed here works at once. A player uses one with "/vip oro 3 CODIGO" or the
 * code field of the VIP window.
 */

export type VipCode = {
  id: string;
  code: string;
  percent: number;
  maxUses: number | null;
  uses: number;
  oncePerAccount: boolean;
  active: boolean;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
};

export type VipCodeInput = {
  code?: string;
  percent?: number;
  maxUses?: number | null;
  oncePerAccount?: boolean;
  active?: boolean;
  expiresAt?: string | null;
  note?: string | null;
};

let ensured = false;

/** The same tables the deploy config creates, for a panel that runs before it was applied. */
async function ensure(sql: Sql): Promise<void> {
  if (ensured) return;
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.vip_codes (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code             text NOT NULL,
      percent          integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
      max_uses         integer CHECK (max_uses IS NULL OR max_uses > 0),
      uses             integer NOT NULL DEFAULT 0,
      once_per_account boolean NOT NULL DEFAULT true,
      active           boolean NOT NULL DEFAULT true,
      expires_at       timestamptz,
      note             text,
      created_at       timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS vip_codes_code ON mlr.vip_codes (lower(code))`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.vip_code_uses (
      code_id    uuid NOT NULL REFERENCES mlr.vip_codes(id) ON DELETE CASCADE,
      account_id uuid NOT NULL,
      price      bigint NOT NULL,
      used_at    timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

function cleanCode(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error('El código va de 3 a 24 letras, números, - o _ (sin espacios)');
  return code;
}

function cleanPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('El descuento va de 1 a 100%');
  return n;
}

function cleanMaxUses(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error('Los usos máximos son un número de 1 para arriba (o vacío: sin límite)');
  return n;
}

function cleanDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('La fecha de vencimiento no es válida');
  return date;
}

const cleanNote = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null);

function toCode(r: Record<string, unknown>): VipCode {
  return {
    id: String(r.id),
    code: String(r.code),
    percent: Number(r.percent),
    maxUses: r.max_uses === null ? null : Number(r.max_uses),
    uses: Number(r.uses),
    oncePerAccount: !!r.once_per_account,
    active: !!r.active,
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    note: (r.note as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listCodes(sql: Sql): Promise<VipCode[]> {
  await ensure(sql);
  const rows = await sql`SELECT * FROM mlr.vip_codes ORDER BY created_at DESC`;
  return rows.map(r => toCode(r));
}

async function unique(sql: Sql, code: string, except?: string) {
  const [taken] = await sql`
    SELECT 1 FROM mlr.vip_codes WHERE lower(code) = lower(${code}) AND (${except ?? null}::uuid IS NULL OR id <> ${except ?? null}::uuid)`;
  if (taken) throw new Error(`Ya existe el código ${code}`);
}

export async function createCode(sql: Sql, input: VipCodeInput): Promise<void> {
  await ensure(sql);
  const code = cleanCode(input.code);
  await unique(sql, code);
  await sql`
    INSERT INTO mlr.vip_codes (code, percent, max_uses, once_per_account, active, expires_at, note)
    VALUES (${code}, ${cleanPercent(input.percent)}, ${cleanMaxUses(input.maxUses)}, ${input.oncePerAccount ?? true},
            ${input.active ?? true}, ${cleanDate(input.expiresAt)}, ${cleanNote(input.note)})`;
}

export async function updateCode(sql: Sql, id: string, input: VipCodeInput): Promise<void> {
  await ensure(sql);
  const sets: Record<string, unknown> = {};
  if (input.code !== undefined) {
    sets.code = cleanCode(input.code);
    await unique(sql, sets.code as string, id);
  }
  if (input.percent !== undefined) sets.percent = cleanPercent(input.percent);
  if (input.maxUses !== undefined) sets.max_uses = cleanMaxUses(input.maxUses);
  if (input.oncePerAccount !== undefined) sets.once_per_account = !!input.oncePerAccount;
  if (input.active !== undefined) sets.active = !!input.active;
  if (input.expiresAt !== undefined) sets.expires_at = cleanDate(input.expiresAt);
  if (input.note !== undefined) sets.note = cleanNote(input.note);
  if (!Object.keys(sets).length) return;
  const [row] = await sql`UPDATE mlr.vip_codes SET ${sql(sets)} WHERE id = ${id}::uuid RETURNING id`;
  if (!row) throw new Error('Ese código no existe');
}

export async function deleteCode(sql: Sql, id: string): Promise<void> {
  await ensure(sql);
  await sql`DELETE FROM mlr.vip_codes WHERE id = ${id}::uuid`;
}
