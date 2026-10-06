import { describe, expect, it } from 'vitest';
import { parseAddCommand } from './chatCommands';
import { StatType } from './characterStats';

describe('parseAddCommand', () => {
  it('reads /add <stat> <n>', () => {
    expect(parseAddCommand('/add str 100')).toEqual({ kind: 'add', stat: StatType.Strength, amount: 100 });
    expect(parseAddCommand('/ADD Cmd 5')).toEqual({ kind: 'add', stat: StatType.Leadership, amount: 5 });
  });

  it('reads /addstr <n> and the other four', () => {
    expect(parseAddCommand('/addagi 20')).toEqual({ kind: 'add', stat: StatType.Agility, amount: 20 });
    expect(parseAddCommand('/addvit 1')).toEqual({ kind: 'add', stat: StatType.Vitality, amount: 1 });
    expect(parseAddCommand('/addene  7')).toEqual({ kind: 'add', stat: StatType.Energy, amount: 7 });
  });

  it('answers with the usage on a bad line', () => {
    expect(parseAddCommand('/add')).toMatchObject({ kind: 'usage' });
    expect(parseAddCommand('/add foo 3')).toMatchObject({ kind: 'usage' });
    expect(parseAddCommand('/addstr abc')).toMatchObject({ kind: 'usage', usage: '/addstr <amount>' });
    expect(parseAddCommand('/addstr -4')).toMatchObject({ kind: 'usage' });
  });

  it('leaves other commands alone', () => {
    expect(parseAddCommand('/addfriend')).toBeUndefined();
    expect(parseAddCommand('/reset')).toBeUndefined();
    expect(parseAddCommand('hola')).toBeUndefined();
  });
});
