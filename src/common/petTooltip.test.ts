import { describe, expect, it } from 'vitest';
import { ItemGroup, type ItemDef } from './itemStats';
import { petBonusLines } from './itemTooltip';

const pet = (index: number) => ({ group: ItemGroup.Helper, index }) as ItemDef;

describe('pet tooltip', () => {
  it('names what each pet gives', () => {
    expect(petBonusLines(pet(1))).toEqual(['Increase Damage +30%']);
    expect(petBonusLines(pet(0))).toEqual(['Absorb Damage +20%', 'Increase max. HP +50']);
    expect(petBonusLines(pet(80))).toEqual(['Increase experience gained +50%', 'Increase defense +50']);
  });

  it('leaves other helpers alone', () => {
    expect(petBonusLines(pet(67))).toEqual([]);
    expect(petBonusLines({ group: ItemGroup.Potion, index: 1 } as ItemDef)).toEqual([]);
  });
});
