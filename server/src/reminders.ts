// 나가기 화면의 "내일 해돋이 5분 전에 알려 주세요" (웹 푸시 + 캘린더 파일)
//
// 환경 변수
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY : `npx web-push generate-vapid-keys`로 만든 키 (없으면 푸시 꺼짐)
//   VAPID_SUBJECT                       : 연락처 (기본 https://hae.abracadelulu.com)
//   UPSTASH_REDIS_REST_URL / _TOKEN     : 예약을 저장할 Redis. 없으면 메모리에만 저장 → 서버가 재시작되면 사라짐
//
// 무료 서버는 15분 동안 아무도 없으면 잠들어서 예약 시각에 깨어 있지 않을 수 있다.
// 그래서 외부 크론(cron-job.org 등)이 몇 분마다 /push/tick 을 불러 서버를 깨우고 밀린 알림을 보낸다.
import webpush, { type PushSubscription } from 'web-push';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Lang = 'ko' | 'en';
type PlaceKey = 'jeongdongjin' | 'seongsan' | 'homigot' | 'gisborne' | 'jumunjin';

const PLACE_NAMES: Record<PlaceKey, Record<Lang, string>> = {
  jeongdongjin: { ko: '정동진', en: 'Jeongdongjin' },
  seongsan: { ko: '성산일출봉', en: 'Seongsan Ilchulbong' },
  homigot: { ko: '호미곶', en: 'Homigot' },
  gisborne: { ko: '기스본', en: 'Gisborne' },
  jumunjin: { ko: '주문진 방파제', en: 'Jumunjin Breakwater' },
};
const TZ: Record<PlaceKey, string> = {
  jeongdongjin: 'Asia/Seoul', seongsan: 'Asia/Seoul', homigot: 'Asia/Seoul', gisborne: 'Pacific/Auckland', jumunjin: 'Asia/Seoul',
};
const SITE = 'https://hae.abracadelulu.com';
const LEAD = 5 * 60000; // 해 뜨기 5분 전
/** 예약은 지금부터 이틀 안의 일출만 받는다 */
const MAX_AHEAD = 48 * 3600000;
/** 서버가 잠들어 늦게 깼을 때, 해가 이미 뜬 지 이만큼 지났으면 보내지 않는다 */
const STALE = 10 * 60000;

interface Reminder { sub: PushSubscription; place: PlaceKey; sunrise: number; lang: Lang }

const PUB = process.env.VAPID_PUBLIC_KEY ?? '';
const PRIV = process.env.VAPID_PRIVATE_KEY ?? '';
export const pushEnabled = !!(PUB && PRIV);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? SITE, PUB, PRIV);

