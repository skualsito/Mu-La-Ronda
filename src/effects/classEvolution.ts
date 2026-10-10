import { Vector3, type Scene } from '../libs/babylon/exports';
import type { Entity, World } from '../ecs/world';
import { warmGLTF } from '../common/modelLoader';
import { effects } from './index';
import { MODEL, TEX } from './recipes';
import { entityPos, followEntity, type RGB } from './core';
import { spawnRing } from './ring';

/**
 * Mu La Ronda: the final class evolution (the 3rd class quest's reward, `LegacyQuestReward`
 * SecondToThird) - a column of blue light coming down on the hero (the cylinder of light
 * `clinderlight`, with the class change's ground rings `MODEL_CHANGE_UP_EFF` and spiral
 * `MODEL_CHANGE_UP_NASA` at its foot) and a wide magic circle on the ground, held longer than a
 * level-up. The white burst on the body and its light are the master level-up's (legacyQuests.ts).
 */

const BLUE: RGB = [0.6, 0.88, 1];
const WHITE: RGB = [1, 1, 1];
const SECONDS = 4;
/** The column: about two tiles wide and far up out of sight, with a white core inside. */
const PILLAR_SCALE = 1.3;
const CORE_SCALE = 0.7;
/** The rings and the spiral at the feet. */
const RING_SCALE = 0.7;
/** The magic circle on the ground, in tiles. */
const CIRCLE_SCALE = 11;

/** Loads the models ahead: the evolution shows once, and its models would still be on the way. */
export function warmClassEvolution(world: World): void {
  for (const model of [MODEL.clinderLight, MODEL.changeUp, MODEL.changeUpNasa]) void warmGLTF(model, world).catch(() => {});
}

export function playClassEvolution(scene: Scene, entity: Entity): void {
  const follow = followEntity(entity, 0);
  const at = entityPos(entity, 0, new Vector3());
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.clinderLight,
    seconds: SECONDS,
    scale: PILLAR_SCALE,
    colour: BLUE,
    follow,
    spin: 1.5,
    fadeTail: 0.4,
  });
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.clinderLight,
    seconds: SECONDS,
    scale: CORE_SCALE,
    colour: WHITE,
    follow,
    spin: -1,
    fadeTail: 0.4,
  });
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.changeUp,
    seconds: SECONDS,
    scale: RING_SCALE,
    colour: WHITE,
    follow,
    spin: 1.2,
    fadeTail: 0.4,
  });
  effects.spawn('model', scene, at.clone(), {
    model: MODEL.changeUpNasa,
    seconds: SECONDS,
    scale: RING_SCALE,
    colour: BLUE,
    follow,
    spin: -2.4,
    rise: 0.4,
    fadeTail: 0.5,
  });
  // The wide circle the column stands in, spreading and turning slowly.
  spawnRing(scene, at.clone(), {
    texture: TEX.magicCircle,
    colour: BLUE,
    scale: CIRCLE_SCALE,
    maxScale: CIRCLE_SCALE,
    seconds: SECONDS,
    growFrom: 0.4,
    spin: 0.4,
    fadeIn: 0.15,
    fadeTail: 0.35,
  });
  // And the glow under the feet, so the circle reads on a light floor too.
  spawnRing(scene, at.clone(), {
    texture: TEX.magicGround2,
    colour: BLUE,
    scale: CIRCLE_SCALE * 0.6,
    seconds: SECONDS,
    growFrom: 0.2,
    spin: -0.6,
    fadeTail: 0.35,
  });
}
