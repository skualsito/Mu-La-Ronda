import { describe, expect, it } from 'vitest';
import { itemNameColor } from './itemTooltip';

describe('excellent item name colour', () => {
  it('is green with or without an additional option, at any level', () => {
    expect(itemNameColor({ group: 0, num: 5, isExcellent: true })).toBe('green');
    expect(itemNameColor({ group: 0, num: 5, lvl: 9, isExcellent: true })).toBe('green');
    expect(itemNameColor({ group: 0, num: 5, optionLevel: 3, isExcellent: true })).toBe('green');
  });

  it('leaves plain items as before', () => {
    expect(itemNameColor({ group: 0, num: 5 })).toBe('white');
    expect(itemNameColor({ group: 0, num: 5, lvl: 9 })).toBe('yellow');
  });
});
