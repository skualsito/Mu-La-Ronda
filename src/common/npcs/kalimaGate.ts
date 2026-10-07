import type { World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import { ModelObject, type PartPose } from '../modelObject';
import { npcModelFile } from './npcModelTable';

/**
 * The Kalima gates (152-158), the portal a Lost Map opens: `MODEL_WARCRAFT`
 * (Data\Skill\HellGate), which the original runs once and pins on animation
 * frame 10, the open portal (ZzzCharacter.cpp:13046-13064). As a plain NPC it
 * looped the opening clip for as long as it stood there.
 */
const OPEN: PartPose = { action: 0, speed: 0.28, holdFrame: 10 };

export class KalimaGate extends ModelObject {
  async init(world: World) {
    this.PartPose = OPEN;
    this.load(await loadGLTF(npcModelFile('/Skill/HellGate'), world));
    this.applyPartPose();
  }

  /** The monster animation loop asks for Stop1 every frame: the gate keeps its one opening. */
  override playAction(): void {}
}
