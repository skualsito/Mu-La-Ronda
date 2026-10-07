import { describe, expect, it } from 'vitest';
import { readWireString } from './binaryUtils';

const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe('readWireString', () => {
  it('reads UTF-8, so an ñ is one letter', () => {
    const bytes = [...new TextEncoder().encode('Ñandú año'), 0, 0x41];
    expect(readWireString(view(bytes), 0, bytes.length)).toBe('Ñandú año');
  });

  it('stops at the first NUL and at the field end', () => {
    expect(readWireString(view([0x41, 0x42, 0, 0x43]), 0, 4)).toBe('AB');
    expect(readWireString(view([0x41, 0x42, 0x43]), 0, 2)).toBe('AB');
  });

  it('keeps bytes that are not UTF-8 one per character', () => {
    expect(readWireString(view([0x61, 0xf1, 0x6f]), 0, 3)).toBe('a\u00f1o');
  });
});
