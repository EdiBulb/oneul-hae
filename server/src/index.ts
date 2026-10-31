import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServer, Emote, Ghost, JoinPayload, Look, Move, PlaceId, PlayerInfo, ServerToClient, St, Stats, Traces,
} from './protocol.js';
import { handleReminderHttp, pushEnabled } from './reminders.js';

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
// 해변 + 얕은 물 + 바다로 뻗은 데크(z -26까지). 세부 모양은 클라이언트가 막는다
const BOUNDS = { minX: -22, maxX: 22, minZ: -26, maxZ: 17 };
/** 짠: 이 거리(m) 안에서, 이 시간(ms) 안에 둘 다 눌러야 컵이 부딪친다 */
const CHEERS_DIST = 3, CHEERS_WINDOW = 3000;

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
  /** 짠을 누르고 아직 상대를 못 찾은 시각 (0 = 없음) */
  cheersAt: number;
}
type IO = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>;

const channels = new Map<string, Channel>();

// ---------- 오늘의 흔적 ----------
// 장소·현지 날짜별로, 실제 접속한 사람의 마지막 자리와 풍등 위치만 남긴다.
// 이름·소원 문구는 저장하지 않는다. 메모리에만 있으므로 서버가 재시작되면 사라진다.
interface Mark { x: number; z: number; ry: number; sit: boolean; look: Look; at: number }
interface Day { marks: Map<string, Mark>; lanterns: [number, number][] }
const days = new Map<string, Day>();
const GHOST_MAX = 30, LANTERN_MAX = 40;
function dayOf(place: PlaceId) {
  const k = `${place}|${localDate(place)}`;
  let d = days.get(k);
  if (!d) { d = { marks: new Map(), lanterns: [] }; days.set(k, d); }
  return d;
}
function onlineUids(place: PlaceId) {
  const set = new Set<string>();
  for (const s of io.sockets.sockets.values()) {
    const d = (s as Sock).data;
    if (d.channel?.place === place && d.uid) set.add(d.uid);
  }
  return set;
}
function traces(place: PlaceId, selfUid?: string): Traces {
  const d = dayOf(place), here = onlineUids(place);
  if (selfUid) here.add(selfUid);
  const ghosts: Ghost[] = [...d.marks.entries()]
    .filter(([uid]) => !here.has(uid))
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, GHOST_MAX)
    .map(([, m]) => ({ x: m.x, z: m.z, ry: m.ry, sit: m.sit, look: m.look }));
  const visitors = new Set([...d.marks.keys(), ...here]).size;
  return { visitors, ghosts, lanterns: d.lanterns.slice(-LANTERN_MAX) };
}
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

/** 2초 안에 짠을 누르고 기다리는 사람 중, 3m 안에서 가장 가까운 사람 */
function findCheersPartner(socket: Sock, c: Channel, now: number): Sock | null {
  const me = c.players.get(socket.id);
  if (!me) return null;
  let best: Sock | null = null, bd = CHEERS_DIST;
  for (const p of c.players.values()) {
    if (p.id === socket.id) continue;
    const s = io.sockets.sockets.get(p.id) as Sock | undefined;
    if (!s || !s.data.cheersAt || now - s.data.cheersAt > CHEERS_WINDOW) continue;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d <= bd) { bd = d; best = s; }
  }
  return best;
}

function countWoke(place: PlaceId, uid: string) {
  const k = `${place}|${localDate(place)}`;
  let set = wokeToday.get(k);
  if (!set) { set = new Set(); wokeToday.set(k, set); }
  set.add(uid);
}

function stats(): Stats {
  const online = { jeongdongjin: 0, seongsan: 0, homigot: 0, gisborne: 0 } as Record<PlaceId, number>;
  const woke = { ...online }, today = { ...online };
  for (const c of channels.values()) online[c.place] += c.players.size;
  for (const p of Object.keys(PLACES) as PlaceId[]) {
    woke[p] = wokeToday.get(`${p}|${localDate(p)}`)?.size ?? 0;
    today[p] = traces(p).visitors;
  }
  return { online, woke, today };
}

// ---------- 서버 ----------
const http = createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
  try { if (await handleReminderHttp(req, res, ORIGINS)) return; } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500).end(); return; }
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
  const me = c.players.get(socket.id), uid = socket.data.uid;
  if (me && uid) {
    const sit = [...c.seats.values()].includes(socket.id);
    dayOf(c.place).marks.set(uid, { x: me.x, z: me.z, ry: me.ry, sit, look: me.look, at: Date.now() });
  }
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
  socket.data.cheersAt = 0;

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
      traces: traces(c.place, socket.data.uid),
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
    if (!c || (e !== 'stretch' && e !== 'wave' && e !== 'cheers') || now - socket.data.lastEmote < 800) return;
    socket.data.lastEmote = now;
    if (e === 'cheers') {
      const partner = findCheersPartner(socket, c, now);
      if (partner) {
        // 먼저 기다리던 사람과 짝이 됨: 둘 다 다시 짝이 되지 않도록 초기화하고 방 전체에 알림
        partner.data.cheersAt = 0;
        socket.data.cheersAt = 0;
        io.to(c.key).emit('clink', partner.id, socket.id);
        return;
      }
      socket.data.cheersAt = now;
    }
    socket.to(c.key).emit('emote', socket.id, e);
  });

  socket.on('lantern', (x, z) => {
    const c = socket.data.channel, now = Date.now();
    if (!c || now - socket.data.lastLantern < 3000) return; // 3초에 한 번
    socket.data.lastLantern = now;
    const L = dayOf(c.place).lanterns;
    L.push([Math.round(num(x, BOUNDS.minX, BOUNDS.maxX) * 10) / 10, Math.round(num(z, BOUNDS.minZ, BOUNDS.maxZ) * 10) / 10]);
    if (L.length > LANTERN_MAX * 2) L.splice(0, L.length - LANTERN_MAX);
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
  for (const k of days.keys()) {
    const [place, date] = k.split('|') as [PlaceId, string];
    if (date !== localDate(place)) days.delete(k);
  }
}, 60 * 60 * 1000);

http.listen(PORT, () => console.log(`오늘의 해 서버: http://localhost:${PORT} (채널 정원 ${CAP}명, 푸시 ${pushEnabled ? '켜짐' : '꺼짐'})`));
