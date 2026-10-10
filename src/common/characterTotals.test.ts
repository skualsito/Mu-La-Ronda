import { describe, expect, it } from 'vitest';
import { characterTotals, readCharacterTotalsLine, totalsSections } from './characterTotals';

describe('character totals', () => {
  it('reads the server lines and hides them', () => {
    expect(readCharacterTotalsLine('Estadisticas: pmin=100;pmax=150;refl=0.15;')).toBe(true);
    expect(readCharacterTotalsLine('Estadisticas: zen=1.5;recv=0.75;hp=2000;')).toBe(true);
    expect(characterTotals.values.pmin).toBeUndefined(); // only on "fin"
    expect(readCharacterTotalsLine('Estadisticas: fin')).toBe(true);
    expect(characterTotals.values).toMatchObject({ pmin: 100, pmax: 150, refl: 0.15, zen: 1.5, recv: 0.75, hp: 2000 });
    expect(readCharacterTotalsLine('VIP: no tenes VIP.')).toBe(false);
  });

  it('shows what the character has, as percentages where they are', () => {
    const rows = totalsSections({ pmin: 100, pmax: 150, refl: 0.15, zen: 1.5, recv: 0.75, hp: 2000, crit: 0 })
      .flatMap(s => s.rows)
      .map(r => [r.label, r.value]);
    expect(rows).toContainEqual(['totals.physical', '100 ~ 150']);
    expect(rows).toContainEqual(['totals.reflect', '15%']);
    expect(rows).toContainEqual(['totals.zen', '+50%']);
    expect(rows).toContainEqual(['totals.absorb', '25%']);
    expect(rows.find(r => r[0] === 'totals.critical')).toBeUndefined();
    expect(rows.find(r => r[0] === 'totals.wizardry')).toBeUndefined();
  });
});
