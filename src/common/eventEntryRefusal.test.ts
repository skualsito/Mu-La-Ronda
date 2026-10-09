import { describe, expect, it } from 'vitest';
import { eventEntryRefusal, noteServerLine } from './eventEntryRefusal';

describe('eventEntryRefusal', () => {
  it("shows the server's own reason", () => {
    noteServerLine('Evento: ya estás dentro de otro evento.', 1000);
    expect(eventEntryRefusal('Chaos Castle', 1500)).toBe('ya estás dentro de otro evento.');
  });

  it('ignores a stale line and any other chat', () => {
    noteServerLine('Evento: ya estás dentro de otro evento.', 1000);
    expect(eventEntryRefusal('Chaos Castle', 9000)).toBeNull();
    noteServerLine('bot001 entered the game.', 1000);
    expect(eventEntryRefusal('Chaos Castle', 1100)).toBeNull();
  });
});
