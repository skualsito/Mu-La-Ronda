import type { Sql } from 'postgres';
import { startOpenmu, stopOpenmu } from './docker';

/**
 * Mu La Ronda: turning the game server off for maintenance, from the panel's Servidor page. With
 * a warning, the players get the golden notice now (the proxy sends it, proxy/announce.ts) and,
 * if there is time, again a minute before; then OpenMU stops - it saves everyone on the way out -
 * and stays off until it is started again (or the next deploy starts it).
 */

type Pending = { at: number; timers: ReturnType<typeof setTimeout>[]; messageIds: number[] };

let pending: Pending | null = null;

export function maintenanceState(): { stopAt: string | null } {
  return { stopAt: pending ? new Date(pending.at).toISOString() : null };
}

/** A one-off golden notice: the proxy sends it on its next poll (within 15 s). */
async function announce(sql: Sql, text: string): Promise<number | null> {
  try {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO mlr.auto_messages (text, interval_minutes, enabled, send_now_at)
      VALUES (${text}, 1440, false, now()) RETURNING id`;
    return row.id;
  } catch {
    // Without the table there is no notice; the stop still happens.
    return null;
  }
}

async function forget(sql: Sql, ids: number[]): Promise<void> {
  if (ids.length) await sql`DELETE FROM mlr.auto_messages WHERE id = ANY(${ids}::int[])`.catch(() => {});
}

/** Stops now (minutes 0) or after warning the players for that many minutes. */
export async function scheduleStop(sql: Sql, minutes: number): Promise<{ stopAt: string | null }> {
  cancelStop(sql);
  const wait = Math.max(0, Math.min(30, Math.trunc(minutes)));
  if (wait === 0) {
    await stopOpenmu();
    return { stopAt: null };
  }

  const at = Date.now() + wait * 60_000;
  const state: Pending = { at, timers: [], messageIds: [] };
  pending = state;
  const first = await announce(
    sql,
    `⚠ El servidor se apaga en ${wait} ${wait === 1 ? 'minuto' : 'minutos'} por mantenimiento. ¡Guardá lo que estés haciendo!`
  );
  if (first) state.messageIds.push(first);

  if (wait > 1) {
    state.timers.push(
      setTimeout(async () => {
        const id = await announce(sql, '⚠ El servidor se apaga en 1 minuto por mantenimiento.');
        if (id) state.messageIds.push(id);
      }, (wait - 1) * 60_000)
    );
  }

  state.timers.push(
    setTimeout(async () => {
      if (pending !== state) return;
      pending = null;
      try {
        await stopOpenmu();
      } catch (err) {
        console.error('maintenance: stop failed:', err instanceof Error ? err.message : err);
      }
      await forget(sql, state.messageIds);
    }, wait * 60_000)
  );
  return maintenanceState();
}

export function cancelStop(sql: Sql): void {
  if (!pending) return;
  pending.timers.forEach(clearTimeout);
  void forget(sql, pending.messageIds);
  pending = null;
}

export async function start(): Promise<void> {
  await startOpenmu();
}
