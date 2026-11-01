// 모래성: 해변(장소)마다 함께 쌓는다.
// - 누구나 새 성을 짓거나, 가까운 성을 한 단 더 올리거나(3단까지), 다 지어진 성에 탑을 얹을 수 있다(4개까지)
// - 메모리에만 두고, 매일 현지 정오에 밀물이 와서 모두 쓸어 간다 (모래 게시판과 같은 규칙)
import type { Castle, CastleResult, PlaceId } from './protocol.js';
import { lastNoon } from './sand-board.js';

const MAX = 30, NEAR = 1.6, COOLDOWN = 2500;
const ZONE = { minX: -21, maxX: 21, minZ: -1.4, maxZ: 16 };

interface Stored extends Castle { at: number }
const beaches = new Map<PlaceId, Stored[]>();
const last = new Map<string, number>();
let seq = 0;

function alive(place: PlaceId, tz: string, now = Date.now()) {
  const tide = lastNoon(tz, now);
  const list = (beaches.get(place) ?? []).filter(c => c.at >= tide);
  beaches.set(place, list);
  return list;
}
const pub = ({ id, x, z, level, towers }: Stored): Castle => ({ id, x, z, level, towers });

export function castlesOf(place: PlaceId, tz: string): Castle[] {
  return alive(place, tz).map(pub);
}

/** (x, z)에서 모래성 쌓기: 가까운 성이 있으면 키우고, 없으면 새로 짓는다 */
export function build(place: PlaceId, tz: string, uid: string, x: number, z: number): CastleResult {
  const now = Date.now(), key = `${place}|${uid}`;
  if (now - (last.get(key) ?? 0) < COOLDOWN) return { ok: false, reason: 'cooldown' };
  if (!(x >= ZONE.minX && x <= ZONE.maxX && z >= ZONE.minZ && z <= ZONE.maxZ)) return { ok: false, reason: 'place' };
  const list = alive(place, tz, now);
  let best: Stored | null = null, bd = NEAR;
  for (const c of list) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
  last.set(key, now);
  if (best) {
    if (best.level < 3) { best.level++; best.at = Math.max(best.at, now); return { ok: true, castle: pub(best), kind: 'grow' }; }
    if (best.towers < 4) { best.towers++; return { ok: true, castle: pub(best), kind: 'tower' }; }
    return { ok: false, reason: 'done' };
  }
  if (list.length >= MAX) return { ok: false, reason: 'full' };
  const c: Stored = { id: `${now.toString(36)}${(seq++ % 1296).toString(36)}`, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, level: 1, towers: 0, at: now };
  list.push(c);
  return { ok: true, castle: pub(c), kind: 'new' };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, t] of last) if (now - t > COOLDOWN) last.delete(k);
}, 10 * 60000);
