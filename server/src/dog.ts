// 해변 강아지: 채널마다 한 마리. 서버가 위치와 기분을 정하고 모두에게 똑같이 보낸다.
// - wander: 해변을 어슬렁, 가끔 사람 곁으로
// - sit: 쓰다듬으면 그 사람을 보고 앉아 꼬리를 흔듦
// - belly: 짧은 시간에 여러 번 쓰다듬으면 발라당
// - follow: 쓰다듬은 사람을 30초쯤 졸졸 따라감
import type { DogMode, DogState, PlaceId } from './protocol.js';

interface Pos { x: number; z: number }
export interface Dog extends DogState { tx: number; tz: number; wait: number; until: number; recent: number[]; lastPet: string }

const SPEED = 1.4, FOLLOW_SPEED = 2.2;
const AREA: Record<string, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  default: { minX: -16, maxX: 14, minZ: -1.4, maxZ: 6 },
  hangang: { minX: -6, maxX: 14, minZ: 0, maxZ: 9 },
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const area = (p: PlaceId) => AREA[p] ?? AREA.default;

export function newDog(place: PlaceId): Dog {
  const a = area(place), x = rand(a.minX, a.maxX), z = rand(a.minZ, a.maxZ);
  return { x, z, ry: 0, mode: 'wander', by: '', tx: x, tz: z, wait: 2, until: 0, recent: [], lastPet: '' };
}
export const pub = (d: Dog): DogState => ({ x: Math.round(d.x * 100) / 100, z: Math.round(d.z * 100) / 100, ry: Math.round(d.ry * 100) / 100, mode: d.mode, by: d.by });

/** dt초만큼 움직이기. 상태가 바뀌었으면 true */
export function stepDog(d: Dog, place: PlaceId, dt: number, players: Map<string, Pos>, now: number): boolean {
  const a = area(place);
  let changed = false;
  const set = (m: DogMode, by = '') => { if (d.mode !== m || d.by !== by) changed = true; d.mode = m; d.by = by; };
  if ((d.mode === 'sit' || d.mode === 'belly') && now > d.until) {
    // 다 쓰다듬고 나면 그 사람을 잠시 따라감
    if (players.has(d.lastPet)) { set('follow', d.lastPet); d.until = now + 30000; } else set('wander');
  }
  if (d.mode === 'follow') {
    const p = players.get(d.by);
    if (!p || now > d.until) { set('wander'); d.wait = rand(1, 3); }
    else { d.tx = p.x + 0.9; d.tz = p.z + 0.6; }
  }
  if (d.mode === 'sit' || d.mode === 'belly') return changed;
  const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
  if (dist > 0.15) {
    const s = Math.min(dist, (d.mode === 'follow' ? FOLLOW_SPEED : SPEED) * dt);
    d.x += (dx / dist) * s; d.z += (dz / dist) * s;
    d.ry = Math.atan2(-dx, -dz);
  } else if (d.mode === 'wander') {
    d.wait -= dt;
    if (d.wait <= 0) {
      d.wait = rand(2, 6);
      const ps = [...players.values()];
      if (ps.length && Math.random() < 0.35) { const p = ps[Math.floor(Math.random() * ps.length)]; d.tx = p.x + rand(-1.5, 1.5); d.tz = p.z - rand(0.8, 1.8); }
      else { d.tx = rand(a.minX, a.maxX); d.tz = rand(a.minZ, a.maxZ); }
      d.tx = Math.max(a.minX, Math.min(a.maxX, d.tx)); d.tz = Math.max(a.minZ, Math.min(a.maxZ, d.tz));
    }
  }
  return changed;
}

/** 쓰다듬기. 너무 멀면 false */
export function petDog(d: Dog, id: string, p: Pos, now: number): boolean {
  if (Math.hypot(p.x - d.x, p.z - d.z) > 2.2) return false;
  d.recent = d.recent.filter(t => now - t < 20000); d.recent.push(now);
  d.lastPet = id; d.by = id;
  d.ry = Math.atan2(-(p.x - d.x), -(p.z - d.z)); // 쓰다듬는 사람을 바라봄
  if (d.recent.length >= 4 && d.mode !== 'belly') { d.mode = 'belly'; d.until = now + 4500; d.recent = []; }
  else if (d.mode !== 'belly') { d.mode = 'sit'; d.until = now + 3000; }
  return true;
}
