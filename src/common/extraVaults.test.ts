import { describe, expect, it } from 'vitest';
import { extraVaults, readVaultLine, resetExtraVaults } from './extraVaults';

describe('readVaultLine', () => {
  it('reads and hides the state line', () => {
    expect(readVaultLine('Baul 2/9')).toBe(true);
    expect(extraVaults.current).toBe(2);
    expect(extraVaults.allowed).toBe(9);
  });

  it('shows the refusals, and they end a switch', () => {
    extraVaults.switching = true;
    expect(readVaultLine('Baul: tu VIP tiene 3 baules extra.')).toBe(false);
    expect(extraVaults.switching).toBe(false);
  });

  it('leaves other lines alone', () => {
    expect(readVaultLine('Baul de Lorencia')).toBe(false);
  });

  it('starts again on the own vault when it closes', () => {
    readVaultLine('Baul 5/6');
    resetExtraVaults();
    expect(extraVaults.current).toBe(0);
    expect(extraVaults.allowed).toBe(6);
  });
});

describe('switchVault', () => {
  it('wraps around and waits for the answer', async () => {
    const { switchVault } = await import('./extraVaults');
    readVaultLine('Baul 3/3');
    const sent: string[] = [];
    switchVault(4, command => (sent.push(command), true));
    switchVault(1, command => (sent.push(command), true));
    expect(sent).toEqual(['/baul 0']);
  });
});
