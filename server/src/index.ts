import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServer, Emote, JoinPayload, Look, Move, PlaceId, PlayerInfo, ServerToClient, St, Stats,
} from './protocol.js';

// ---------- 설정 (환경 변수로 바꿀 수 있음) ----------
const PORT = Number(process.env.PORT ?? 3001);
/** 채널 하나에 들어갈 수 있는 최대 인원 */
const CAP = Number(process.env.CHANNEL_CAP ?? 100);
/** 접속을 허용할 프론트 주소. 쉼표로 여러 개. 예: https://hae.abracadelulu.com */
const ORIGINS = (process.env.CORS_ORIGIN ?? '*').split(',').map(s => s.trim());

const PLACES: Record<PlaceId, { tz: string }> = {
  jeongdongjin: { tz: 'Asia/Seoul' },
  seongsan: { tz: 'Asia/Seoul' },
  homigot: { tz: 'Asia/Seoul' },
  gisborne: { tz: 'Pacific/Auckland' },
};
const SEAT_COUNT = 22;
const BOUNDS = { minX: -22, maxX: 22, minZ: -1.6, maxZ: 17 };

// ---------- 상태 ----------
interface Channel {
  key: string;
  place: PlaceId;
  n: number;
  players: Map<string, PlayerInfo>;
  seats: Map<number, string>;
  /** 이번 틱에 움직인 사람들 */
  dirty: Set<string>;
}
interface SocketData {
  channel?: Channel;
  uid?: string;
  lastLantern: number;
  lastEmote: number;
  moveBudget: number;
}
type IO = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>;

const channels = new Map<string, Channel>();
/** "장소|날짜" → 그날 알람으로 깬 uid 모음 */
const wokeToday = new Map<string, Set<string>>();

const isPlace = (p: unknown): p is PlaceId => typeof p === 'string' && p in PLACES;
const num = (v: unknown, lo: number, hi: number, d = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const localDate = (place: PlaceId) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PLACES[place].tz }).format(new Date());

function cleanNick(n: unknown): string {
  const s = typeof n === 'string' ? n.replace(/[<>]/g, '').trim().slice(0, 12) : '';
  return s || '해 보러 온 사람';
}
function cleanLook(l: unknown): Look {
  const o = (l ?? {}) as Partial<Look>;
  return { body: Math.floor(num(o.body, 0, 15)), hat: Math.floor(num(o.hat, 0, 15)) };
}

/** 정원이 남은 첫 채널을 고르고, 없으면 새 채널을 연다 */
function pickChannel(place: PlaceId): Channel {
  for (let n = 1; ; n++) {
    const key = `${place}:${n}`;
    let c = channels.get(key);
    if (!c) {
      c = { key, place, n, players: new Map(), seats: new Map(), dirty: new Set() };
      channels.set(key, c);
    }
    if (c.players.size < CAP) return c;
  }
}

function countWoke(place: PlaceId, uid: string) {
  const k = `${place}|${localDate(place)}`;
  let set = wokeToday.get(k);
  if (!set) { set = new Set(); wokeToday.set(k, set); }
  set.add(uid);
}

function stats(): Stats {
  const online = { jeongdongjin: 0, seongsan: 0, homigot: 0, gisborne: 0 } as Record<PlaceId, number>;
  const woke = { ...online };
  for (const c of channels.values()) online[c.place] += c.players.size;
  for (const p of Object.keys(PLACES) as PlaceId[]) woke[p] = wokeToday.get(`${p}|${localDate(p)}`)?.size ?? 0;
  return { online, woke };
}

// ---------- 서버 ----------
const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('오늘의 해 실시간 서버');
});

const io: IO = new Server(http, {
  cors: { origin: ORIGINS.includes('*') ? '*' : ORIGINS },
  pingInterval: 20000,
  pingTimeout: 20000,
});

function leave(socket: Sock, io: IO) {
  const c = socket.data.channel;
  if (!c) return;
  c.players.delete(socket.id);
  c.dirty.delete(socket.id);
  for (const [idx, id] of c.seats) {
    if (id === socket.id) { c.seats.delete(idx); io.to(c.key).emit('seat', idx, null); }
  }
  socket.leave(c.key);
  socket.to(c.key).emit('left', socket.id);
  if (c.players.size === 0 && c.n > 1) channels.delete(c.key);
  socket.data.channel = undefined;
}

