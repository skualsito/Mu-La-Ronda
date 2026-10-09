import { LORENCIA_RING } from '../../common/terrain/lorenciaRing';
import { TERRAIN_SIZE } from '../../common/terrain/consts';
import type { MuSprite } from './sprites';

/**
 * Mu La Ronda: Lorencia's minimap picture still had the fountain the ring
 * replaced (`maps/lorencia/ring.ts`). The ring is painted over it - dark
 * slabs, the pale frosted edge, the stone curb and the logo, shrunk - into a
 * copy of the decoded picture, with its own blob URL.
 *
 * The picture is transposed against the tiles: pixel x runs along tile Y and
 * pixel y along tile X (`minimap/sheet.tsx`: `Tx = PositionY / 256 · L`).
 */

const LOGO = './brand/la-ronda.png';

/**
 * The picture is not drawn true to the tiles here: the fountain and the four
 * flower beds round it sit a tile or two further along both axes than the
 * terrain has them, and the beds are drawn fatter than their cells. So the
 * ring is not painted on its own rectangle but centred in the gap the picture
 * leaves between the four drawn beds - tile X 139 to 147 (beds above and
 * below), tile Y 125.5 to 131 at the top and 127.5 to 131.5 at the bottom -
 * and a tile smaller than the ring, to clear them.
 */
const PICTURE_CENTER = { x: 143, y: 128.9 };
const INSET = 0.5;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`minimap ring: cannot load ${url}`));
    image.src = url;
  });
}

/** A copy of Lorencia's minimap with the ring on it; the original if anything fails. */
export async function paintLorenciaRingOnMinimap(sprite: MuSprite): Promise<MuSprite> {
  try {
    const [picture, logo] = await Promise.all([
      loadImage(sprite.url),
      loadImage(LOGO).catch(() => null),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = picture.width;
    canvas.height = picture.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sprite;
    ctx.drawImage(picture, 0, 0);

    const px = picture.width / TERRAIN_SIZE;
    const py = picture.height / TERRAIN_SIZE;
    const { x1, y1, x2, y2 } = LORENCIA_RING;
    // Transposed: tile Y -> pixel x, tile X -> pixel y.
    const w = (y2 - y1 + 1 - INSET * 2) * px;
    const h = (x2 - x1 + 1 - INSET * 2) * py;
    const left = PICTURE_CENTER.y * px - w / 2;
    const top = PICTURE_CENTER.x * py - h / 2;

    // The curb, then the slabs inside it.
    ctx.fillStyle = '#8a7a63';
    ctx.fillRect(left, top, w, h);
    const curb = Math.max(1, Math.round(px * 0.3));
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(left + curb, top + curb, w - curb * 2, h - curb * 2);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 1; t < x2 - x1; t++) {
      ctx.moveTo(left + curb, top + (t * h) / (x2 - x1));
      ctx.lineTo(left + w - curb, top + (t * h) / (x2 - x1));
    }
    for (let t = 1; t < y2 - y1; t++) {
      ctx.moveTo(left + (t * w) / (y2 - y1), top + curb);
      ctx.lineTo(left + (t * w) / (y2 - y1), top + h - curb);
    }
    ctx.stroke();

    // The frost along the inside of the curb.
    ctx.strokeStyle = 'rgba(225, 230, 235, 0.45)';
    ctx.lineWidth = Math.max(1, px * 0.5);
    ctx.strokeRect(left + curb + ctx.lineWidth / 2, top + curb + ctx.lineWidth / 2, w - curb * 2 - ctx.lineWidth, h - curb * 2 - ctx.lineWidth);

    if (logo) {
      const span = Math.min(w, h) * 0.72;
      const scale = span / Math.max(logo.width, logo.height);
      ctx.drawImage(
        logo,
        left + (w - logo.width * scale) / 2,
        top + (h - logo.height * scale) / 2,
        logo.width * scale,
        logo.height * scale
      );
    }

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return sprite;
    return { url: URL.createObjectURL(blob), width: sprite.width, height: sprite.height };
  } catch {
    return sprite;
  }
}
