/**
 * Mu La Ronda: the Chaos Goblin's success rates, as the server rolls them
 * (marketplace/openmu/src/GameLogic/MuLaRondaRates.cs - keep the two in step).
 * OpenMU's own rates grew with the value of the items in the tray; the server
 * now uses these fixed ones, so the window shows them instead of OpenMU's.
 */

export type ChaosRate =
  | { readonly kind: 'luck'; readonly normal: number; readonly luck: number; readonly vipLuck: number }
  | { readonly kind: 'vip'; readonly normal: number; readonly vip: number };

const luck = (normal: number, withLuck: number, vipLuck: number): ChaosRate => ({ kind: 'luck', normal, luck: withLuck, vipLuck });
const vip = (normal: number, withVip: number): ChaosRate => ({ kind: 'vip', normal, vip: withVip });

/** By OpenMU crafting number. */
export const CHAOS_RATES: Readonly<Record<number, ChaosRate>> = {
  3: luck(80, 95, 100), // +10
  4: luck(75, 90, 95), // +11
  22: luck(70, 85, 90), // +12
  23: luck(65, 80, 85), // +13
  49: luck(55, 70, 75), // +14
  50: luck(45, 60, 65), // +15
  1: vip(90, 95), // Chaos Weapon
  11: vip(85, 90), // 1st level wings
  7: vip(75, 80), // 2nd level wings
  24: vip(75, 80), // Cape of Lord / Fighter
  38: vip(60, 65), // 3rd level wings, stage 1 (Condor Feather)
  39: vip(50, 55), // 3rd level wings, stage 2
  13: vip(85, 90), // Dark Horse
  14: vip(85, 90), // Dark Raven
  25: vip(75, 80), // Fenrir stage 1
  26: vip(65, 70), // Fenrir stage 2
  27: vip(55, 60), // Fenrir stage 3
  28: vip(50, 55), // Fenrir upgrade
  42: vip(80, 85), // Seed extraction
  43: vip(75, 80), // Seed sphere
  36: vip(70, 75), // Option 380
};
