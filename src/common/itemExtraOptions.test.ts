import { describe, expect, it } from 'vitest';
import { harmonyKindOf, harmonyLevels, harmonyOf, socketOf, SOCKET_EMPTY } from './itemExtraOptions';

describe('harmony option', () => {
  it('reads the option and level off byte 6, with its value at that level', () => {
    // Armor (group 8), option 1 (defense) at level 2: +5.
    expect(harmonyOf(8, (1 << 4) | 2)).toMatchObject({ key: 'harmony.defense', value: 5, active: true });
    // A sword, option 1 (min. attack) at level 13: the last value, +20.
    expect(harmonyOf(0, (1 << 4) | 13)).toMatchObject({ key: 'harmony.minDamage', value: 20 });
    // A staff uses the wizardry table.
    expect(harmonyOf(5, (1 << 4) | 0)).toMatchObject({ key: 'harmony.wizardry', value: 6 });
  });

  it('marks an option below its first level as giving nothing', () => {
    // Defense option 4 (HP recovery) starts at level 6.
    expect(harmonyOf(8, (4 << 4) | 0)?.active).toBe(false);
    expect(harmonyLevels('defense', 4)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('has nothing for no option or items without a table', () => {
    expect(harmonyOf(8, 0)).toBeNull();
    expect(harmonyKindOf(13)).toBeNull();
  });
});

describe('socket option', () => {
  it('splits the byte into element, option and sphere level', () => {
    // Fire option 1 (attack speed) at level 3: the byte carries the level less one.
    expect(socketOf(2 * 50 + 1)).toEqual({ empty: false, element: 'fire', key: 'socket.fire1', level: 3 });
    // Water starts at 10: index 11 is water option 1.
    expect(socketOf(50 + 11)).toMatchObject({ element: 'water', key: 'socket.water1', level: 2 });
    // Earth at 36, a level 1 sphere.
    expect(socketOf(36)).toMatchObject({ element: 'earth', key: 'socket.earth0', level: 1 });
    expect(socketOf(SOCKET_EMPTY)).toEqual({ empty: true });
  });
});
