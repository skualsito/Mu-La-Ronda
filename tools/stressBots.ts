/**
 * Mu La Ronda: local stress test - N headless players that log in to a local
 * OpenMU and mill around Lorencia's spawn, so a real client standing there can
 * be watched (RAM, FPS) with a crowd on screen.
 *
 * The accounts come from the scratch demo build: `MLR_STRESS_BOTS=200` makes
 * bot001..bot200 (password = name), each with the level 400 characters
 * (bot001Dk, bot001Dw, bot001Elf, bot001Dl, bot001Mg), all placed in Lorencia.
 *
 *   bun run tools/stressBots.ts --bots 100 --mode fight
 *
 * --host 127.0.0.1  --port 57901    the game server (straight TCP, no proxy)
 * --bots N          how many log in (default 50)
 * --from N          first bot number (default 1) - to run a second batch
 * --mode idle|walk|fight|chat|all   what they do once in (default all)
 * --class dk|dw|elf|dl|mg|mix       which character each one picks (default mix)
 * --spread N        tiles around the spawn they wander (default 6)
 * --ramp MS         delay between logins (default 150)
 * --goto X,Y        walk there first and make it home (e.g. 140,128: the Lorencia ring)
 * --account NAME    log in with this account instead (password = name; with --bots 1)
 *
 * Talks the same wire as the browser: Xor32 on every packet, SimpleModulus on
 * C3/C4 (store.ts sendToGS), Xor3 on the login strings (loginRequest).
 */
import net from 'node:net';
import {
  SimpleModulusDecryptor,
  SimpleModulusEncryptor,
  SimpleModulusKeys,
  Xor32Encryptor,
  Xor3Byte,
} from '../src/common/encryption';
import {
  AnimationRequestPacket,
  AreaSkillPacket,
  LoginShortPasswordPacket,
  PublicChatMessagePacket,
  RequestCharacterListPacket,
  SelectCharacterPacket,
  WalkRequestPacket,
} from '../src/common/packets/ClientToServerPackets';
import { getPacketSize, getSizeOfPacketType, stringToBytes } from '../src/common/wireUtils';

// --- the Season 6 constants (versions/season6/index.ts) -------------------
const CLIENT_TO_SERVER_KEYS = [128079, 164742, 70235, 106898, 23489, 11911, 19816, 13647, 48413, 46165, 15171, 37433];
const SERVER_TO_CLIENT_KEYS = [73326, 109989, 98843, 171058, 18035, 30340, 24701, 11141, 62004, 64409, 35374, 64599];
const XOR32_KEY = new Uint8Array([
  0xab, 0x11, 0xcd, 0xfe, 0x18, 0x23, 0xc5, 0xa3, 0xca, 0x33, 0xc1, 0xcc, 0x66, 0x67, 0x21, 0xf3,
  0x32, 0x12, 0x15, 0x35, 0x29, 0xff, 0xfe, 0x1d, 0x44, 0xef, 0xcd, 0x41, 0x26, 0x3c, 0x4e, 0x4d,
]);
const ascii = (s: string) => Array.from(s, c => c.charCodeAt(0));
const CLIENT_VERSION = ascii('10404');
const CLIENT_SERIAL = ascii('k1Pk2jcET48mxL3b');

// --- arguments -------------------------------------------------------------
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const HOST = arg('host', '127.0.0.1');
const PORT = Number(arg('port', '57901'));
const BOTS = Number(arg('bots', '50'));
const FROM = Number(arg('from', '1'));
const MODE = arg('mode', 'all') as 'idle' | 'walk' | 'fight' | 'chat' | 'all';
const CLASS = arg('class', 'mix');
const SPREAD = Number(arg('spread', '6'));
const RAMP = Number(arg('ramp', '150'));
const ACCOUNT = arg('account', '');
const GOTO = arg('goto', '').split(',').map(Number) as [number, number] | number[];
const HAS_GOTO = GOTO.length === 2 && GOTO.every(n => Number.isFinite(n));

const CLASSES = ['Dk', 'Dw', 'Elf', 'Dl', 'Mg'] as const;
type Cls = (typeof CLASSES)[number];

/**
 * Area skills that draw something big on the viewers' screens. Whatever the
 * character has not learned the server just ignores.
 */
const SKILLS: Record<Cls, number[]> = {
  Dk: [41, 42, 43], // Twisting Slash, Rageful Blow, Death Stab
  Dw: [9, 12, 14], // Evil Spirit, Aqua Beam, Inferno
  Elf: [24, 52], // Triple Shot, Penetration
  Dl: [61, 62, 78], // Fire Burst, Earthshake, Fire Scream
  Mg: [55, 56, 9], // Fire Slash, Power Slash, Evil Spirit
};

