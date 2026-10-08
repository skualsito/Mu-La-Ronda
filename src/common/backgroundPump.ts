/**
 * Mu La Ronda: keeps the game running while the browser gives it no frames.
 *
 * With the tab hidden (or the window minimized or covered) the browser stops
 * requestAnimationFrame, and with it the whole game loop: the hero froze mid
 * walk, the helper stopped hunting, and everything caught up at once on coming
 * back. A worker posts a tick every 50 ms (its timers are not throttled the
 * way the page's are); while the frames have stopped, each tick runs one frame
 * of the loop, so the game goes on at about 20 a second in the background.
 */

/** Frames this far apart mean the browser has stopped giving them. */
const STALLED_MS = 250;

let lastFrameAt = performance.now();

/** Called from each normal (animation-frame) frame. */
export function noteAnimationFrame(now: number): void {
  lastFrameAt = now;
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
    if (now - lastFrameAt < STALLED_MS) return;
    frame(now);
  };
}
