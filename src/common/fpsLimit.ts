/**
 * Mu La Ronda: the frame-rate cap (`GameOptions.fpsLimit` is an index into
 * these). 0 is uncapped - the browser's own vsync, as before. A cap only
 * skips whole animation frames, so it lands on what the monitor allows:
 * 60 on a 144 Hz screen is a steady 60, 90 on a 60 Hz screen stays 60.
 */
export const FPS_LIMIT_STEPS = [0, 30, 45, 60, 90, 120, 144] as const;

export const FPS_LIMIT_MAX = FPS_LIMIT_STEPS.length - 1;

export function fpsLimitForStep(step: number): number {
  return FPS_LIMIT_STEPS[Math.max(0, Math.min(FPS_LIMIT_MAX, step))] ?? 0;
}

/**
 * Paces the render loop to `limit` frames per second. Frames are skipped
 * whole, with the due time carried forward rather than reset, so a cap that
 * is not a divisor of the refresh rate (45 on 60 Hz) still averages out
 * right. The 1 ms slack keeps rAF jitter from dropping every other frame
 * when the cap equals the refresh rate.
 */
export class FramePacer {
  private nextDue = 0;

  due(now: number, limit: number): boolean {
    if (limit <= 0) return true;

    const interval = 1000 / limit;
    if (now < this.nextDue - 1) return false;

    // Fell more than a frame behind (a hitch, a hidden tab): start over.
    this.nextDue = now - this.nextDue > interval ? now + interval : this.nextDue + interval;
    return true;
  }
}
