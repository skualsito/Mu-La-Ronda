import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: the monster spots of the map the hero is on, for the TAB map.
 * The server sends them on arrival as blue lines that are read here and not
 * shown (MapSpotsPlugIn.cs):
 *
 *   Spots {map}|{part}/{parts}|x,y,monster,level,count;x,y,monster,level,count...
 *
 * Part 1 starts the map's list over; a map with no spots sends one empty part.
 */

export type MapSpot = {
  /** Tile coordinates of the spot's middle. */
  x: number;
  y: number;
  monster: number;
  level: number;
  count: number;
};

const LINE = /^Spots (\d+)\|(\d+)\/(\d+)\|(.*)$/;

const spotsByMap = observable.map<number, MapSpot[]>({}, { deep: false });

function parseEntries(text: string): MapSpot[] {
  const spots: MapSpot[] = [];
  for (const entry of text.split(';')) {
    const [x, y, monster, level, count] = entry.split(',').map(Number);
    if ([x, y, monster, level, count].some(n => n === undefined || Number.isNaN(n))) continue;
    spots.push({ x, y, monster, level, count });
  }
  return spots;
}

/** Takes a spots line from the server; false when the line is another one. */
export function readSpotsLine(text: string): boolean {
  const match = LINE.exec(text);
  if (!match) return false;
  const map = Number(match[1]);
  const part = Number(match[2]);
  const entries = parseEntries(match[4]);
  runInAction(() => {
    const held = part === 1 ? [] : (spotsByMap.get(map) ?? []);
    spotsByMap.set(map, held.concat(entries));
  });
  return true;
}

/** The spots of `map` the server has told about (empty until it does). */
export function mapSpots(map: number): readonly MapSpot[] {
  return spotsByMap.get(map) ?? [];
}
