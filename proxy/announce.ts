import postgres from "postgres";

/**
 * Mu La Ronda: automatic announcements - the golden notice in the middle of
 * the screen (`ServerMessage`, C1 0D, type 0), sent to every player in game
 * every N minutes. The admin panel edits them in `mlr.auto_messages`
 * (deploy/config/07-messages.sql); this reads that table and does the sending.
 *
 * It lives in the proxy because the proxy already holds every game socket and
 * already originates one packet (the weather). OpenMU has no scheduled
 * announcements of its own.
 *
 * A packet the proxy adds must land *between* the game server's packets: the
 * client reassembles one byte stream, so a notice dropped into the middle of
 * a packet that TCP happened to split would corrupt both. `PacketFramer`
 * follows the server's stream by its headers and says when it is at a
 * boundary; until then the notice waits.
 */

/** Follows a server→client byte stream by its C1/C2/C3/C4 headers. */
export class PacketFramer {
  /** Bytes still to come of the packet in progress. */
  private remaining = 0;
  /** The first bytes of a header TCP cut short. */
  private header: number[] = [];
  /** Lost sync on a byte that starts no packet; from then on it cannot tell. */
  broken = false;

  feed(chunk: Uint8Array): void {
    let i = 0;
    while (i < chunk.length && !this.broken) {
      if (this.remaining > 0) {
        const n = Math.min(this.remaining, chunk.length - i);
        this.remaining -= n;
        i += n;
        continue;
      }

      this.header.push(chunk[i++]);
      const code = this.header[0];
      const sizeBytes = code === 0xc1 || code === 0xc3 ? 1 : code === 0xc2 || code === 0xc4 ? 2 : 0;
      if (sizeBytes === 0) {
        this.broken = true;
        break;
      }
      if (this.header.length < 1 + sizeBytes) continue;

      const size = sizeBytes === 1 ? this.header[1] : (this.header[1] << 8) | this.header[2];
      this.header = [];
      if (size < 1 + sizeBytes) {
        this.broken = true;
        break;
      }
      this.remaining = size - 1 - sizeBytes;
    }
  }

  /** Between two packets, so one of ours can go in. */
  get atBoundary(): boolean {
    return !this.broken && this.remaining === 0 && this.header.length === 0;
  }
}

/**
 * Sends the proxy's own packets on one connection without splitting the
 * server's. While the stream is mid-packet they queue, and go out right
 * after the chunk that completes it. A stream the framer lost track of gets
 * them at once, which is what the weather always did.
 */
export class Injector {
  readonly framer = new PacketFramer();
  private queue: Uint8Array[] = [];

  constructor(private readonly send: (packet: Uint8Array) => void) {}

  inject(packet: Uint8Array): void {
    if (this.framer.atBoundary || this.framer.broken) this.send(packet);
    else this.queue.push(packet);
  }

  /** After forwarding a server chunk: track it, then flush whatever waited. */
  afterServerChunk(chunk: Uint8Array): void {
    this.framer.feed(chunk);
    if (this.queue.length && (this.framer.atBoundary || this.framer.broken)) {
      const waiting = this.queue;
      this.queue = [];
      for (const packet of waiting) this.send(packet);
    }
  }
}

/** The client reads the text one byte per character; anything wider becomes `?`. */
function latin1(text: string): number[] {
  return Array.from(text, ch => {
    const code = ch.charCodeAt(0);
    return code < 256 ? code : 0x3f;
  });
}

/** Room for the text: the C1 size is one byte, and the client cuts long lines in two anyway. */
export const NOTICE_MAX = 200;

export function goldenNoticePacket(text: string): Uint8Array {
  const body = latin1(text.replace(/[\r\n\t]+/g, " ").trim().slice(0, NOTICE_MAX));
  const packet = new Uint8Array(4 + body.length + 1);
  packet[0] = 0xc1;
  packet[1] = packet.length;
  packet[2] = 0x0d;
  packet[3] = 0; // GoldenCenter
  packet.set(body, 4);
  return packet;
}

export type AutoMessage = {
  id: number;
  text: string;
  intervalMinutes: number;
  enabled: boolean;
  /** Set by the panel's "send now"; sent once when it is newer than the last poll saw. */
  sendNowAt: number | null;
};

/**
 * Which messages are due. Each message keeps its own clock, started when the
 * proxy first sees it - so a restart or a new message waits one interval
 * instead of every message firing at once.
 */
export class AnnounceSchedule {
  private lastSent = new Map<number, number>();
  private sentNow = new Map<number, number>();

  due(messages: AutoMessage[], now: number): AutoMessage[] {
    const out: AutoMessage[] = [];
    const seen = new Set<number>();
    for (const m of messages) {
      seen.add(m.id);
      const text = m.text.trim();

      if (m.sendNowAt !== null && m.sendNowAt > (this.sentNow.get(m.id) ?? -Infinity)) {
        const first = !this.sentNow.has(m.id);
        this.sentNow.set(m.id, m.sendNowAt);
        // A "send now" from before the proxy started is history, not a request.
        if (!first || now - m.sendNowAt < 60_000) {
          if (text) out.push(m);
          this.lastSent.set(m.id, now);
          continue;
        }
      }

      if (!m.enabled || !text || !(m.intervalMinutes > 0)) continue;
      const last = this.lastSent.get(m.id);
      if (last === undefined) {
        this.lastSent.set(m.id, now);
        continue;
      }
      if (now - last >= m.intervalMinutes * 60_000) {
        this.lastSent.set(m.id, now);
        out.push(m);
      }
    }
    for (const id of this.lastSent.keys()) if (!seen.has(id)) this.lastSent.delete(id);
    return out;
  }
}

export const ANNOUNCE_POLL_MS = Number(process.env.ANNOUNCE_POLL_MS ?? 15_000);

/**
 * Polls the table and hands each due message to `broadcast`. Off without a
 * DATABASE_URL; a missing table (config not applied yet) is logged once and
 * retried quietly.
 */
export function startAnnouncements(broadcast: (packet: Uint8Array) => number): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("announce: off (no DATABASE_URL)");
    return;
  }
  const sql = postgres(url, { max: 1, idle_timeout: 60 });
  const schedule = new AnnounceSchedule();
  let complained = false;

  const tick = async () => {
    try {
      const rows = await sql<
        { id: number; text: string; interval_minutes: number; enabled: boolean; send_now_at: Date | null }[]
      >`SELECT id, text, interval_minutes, enabled, send_now_at FROM mlr.auto_messages ORDER BY id`;
      complained = false;
      const messages = rows.map(r => ({
        id: r.id,
        text: r.text,
        intervalMinutes: r.interval_minutes,
        enabled: r.enabled,
        sendNowAt: r.send_now_at ? r.send_now_at.getTime() : null,
      }));
      for (const m of schedule.due(messages, Date.now())) {
        const reached = broadcast(goldenNoticePacket(m.text));
        console.log(`announce: #${m.id} to ${reached} player(s)`);
      }
    } catch (error) {
      if (!complained) console.log("announce: cannot read mlr.auto_messages:", (error as Error).message);
      complained = true;
    }
  };

  setInterval(() => void tick(), ANNOUNCE_POLL_MS);
  void tick();
  console.log(`announce: on (poll ${ANNOUNCE_POLL_MS}ms)`);
}
