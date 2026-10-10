import { describe, expect, it } from 'vitest';
import { ItemGroup, type ItemDef } from './itemStats';
import { petBonusLines } from './itemTooltip';

const pet = (index: number) => ({ group: ItemGroup.Helper, index }) as ItemDef;

describe('pet tooltip', () => {
  it('names what each pet gives', () => {
    expect(petBonusLines(pet(1))).toEqual(['Increase Damage +30%']);
    expect(petBonusLines(pet(0))).toEqual(['Absorb Damage +20%', 'Increase max. HP +50']);
    expect(petBonusLines(pet(80))).toEqual(['Increase experience gained +50%', 'Increase defense +50', 'Automatically collects Zen']);
    expect(petBonusLines(pet(67))).toEqual(['Automatically collects Zen']);
  });

  it('names what each transformation ring gives', () => {
    expect(petBonusLines(pet(76))).toEqual(['Increase damage +30', 'Increase Zen dropped +50%', 'Final damage +30']);
    expect(petBonusLines(pet(39))).toEqual(['Increase defense +10%', 'Increase max. HP +1 per level']);
  });

  it('leaves other helpers alone', () => {
    expect(petBonusLines(pet(68))).toEqual([]); // the Snowman ring only transforms
    expect(petBonusLines({ group: ItemGroup.Potion, index: 1 } as ItemDef)).toEqual([]);
  });
});
