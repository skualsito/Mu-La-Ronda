import { observable, runInAction } from 'mobx';
import type { TextKey } from '../i18n';

/**
 * Mu La Ronda: the character's statistics window - the totals of everything at once (stats,
 * items, sets, sockets, buffs, VIP), as the server counts them. The window asks with
 * /estadisticas (marketplace/openmu/src/GameLogic/PlugIns/ChatCommands/MlrStatsChatCommandPlugIn.cs),
 * which answers blue lines "Estadisticas: key=value;..." ended by "Estadisticas: fin"; they are
 * read here and never shown in the chat.
 */

const PREFIX = 'Estadisticas: ';

export const characterTotals = observable({
  open: false,
  /** Waiting for the server's answer. */
  loading: false,
  values: {} as Record<string, number>,
});

let pending: Record<string, number> = {};

/** Reads a server line; true when it was one of the statistics' (hidden from the chat). */
export function readCharacterTotalsLine(text: string): boolean {
  if (!text.startsWith(PREFIX)) return false;
  const body = text.slice(PREFIX.length).trim();
  if (body === 'fin') {
    const values = pending;
    pending = {};
    runInAction(() => {
      characterTotals.values = values;
      characterTotals.loading = false;
    });
    return true;
  }
  for (const pair of body.split(';')) {
    const [key, raw] = pair.split('=');
    const value = Number(raw);
    if (key && raw !== undefined && Number.isFinite(value)) pending[key.trim()] = value;
  }
  return true;
}

export function setCharacterTotalsOpen(open: boolean): void {
  runInAction(() => {
    characterTotals.open = open;
    if (open) characterTotals.loading = true;
  });
}

export type TotalsRow = { label: TextKey; value: string };
export type TotalsSection = { title: TextKey; rows: TotalsRow[] };

const int = (v: number) => Math.round(v).toLocaleString('es-AR');
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

/**
 * The window's lines from the server's values: only what the character has (a zero chance, an
 * absent resistance, a curse damage of a class without curses stay out).
 */
export function totalsSections(v: Record<string, number>): TotalsSection[] {
  const get = (key: string) => v[key] ?? 0;
  const rows = (list: (TotalsRow | false)[]) => list.filter((r): r is TotalsRow => !!r);
  const range = (min: string, max: string) => `${int(get(min))} ~ ${int(get(max))}`;
  const chance = (key: string, label: TextKey) => get(key) > 0 && { label, value: pct(get(key)) };
  const plus = (key: string, label: TextKey) => get(key) > 0 && { label, value: `+${int(get(key))}` };

  const attack = rows([
    get('pmax') > 0 && { label: 'totals.physical', value: range('pmin', 'pmax') },
    get('wmax') > 0 && { label: 'totals.wizardry', value: range('wmin', 'wmax') },
    get('cmax') > 0 && { label: 'totals.curse', value: range('cmin', 'cmax') },
    get('skm') > 0 && { label: 'totals.skillMultiplier', value: `×${+get('skm').toFixed(2)}` },
    { label: 'totals.attackSpeed', value: int(get('aspd')) },
    get('mspd') > 0 && { label: 'totals.magicSpeed', value: int(get('mspd')) },
    { label: 'totals.attackRate', value: int(get('arpvm')) },
    get('arpvp') > 0 && { label: 'totals.attackRatePvp', value: int(get('arpvp')) },
    chance('crit', 'totals.critical'),
    chance('exc', 'totals.excellent'),
    chance('dbl', 'totals.double'),
    chance('ign', 'totals.ignoreDefense'),
    plus('critb', 'totals.criticalBonus'),
    plus('excb', 'totals.excellentBonus'),
    plus('fdmg', 'totals.finalDamage'),
    plus('pvpdmg', 'totals.pvpDamage'),
  ]);

  const absorb = 1 - (v.recv ?? 1);
  const defense = rows([
    { label: 'totals.defense', value: int(get('def')) },
    get('defpvp') > 0 && { label: 'totals.defensePvp', value: int(get('defpvp')) },
    { label: 'totals.defenseRate', value: int(get('drpvm')) },
    get('drpvp') > 0 && { label: 'totals.defenseRatePvp', value: int(get('drpvp')) },
    chance('refl', 'totals.reflect'),
    chance('ddec', 'totals.damageDecrease'),
    absorb > 0.0005 && { label: 'totals.absorb', value: pct(absorb) },
  ]);

  const life = rows([
    { label: 'totals.hp', value: int(get('hp')) },
    { label: 'totals.mana', value: int(get('mp')) },
    get('sd') > 0 && { label: 'totals.sd', value: int(get('sd')) },
    get('ag') > 0 && { label: 'totals.ag', value: int(get('ag')) },
    chance('hprec', 'totals.hpRecovery'),
    chance('hpkill', 'totals.hpAfterKill'),
    chance('mpkill', 'totals.manaAfterKill'),
  ]);

  const zen = get('zen') - 1;
  const other = rows([
    zen > 0.0005 && { label: 'totals.zen', value: `+${pct(zen)}` },
    get('exp') > 0 && { label: 'totals.experience', value: `+${pct(get('exp'))}` },
    ...(
      [
        ['rice', 'totals.resIce'],
        ['rfire', 'totals.resFire'],
        ['rwater', 'totals.resWater'],
        ['rearth', 'totals.resEarth'],
        ['rwind', 'totals.resWind'],
        ['rpoison', 'totals.resPoison'],
        ['rlight', 'totals.resLightning'],
      ] as const
    ).map(([key, label]) => get(key) > 0 && { label: label as TextKey, value: `+${int(get(key))}` }),
  ]);

  return (
    [
      { title: 'totals.attackTitle', rows: attack },
      { title: 'totals.defenseTitle', rows: defense },
      { title: 'totals.lifeTitle', rows: life },
      { title: 'totals.otherTitle', rows: other },
    ] as TotalsSection[]
  ).filter(s => s.rows.length > 0);
}
