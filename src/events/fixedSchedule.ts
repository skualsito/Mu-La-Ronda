/**
 * Mu La Ronda: when the events OpenMU does not report next start - the
 * invasions and Kanturu. Blood Castle, Devil Square and Chaos Castle come
 * from the server (`events/schedule.ts`); these have no packet to ask, so the
 * timetable `deploy/config/15-events.sql` sets is copied here. Keep the two
 * in step.
 *
 * OpenMU reads a timetable in its server time zone, which this deploy leaves
 * at its default, UTC (Startup `ResolveServerTimeZone`).
 */

export type FixedEventKey = 'goldenInvasion' | 'redDragon' | 'whiteWizard' | 'kanturu';

export type FixedEvent = {
  key: FixedEventKey;
  label: string;
  /** Start times of day, UTC, as [hour, minute]. */
  times: readonly (readonly [number, number])[];
};

const hours = (from: number, to: number, step: number, minute: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => [from + i * step, minute] as const);

export const FIXED_EVENTS: readonly FixedEvent[] = [
  { key: 'goldenInvasion', label: 'Invasión dorada', times: hours(0, 20, 4, 45) },
  { key: 'redDragon', label: 'Red Dragon', times: hours(3, 21, 6, 45) },
  { key: 'whiteWizard', label: 'White Wizard', times: hours(13, 23, 2, 0) },
  { key: 'kanturu', label: 'Kanturu', times: [[22, 45]] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Seconds from `now` (epoch ms) to the next start in `times`. */
export function secondsToNext(times: FixedEvent['times'], now: number): number {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  let best = Infinity;
  for (const [h, m] of times) {
    let at = midnight + (h * 60 + m) * 60_000;
    if (at <= now) at += DAY_MS;
    best = Math.min(best, at - now);
  }
  return Math.round(best / 1000);
}

/** `HH:MM:SS` (or `MM:SS` under an hour). */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}
