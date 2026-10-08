import { describe, expect, it } from 'vitest';
import {
  BLOB_EXTRA_ITEM_CHARS,
  decodeMuHelperConfig,
  defaultMuHelperConfig,
  encodeMuHelperConfig,
  matchesExtraItem,
  restoreExtraItemNames,
} from './config';

describe('extra item filters', () => {
  const shield = { name: 'Guardian Shield', level: 9, luck: true, hasSkill: false, optionLevel: 3 };

  it('matches the name alone as before', () => {
    expect(matchesExtraItem('guardian', shield)).toBe(true);
    expect(matchesExtraItem('Dragon', shield)).toBe(false);
  });

  it('reads luck and the option level', () => {
    expect(matchesExtraItem('Guardian Shield +Luck +Opt 12', shield)).toBe(true);
    expect(matchesExtraItem('Guardian Shield +Luck +Opt12', shield)).toBe(true);
    expect(matchesExtraItem('Guardian Shield +Opt 16', shield)).toBe(false);
    expect(matchesExtraItem('Guardian Shield +Opt', { ...shield, optionLevel: 0 })).toBe(false);
    expect(matchesExtraItem('Guardian Shield +Luck', { ...shield, luck: false })).toBe(false);
  });

  it('reads skill, excellent, ancient and a minimum level', () => {
    expect(matchesExtraItem('Shield +Skill', shield)).toBe(false);
    expect(matchesExtraItem('Shield +9', shield)).toBe(true);
    expect(matchesExtraItem('Shield +10', shield)).toBe(false);
    expect(matchesExtraItem('+Exc', { name: 'Sword', isExcellent: true })).toBe(true);
    expect(matchesExtraItem('+Anc', { name: 'Sword' })).toBe(false);
  });
});

describe('extra item names past the blob slot', () => {
  it('cuts the blob and puts the whole text back from the saved list', () => {
    const full = ['Guardian Shield +Luck +Opt 12', 'Guardian Shield +Skill', 'Jewel'];
    const config = { ...defaultMuHelperConfig(), extraItems: full };
    const slots = decodeMuHelperConfig(encodeMuHelperConfig(config)).extraItems;

    expect(slots.every(s => s.length <= BLOB_EXTRA_ITEM_CHARS)).toBe(true);
    expect(restoreExtraItemNames(slots, full)).toEqual(full);
  });

  it('keeps a slot nothing saved here starts with', () => {
    expect(restoreExtraItemNames(['Guardian Shiel', 'Box'], [])).toEqual(['Guardian Shiel', 'Box']);
  });
});
