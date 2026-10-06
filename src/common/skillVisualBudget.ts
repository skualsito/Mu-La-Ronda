/**
 * Mu La Ronda: how many skill effects get drawn. Every cast spawns meshes,
 * particles and lights for a second or two; with a lot of agility a character
 * attacks several times a second, and a crowd of them casting in the same
 * place piled up hundreds of live effects - the client's memory and frame time
 * went with them.
 *
 * The blows still land and their numbers still show: only the drawing is
 * thinned. Per caster there is a minimum gap between two drawn casts (shorter
 * for the hero, so your own attacks feel responsive), and the other players'
 * casts also share a budget per second, so a crowded spot costs about the same
 * as a few players.
 */

/** The hero draws at most ~6 casts a second. */
export const HERO_MIN_GAP_MS = 166;
/** Anyone else at most ~3 a second each. */
export const OTHER_MIN_GAP_MS = 333;
/** And all of them together at most this many a second. */
export const OTHERS_PER_SECOND = 30;

export class SkillVisualBudget {
  private readonly lastDrawn = new WeakMap<object, number>();
  private windowStart = -Infinity;
  private windowCount = 0;

  /** Whether a cast by `caster` at `now` (ms) gets drawn; counts it if so. */
  allow(caster: object, isHero: boolean, now: number): boolean {
    const last = this.lastDrawn.get(caster);
    const gap = isHero ? HERO_MIN_GAP_MS : OTHER_MIN_GAP_MS;
    if (last !== undefined && now - last < gap) return false;

    if (!isHero) {
      if (now - this.windowStart >= 1000) {
        this.windowStart = now;
        this.windowCount = 0;
      }
      if (this.windowCount >= OTHERS_PER_SECOND) return false;
      this.windowCount++;
    }

    this.lastDrawn.set(caster, now);
    return true;
  }
}

export const skillVisualBudget = new SkillVisualBudget();
