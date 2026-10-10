import { describe, expect, it } from 'vitest';
import type { Item } from '../ecs/world';
import { defaultSocket, isSeedSphere, seedSphereLevel, socketItemOf, socketToUse } from './seedCrafting';

const item = (group: number, num: number, extra: Partial<Item> = {}) => ({ group, num, ...extra }) as Item;

describe('seed crafting', () => {
  it('knows a seed sphere and its level by its number', () => {
    expect(isSeedSphere(item(12, 100))).toBe(true);
    expect(isSeedSphere(item(12, 70))).toBe(false); // a Sphere (Mono), not a seed sphere
    expect(seedSphereLevel(item(12, 105))).toBe(1); // Earth (1)
    expect(seedSphereLevel(item(12, 112))).toBe(3); // Fire (3)
    expect(seedSphereLevel(item(12, 129))).toBe(5);
  });

  it('starts on the first free socket to mount, the first full one to take off', () => {
    const sword = item(0, 26, { socketCount: 3, sockets: [1, 0xfe, 0xfe] });
    expect(socketItemOf([null, sword])).toBe(sword);
    expect(defaultSocket([sword, item(12, 101)])).toBe(1);
    expect(defaultSocket([sword])).toBe(0);
    expect(defaultSocket([item(14, 13)])).toBe(0);
  });

  it('keeps the picked socket only while it fits', () => {
    const sword = item(0, 26, { socketCount: 3, sockets: [0xfe, 2, 0xfe] });
    const sphere = item(12, 101);
    expect(socketToUse([sword, sphere], 2)).toBe(2); // empty: mounts there
    expect(socketToUse([sword, sphere], 1)).toBe(0); // full: the first empty one instead
    expect(socketToUse([sword], 0)).toBe(1); // nothing to take off there: the full one
  });
});
