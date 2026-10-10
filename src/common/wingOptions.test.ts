import { describe, expect, it } from 'vitest';
import { ItemSerializer } from './itemSerializer';
import { buildItemTooltip, itemDisplayName } from './itemTooltip';
import type { HeroStats } from './itemStats';

const HERO: HeroStats = { level: 400, str: 3000, agi: 3000, vit: 3000, ene: 3000, cmd: 0, baseClass: 1, stepClass: 3 };

/** OpenMU's 12 bytes for an item: number, level/luck/skill/option, durability, byte 3, ancient, group. */
function bytes(group: number, num: number, level: number, byte3: number, optionLow = 0): Uint8Array {
  const a = new Uint8Array(12).fill(0xff);
  a[0] = num & 0xff;
  a[1] = (level << 3) | 0x04 | optionLow;
  a[2] = 255;
  a[3] = byte3;
  a[4] = 0;
  a[5] = group << 4;
  a[6] = 0;
  return a;
}

describe('wing options', () => {
  it('reads a third wing with every option as wing options, not excellent ones', () => {
    // Wing of Storm +13, all four wing options, the defense option (kind 2) at level 4.
    const item = ItemSerializer.DeserializeItem(bytes(12, 36, 13, 0x0f | 0x20 | 0x40));
    expect(item.isExcellent).toBe(false);
    expect(item.excellentFlags).toBe(0);
    expect(item.wingOptions).toBe(0x0f);
    expect(item.wingOptionKind).toBe(2);
    expect(item.optionLevel).toBe(4);

    const lines = (buildItemTooltip(item, HERO)?.lines ?? []).map(l => l.text);
    expect(lines).toContain('Additional Defense +16');
    expect(lines).toContain("Ignore opponent's defense 5%");
    expect(lines).toContain("5% chance to return the enemy's attack");
    expect(lines).toContain('5% chance to fully recover life');
    expect(lines).toContain('5% chance to fully recover mana');
    expect(itemDisplayName(item)).not.toMatch(/excellent/i);
  });

  it('gives a second wing its HP and mana by level, and the Cape of Lord its command', () => {
    const wings = ItemSerializer.DeserializeItem(bytes(12, 5, 9, 0x07));
    const lines = (buildItemTooltip(wings, HERO)?.lines ?? []).map(l => l.text);
    expect(lines).toContain('Max HP +95');
    expect(lines).toContain('Max Mana +95');
    expect(lines).toContain("Ignore opponent's defense 3%");

    const cape = ItemSerializer.DeserializeItem(bytes(13, 30, 2, 0x08));
    expect((buildItemTooltip(cape, HERO)?.lines ?? []).map(l => l.text)).toContain('Command +20');
  });

  it('leaves excellent items alone', () => {
    const sword = ItemSerializer.DeserializeItem(bytes(0, 5, 0, 0x21));
    expect(sword.isExcellent).toBe(true);
    expect(sword.excellentFlags).toBe(0x21);
    expect(sword.wingOptions).toBeUndefined();
  });
});
