import type { Entity, ISystemFactory } from '../world';
import { GameOptions } from '../../common/gameOptions';
import { monsterVisualFor, visualMonster } from '../../effects/monsterVisuals';
import type { EffectHandle } from '../../effects';
import { loadGLTF, type LoadedModel } from '../../common/modelLoader';
import { Store } from '../../store';

/** OpenMU's GM MARK magic effect (Player.GMEffect). */
const GM_MARK_EFFECT = 28;
/** MODEL_GM_CHARACTER, whose look is the GM emblem (effects/monsterVisuals.ts). */
const GM_CHARACTER = 378;
/** The floating red "MU" star over a game master's head (Data/Skill/musign.bmd). */
const GM_SIGN_MODEL = 'Skill/musign.glb';
/** Above the model's root, in world units: a little over the head (≈2.3). */
const GM_SIGN_HEIGHT = 2.65;
const GM_SIGN_SCALE = 1.4;
/** Radians a second it turns around its vertical axis. */
const GM_SIGN_SPIN = 1.6;

/**
 * Consumer of the effects layer's `monsterVisuals` entry: walks the entities
 * that have an `npcType` and starts the body effects its table names once
 * the model is posed - the dust, the breath, the fire, the sand - and drops
 * them when the monster leaves or the option goes off. Owns no visual state;
 * `effects/monsterVisuals.ts` does.
 */
export const MonsterVisualSystem: ISystemFactory = world => {
  const characters = world.with('npcType', 'modelObject', 'transform');
  /**
   * A character wearing a monster's appearance draws the same body effects
   * as the monster - a game master in the ring stands on the same mark as
   * the game master NPC. It has a `skin`, not an `npcType`, so it needs a
   * query of its own rather than a wider walk of every entity.
   */
  const skinned = world.with('skin', 'modelObject', 'transform');
  const handles = new Map<Entity, EffectHandle>();
  /**
   * Mu La Ronda: a game master's mark. OpenMU puts magic effect 28 ("GM
   * MARK") on every GM character; it is drawn with the Game Master NPC's own
   * look - the light over the head and the turning marks underfoot - since
   * that is the client's GM emblem. Kept apart from `handles` so a GM wearing
   * a transformation ring keeps both.
   */
  const players = world.with('attributeSystem', 'modelObject', 'transform');
  const gmHandles = new Map<Entity, EffectHandle>();
  /**
   * The floating "MU" sign of each game master in view. `null` while its
   * model is still loading, so it is requested once.
   */
  const gmSigns = new Map<Entity, LoadedModel | null>();
  players.onEntityRemoved.subscribe(e => {
    gmHandles.get(e)?.stop();
    gmHandles.delete(e);
    dropSign(e);
  });

  function dropSign(e: Entity): void {
    const sign = gmSigns.get(e);
    gmSigns.delete(e);
    if (!sign) return;
    for (const group of sign.animationGroups) group.dispose();
    sign.mesh.dispose(false, false);
  }

  function isGameMaster(e: Entity): boolean {
    if (e.buffs?.has(GM_MARK_EFFECT) || e.isGm) return true;
    // The hero knows it from the login answer even before the effect arrives.
    return e === world.playerEntity && Store.playerData.isGameMaster;
  }

  /** Keeps the sign of `e` over its head, turning; loads it the first time. */
  function gmSign(e: Entity, show: boolean, dt: number): void {
    if (!show) {
      if (gmSigns.has(e)) dropSign(e);
      return;
    }
    if (!gmSigns.has(e)) {
      gmSigns.set(e, null);
      void loadGLTF(GM_SIGN_MODEL, world).then(
        model => {
          // Gone, or no longer a GM, while it was loading.
          if (!gmSigns.has(e)) {
            for (const group of model.animationGroups) group.dispose();
            model.mesh.dispose(false, false);
            return;
          }
          model.mesh.scaling.setAll(GM_SIGN_SCALE);
          model.mesh.isPickable = false;
          for (const mesh of model.mesh.getChildMeshes(false)) mesh.isPickable = false;
          gmSigns.set(e, model);
        },
        () => gmSigns.delete(e)
      );
      return;
    }
    const sign = gmSigns.get(e);
    const node = e.modelObject?.node;
    if (!sign || !node) return;
    const at = node.getAbsolutePosition();
    sign.mesh.position.set(at.x, at.y + GM_SIGN_HEIGHT, at.z);
    sign.mesh.rotation.y = (sign.mesh.rotation.y + GM_SIGN_SPIN * dt) % (Math.PI * 2);
  }

  function snuff(e: Entity): void {
    handles.get(e)?.stop();
    handles.delete(e);
  }

  characters.onEntityRemoved.subscribe(snuff);
  skinned.onEntityRemoved.subscribe(snuff);

  function step(e: Entity, type: number, on: boolean): void {
    const row = monsterVisualFor(type);
    if (!row) return;

    // The toggle takes effect at once, and out of scope the entry would
    // otherwise be restarted every frame until the monster is back.
    if (!on || e.objOutOfScope) {
      snuff(e);
      return;
    }

    // A map change ends every effect underneath us; `alive` is then false
    // and the next frame rebuilds it.
    if (handles.get(e)?.alive) return;
    if (!e.modelObject?.Ready || !e.modelObject.gltf?.skeleton) return;

    handles.set(e, visualMonster(world.scene, e, row));
  }

  function gmMark(e: Entity, dt: number): void {
    const show = isGameMaster(e) && !e.objOutOfScope && !e.dying;
    gmSign(e, show, dt);
    const handle = gmHandles.get(e);
    if (!show) {
      if (handle) {
        handle.stop();
        gmHandles.delete(e);
      }
      return;
    }
    if (handle?.alive) return;
    if (!e.modelObject?.Ready || !e.modelObject.gltf?.skeleton) return;
    const row = monsterVisualFor(GM_CHARACTER);
    if (row) gmHandles.set(e, visualMonster(world.scene, e, row));
  }

  return {
    update: (dt: number) => {
      for (const e of players) if (e.npcType === undefined && !e.skin) gmMark(e, dt);
      const on = GameOptions.monsterEffects;
      for (const e of characters) step(e, e.npcType, on);
      // A skinned NPC is in both queries; its npcType has already answered.
      for (const e of skinned) {
        if (e.npcType === undefined) step(e, e.skin, on);
      }
    },
  };
};
