import { Vector3, type Scene } from '../libs/babylon/exports';
import type { Entity, World } from '../ecs/world';
import { warmGLTF } from '../common/modelLoader';
import { effects } from './index';
import { MODEL } from './recipes';
import { entityPos, followEntity, type RGB } from './core';

/**
 * Mu La Ronda: a master level-up - the golden pillar the original raises on a
 * master level (the cylinder of light `clinderlight`, with the class change's
 * ground rings `MODEL_CHANGE_UP_EFF` and spiral `MODEL_CHANGE_UP_NASA` at its
 * foot), not the level-up beam. The server sends it as an effect of our own
 * (MasterLevelUpEffectPlugIn.cs, ShowEffect 32) to the hero and everybody
 * around; the level-up beam OpenMU sends right after is skipped
 * (objectEffectSystem).
 */

/** The pillar's sheet is a pale green-yellow: the tint leans to orange to read gold on it. */
const GOLD: RGB = [1, 0.58, 0.12];
const SECONDS = 2.5;
/** The pillar: about a tile wide and nine tall at this scale. */
const PILLAR_SCALE = 0.6;
/** The rings and the spiral at the feet: a tile and a half across. */
const RING_SCALE = 0.4;

/**
 * Loads the three models ahead: a level-up is over in two seconds, and the
 * first one of a session played while its models were still on the way.
 */
export function warmMasterLevelUp(world: World): void {
  for (const model of [MODEL.clinderLight, MODEL.changeUp, MODEL.changeUpNasa]) void warmGLTF(model, world).catch(() => {});
}

export function playMasterLevelUp(scene: Scene, entity: Entity): void {
  const follow = followEntity(entity, 0);
  const at = entityPos(entity, 0, new Vector3());
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.clinderLight,
    seconds: SECONDS,
    scale: PILLAR_SCALE,
    colour: GOLD,
    follow,
    spin: 1.5,
    fadeTail: 0.5,
  });
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.changeUp,
    seconds: SECONDS,
    scale: RING_SCALE,
    colour: GOLD,
    follow,
    spin: 1.2,
    fadeTail: 0.4,
  });
  effects.spawn('model', scene, at, {
    model: MODEL.changeUpNasa,
    seconds: SECONDS,
    scale: RING_SCALE,
    colour: GOLD,
    follow,
    spin: -2.4,
    rise: 0.4,
    fadeTail: 0.5,
  });
}
