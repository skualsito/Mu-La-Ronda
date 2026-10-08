import { GameOptions } from '../../common/gameOptions';
import type { Entity, ISystemFactory } from '../world';
import { isNpcOrTrapType } from './attackSystem';

/**
 * Mu La Ronda: the Options toggles that hold other players' and the NPCs'
 * looping clips still (standing, walking). A held model is paused the way an
 * off-screen one is (`ModelObject.setAnimationsSuppressed`); one-shots - a
 * swing, a death - still play, so a fight still reads. Mu La Ronda: another
 * player who is walking is not held - frozen mid stride, everyone slid across
 * the ground on Low; standing still they are, which is where the saving is.
 */

/** Monster numbers 100-110 are traps, not NPCs: they have no clips worth holding. */
function isNpc(e: Entity): boolean {
  const type = e.npcType;
  if (type === undefined || (type >= 100 && type <= 110)) return false;
  return isNpcOrTrapType(type);
}

/** On its way somewhere: a step being taken, or a path still to walk. */
function isMoving(e: Entity): boolean {
  const v = e.movement?.velocity;
  if (v && (v.x !== 0 || v.y !== 0)) return true;
  return (e.pathfinding?.path?.length ?? 0) > 0;
}

export const AnimationToggleSystem: ISystemFactory = world => {
  const models = world.with('modelObject');

  return {
    update: () => {
      const players = GameOptions.otherPlayerAnimations;
      const npcs = GameOptions.npcAnimations;

      for (const e of models) {
        const held =
          (!players && !!e.playerAnimation && !e.localPlayer && !isMoving(e)) ||
          (!npcs && isNpc(e));
        // Untouched models stay untouched: only those held, or let go, are walked.
        if (held || e.modelObject.AnimationsSuppressed) {
          e.modelObject.setAnimationsSuppressed(held);
        }
      }
    },
  };
};
