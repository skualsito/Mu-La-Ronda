import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, notePvpKey, PvpMode } from './pvpMode';

describe('PvP mode', () => {
  it('flips on a quick double tap of Ctrl, and back on the next one', () => {
    const start = PvpMode.on;
    expect(notePvpKey('ControlLeft', 1000)).toBe(false);
    expect(notePvpKey('ControlLeft', 1000 + DOUBLE_TAP_MS - 50)).toBe(true);
    expect(PvpMode.on).toBe(!start);

    expect(notePvpKey('ControlRight', 5000)).toBe(false);
    expect(notePvpKey('ControlLeft', 5100)).toBe(true);
    expect(PvpMode.on).toBe(start);
  });

  it('ignores slow taps and Ctrl chords', () => {
    const start = PvpMode.on;
    notePvpKey('ControlLeft', 10000);
    expect(notePvpKey('ControlLeft', 10000 + DOUBLE_TAP_MS + 50)).toBe(false);

    notePvpKey('ControlLeft', 20000);
    notePvpKey('KeyQ', 20050);
    expect(notePvpKey('ControlLeft', 20100)).toBe(false);
    expect(PvpMode.on).toBe(start);
  });
});
