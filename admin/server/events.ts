import type { Sql } from 'postgres';
import { controlEvent, gameEventDetails, gameEvents, type GameEvent, type GameEventDetails } from './openmuApi';

/**
 * Events: the periodic events OpenMU runs (Blood Castle, Devil Square, Chaos
 * Castle, Kanturu, the invasions, Medusa, happy hour), what each is doing now
 * and when it starts next (MlrEventsController), a start and a stop button,
 * and the team's own notes: whether it works and when it was last tested
 * (mlr.event_notes, the panel's alone).
 */

export const EVENT_STATUS = ['untested', 'ok', 'broken'] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export type EventNote = { status: EventStatus; note: string; testedAt: string | null; testedBy: string | null };

export type EventRow = GameEvent & EventNote;

/** Names for the events OpenMU only knows by their class (their display name is a resource key). */
const NAMES: Record<string, string> = {
  BloodCastleStartPlugIn: 'Blood Castle',
  ChaosCastleStartPlugIn: 'Chaos Castle',
  DevilSquareStartPlugIn: 'Devil Square',
  KanturuStartPlugIn: 'Kanturu (Maya y Nightmare)',
  GoldenInvasionPlugIn: 'Invasión dorada',
  RedDragonInvasionPlugIn: 'Red Dragon',
  WhiteWizardInvasionPlugIn: 'White Wizard',
  HappyHourPlugIn: 'Happy Hour',
  MedusaInvasionPlugIn: 'Medusa',
  SkeletonKingInvasionPlugIn: 'Skeleton King (Lorencia)',
  LordSilvesterInvasionPlugIn: 'Lord Silvester (Vulcanus)',
  ErohimInvasionPlugIn: 'Erohim (Kanturu Relics)',
  LorenDeepInvasionPlugIn: 'Loren Deep (Valley of Loren)',
};

async function ensureBooks(sql: Sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
  await sql`
    CREATE TABLE IF NOT EXISTS mlr.event_notes (
      "Id" text PRIMARY KEY,
      "Status" text NOT NULL DEFAULT 'untested',
      "Note" text NOT NULL DEFAULT '',
      "TestedAt" timestamptz,
      "TestedBy" text)`;
}

export async function listEvents(sql: Sql): Promise<{ events: EventRow[]; error: string | null }> {
  await ensureBooks(sql);
  const notes = new Map(
    (await sql<{ id: string; status: EventStatus; note: string; testedAt: string | null; testedBy: string | null }[]>`
      SELECT "Id" AS id, "Status" AS status, "Note" AS note, "TestedAt" AS "testedAt", "TestedBy" AS "testedBy"
        FROM mlr.event_notes`).map(n => [n.id.toLowerCase(), n])
  );
  let events: GameEvent[] = [];
  let error: string | null = null;
  try {
    events = await gameEvents(sql);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const rows = events.map(e => {
    const n = notes.get(e.id.toLowerCase());
    return { ...e, name: NAMES[e.type] ?? e.name, status: n?.status ?? 'untested', note: n?.note ?? '', testedAt: n?.testedAt ?? null, testedBy: n?.testedBy ?? null };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { events: rows, error };
}

export async function saveNote(sql: Sql, id: string, input: { status?: unknown; note?: unknown; tested?: unknown }, user: string) {
  await ensureBooks(sql);
  const status = input.status === undefined ? undefined : String(input.status);
  if (status !== undefined && !EVENT_STATUS.includes(status as EventStatus)) throw new Error('Estado inválido');
  const note = input.note === undefined ? undefined : String(input.note).slice(0, 500);
  await sql`
    INSERT INTO mlr.event_notes ("Id", "Status", "Note", "TestedAt", "TestedBy")
    VALUES (${id.toLowerCase()}, ${status ?? 'untested'}, ${note ?? ''},
            ${input.tested ? sql`now()` : null}, ${input.tested ? user : null})
    ON CONFLICT ("Id") DO UPDATE SET
      "Status" = COALESCE(${status ?? null}, mlr.event_notes."Status"),
      "Note" = COALESCE(${note ?? null}, mlr.event_notes."Note"),
      "TestedAt" = CASE WHEN ${!!input.tested} THEN now() ELSE mlr.event_notes."TestedAt" END,
      "TestedBy" = CASE WHEN ${!!input.tested} THEN ${user} ELSE mlr.event_notes."TestedBy" END`;
}

/** One event in full, with its panel name: setup, and per server its state and live monsters. */
export async function eventDetails(sql: Sql, id: string): Promise<GameEventDetails | null> {
  const detail = await gameEventDetails(sql, id);
  return detail ? { ...detail, name: NAMES[detail.type] ?? detail.name } : null;
}

export async function startEvent(sql: Sql, id: string) {
  await controlEvent(sql, id, 'start');
}

export async function stopEvent(sql: Sql, id: string) {
  await controlEvent(sql, id, 'stop');
}
