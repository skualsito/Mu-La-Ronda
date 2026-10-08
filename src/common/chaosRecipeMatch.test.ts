import { describe, expect, it } from 'vitest';
import type { Item } from '../ecs/world';
import { bestRecipe } from './chaosRecipeMatch';

const item = (group: number, num: number, extra: Partial<Item> = {}): Item => ({ group, num, ...extra });
const chaos = item(12, 15);

describe('bestRecipe', () => {
  it('says nothing for an empty tray or a lone Jewel of Chaos', () => {
    expect(bestRecipe([])).toBeNull();
    expect(bestRecipe([chaos, null])).toBeNull();
  });

  it('reads 3rd wings stage 2 and lists what is missing', () => {
    const tray = [item(0, 0, { lvl: 9, isExcellent: true, optionLevel: 1 }), chaos, item(14, 22), item(13, 53), item(13, 52)];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('3rd Level Wings, Stage 2');
    expect(match.complete).toBe(false);
    const missing = match.requirements.filter(r => !r.ok).map(r => r.requirement.items);
    expect(missing).toEqual([[[12, 31]], [[12, 30]]]);
  });

  it('is complete once the packed jewels are in', () => {
    const tray = [
      item(0, 0, { lvl: 9, isExcellent: true, optionLevel: 1 }),
      chaos, item(14, 22), item(13, 53), item(13, 52), item(12, 31), item(12, 30),
    ];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('3rd Level Wings, Stage 2');
    expect(match.complete).toBe(true);
  });

  it('picks the +N combination by the item level', () => {
    const tray = [item(0, 0, { lvl: 11 }), chaos, ...[0, 1, 2].flatMap(() => [item(14, 13), item(14, 14)])];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('+12 Item Combination');
    expect(match.complete).toBe(true);
  });

  it('reads a +9 item with an option, Chaos, Bless and Soul as +10, not Chaos Weapon', () => {
    const tray = [item(0, 0, { lvl: 9, optionLevel: 2, luck: true }), chaos, item(14, 13), item(14, 14)];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('+10 Item Combination');
    expect(match.complete).toBe(true);
  });

  it('says Chaos Weapon while the Soul is missing, as the server would mix it then', () => {
    const tray = [item(0, 0, { lvl: 9, optionLevel: 1 }), chaos, item(14, 13)];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('Chaos Weapon');
    expect(match.complete).toBe(true);
  });

  it('heads for +10 with a +9 item that has no option', () => {
    const tray = [item(0, 0, { lvl: 9 }), chaos, item(14, 13)];
    const match = bestRecipe(tray)!;
    expect(match.recipe.name).toBe('+10 Item Combination');
    expect(match.complete).toBe(false);
  });
});