const EMOTES = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x0a, 0x0b, 0x0d, 0x0e];
const LINES = ['hola', 'alguien party?', 'vendo wings', 'que lag jaja', 'gg', 'donde esta kundun', 'x9999 vamo', '/re auto', 'buen server', 'compro soul'];

// Client direction codes (networkSystem.ts GetClientDirectionCode): index = code.
const DIRS: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

const rnd = (n: number) => Math.floor(Math.random() * n);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const stats = { connected: 0, inGame: 0, failed: 0, closed: 0, sent: 0, received: 0 };

class Bot {
  readonly account: string;
  readonly cls: Cls;
  private socket!: net.Socket;
  private bytes = new Uint8Array(0);
  private readonly xor32 = new Xor32Encryptor();
  private readonly encryptor = new SimpleModulusEncryptor();
  private readonly decryptor = new SimpleModulusDecryptor();
  private x = 0;
  private y = 0;
  private home = { x: 0, y: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;
  inGame = false;

  constructor(readonly n: number) {
    this.account = ACCOUNT || `bot${String(n).padStart(3, '0')}`;
    const pick = CLASSES.find(c => c.toLowerCase() === CLASS.toLowerCase());
    this.cls = pick ?? CLASSES[n % CLASSES.length];
    this.xor32.xor32Key = XOR32_KEY;
    this.encryptor.encryptionKeys = SimpleModulusKeys.CreateEncryptionKeys(CLIENT_TO_SERVER_KEYS);
    this.decryptor.decryptionKeys = SimpleModulusKeys.CreateDecryptionKeys(SERVER_TO_CLIENT_KEYS);
  }

  get character() {
    return this.account + this.cls;
  }

  start() {
    this.socket = net.connect({ host: HOST, port: PORT }, () => stats.connected++);
    this.socket.setNoDelay(true);
    this.socket.on('data', data => this.receive(new Uint8Array(data)));
    this.socket.on('error', err => {
      if (!this.inGame) stats.failed++;
      console.error(`[${this.account}] ${err.message}`);
    });
    this.socket.on('close', () => {
      stats.closed++;
      if (this.inGame) stats.inGame--;
      this.inGame = false;
      if (this.timer) clearTimeout(this.timer);
    });
  }

  stop() {
    this.socket?.destroy();
  }

  private send(view: DataView) {
    let packet = new Uint8Array(view.buffer);
    const header = packet[0];
    this.xor32.Encrypt(packet);
    if (header >= 0xc3) packet = this.encryptor.Encrypt(packet);
    stats.sent++;
    this.socket.write(packet);
  }

  private receive(chunk: Uint8Array) {
    const combined = new Uint8Array(this.bytes.length + chunk.length);
    combined.set(this.bytes);
    combined.set(chunk, this.bytes.length);
    this.bytes = combined;

    while (this.bytes.length > 0) {
      const type = this.bytes[0];
      if (type < 0xc1 || type > 0xc4) {
        this.bytes = this.bytes.subarray(1);
        continue;
      }
      if (this.bytes.length < getSizeOfPacketType(type) + 1) return;
      const length = getPacketSize(this.bytes);
      if (length < 3) {
        this.bytes = this.bytes.subarray(1);
        continue;
      }
      if (this.bytes.length < length) return;

      let packet: Uint8Array = this.bytes.slice(0, length);
      this.bytes = this.bytes.subarray(length);
      if (type >= 0xc3) {
        const [ok, decrypted] = this.decryptor.Decrypt(packet);
        if (!ok) continue;
        packet = decrypted;
      }
      stats.received++;
      this.handle(packet);
    }
  }

  private handle(p: Uint8Array) {
    const codeAt = p[0] === 0xc1 || p[0] === 0xc3 ? 2 : 3;
    const code = p[codeAt];
    const sub = p[codeAt + 1];

    if (code === 0xf1 && sub === 0x00) return this.login(); // GameServerEntered
    if (code === 0xf1 && sub === 0x01) {
      // LoginResponse: 1 = ok
      const result = p[codeAt + 2];
      if (result !== 1) {
        stats.failed++;
        console.error(`[${this.account}] login refused (${result}) - is MLR_STRESS_BOTS high enough?`);
        return this.stop();
      }
      const list = RequestCharacterListPacket.createPacket();
      list.Language = 0;
      return this.send(list.buffer);
    }
    if (code === 0xf3 && sub === 0x00) {
      // CharacterList
      const select = SelectCharacterPacket.createPacket();
      select.setName(this.character);
      return this.send(select.buffer);
    }
    if (code === 0xf3 && sub === 0x03) {
      // CharacterInformation: X at 4, Y at 5 (decrypted C3, code at 2)
      this.x = this.home.x = p[4];
      this.y = this.home.y = p[5];
      if (!this.inGame) {
        this.inGame = true;
        stats.inGame++;
        this.schedule(500 + rnd(2000));
      }
    }
  }

  private login() {
    const user = stringToBytes(this.account, 10);
    const pass = stringToBytes(this.account, 10);
    Xor3Byte(user);
    Xor3Byte(pass);
    const login = LoginShortPasswordPacket.createPacket();
    login.setUsername(user, user.length);
    login.setPassword(pass, pass.length);
    login.setClientVersion(CLIENT_VERSION);
    login.setClientSerial(CLIENT_SERIAL);
    this.send(login.buffer);
  }

  private schedule(ms: number) {
    this.timer = setTimeout(() => {
      if (!this.inGame) return;
      try {
        this.act();
      } catch (e) {
        console.error(`[${this.account}]`, e);
      }
      this.schedule(1500 + rnd(2500));
    }, ms);
  }

  private act() {
    if (HAS_GOTO && (this.x !== GOTO[0] || this.y !== GOTO[1])) {
      this.walkTo(GOTO[0], GOTO[1]);
      if (this.x === GOTO[0] && this.y === GOTO[1]) this.home = { x: this.x, y: this.y };
      return;
    }
    const roll = Math.random();
    switch (MODE) {
      case 'idle':
        return roll < 0.3 && this.emote();
      case 'walk':
        return this.walk();
      case 'fight':
        return roll < 0.7 ? this.skill() : this.walk();
      case 'chat':
        return roll < 0.5 ? this.chat() : this.walk();
      default:
        if (roll < 0.45) return this.walk();
        if (roll < 0.8) return this.skill();
        if (roll < 0.9) return this.emote();
        return this.chat();
    }
  }

  /** A few steps toward a random tile near home (the server stops at walls). */
  private walk() {
    this.walkTo(
      this.home.x + rnd(SPREAD * 2 + 1) - SPREAD,
      this.home.y + rnd(SPREAD * 2 + 1) - SPREAD
    );
  }

  /** Up to 8 straight steps toward (tx, ty). */
  private walkTo(tx: number, ty: number) {
    const dirs: number[] = [];
    let { x, y } = this;
    while ((x !== tx || y !== ty) && dirs.length < 8) {
      const dx = Math.sign(tx - x);
      const dy = Math.sign(ty - y);
      dirs.push(DIRS.findIndex(([a, b]) => a === dx && b === dy));
      x += dx;
      y += dy;
    }
    if (dirs.length === 0) return;

    const packed = new Array<number>(Math.ceil(dirs.length / 2)).fill(0);
    dirs.forEach((d, i) => (packed[i >> 1] |= (d & 0x0f) << (i % 2 === 0 ? 4 : 0)));
    const walk = WalkRequestPacket.createPacket(6 + packed.length);
    walk.SourceX = this.x;
    walk.SourceY = this.y;
    walk.StepCount = dirs.length;
    walk.TargetRotation = dirs[dirs.length - 1];
    walk.setDirections(packed, packed.length);
    this.send(walk.buffer);
    this.x = x;
    this.y = y;
  }

  private skill() {
    const list = SKILLS[this.cls];
    const packet = AreaSkillPacket.createPacket();
    packet.SkillId = list[rnd(list.length)];
    packet.TargetX = this.x + rnd(5) - 2;
    packet.TargetY = this.y + rnd(5) - 2;
    packet.Rotation = rnd(256);
    this.send(packet.buffer);
  }

  private emote() {
    const packet = AnimationRequestPacket.createPacket();
    packet.Rotation = rnd(8);
    packet.AnimationNumber = EMOTES[rnd(EMOTES.length)];
    this.send(packet.buffer);
  }

  private chat() {
    const message = LINES[rnd(LINES.length)];
    // Character (3..12), message from 13, a closing zero (ASCII lines only).
    const packet = PublicChatMessagePacket.createPacket(13 + message.length + 1);
    packet.setCharacter(this.character, 10);
    packet.setMessage(message, message.length);
    this.send(packet.buffer);
  }
}

const bots: Bot[] = [];
console.log(`${BOTS} bots (bot${String(FROM).padStart(3, '0')}..) -> ${HOST}:${PORT}, mode ${MODE}, class ${CLASS}`);

const report = setInterval(() => {
  console.log(
    `in game ${stats.inGame}/${BOTS}  connected ${stats.connected}  failed ${stats.failed}  closed ${stats.closed}  pkts out ${stats.sent} in ${stats.received}`
  );
}, 5000);

process.on('SIGINT', () => {
  console.log('stopping...');
  clearInterval(report);
  bots.forEach(b => b.stop());
  setTimeout(() => process.exit(0), 300);
});

for (let i = 0; i < BOTS; i++) {
  const bot = new Bot(FROM + i);
  bots.push(bot);
  bot.start();
  await sleep(RAMP);
}