// ---------- 저장소: Upstash Redis(REST)가 있으면 거기에, 없으면 메모리에 ----------
const R_URL = process.env.UPSTASH_REDIS_REST_URL, R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HASH = 'oneul-hae:reminders';
const mem = new Map<string, Reminder>();

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(R_URL!, {
    method: 'POST',
    headers: { authorization: `Bearer ${R_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return ((await r.json()) as { result: unknown }).result;
}
const store = {
  async put(key: string, v: Reminder) { mem.set(key, v); if (R_URL) await redis(['HSET', HASH, key, JSON.stringify(v)]); },
  async del(key: string) { mem.delete(key); if (R_URL) await redis(['HDEL', HASH, key]); },
  async load() {
    if (!R_URL) return;
    const flat = (await redis(['HGETALL', HASH])) as string[] | null;
    for (let i = 0; flat && i < flat.length; i += 2) {
      try { mem.set(flat[i], JSON.parse(flat[i + 1])); } catch { /* 깨진 항목 무시 */ }
    }
  },
};
const loaded: Promise<void> = store.load().catch(e => console.error('예약 불러오기 실패', e));

const hm = (ms: number, place: PlaceKey) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ[place], hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);

// ---------- 보내기 ----------
let sending = false;
export async function sendDue() {
  if (!pushEnabled || sending) return 0;
  sending = true;
  let sent = 0;
  try {
    await loaded;
    const now = Date.now();
    for (const [key, r] of mem) {
      if (now < r.sunrise - LEAD) continue;
      await store.del(key); // 한 번만 보낸다
      if (now > r.sunrise + STALE) continue;
      const name = PLACE_NAMES[r.place][r.lang], t = hm(r.sunrise, r.place);
      const payload = r.lang === 'ko'
        ? { title: '☀ 해 뜨기 5분 전이에요', body: `${name} 해돋이 ${t} · 다들 해변에 모이고 있어요`, url: `${SITE}/?source=push&place=${r.place}` }
        : { title: '☀ Sunrise in 5 minutes', body: `${name} sunrise ${t} · people are gathering on the beach`, url: `${SITE}/?source=push&place=${r.place}` };
      try {
        await webpush.sendNotification(r.sub, JSON.stringify(payload), { TTL: 10 * 60, urgency: 'high' });
        sent++;
      } catch (e) {
        // 404/410 = 구독이 사라짐. 그 외 오류도 이미 지웠으니 다시 시도하지 않음
        console.error('푸시 실패', (e as { statusCode?: number }).statusCode ?? e);
      }
    }
  } finally { sending = false; }
  return sent;
}
setInterval(() => { sendDue().catch(e => console.error(e)); }, 30000);

// ---------- 캘린더 파일 (.ics) ----------
const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function ics(place: PlaceKey, sunrise: number, lang: Lang) {
  const name = PLACE_NAMES[place][lang];
  const title = lang === 'ko' ? `☀ 오늘의 해 · ${name} 해돋이` : `☀ Today's Sun · ${name} sunrise`;
  const desc = lang === 'ko' ? `해 뜨기 5분 전이에요. 같이 해 보러 가요 ${SITE}` : `Sunrise in 5 minutes. Come watch it together ${SITE}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Abracadelulu//Oneul-hae//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${place}-${sunrise}@hae.abracadelulu.com`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(sunrise)}`,
    `DTEND:${icsDate(sunrise + 15 * 60000)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `URL:${SITE}/?source=calendar&place=${place}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:-PT5M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// ---------- HTTP ----------
const isPlace = (p: unknown): p is PlaceKey => typeof p === 'string' && p in PLACE_NAMES;
const okSunrise = (t: number) => Number.isFinite(t) && t > Date.now() && t < Date.now() + MAX_AHEAD;
const langOf = (l: unknown): Lang => (l === 'en' ? 'en' : 'ko');

function cors(res: ServerResponse, origins: string[]) {
  res.setHeader('access-control-allow-origin', origins.includes('*') ? '*' : origins[0]);
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}
function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 8000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

/** 처리했으면 true. index.ts의 HTTP 서버가 먼저 이걸 불러 본다 */
export async function handleReminderHttp(req: IncomingMessage, res: ServerResponse, origins: string[]): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/push/') && url.pathname !== '/calendar.ics') return false;
  cors(res, origins);
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return true; }

  if (url.pathname === '/calendar.ics') {
    const place = url.searchParams.get('place'), at = Number(url.searchParams.get('at'));
    if (!isPlace(place) || !okSunrise(at)) { res.writeHead(400).end('bad request'); return true; }
    res.writeHead(200, {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="oneul-hae-${place}.ics"`,
    }).end(ics(place, at, langOf(url.searchParams.get('lang'))));
    return true;
  }
  if (url.pathname === '/push/key') { json(res, 200, { key: pushEnabled ? PUB : null }); return true; }
  // 외부 크론이 몇 분마다 부른다: 서버를 깨우고 밀린 알림을 보냄
  if (url.pathname === '/push/tick') { json(res, 200, { sent: await sendDue(), pending: mem.size }); return true; }

  if (url.pathname === '/push/subscribe' && req.method === 'POST') {
    if (!pushEnabled) { json(res, 503, { ok: false }); return true; }
    try {
      const b = JSON.parse(await readBody(req));
      const sub = b?.sub as PushSubscription, at = Number(b?.at);
      if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth || !isPlace(b.place) || !okSunrise(at)) {
        json(res, 400, { ok: false }); return true;
      }
      await loaded;
      // 기기(구독)마다 예약은 하나: 다시 누르면 덮어씀
      await store.put(sub.endpoint, { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, place: b.place, sunrise: at, lang: langOf(b.lang) });
      json(res, 200, { ok: true });
    } catch { json(res, 400, { ok: false }); }
    return true;
  }
  json(res, 404, { ok: false });
  return true;
}
