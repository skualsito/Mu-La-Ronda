/**
 * Mu La Ronda: how much of the other players' eye candy to drop while the
 * frame rate is down. A crowd casting in Arena took a mid-range machine to a
 * few frames a second; past the fixed caps (skillVisualBudget.ts, the effect
 * layers' live limits), this thins what other people draw further while the
 * frames are not keeping up, and gives it back once they are.
 *
 *   0 - nothing dropped.
 *   1 - under 2/3 of the frame cap: other players draw half as many casts.
 *   2 - under 2/5 of the frame cap: a quarter, and their Fenrir bolts stop.
 *
 * The hero's own effects are never touched. The level is re-read twice a
 * second from the frames actually drawn, and each step has its own way back
 * (hysteresis), so a crowd at the edge does not flicker between levels.
 */

export type ShedLevel = 0 | 1 | 2;

/** Fractions of the frame cap: enter a level under `enter`, leave it over `leave`. */
const STEPS: readonly { enter: number; leave: number }[] = [
  { enter: 2 / 3, leave: 0.85 },
  { enter: 0.4, leave: 0.55 },
];

/** The level for `fps` against `cap`, coming from `previous`. */
export function nextShedLevel(fps: number, cap: number, previous: ShedLevel): ShedLevel {
  // No reading yet (a hidden tab, the first frames): change nothing.
  if (!(fps > 0) || !(cap > 0)) return previous;

  const ratio = fps / cap;
  let level = previous;

  // Down one step at a time, up as far as the reading says.
  if (level > 0 && ratio > STEPS[level - 1].leave) level = (level - 1) as ShedLevel;
  while (level < STEPS.length && ratio < STEPS[level].enter) level = (level + 1) as ShedLevel;

  return level;
}

/** How often the level is re-read, ms. */
const PERIOD_MS = 500;

let level: ShedLevel = 0;
let readAt = -Infinity;
let source: (() => { fps: number; cap: number }) | null = null;

/** Where the frame rate and its cap are read from (boot wires it; tests leave it unset). */
export function setShedSource(read: (() => { fps: number; cap: number }) | null): void {
  source = read;
  level = 0;
  readAt = -Infinity;
}

/** The current level, re-read at most every `PERIOD_MS`. */
export function shedLevel(now = performance.now()): ShedLevel {
  if (!source) return 0;
  if (now - readAt >= PERIOD_MS) {
    readAt = now;
    const { fps, cap } = source();
    level = nextShedLevel(fps, cap, level);
  }
  return level;
}
