import { describe, expect, it, vi } from 'vitest';

vi.mock('../store', () => ({ Store: { buffs: [], playerData: { eng: 0 } } }));

const { buffRemaining, buffsLayer, readBuffsLine, requestBuffTimes } = await import('./buffs');

describe('buff times from the server', () => {
  it('reads the /buffs line and counts down from it', () => {
    expect(readBuffsLine('Buffs: 1=120;2=-1;')).toBe(true);
    expect(buffRemaining(1)).toBe(120);
    expect(buffRemaining(2)).toBeNull(); // lasts for good
    buffsLayer.update?.(0 as never, 30);
    expect(buffRemaining(1)).toBe(90);
    expect(readBuffsLine('VIP: no tenes VIP.')).toBe(false);
  });

  it('asks the server at most once every two seconds', () => {
    const sent: string[] = [];
    requestBuffTimes(c => sent.push(c));
    requestBuffTimes(c => sent.push(c));
    buffsLayer.update?.(0 as never, 3);
    requestBuffTimes(c => sent.push(c));
    expect(sent).toEqual(['/buffs', '/buffs']);
  });
});
