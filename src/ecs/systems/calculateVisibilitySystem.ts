import type { ISystemFactory } from '../world';
import { GameOptions } from '../../common/gameOptions';
import { renderDistanceRanges } from '../../common/renderDistance';

/**
 * Mu La Ronda: the most items on the ground drawn at once. With high rates a
 * hunting spot piled up hundreds of them - each a model, a glow and a label -
 * and the frame rate sank. The nearest ones are drawn; the rest wait hidden
 * until they are among the nearest (or picked up, or gone after 30 s).
 */
const MAX_VISIBLE_DROPS = 60;

export const CalculateVisibilitySystem: ISystemFactory = world => {
  const query = world.with('transform', 'visibility');
  const drops = world.with('droppedItem', 'transform', 'visibility');
  const shown: { visibility: { state: string; lastChecked: number }; distance: number }[] = [];

  return {
    update: dt => {
      const terrain = world.terrain;
      if (!terrain) return;

      // Hero-relative load radius, in tiles - the Render distance option
      // (`common/renderDistance.ts`), whose step 0 is the pair this held
      // as constants. Babylon frustum-culls the loaded meshes, so the radius
      // only has to cover what the camera can possibly see, and the camera
      // facade's zoom, pitch and FOV all move that horizon.
      const { visible: visibleRange, nearby: nearbyRange } =
        renderDistanceRanges(GameOptions.renderDistance);

      const playerEntity = world.playerEntity;

      if (!playerEntity) {
        for (const { visibility } of query) {
          if (visibility.state === 'visible') continue;

          visibility.state = 'visible';
          visibility.lastChecked = 1;
          visibility.swept = true;
        }

        return;
      }

      for (const { transform, visibility } of query) {
        visibility.lastChecked -= dt;

        if (visibility.lastChecked > 0) continue;

        visibility.swept = true;

        const distance = Math.sqrt(
          Math.pow(transform.pos.x - playerEntity.transform.pos.x, 2) +
            Math.pow(transform.pos.z - playerEntity.transform.pos.z, 2)
        );

        if (distance <= visibleRange) {
          visibility.state = 'visible';
          visibility.lastChecked = 0.2;
        } else if (distance <= nearbyRange) {
          visibility.state = 'nearby';
          visibility.lastChecked = 0.3;
        } else {
          visibility.state = 'hidden';
          visibility.lastChecked = 1;
        }
      }

      // The ground item cap, every frame: cheap until there are more than the cap.
      if (drops.size <= MAX_VISIBLE_DROPS) return;
      shown.length = 0;
      const hero = playerEntity.transform.pos;
      for (const { transform, visibility } of drops) {
        if (visibility.state !== 'visible') continue;
        const dx = transform.pos.x - hero.x;
        const dz = transform.pos.z - hero.z;
        shown.push({ visibility, distance: dx * dx + dz * dz });
      }
      if (shown.length <= MAX_VISIBLE_DROPS) return;
      shown.sort((a, b) => a.distance - b.distance);
      for (let i = MAX_VISIBLE_DROPS; i < shown.length; i++) {
        shown[i].visibility.state = 'hidden';
        // Looked at again soon: one may be among the nearest by then.
        shown[i].visibility.lastChecked = 0.25;
      }
    },
  };
};
