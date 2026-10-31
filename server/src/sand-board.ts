// 모래 게시판: 해변(장소)마다 하나. 채널이 나뉘어도 같은 해변이면 같은 게시판을 본다.
// - 글은 메모리에만: 서버가 다시 켜지면 사라짐 ("모래라서 지워진다"는 설정과 같음)
// - 3시간이 지나면 사라지고, 매일 현지 정오에 밀물이 와서 그 전 글을 모두 지운다
// - 한 사람당 10분에 한 번, 풍등과 같은 필터, 서로 다른 3명이 신고하면 바로 지움
import type { PlaceId, SandPost } from './protocol.js';
import { cleanWish } from './wish-filter.js';

export const SAND_TTL = 3 * 3600000;
const COOLDOWN = 10 * 60000;
const MAX_POSTS = 60;
const REPORTS_TO_HIDE = 3;

interface Stored extends SandPost { uid: string; reporters: Set<string> }
const boards = new Map<PlaceId, Stored[]>();
/** "장소|uid" → 마지막으로 쓴 시각 */
const lastPost = new Map<string, number>();
let seq = 0;

/** 이 장소의 가장 최근 현지 정오 (밀물 시각) */
function lastNoon(tz: string, now: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const minsSinceMidnight = Number(parts.hour) * 60 + Number(parts.minute);
  const sinceNoon = (minsSinceMidnight - 720 + 1440) % 1440; // 정오 이후 지난 분
  return now - sinceNoon * 60000 - (now % 60000);
}

function alive(place: PlaceId, tz: string, now = Date.now()) {
  const tide = lastNoon(tz, now);
  const list = (boards.get(place) ?? []).filter(p => now - p.at < SAND_TTL && p.at >= tide);
  boards.set(place, list);
  return list;
}
const pub = (p: Stored): SandPost => ({ id: p.id, text: p.text, at: p.at });

export function boardOf(place: PlaceId, tz: string): SandPost[] {
  return alive(place, tz).map(pub);
}

export type PostResult = { ok: true; post: SandPost } | { ok: false; reason: 'cooldown' | 'filtered'; wait?: number };

export function addPost(place: PlaceId, tz: string, uid: string, text: unknown): PostResult {
  const now = Date.now(), key = `${place}|${uid}`;
  const last = lastPost.get(key) ?? 0;
  if (now - last < COOLDOWN) return { ok: false, reason: 'cooldown', wait: COOLDOWN - (now - last) };
  const clean = cleanWish(text);
  if (!clean) return { ok: false, reason: 'filtered' };
  lastPost.set(key, now);
  const list = alive(place, tz, now);
  const p: Stored = { id: `${now.toString(36)}${(seq++ % 1296).toString(36)}`, text: clean, at: now, uid, reporters: new Set() };
  list.push(p);
  if (list.length > MAX_POSTS) list.splice(0, list.length - MAX_POSTS);
  return { ok: true, post: pub(p) };
}

/** 신고. 숨겨야 하면 true (서로 다른 3명) */
export function report(place: PlaceId, tz: string, uid: string, id: unknown): boolean {
  const list = alive(place, tz);
  const i = list.findIndex(p => p.id === id);
  if (i < 0 || list[i].uid === uid) return false;
  list[i].reporters.add(uid);
  if (list[i].reporters.size < REPORTS_TO_HIDE) return false;
  list.splice(i, 1);
  return true;
}

// 오래된 쿨다운 기록 정리
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of lastPost) if (now - t > COOLDOWN) lastPost.delete(k);
}, 30 * 60000);
