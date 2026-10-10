import { describe, expect, it } from 'vitest';
import { grandResetState, readGrandResetLine } from './grandReset';

describe('readGrandResetLine', () => {
  it('reads the state line', () => {
    expect(readGrandResetLine('Grand Reset: 2 hechos, 150 monedas. Pide nivel 400 y 10 resets; da 10 monedas por reset.')).toBe(true);
    expect(grandResetState).toMatchObject({ known: true, enabled: true, count: 2, coins: 150, requiredLevel: 400, requiredResets: 10, requiredMoney: 0, coinsPerReset: 10, coinsBonus: 0 });
  });

  it('reads the zen it costs', () => {
    readGrandResetLine('Grand Reset: 0 hechos, 0 monedas. Pide nivel 400 y 20 resets y 50,000,000 zen; da 10 monedas por reset y 80 mas. Suma 1 grand reset cada 20 resets.');
    expect(grandResetState.requiredMoney).toBe(50_000_000);
    expect(grandResetState.requiredResets).toBe(20);
    expect(grandResetState.coinsBonus).toBe(80);
    expect(grandResetState.resetsPerGrandReset).toBe(20);
  });

  it('leaves other lines alone', () => {
    expect(readGrandResetLine('Grand Reset 3 hecho: +100 monedas (tenes 300).')).toBe(false);
    expect(readGrandResetLine('VIP: no tenes VIP.')).toBe(false);
  });
});