io.on('connection', (socket: Sock) => {
  socket.data.lastLantern = 0;
  socket.data.lastEmote = 0;
  socket.data.moveBudget = 20;

  socket.on('join', (p: JoinPayload) => {
    if (!p || !isPlace(p.place)) return;
    leave(socket, io);
    const c = pickChannel(p.place);
    const me: PlayerInfo = {
      id: socket.id, nick: cleanNick(p.nick), look: cleanLook(p.look),
      x: (Math.random() * 2 - 1) * 6, z: 12 + Math.random() * 3, ry: 0, st: 0,
    };
    socket.data.uid = typeof p.uid === 'string' ? p.uid.slice(0, 40) : socket.id;
    if (p.woke) countWoke(p.place, socket.data.uid);
    c.players.set(socket.id, me);
    socket.data.channel = c;
    socket.join(c.key);
    socket.emit('welcome', {
      id: socket.id, place: c.place, channel: c.n,
      players: [...c.players.values()].filter(x => x.id !== socket.id),
      seats: Object.fromEntries(c.seats),
    });
    socket.to(c.key).emit('joined', me);
  });

  socket.on('s', (x, z, ry, st) => {
    const c = socket.data.channel, me = c?.players.get(socket.id);
    if (!c || !me) return;
    if (socket.data.moveBudget <= 0) return; // 초당 20회 넘게 보내면 버림
    socket.data.moveBudget--;
    me.x = num(x, BOUNDS.minX, BOUNDS.maxX, me.x);
    me.z = num(z, BOUNDS.minZ, BOUNDS.maxZ, me.z);
    me.ry = num(ry, -10, 10, me.ry);
    me.st = (st === 1 || st === 2 ? st : 0) as St;
    c.dirty.add(socket.id); // 바로 보내지 않고 다음 틱에 묶어서 보냄
  });

  socket.on('emote', (e: Emote) => {
    const c = socket.data.channel, now = Date.now();
    if (!c || (e !== 'stretch' && e !== 'wave') || now - socket.data.lastEmote < 800) return;
    socket.data.lastEmote = now;
    socket.to(c.key).emit('emote', socket.id, e);
  });

  socket.on('lantern', (x, z) => {
    const c = socket.data.channel, now = Date.now();
    if (!c || now - socket.data.lastLantern < 3000) return; // 3초에 한 번
    socket.data.lastLantern = now;
    socket.to(c.key).emit('lantern', socket.id, num(x, BOUNDS.minX, BOUNDS.maxX), num(z, BOUNDS.minZ, BOUNDS.maxZ));
  });

  // 방석은 서버가 주인: 먼저 요청한 사람이 앉는다
  socket.on('sit', (idx, ack) => {
    const c = socket.data.channel;
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!c || !Number.isInteger(idx) || idx < 0 || idx >= SEAT_COUNT) return reply(false);
    if (c.seats.has(idx) && c.seats.get(idx) !== socket.id) return reply(false);
    for (const [i, id] of c.seats) if (id === socket.id && i !== idx) { c.seats.delete(i); io.to(c.key).emit('seat', i, null); }
    c.seats.set(idx, socket.id);
    io.to(c.key).emit('seat', idx, socket.id);
    reply(true);
  });

  socket.on('stand', () => {
    const c = socket.data.channel;
    if (!c) return;
    for (const [i, id] of c.seats) if (id === socket.id) { c.seats.delete(i); io.to(c.key).emit('seat', i, null); }
  });

  socket.on('woke', () => {
    const c = socket.data.channel;
    if (c && socket.data.uid) countWoke(c.place, socket.data.uid);
  });

  socket.on('disconnect', () => leave(socket, io));
});

// 틱: 0.1초마다 방별로 바뀐 위치를 한 묶음으로 전송 (방 100명 기준 초당 8만 → 1천 메시지)
const TICK_MS = Number(process.env.TICK_MS ?? 100);
setInterval(() => {
  for (const c of channels.values()) {
    if (c.dirty.size === 0) continue;
    const batch: Move[] = [];
    for (const id of c.dirty) {
      const p = c.players.get(id);
      if (p) batch.push([id, p.x, p.z, p.ry, p.st]);
    }
    c.dirty.clear();
    io.to(c.key).volatile.emit('tick', batch);
  }
}, TICK_MS);

// 위치 전송 한도 회복 + 통계 방송
setInterval(() => { for (const s of io.sockets.sockets.values()) (s as Sock).data.moveBudget = 20; }, 1000);
setInterval(() => io.emit('stats', stats()), 3000);
// 지난 날짜의 알람 기록 정리
setInterval(() => {
  for (const k of wokeToday.keys()) {
    const [place, date] = k.split('|') as [PlaceId, string];
    if (date !== localDate(place)) wokeToday.delete(k);
  }
}, 60 * 60 * 1000);

http.listen(PORT, () => console.log(`오늘의 해 서버: http://localhost:${PORT} (채널 정원 ${CAP}명)`));
