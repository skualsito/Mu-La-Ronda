import { describe, expect, it } from 'vitest';
import { CharacterClassNumber } from './types';
import { darkLordMaskModel, rageFighterSetModel, showsClassHead } from './classPartModels';

const item = (group: number, num: number) => ({ group, num });

describe('appearance model rules', () => {
  it('dresses the Rage Fighter in his own models for the common sets', () => {
    expect(rageFighterSetModel(item(8, 5), CharacterClassNumber.FistMaster)).toBe('ArmorMonk01.glb');
    expect(rageFighterSetModel(item(7, 9), CharacterClassNumber.RageFighter)).toBe('HelmMonk04.glb');
    expect(rageFighterSetModel(item(10, 6), CharacterClassNumber.RageFighter)).toBe('BootMonk02.glb');
    expect(rageFighterSetModel(item(8, 59), CharacterClassNumber.FistMaster)).toBeNull();
    expect(rageFighterSetModel(item(8, 5), CharacterClassNumber.BladeMaster)).toBeNull();
  });

  it('gives the Dark Lord masks for the five open helms', () => {
    expect(darkLordMaskModel(item(7, 0), CharacterClassNumber.DarkLord)).toBe('MaskHelmMale01.glb');
    expect(darkLordMaskModel(item(7, 9), CharacterClassNumber.LordEmperor)).toBe('MaskHelmMale10.glb');
    expect(darkLordMaskModel(item(7, 25), CharacterClassNumber.LordEmperor)).toBeNull();
    expect(darkLordMaskModel(item(8, 5), CharacterClassNumber.DarkLord)).toBeNull();
    expect(darkLordMaskModel(item(7, 5), CharacterClassNumber.DarkKnight)).toBeNull();
  });

  it('keeps the class head only under no helm or an open one', () => {
    expect(showsClassHead(null)).toBe(true);
    expect(showsClassHead(item(7, 0))).toBe(true);
    expect(showsClassHead(item(7, 12))).toBe(true);
    expect(showsClassHead(item(7, 1))).toBe(false);
    expect(showsClassHead(item(7, 73))).toBe(false);
  });
});
