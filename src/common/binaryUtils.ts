/**
 * Byte-level helpers with no Babylon (and no DOM) dependency.
 *
 * These used to live in `common/utils.ts`, which imports `Scene`/`Texture`.
 * Two things need them without wanting the engine:
 *
 *  - the terrain worker (todo C8), which reaches them via
 *    `mapFileEncryption`;
 *  - the generated packet modules (todo C9), which are the bulk of the app
 *    chunk. While they imported `common/utils`, any attempt to split them
 *    into their own chunk dragged 2.4 MB of Babylon along with them.
 *
 * `common/utils.ts` re-exports every name here, so existing importers are
 * unaffected.
 */

export function castToByte(n: number): Byte {
  return n & 0xff;
}

export function ArrayCopy<TArray extends Uint8Array | Uint16Array>(
  buffer: TArray,
  srcOffset: Int,
  dst: TArray,
  dstOffset: Int,
  count: Int
): void {
  for (let i = 0; i < count; i++) {
    dst[dstOffset + i] = buffer[srcOffset + i];
  }
}

export function GetByteValue(byte: Byte, bits: Int, leftShifted: Int): Byte {
  const andMask = castToByte(Math.pow(2, bits) - 1);
  const numericalValue = castToByte((byte >> leftShifted) & andMask);

  return numericalValue;
}

export function SetByteValue(
  oldValue: Byte,
  value: Byte,
  bits: Int,
  leftShifted: Int
): Byte {
  const bitMask = castToByte(Math.pow(2, bits) - 1) << leftShifted;
  const clearMask = castToByte(0xff - bitMask);

  oldValue &= clearMask;

  const numericalValue = castToByte(value); //Convert.ToByte check?
  oldValue |= castToByte((numericalValue << leftShifted) & bitMask);

  return oldValue;
}

export function GetBoolean(byte: Byte, leftShifted: Int): boolean {
  return ((byte >> leftShifted) & 1) === 1;
}

export function SetBoolean(
  oldValue: Byte,
  value: Boolean,
  leftShifted: Int
): Byte {
  const mask = castToByte(1 << leftShifted);
  const clearMask = castToByte(0xff - (1 << leftShifted));
  oldValue &= clearMask;
  if (value) {
    oldValue |= mask;
  }

  return oldValue;
}

const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });

/**
 * A string field of a packet, up to its first NUL. OpenMU writes them as
 * UTF-8 (`ExtractString(..., Encoding.UTF8)`), so "ñ" arrives as two bytes;
 * read one character per byte it showed as "Ã±". Bytes that are not valid
 * UTF-8 (a field from somewhere else) still come back one per byte.
 */
export function readWireString(view: DataView, from: number, to: number): string {
  const end = Math.min(to, view.byteLength);
  let stop = from;
  let ascii = true;
  while (stop < end) {
    const byte = view.getUint8(stop);
    if (byte === 0) break;
    if (byte >= 0x80) ascii = false;
    stop++;
  }

  let val = '';
  for (let i = from; i < stop; i++) val += String.fromCharCode(view.getUint8(i));
  if (ascii) return val;
  try {
    return UTF8_STRICT.decode(new Uint8Array(view.buffer, view.byteOffset + from, stop - from));
  } catch {
    return val;
  }
}
