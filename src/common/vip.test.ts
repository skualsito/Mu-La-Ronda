import { describe, expect, it } from 'vitest';
import { checkingVipCode, discounted, readVipCodeLine, readVipLine, resetVip, vipCode, vipState } from './vip';

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

describe('the VIP that waits', () => {
  it('reads the tier that follows the current one', () => {
    resetVip();
    readVipLine('VIP Bronce activo hasta 10/11/2026: +10% experiencia y zen. Despues sigue Oro hasta 10/12/2026.');
    expect(vipState).toMatchObject({ name: 'Bronce', until: '10/11/2026', next: { name: 'Oro', until: '10/12/2026' } });
    readVipLine('VIP Oro activo hasta 10/12/2026: +30% experiencia y zen.');
    expect(vipState.next).toBeNull();
  });
});

describe('readVipCodeLine', () => {
  it('reads the discount of the code being checked', () => {
    checkingVipCode('BETA10');
    expect(readVipCodeLine('VIP codigo beta10: 10% de descuento.')).toBe(true);
    expect(vipCode).toMatchObject({ percent: 10, refusal: null });
  });

  it('reads why a code cannot be used, and ignores answers for another code', () => {
    checkingVipCode('NOPE');
    expect(readVipCodeLine('VIP codigo NOPE: ese codigo no existe.')).toBe(true);
    expect(vipCode).toMatchObject({ percent: null, refusal: 'ese codigo no existe.' });
    readVipCodeLine('VIP codigo OTHER: 50% de descuento.');
    expect(vipCode.percent).toBeNull();
    expect(readVipCodeLine('VIP Oro activo hasta 10/12/2026: +30% experiencia y zen.')).toBe(false);
  });

  it('rounds the discounted price down, like the server', () => {
    expect(discounted(200_000_000, 10)).toBe(180_000_000);
    expect(discounted(333, 10)).toBe(299);
    expect(discounted(500, null)).toBe(500);
  });
});
