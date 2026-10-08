/**
 * Mu La Ronda: free points past 65 535. The level and stats packets carry them
 * in 16 bits, so the number wrapped around (66 000 showed as 464, and a reset
 * seemed to eat them). The server follows those packets with a line
 * "Puntos libres: N" when there are more (WidePointsLine.cs); it is read here
 * and not shown.
 */

const LINE = /^Puntos libres: (\d+)$/;

/** The real free points from a server line, or null when the line is another one. */
export function readPointsLine(text: string): number | null {
  const match = LINE.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * The free points a 16-bit packet field means, given what the client holds.
 * Above 65 535 the field is the low 16 bits: the change from the held value is
 * taken as the nearest one (a level-up adds a few points, never 32 768), so
 * the number doesn't wrap between the packet and the line that corrects it.
 */
export function pointsFromWire(wire: number, held: number): number {
  if (held <= 0xffff) return wire;
  const delta = ((wire - (held & 0xffff) + 0x18000) & 0xffff) - 0x8000;
  return Math.max(0, held + delta);
}
