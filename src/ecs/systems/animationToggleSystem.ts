import { GameOptions } from '../../common/gameOptions';
import type { Entity, ISystemFactory } from '../world';
import { isNpcOrTrapType } from './attackSystem';

/**
 * Mu La Ronda: the Options toggles that hold other players' and the NPCs'
 * looping clips still (standing, walking). A held model is paused the way an
 * off-screen one is (`ModelObject.setAnimationsSuppressed`); one-shots - a
 * swing, a death - still play, so a fight still reads.
 */

/** Monster numbers 100-110 are traps, not NPCs: they have no clips worth holding. */
function isNpc(e: Entity): boolean {
  const type = e.npcType;
  if (type === undefined || (type >= 100 && type <= 110)) return false;
  return isNpcOrTrapType(type);
}

export const AnimationToggleSystem: ISystemFactory = world => {
  const models = world.with('modelObject');

  return {
    update: () => {
      const players = GameOptions.otherPlayerAnimations;
      const npcs = GameOptions.npcAnimations;

      for (const e of models) {
        const held =
          (!players && !!e.playerAnimation && !e.localPlayer) ||
          (!npcs && isNpc(e));
        // Untouched models stay untouched: only those held, or let go, are walked.
        if (held || e.modelObject.AnimationsSuppressed) {
          e.modelObject.setAnimationsSuppressed(held);
        }
      }
    },
  };
};
