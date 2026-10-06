import type { Sql } from 'postgres';

/**
 * Automatic announcements: the golden notice in the middle of the screen,
 * repeated every N minutes (mlr.auto_messages, deploy/config/07-messages.sql).
 * The proxy reads the table and sends them (proxy/announce.ts), so a change
 * here reaches the game within its poll - no OpenMU restart.
 */

export type AutoMessage = {
  id: number;
  text: string;
  intervalMinutes: number;
  enabled: boolean;
  sendNowAt: string | null;
};

export type MessageInput = { text?: string; intervalMinutes?: number; enabled?: boolean };

/** What the proxy puts in one C1 packet; the client cuts long lines in two. */
export const TEXT_MAX = 200;

let ensured = false;

/** The same table the deploy config creates, for a panel that runs before it was applied. */
async function ensure(sql: Sql): Promise<void> {
  if (ensured) return;
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.auto_messages (
      id               serial PRIMARY KEY,
      text             text NOT NULL,
      interval_minutes integer NOT NULL DEFAULT 30 CHECK (interval_minutes BETWEEN 1 AND 1440),
      enabled          boolean NOT NULL DEFAULT true,
      send_now_at      timestamptz,
      created_at       timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Falta el texto');
  const text = value.replace(/[\r\n\t]+/g, ' ').trim();
  if (!text) throw new Error('Falta el texto');
  if (text.length > TEXT_MAX) throw new Error(`El texto puede tener hasta ${TEXT_MAX} caracteres`);
  return text;
}

function cleanInterval(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1440) throw new Error('El intervalo va de 1 a 1440 minutos');
  return n;
}

export async function listMessages(sql: Sql): Promise<AutoMessage[]> {
  await ensure(sql);
  const rows = await sql<{ id: number; text: string; interval_minutes: number; enabled: boolean; send_now_at: Date | null }[]>`
    SELECT id, text, interval_minutes, enabled, send_now_at FROM mlr.auto_messages ORDER BY id`;
  return rows.map(r => ({
    id: r.id,
    text: r.text,
    intervalMinutes: r.interval_minutes,
    enabled: r.enabled,
    sendNowAt: r.send_now_at ? r.send_now_at.toISOString() : null,
  }));
}

export async function createMessage(sql: Sql, input: MessageInput): Promise<void> {
  await ensure(sql);
  const text = cleanText(input.text);
  const interval = cleanInterval(input.intervalMinutes ?? 30);
  await sql`
    INSERT INTO mlr.auto_messages (text, interval_minutes, enabled)
    VALUES (${text}, ${interval}, ${input.enabled ?? true})`;
}

export async function updateMessage(sql: Sql, id: number, input: MessageInput): Promise<void> {
  await ensure(sql);
  const sets: Record<string, unknown> = {};
  if (input.text !== undefined) sets.text = cleanText(input.text);
  if (input.intervalMinutes !== undefined) sets.interval_minutes = cleanInterval(input.intervalMinutes);
  if (input.enabled !== undefined) sets.enabled = !!input.enabled;
  if (!Object.keys(sets).length) return;
  const result = await sql`UPDATE mlr.auto_messages SET ${sql(sets)} WHERE id = ${id}`;
  if (result.count === 0) throw new Error('Ese mensaje no existe');
}

export async function deleteMessage(sql: Sql, id: number): Promise<void> {
  await ensure(sql);
  await sql`DELETE FROM mlr.auto_messages WHERE id = ${id}`;
}

/** The proxy sends it once on its next poll, enabled or not. */
export async function sendNow(sql: Sql, id: number): Promise<void> {
  await ensure(sql);
  const result = await sql`UPDATE mlr.auto_messages SET send_now_at = now() WHERE id = ${id}`;
  if (result.count === 0) throw new Error('Ese mensaje no existe');
}
