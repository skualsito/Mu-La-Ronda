import { describe, expect, it } from 'vitest';
import { readVipLine, resetVip, vipState } from './vip';

describe('readVipLine', () => {
  it('reads an active VIP from the server line', () => {
    resetVip();
    expect(readVipLine('VIP Oro activo hasta 06/11/2026: +30% experiencia y zen.')).toBe(true);
    expect(vipState).toMatchObject({ known: true, name: 'Oro', until: '06/11/2026', buying: false });
  });

  it('reads "no VIP"', () => {
    readVipLine('VIP Plata activo hasta 01/01/2027: +20% experiencia y zen.');
    expect(readVipLine('VIP: no tenes VIP. Bronce, Plata u Oro con /vip bronce|plata|oro.')).toBe(true);
    expect(vipState).toMatchObject({ known: true, name: null, until: null });
  });

  it('ends a purchase on any VIP answer and ignores other lines', () => {
    resetVip();
    vipState.buying = true;
    expect(readVipLine('Hola mundo')).toBe(false);
    expect(vipState.buying).toBe(true);
    readVipLine('VIP: te faltan zen, Oro cuesta 1,000,000,000.');
    expect(vipState.buying).toBe(false);
    expect(vipState.known).toBe(false);
  });
});
