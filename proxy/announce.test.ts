import { describe, expect, it } from 'vitest';
import { AnnounceSchedule, Injector, PacketFramer, goldenNoticePacket, type AutoMessage } from './announce';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('PacketFramer', () => {
  it('follows C1 and C2 packets across chunk splits', () => {
    const f = new PacketFramer();
    f.feed(bytes(0xc1, 0x04, 0x0f, 0x00)); // one whole packet
    expect(f.atBoundary).toBe(true);
    f.feed(bytes(0xc1, 0x05, 0x01)); // cut mid-packet
    expect(f.atBoundary).toBe(false);
    f.feed(bytes(0x02, 0x03, 0xc2)); // its end, then half a C2 header
    expect(f.atBoundary).toBe(false);
    f.feed(bytes(0x00, 0x05, 0x10, 0x11)); // C2 size 5: header 3 + 2 bytes
    expect(f.atBoundary).toBe(true);
  });

  it('gives up on a byte that starts no packet', () => {
    const f = new PacketFramer();
    f.feed(bytes(0x42, 0x00));
    expect(f.broken).toBe(true);
    expect(f.atBoundary).toBe(false);
  });
});

describe('Injector', () => {
  it('holds a packet until the server stream reaches a boundary', () => {
    const sent: number[][] = [];
    const inj = new Injector(p => sent.push([...p]));
    inj.afterServerChunk(bytes(0xc1, 0x05, 0x01)); // mid-packet
    inj.inject(bytes(0xc1, 0x04, 0x0d, 0x00));
    expect(sent).toEqual([]);
    inj.afterServerChunk(bytes(0x02, 0x03));
    expect(sent).toEqual([[0xc1, 0x04, 0x0d, 0x00]]);
    inj.inject(bytes(0xc1, 0x04, 0x0f, 0x00));
    expect(sent.length).toBe(2);
  });
});

describe('goldenNoticePacket', () => {
  it('builds a C1 0D type 0 notice with a trailing zero', () => {
    const p = goldenNoticePacket('Hola á');
    expect([...p.slice(0, 4)]).toEqual([0xc1, p.length, 0x0d, 0x00]);
    expect(String.fromCharCode(...p.slice(4, -1))).toBe('Hola á');
    expect(p[p.length - 1]).toBe(0);
  });

  it('stays inside one C1 packet', () => {
    expect(goldenNoticePacket('x'.repeat(500)).length).toBeLessThanOrEqual(255);
  });
});

describe('AnnounceSchedule', () => {
  const msg = (over: Partial<AutoMessage> = {}): AutoMessage => ({
    id: 1,
    text: 'Bienvenidos',
    intervalMinutes: 10,
    enabled: true,
    sendNowAt: null,
    ...over,
  });

  it('waits one interval after first seeing a message, then repeats', () => {
    const s = new AnnounceSchedule();
    expect(s.due([msg()], 0)).toEqual([]);
    expect(s.due([msg()], 9 * 60_000)).toEqual([]);
    expect(s.due([msg()], 10 * 60_000).length).toBe(1);
    expect(s.due([msg()], 11 * 60_000)).toEqual([]);
    expect(s.due([msg()], 20 * 60_000).length).toBe(1);
  });

  it('skips disabled and empty messages', () => {
    const s = new AnnounceSchedule();
    s.due([msg({ enabled: false }), msg({ id: 2, text: '  ' })], 0);
    expect(s.due([msg({ enabled: false }), msg({ id: 2, text: '  ' })], 60 * 60_000)).toEqual([]);
  });

  it('sends a fresh "send now" once, even when disabled', () => {
    const s = new AnnounceSchedule();
    const now = 1_000_000;
    expect(s.due([msg({ enabled: false, sendNowAt: now - 1000 })], now).length).toBe(1);
    expect(s.due([msg({ enabled: false, sendNowAt: now - 1000 })], now + 15_000)).toEqual([]);
    expect(s.due([msg({ enabled: false, sendNowAt: now + 20_000 })], now + 30_000).length).toBe(1);
  });

  it('ignores a "send now" from before the proxy started', () => {
    const s = new AnnounceSchedule();
    expect(s.due([msg({ sendNowAt: 0 })], 10 * 60_000)).toEqual([]);
  });
});
