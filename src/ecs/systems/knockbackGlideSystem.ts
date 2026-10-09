import type { Entity, ISystemFactory } from '../world';

/**
 * Mu La Ronda: a short shove by the server slides instead of jumping.
 *
 * In Chaos Castle a monster that dies may blow up and throw the players
 * around it three or four tiles (ChaosCastleContext, `BlowOutDistance`). The
 * server just moves them (ObjectMoved, an instant move), and the client put
 * them on the new tile at once - it looked like a teleport. Here the logical
 * position still lands on the new tile straight away (walking, attacking and
 * the server all agree on it); only the drawing starts where the character
 * was and slides over in `GLIDE_SECONDS`, by lending the difference to
 * `transform.posOffset` and taking it back.
 */

/** How long the slide lasts. */
export const GLIDE_SECONDS = 0.3;

/** Longer moves are real teleports (gates, /move, the Teleport skill) and stay instant. */
export const MAX_GLIDE_TILES = 6;

type Glide = {
  /** The offset the entity had before (players are centred on their tile). */
  base: { x: number; y: number; z: number };
  /** Where the drawing starts, relative to the new position. */
  from: { x: number; y: number; z: number };
  elapsed: number;
};

const glides = new Map<Entity, Glide>();

/** Ease-out: fast away from where the blow hit, settling on the tile. */
const ease = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Starts a slide for an entity just moved from `from` to its current
 * position. Returns false (nothing to do) for a move too long or too short.
 */
export function startGlide(entity: Entity, from: { x: number; y: number; z: number }): boolean {
  const t = entity.transform;
  if (!t) return false;
  const dx = from.x - t.pos.x;
  const dz = from.z - t.pos.z;
  const tiles = Math.hypot(dx, dz);
  if (tiles < 1 || tiles > MAX_GLIDE_TILES) return false;

  // A slide still running hands its remaining offset over to the new one.
  const running = glides.get(entity);
  const base = running?.base ?? { x: t.posOffset?.x ?? 0, y: t.posOffset?.y ?? 0, z: t.posOffset?.z ?? 0 };
  glides.set(entity, { base, from: { x: dx, y: from.y - t.pos.y, z: dz }, elapsed: 0 });
  t.posOffset = { x: base.x + dx, y: base.y + from.y - t.pos.y, z: base.z + dz };
  return true;
}

export const KnockbackGlideSystem: ISystemFactory = () => ({
  update(deltaTime: number) {
    for (const [entity, glide] of glides) {
      const t = entity.transform;
      glide.elapsed += deltaTime;
      const k = Math.min(1, glide.elapsed / GLIDE_SECONDS);
      const left = 1 - ease(k);
      if (t) {
        t.posOffset = {
          x: glide.base.x + glide.from.x * left,
          y: glide.base.y + glide.from.y * left,
          z: glide.base.z + glide.from.z * left,
        };
      }
      if (k >= 1 || !t) glides.delete(entity);
    }
  },
});
