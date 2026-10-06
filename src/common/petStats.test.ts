import { describe, expect, it } from 'vitest';
import { deriveCharacterStats } from './characterStats';
import type { Item } from '../ecs/world';

/** A Dark Knight with a sword and, in slot 8, `pet` (group 13). */
function stats(pet?: { num: number; durability?: number }) {
  const items = new Array<Item | null>(12).fill(null);
  items[0] = { group: 0, num: 0, level: 0, durability: 20 } as Item;
  if (pet) items[8] = { group: 13, num: pet.num, level: 0, durability: pet.durability ?? 255 } as Item;
  return deriveCharacterStats({
    charClass: 16,
    strength: 1000,
    agility: 100,
    vitality: 100,
    energy: 100,
    items,
  } as Parameters<typeof deriveCharacterStats>[0]);
}

describe('pet bonuses in the character window', () => {
  const base = stats();

  it.each([
    [1, 1.3], // Imp
    [3, 1.15], // Dinorant
    [64, 1.4], // Demon
    [123, 1.2], // Pet Skeleton
  ])('pet %i multiplies the damage by %f', (num, factor) => {
    const s = stats({ num });
    expect(s.damageMin).toBe(Math.trunc(base.damageMin * factor));
    expect(s.damageMax).toBe(Math.trunc(base.damageMax * factor));
  });

  it('a pet worn down to 0 durability gives nothing', () => {
    expect(stats({ num: 1, durability: 0 }).damageMax).toBe(base.damageMax);
  });

  it.each([80, 106])('pet %i adds 50 defense', num => {
    expect(stats({ num }).defense).toBe(base.defense + 50);
  });

  it('the angel changes no shown number (its -20% is on damage taken)', () => {
    const s = stats({ num: 0 });
    expect([s.damageMax, s.defense]).toEqual([base.damageMax, base.defense]);
  });
});
