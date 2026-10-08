import { beforeEach, describe, expect, it } from 'vitest';
import { clearInvasions, readInvasionLine, runningInvasions } from './invasionTally';

describe('invasionTally', () => {
  beforeEach(() => clearInvasions());

  it('ignores other lines', () => {
    expect(readInvasionLine('Puntos libres: 10')).toBe(false);
    expect(runningInvasions()).toEqual([]);
  });

  it('reads a tally sent in parts, part 1 starting it over', () => {
    expect(readInvasionLine('Invasion Golden|1/2|43,0,6;78,2,6')).toBe(true);
    readInvasionLine('Invasion Golden|2/2|79,1,10');
    expect(runningInvasions()).toEqual([
      {
        key: 'Golden',
        counts: [
          { monster: 43, killed: 0, total: 6 },
          { monster: 78, killed: 2, total: 6 },
          { monster: 79, killed: 1, total: 10 },
        ],
      },
    ]);
    readInvasionLine('Invasion Golden|1/1|43,1,6');
    expect(runningInvasions()[0].counts).toEqual([{ monster: 43, killed: 1, total: 6 }]);
  });

  it('drops an invasion once it is over', () => {
    readInvasionLine('Invasion Golden|1/1|43,0,6');
    readInvasionLine('Invasion RedDragon|1/1|44,0,5');
    readInvasionLine('Invasion Golden|0/0|');
    expect(runningInvasions().map(i => i.key)).toEqual(['RedDragon']);
  });
});
