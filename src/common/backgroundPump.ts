/**
 * Mu La Ronda: keeps the game running while the browser gives it no frames.
 *
 * With the tab hidden (or the window minimized or covered) the browser stops
 * requestAnimationFrame, and with it the whole game loop: the hero froze mid
 * walk, the helper stopped hunting, and everything caught up at once on coming
 * back. A worker posts a tick every 50 ms (its timers are not throttled the
 * way the page's are); while the frames have stopped, each tick runs one frame
 * of the loop, so the game goes on at about 20 a second in the background.
 *
 * The page's own timers are throttled too - to once a second when hidden, and
 * to once a minute after a few minutes - so the game logic's waits go through
 * `gameTimeout`: a plain setTimeout that the worker's tick also fires when it
 * is due. Waiting on a page timer, the warp's scene hold kept the game paused
 * (and the helper idle) for up to a minute after a death in the background.
 */

/** Frames this far apart mean the browser has stopped giving them. */
const STALLED_MS = 250;

let lastFrameAt = performance.now();

type GameTimer = { at: number; fn: () => void; native: ReturnType<typeof setTimeout> };

const timers = new Map<number, GameTimer>();
let nextTimer = 1;

/** Called from each normal (animation-frame) frame. */
export function noteAnimationFrame(now: number): void {
  lastFrameAt = now;
}

function fire(id: number): void {
  const timer = timers.get(id);
  if (!timer) return;
  timers.delete(id);
  clearTimeout(timer.native);
  timer.fn();
}

/** setTimeout that still fires on time in a hidden tab. */
export function gameTimeout(fn: () => void, ms: number): number {
  const id = nextTimer++;
  timers.set(id, { at: performance.now() + ms, fn, native: setTimeout(() => fire(id), ms) });
  return id;
}

export function clearGameTimeout(id: number | null | undefined): void {
  if (id == null) return;
  const timer = timers.get(id);
  if (!timer) return;
  clearTimeout(timer.native);
  timers.delete(id);
}

function fireDue(now: number): void {
  for (const [id, timer] of timers) {
    if (timer.at <= now) fire(id);
  }
}

/** Starts the worker; `frame` runs once per tick while animation frames have stopped. */
export function installBackgroundPump(frame: (now: number) => void): void {
  if (typeof Worker === 'undefined') return;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./backgroundPump.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  worker.onmessage = () => {
    const now = performance.now();
    if (timers.size) fireDue(now);
    if (now - lastFrameAt < STALLED_MS) return;
    frame(now);
  };
}
