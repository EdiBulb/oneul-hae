import * as THREE from 'three';
import { stable } from './stable-tex';
import { textSprite } from './character';
import { pondD, POND, CRATER, GATE, SHOPS, SUMMIT, SUMMIT_ROCKS, TRAIL, mountainY as mY, trailX, worldToShop } from './beach-extras';
import { koreanPine } from './place-scenery';
import { createShops } from './mountain-shops';
import { HALL } from './hall';
import { FEED_AT, FEED_R } from './feed';
import { LOOK, stylize } from './look';
import { SPOTS_ON, SPRING, DANGSAN, SWING, createSpots } from './landmarks';
import { regionOpen } from './regions';
import { bakeStatic } from './bake';
/** 둥지 · 마고할미 (장터목 마당 아래쪽) */
export const NEST = { x: trailX(98) - 0.8, z: 98 };

// 지리산 천왕봉: 정상 직전 바위 능선에 도착 → 언덕을 넘으면 절벽 끝 전망대.
// 발아래는 운해(구름 바다), 그 위로 겹겹이 이어진 능선이 봉우리만 내밀고 있다.

const lam = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** 한국 날짜로 계절. 주소에 ?season=spring 처럼 붙이면 미리 볼 수 있음 */
export type Season = 'spring' | 'summer' | 'autumn' | 'late' | 'winter';
export function seasonNow(): Season {
  const q = new URLSearchParams(location.search).get('season');
  if (q === 'spring' || q === 'summer' || q === 'autumn' || q === 'late' || q === 'winter') return q;
  const m = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
  // 천왕봉은 높아서 계절이 빨리 지나감: 5월 철쭉·진달래, 9~10월 단풍, 11월 억새와 서리, 12~3월 눈
  return m === 4 || m === 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m === 9 || m === 10 ? 'autumn' : m === 11 ? 'late' : 'winter';
}

/** 먼 능선 한 겹: 위쪽이 들쭉날쭉한 세로 띠 */
function ridge(dist: number, top: number, amp: number, color: number, seed: number) {
  const pts = 90, w = 3200, geo = new THREE.BufferGeometry();
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= pts; i++) {
    const x = -w / 2 + (i / pts) * w;
    const n = Math.sin(i * 0.37 + seed) * 0.5 + Math.sin(i * 0.11 + seed * 2.3) * 0.8 + Math.sin(i * 1.3 + seed) * 0.15;
    pos.push(x, top + n * amp, -dist, x, -160, -dist);
    if (i < pts) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
}

/** 표지석 글씨 */
function stoneFace(chars: string[], height: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b6660'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.08})`; g.fillRect(rnd() * 256, rnd() * 512, 3, 3); }
  g.fillStyle = '#f4efe2'; g.textAlign = 'center'; g.font = '900 64px "Noto Sans KR", sans-serif';
  chars.forEach((ch, i) => g.fillText(ch, 128, 80 + i * (396 / chars.length)));
  g.font = '800 34px "Noto Sans KR", sans-serif'; g.fillText(height, 128, 486);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 나무 안내판 */
function trailSign(name: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a5532'; g.fillRect(0, 0, 512, 192);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let y = 20; y < 192; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + 6); g.stroke(); }
  g.fillStyle = '#fff6e0'; g.textAlign = 'center';
  g.font = '900 64px "Noto Sans KR", sans-serif'; g.fillText(`↑ ${name} 정상`, 256, 92);
  g.font = '700 38px "Noto Sans KR", sans-serif'; g.fillText('Summit · 50 m', 256, 156);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 산마다 다른 점: 땅 색, 나무, 표지석 글자, 먼 능선 (한라산은 섬이라 사방이 운해) */
const VARIANTS = {
  jirisan: { grass: 0xb8c08e, dry: 0xd6c8a2, stone: 0xc8b9a6, path: 0xe4d6bc, rock: [0xb9aa98, 0xc6b8a7, 0xa99b8b], trees: 34, dead: 0.22, stoneText: ['지', '리', '산', '천', '왕', '봉'], height: '1,915m', sign: '천왕봉', ridges: 5, crater: false },
  hallasan: { grass: 0x6f7340, dry: 0x8a6e4c, stone: 0x5a4a42, path: 0x7a5e4e, rock: [0x3e3532, 0x4a3f3a, 0x2f2a28], trees: 16, dead: 0.45, stoneText: ['한', '라', '산', '백', '록', '담'], height: '1,947m', sign: '백록담', ridges: 1, crater: true },
} as const;
export type MountainId = keyof typeof VARIANTS;
export function createMountain(scene: THREE.Scene, id: MountainId, GLOW: THREE.Texture) {
  const V0 = VARIANTS[id], LK = id === 'jirisan' ? LOOK : null;
  const V = LK ? { ...V0, grass: LK.ground.grass, dry: LK.ground.dry, stone: LK.ground.stone, path: LK.ground.path, rock: LK.rock } : V0;
  const SEASON = seasonNow();
  const mountainY = (x: number, z: number) => mY(x, z, id);
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  /** 가게 자리 근처엔 나무·덤불·돌을 두지 않음 */
  // 진행에 따라 열리는 장소: 지금 열려 있을 때만 자리를 비워 둠 (나중에 열리면 다음 접속부터)
  const openDangsan = regionOpen('dangsan'), openSwing = regionOpen('swing');
  const clearOf = (x: number, z: number) => id !== 'jirisan' || (SHOPS.every(s => { const [lx, lz] = worldToShop(s, x, z); return Math.abs(lx) > s.w / 2 + 3.2 || Math.abs(lz) > s.d / 2 + 2.6; }) && Math.hypot(x - HALL.x, z - HALL.z) > 5.8 && Math.hypot(x - FEED_AT.x, z - FEED_AT.z) > FEED_R + 1.4 && Math.hypot(x - NEST.x, z - NEST.z) > 2.6 && (!SPOTS_ON || (pondD(x, z) > 1.9 && (!openDangsan || Math.hypot(x - DANGSAN.x, z - DANGSAN.z) > 6.5) && (!openSwing || Math.hypot(x - SWING.x, z - SWING.z) > 3.6))));

  /** 꽃밭 (지리산, 시안): 제석봉 아래 오른쪽 비탈에 크게 */
  const FIELD = { z0: 38, z1: 75, x0: 2.8, x1: 30 };
  const inField = (x: number, z: number) => !!LK && z > FIELD.z0 && z < FIELD.z1 && x - trailX(z) > FIELD.x0 && x - trailX(z) < FIELD.x1 + Math.sin(z * 0.2) * 3;
  // ---------- 정상 땅 (바위와 풀이 섞인 능선) ----------
  const jiri = id === 'jirisan';
  const W = 150, D = jiri ? 166 : 76, geo = new THREE.PlaneGeometry(W, D, 110, jiri ? 138 : 64);
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0, D / 2 - 1.2);
  const p = geo.attributes.position, col: number[] = [];
  const SNOW = new THREE.Color(0xeef2f7), grass = new THREE.Color(V.grass), dry = new THREE.Color(V.dry), stone = new THREE.Color(V.stone), path = new THREE.Color(V.path), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // 난간 앞쪽 가장자리는 아래로 뚝 떨어지는 절벽
    p.setY(i, z < SUMMIT.edgeZ - 0.4 ? SUMMIT.deckY - 14 : mountainY(x, z));
    const n = Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(x * 0.4 - z * 1.3) * 0.5;
    if (Math.abs(x - (jiri ? trailX(z) : 0)) < 1.6 + Math.sin(z * 0.5) * 0.4 && z > 1 && z < (jiri ? TRAIL.end : 40)) c.copy(path);
    else if (z < SUMMIT.crestZ + 1 || n > 0.45 || Math.abs(x - (jiri ? trailX(z) : 0)) > 9) c.copy(stone).lerp(dry, 0.15 + 0.2 * Math.max(0, n));
    else c.copy(grass).lerp(dry, 0.5 + 0.5 * n);
    if (LK) {
      // 시안: 풀밭이 기본, 바위는 정상 언덕·절벽 근처와 군데군데만. 길은 부드럽게 번지고, 멀리 내려갈수록 살짝 진하게
      const g2 = new THREE.Color(LK.ground.grass2), big = Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 - 0.4), dx = Math.abs(x - (jiri ? trailX(z) : 0));
      c.copy(grass).lerp(g2, 0.5 + 0.5 * big).lerp(dry, Math.max(0, n - 0.2) * 0.5);
      if (z < SUMMIT.crestZ + 1.5 || (n > 0.7 && dx > 4)) c.copy(stone).lerp(dry, 0.2);
      if (inField(x, z)) c.set(LK.ground.field);
      if (SPOTS_ON && jiri) { const pd = pondD(x, z); if (pd < 1.0) c.set(0x9fd8d0).lerp(new THREE.Color(0x4aa8c8), Math.max(0, 1 - pd * 1.2)); else if (pd < 1.35) c.lerp(new THREE.Color(0xe8dcc8), 0.6); if (Math.hypot(x - POND.x - POND.isle.dx, z - POND.z - POND.isle.dz) < POND.isle.r) c.set(LK.ground.grass); }
      const pw = 1.5 + Math.sin(z * 0.5) * 0.4;
      if (z > 1 && z < (jiri ? 146 : 40)) c.lerp(path, clamp01((pw + 0.6 - dx) / 1.2));
      c.multiplyScalar(1 - Math.min(0.18, Math.max(0, dx - 12) * 0.012));
    }
    if (SEASON === 'winter' && (n > -0.15 || Math.abs(x) > 4)) c.lerp(SNOW, 0.55 + 0.35 * Math.max(0, n));
    else if (SEASON === 'late') c.lerp(dry, 0.45);
    else if (SEASON === 'summer') c.lerp(grass, 0.35);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  // ---------- 절벽과 양옆 바위 ----------
  const rockM = V.rock.map(c => lam(c));
  const boulder = (x: number, y: number, z: number, s: number, sy = 0.8) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockM[Math.floor(rnd() * 3)]);
    m.scale.set(s * (1 + rnd() * 0.4), s * sy, s * (0.8 + rnd() * 0.4)); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m.position.set(x, y, z); g.add(m); return m;
  };
  // 절벽 면: 전망대 아래로 크고 각진 바위를 겹겹이
  // 꼭대기가 전망대보다 낮게: 양옆이 트였을 때 벽처럼 솟아 보이지 않게
  for (let i = 0; i < 46; i++) { const s = 2.5 + rnd() * 3.5; boulder(-12 + rnd() * 24, SUMMIT.deckY - 2.5 - s * 0.9 - rnd() * 30, -1.6 - rnd() * 6 - (i % 3), s, 1.1); }
  // 전망대 양옆 바위 (시야를 액자처럼)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const x = sx * (6 + i * 1.6 + rnd()), z = -0.2 + i * 1.1 + rnd(); boulder(x, mY(x, z, id) + 0.2, z, 0.55 + rnd() * 0.45); }
  // 언덕 위 바위: 도착 자리에서 앞이 바로 안 보이게 가려 줌
  // (작게: 정상에서 뒤로 돌아볼 때 시야를 막지 않게)
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 1.6 + (rnd() - 0.5); if (Math.abs(x) < 1.8) continue; boulder(x, mountainY(x, SUMMIT.crestZ) + 0.2, SUMMIT.crestZ + rnd() * 0.8, 0.4 + rnd() * 0.3); }
  // 길가 작은 돌
  for (let i = 0; i < 40; i++) { const x = (rnd() - 0.5) * 22, z = 3 + rnd() * 22; if (Math.abs(x) < 2.2 || !clearOf(x, z)) continue; boulder(x, mountainY(x, z) + 0.1, z, 0.25 + rnd() * 0.4, 0.6); }

  // ---------- 나무: 키 작은 구상나무와 하얗게 말라 죽은 고사목 ----------
  const pineM = lam(LK ? LK.pine[0] : 0x8fa77c), pineM2 = lam(LK ? LK.pine[1] : 0x9fb58a), deadM = lam(LK ? LK.dead : 0xe2dbcd); // 연한 수채 초록
  for (let i = 0; i < V.trees; i++) {
    const sx = rnd() < 0.5 ? -1 : 1, x = sx * (7 + rnd() * 10), z = 4 + rnd() * 24, y = mountainY(x, z);
    if (!clearOf(x, z) || inField(x, z)) continue;
    if (rnd() < V.dead) {
      // 고사목
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2.6, 5), deadM); t.position.set(x, y + 1.3, z); t.rotation.z = (rnd() - 0.5) * 0.3; g.add(t);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 4), deadM); b.position.set(x, y + 1.4 + k * 0.4, z); b.rotation.z = (k % 2 ? 1 : -1) * (0.9 + rnd() * 0.4); g.add(b); }
    } else {
      const h = 1.2 + rnd() * 1.6;
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75 - k * 0.2, h * 0.55, 7), k % 2 ? pineM : pineM2);
        cone.position.set(x, y + 0.3 + k * h * 0.28 + h * 0.27, z); g.add(cone);
      }
    }
  }
  // 낮은 덤불
  // 가을 단풍 든 덤불 (살짝 어두운 붉은색·주황·갈색)
  const BUSH: Record<Season, number[]> = {
    // 프사 그림 톤: 모두 옅은 수채
    spring: [0xa8b88a, 0xf0a6c4, 0x9fb282, 0xf4bcd2, 0xe892b4], // 철쭉·진달래
    summer: [0x9fb282, 0xa8bc88, 0x96aa7a, 0xa8bc88, 0xb0c48e],
    autumn: [0xa7b07e, 0xd88a6a, 0xe0a46e, 0xc69a72, 0xd8b07a], // 단풍
    late: [0xb8a882, 0xc49a7a, 0xc8b890, 0xae9e7e, 0xcaa888],
    winter: [0xb8b0a6, 0xc4bcb2, 0xaca69e, 0xbcb4aa, 0xb4aea6],
  };
  const bushMs = (LK ? LK.bush : BUSH[SEASON]).map(c => lam(c));
  for (let i = 0; i < 34; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 6), z = 4 + rnd() * 16; if (!clearOf(x, z)) continue; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.4, 0), bushMs[i % bushMs.length]); b.scale.y = 0.6; b.position.set(x, mountainY(x, z) + 0.2, z); g.add(b); }

  // ---------- 계절 ----------
  const seasonG = new THREE.Group(); g.add(seasonG);
  if (SEASON === 'spring') {
    // 연분홍 꽃무더기 (철쭉·진달래): 길 양옆 비탈에
    const fM = [lam(0xf08cb8), lam(0xe0609a), lam(0xf6b3d0)];
    for (let i = 0; i < 70; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 8), z = 2 + rnd() * 26; if (!clearOf(x, z)) continue; const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + rnd() * 0.3, 0), fM[i % 3]); f.scale.y = 0.55; f.position.set(x, mountainY(x, z) + 0.18, z); seasonG.add(f); }
  } else if (SEASON === 'summer') {
    const fM = lam(0xf2b233); // 원추리
    for (let i = 0; i < 26; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (2.5 + rnd() * 7), z = 3 + rnd() * 22; if (!clearOf(x, z)) continue; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), lam(0x4f6a34)); s.position.set(x, mountainY(x, z) + 0.3, z); seasonG.add(s); const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 6), fM); f.rotation.x = Math.PI; f.position.set(x, mountainY(x, z) + 0.62, z); seasonG.add(f); }
  }
  if (SEASON === 'autumn' || SEASON === 'late') {
    // 억새: 가는 줄기 다발 + 끝에 은빛·금빛 이삭 (바람에 살랑)
    const stemM = lam(SEASON === 'late' ? 0xb8a77a : 0x9a8a52), plumeM = new THREE.MeshLambertMaterial({ color: SEASON === 'late' ? 0xece4d2 : 0xe8cf94 });
    for (let i = 0; i < 46; i++) {
      const x = (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 8.5), z = 2 + rnd() * 27; if (!clearOf(x, z)) continue;
      const tuft = new THREE.Group(); tuft.position.set(x, mountainY(x, z), z); tuft.userData.ph = rnd() * 6;
      for (let k = 0; k < 5; k++) {
        const h = 0.7 + rnd() * 0.5, a = (k / 5) * Math.PI * 2, lean = 0.12 + rnd() * 0.15;
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, h, 3), stemM); st.position.set(Math.cos(a) * 0.08, h / 2, Math.sin(a) * 0.08); st.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); tuft.add(st);
        const pl = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 4), plumeM); pl.position.set(Math.cos(a) * (0.08 + h * lean), h + 0.1, Math.sin(a) * (0.08 + h * lean)); pl.rotation.copy(st.rotation); tuft.add(pl);
      }
      seasonG.add(tuft);
    }
  }
  if (SEASON === 'winter' || SEASON === 'late') {
    // 서리꽃(상고대)·눈: 나무와 바위 위에 하얀 덩어리를 얹음
    const frostM = new THREE.MeshLambertMaterial({ color: 0xf4f7fb, flatShading: true });
    const tops: THREE.Vector3[] = [];
    g.traverse(o => { if (o instanceof THREE.Mesh && (o.geometry instanceof THREE.ConeGeometry || (o.geometry instanceof THREE.DodecahedronGeometry && o.position.y > -2))) tops.push(o.position.clone().setY(o.position.y + (o.geometry instanceof THREE.ConeGeometry ? 0.25 : o.scale.y * 0.75))); });
    for (const t of tops) { if (SEASON === 'late' && rnd() < 0.6) continue; const f = new THREE.Mesh(new THREE.IcosahedronGeometry(SEASON === 'late' ? 0.16 : 0.3, 0), frostM); f.scale.y = 0.45; f.position.copy(t); seasonG.add(f); }
  }

  // ---------- 정상: 데크·난간 없이 층층이 쪼개진 화강암 (해만 보는 곳) ----------
  const graniteM = (LK ? LK.granite : [0xbcae9c, 0xc8bba9, 0xb0a290]).map(c => lam(c));
  const slab = (x: number, z: number, sx: number, sy: number, sz: number, ry: number, top: number) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), graniteM[Math.floor(rnd() * 3)]);
    m.scale.set(sx, sy, sz); m.rotation.set((rnd() - 0.5) * 0.25, ry, (rnd() - 0.5) * 0.25);
    m.position.set(x, mY(x, z, id) + top - sy * 0.8, z); g.add(m); return m;
  };
  // 넓적한 판석 (땅에 반쯤 묻혀 위만 살짝): 디딤돌처럼
  for (let i = 0; i < 22; i++) { const x = (rnd() - 0.5) * 9.6, z = 0.2 + rnd() * 2.8; slab(x, z, 0.5 + rnd() * 0.7, 0.18 + rnd() * 0.12, 0.4 + rnd() * 0.5, rnd() * 3, 0.06 + rnd() * 0.08); }
  // 앉는 바위 6곳 (윗면이 앉는 높이)
  for (const [x, z] of SUMMIT_ROCKS) slab(x, z, 0.42 + rnd() * 0.12, 0.42, 0.38 + rnd() * 0.1, rnd() * 3, 0.36);
  // 절벽 끝을 알려 주는 낮은 바위 줄 (난간 대신)
  for (let i = 0; i < 9; i++) { const x = -4.6 + i * 1.15 + (rnd() - 0.5) * 0.3; slab(x, -0.15, 0.32 + rnd() * 0.2, 0.3, 0.25, rnd() * 3, 0.18 + rnd() * 0.12); }
  // 바위 틈 억새 몇 포기
  const tuftM = lam(0xb9a37a), plM = new THREE.MeshLambertMaterial({ color: 0xf1e2c4 });
  for (let i = 0; i < 10; i++) {
    const x = (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 3.4), z = 0.3 + rnd() * 2.6, tf = new THREE.Group(); tf.position.set(x, mY(x, z, id), z);
    for (let k = 0; k < 4; k++) { const a = k * 1.6, h = 0.45 + rnd() * 0.3; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, h, 3), tuftM); st.position.set(Math.cos(a) * 0.04, h / 2, Math.sin(a) * 0.04); st.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); tf.add(st); const pl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), plM); pl.position.set(Math.cos(a) * (0.04 + h * 0.25), h + 0.05, Math.sin(a) * (0.04 + h * 0.25)); pl.rotation.copy(st.rotation); tf.add(pl); }
    g.add(tf);
  }
  const postM = lam(0x6e4f33);

  // ---------- 등산로 (지리산): 통천문 · 제석봉 고사목 숲 · 이정표 · 길가 구상나무 ----------
  if (jiri) {
    // 통천문: 길 양쪽 큰 바위 둘 + 그 위에 얹힌 바위 하나, 사이로 나무 계단
    const gateG = new THREE.Group(); gateG.position.set(GATE.x, 0, GATE.z); g.add(gateG);
    const gy = mY(GATE.x, GATE.z, id), gm = (LK ? LK.rock : [0xb4a594, 0xc0b2a1, 0xa89a89]).map(c => lam(c));
    const big = (x: number, sx: number, sy: number, sz: number, y: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), m); b.scale.set(sx, sy, sz); b.position.set(x, gy + y, 0); b.rotation.set(0.1, rnd(), 0.05); gateG.add(b); return b; };
    for (const sx of [-1, 1]) { big(sx * (GATE.gap + GATE.w / 2), GATE.w / 2 + 0.2, 2.2, GATE.d / 2 + 0.2, 1.4, gm[0]); big(sx * (GATE.gap + 2.6), 1.4, 1.4, 1.5, 0.6, gm[2]); }
    big(0, 2.4, 0.75, 1.5, 3.55, gm[1]);
    // 새긴 글씨 通天門
    const gateTex = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 384; const x = cv.getContext('2d')!; x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 128, 384); x.fillStyle = 'rgba(245,228,196,.85)'; x.textAlign = 'center'; x.font = '900 96px "Noto Serif KR", serif'; ['通', '天', '門'].forEach((ch, i) => x.fillText(ch, 64, 110 + i * 112)); const t = stable(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const carve = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.5), new THREE.MeshBasicMaterial({ map: gateTex, transparent: true, depthWrite: false })); carve.position.set(-(GATE.gap + 0.55), gy + 1.7, -GATE.d / 2 - 0.25); carve.rotation.y = Math.PI; gateG.add(carve);
    // 나무 계단
    const stepM = lam(0x7a5532);
    for (let i = 0; i < 7; i++) { const zz = GATE.d / 2 + 1 - i * 0.55, st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.22), stepM); st.position.set(0, mY(GATE.x, GATE.z + zz, id) - gy + gy + 0.05, zz); gateG.add(st); }
    // 제석봉 고사목 숲: 풀밭 비탈에 하얗게 말라 죽은 나무들
    const deadM2 = lam(LK ? LK.dead : 0xe9e2d4);
    const deadTree = (x: number, z: number, h: number) => {
      const y = mY(x, z, id), t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = rnd() * 6.28; g.add(t);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, h, 5), deadM2); trunk.position.y = h / 2; trunk.rotation.z = (rnd() - 0.5) * 0.2; t.add(trunk);
      for (let k = 0; k < 4; k++) { const L = h * (0.25 + rnd() * 0.25), br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, L, 4), deadM2); const a = rnd() * 6.28, up = 0.5 + rnd() * 0.6; br.position.set(Math.cos(a) * L * 0.35 * Math.sin(up), h * (0.55 + k * 0.1) + Math.cos(up) * L * 0.35, Math.sin(a) * L * 0.35 * Math.sin(up)); br.rotation.set(Math.sin(a) * up, 0, -Math.cos(a) * up); t.add(br); }
    };
    for (let i = 0; i < 46; i++) { const z = 36 + rnd() * 30, side = rnd() < 0.5 ? -1 : 1, x = trailX(z) + side * (2.4 + rnd() * 9); if (inField(x, z) || (LK && side > 0)) continue; deadTree(x, z, 2.2 + rnd() * 2.2); }
    // 길가 구상나무 (통천문 위아래, 장터목 가는 길)
    for (let i = 0; i < 40; i++) { const z = (i < 14 ? 16 + rnd() * 18 : 66 + rnd() * 30), side = rnd() < 0.5 ? -1 : 1, x = trailX(z) + side * (2.6 + rnd() * 8), y = mY(x, z, id); if (!clearOf(x, z) || inField(x, z)) continue; const h = 1.2 + rnd() * 1.6; for (let k = 0; k < 3; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75 - k * 0.2, h * 0.55, 7), k % 2 ? pineM : pineM2); cone.position.set(x, y + 0.3 + k * h * 0.28 + h * 0.27, z); g.add(cone); } }
    // 길가 바위
    for (let i = 0; i < 50; i++) { const z = 16 + rnd() * 84, x = trailX(z) + (rnd() < 0.5 ? -1 : 1) * (1.9 + rnd() * 6); if (!clearOf(x, z) || inField(x, z) || Math.abs(z - GATE.z) < 3) continue; boulder(x, mY(x, z, id) + 0.1, z, 0.25 + rnd() * 0.45, 0.6); }
    // 이정표: 천왕봉까지 남은 거리 (실제 거리 기준)
    const signPost = (z: number, side: number, up: string, down: string) => {
      const x = trailX(z) + side * 1.9, sgp = new THREE.Group(); sgp.position.set(x, mY(x, z, id), z); sgp.rotation.y = side > 0 ? -0.5 : 0.5; g.add(sgp);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const xx = cv.getContext('2d')!;
      xx.fillStyle = '#7a5532'; xx.fillRect(0, 0, 512, 256); xx.strokeStyle = 'rgba(0,0,0,.25)'; xx.lineWidth = 3; for (let yy = 24; yy < 256; yy += 30) { xx.beginPath(); xx.moveTo(0, yy); xx.lineTo(512, yy + 5); xx.stroke(); }
      xx.fillStyle = '#fff6e0'; xx.textAlign = 'center'; xx.font = '900 64px "Noto Sans KR", sans-serif'; xx.fillText(up, 256, 100); xx.font = '800 48px "Noto Sans KR", sans-serif'; xx.fillText(down, 256, 200);
      const tx = stable(new THREE.CanvasTexture(cv)); tx.colorSpace = THREE.SRGBColorSpace; const fm = new THREE.MeshLambertMaterial({ map: tx });
      const pole3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.9, 6), postM); pole3.position.y = 0.95; sgp.add(pole3);
      const bd = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.06), [postM, postM, postM, postM, fm, fm]); bd.position.y = 1.65; bd.rotation.y = Math.PI; sgp.add(bd);
    };
    signPost(27, -1, '↑ 천왕봉 0.3km', '↓ 장터목 1.4km');
    signPost(52, 1, '↑ 천왕봉 0.9km', '제석봉 1,808m');
    signPost(80, -1, '↑ 천왕봉 1.4km', '↓ 장터목 0.3km');
  }

  // ---------- 꽃밭 (시안): 어머니들 카톡 프사 같은 큰 꽃밭. 색 띠가 비탈을 따라 굽이침 ----------
  if (LK && jiri) {
    const pts: [number, number, number][] = [], NF = LK.flowers.length;
    for (let z = FIELD.z0 + 0.5; z < FIELD.z1 - 0.3; z += 0.2) for (let dx = FIELD.x0 + 0.4; dx < FIELD.x1 + 3; dx += 0.2) {
      const x = trailX(z) + dx + (rnd() - 0.5) * 0.18, zz = z + (rnd() - 0.5) * 0.18;
      if (!inField(x, zz) || !clearOf(x, zz)) continue;
      // 꽃밭 사이 오솔길 (사진 찍으러 들어가는 길)
      const lane = Math.abs((dx - 10) - Math.sin(z * 0.18) * 4);
      if (lane < 0.6) continue;
      // 굽이치는 색 띠, 경계는 살짝 섞임 + 군데군데 다른 색 한 송이
      const bv = (dx * 0.55 + z * 0.32 + Math.sin(z * 0.15) * 3) / 3.2 + (rnd() - 0.5) * 0.35;
      let k = ((Math.floor(bv) % NF) + NF) % NF; if (rnd() < 0.04) k = Math.floor(rnd() * NF);
      pts.push([x, zz, k]);
    }
    const geo = new THREE.IcosahedronGeometry(0.1, 1); geo.scale(1, 0.55, 1);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: 0xffffff }), pts.length);
    const leafGeo = new THREE.ConeGeometry(0.13, 0.22, 5);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshToonMaterial({ color: new THREE.Color(LK.ground.field).multiplyScalar(0.8) }), Math.ceil(pts.length / 3));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), cc = new THREE.Color();
    pts.forEach(([x, z, k], i) => {
      const s = 0.75 + rnd() * 0.6, gy = mY(x, z, id); e.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4); q.setFromEuler(e);
      m4.compose(ps.set(x, gy + 0.16 + rnd() * 0.12, z), q, sc.set(s, s, s)); im.setMatrixAt(i, m4);
      cc.set(LK.flowers[k]).offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.1); im.setColorAt(i, cc);
      if (i % 3 === 0) { m4.compose(ps.set(x + 0.05, gy + 0.08, z + 0.05), q, sc.set(1, 1, 1)); leaves.setMatrixAt(i / 3, m4); }
    });
    im.instanceColor!.needsUpdate = true; g.add(im, leaves);
    // 사진 찍는 나무 액자
    const fx = trailX(56) + 9, fz = 56, fy = mY(fx, fz, id), frame = new THREE.Group(); frame.position.set(fx, fy, fz); frame.rotation.y = -0.9; g.add(frame);
    const wood = lam(0xb07a4a);
    for (const sx of [-1, 1]) { const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), wood); p2.position.set(sx * 0.95, 1.1, 0); frame.add(p2); }
    for (const yy of [0.35, 2.15]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.14, 0.14), wood); b.position.y = yy; frame.add(b); }
    const tag = textSprite('지리산 꽃밭', 0.42); tag.position.y = 2.55; frame.add(tag);
  }

  // ---------- 둥지: 모든 병아리가 태어나고 매일 아침 깨어나는 곳 ----------
  if (id === 'jirisan') {
    const nest = new THREE.Group(); nest.position.set(NEST.x, mY(NEST.x, NEST.z, id), NEST.z); g.add(nest);
    const twig = lam(0x8a6438), twig2 = lam(0x6a4a2a);
    for (let i = 0; i < 26; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.9 + (i % 3) * 0.06, 0.06, 4, 18, Math.PI * (1.1 + rnd() * 0.6)), i % 2 ? twig : twig2); t.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.35, 0, rnd() * 6.28); t.position.y = 0.12 + (i % 4) * 0.05; nest.add(t); }
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.12, 18), lam(0xc9a96a)); bed.position.y = 0.08; nest.add(bed);
    // 껍데기 조각들 (막 깨어난 흔적)
    const shellM = lam(0xfbf6ea);
    for (let i = 0; i < 6; i++) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI, 0, Math.PI / 2), shellM); sh.position.set((rnd() - 0.5) * 1.1, 0.16, (rnd() - 0.5) * 1.1); sh.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); nest.add(sh); }
  }

  // ---------- 정상 표지석과 안내판 ----------
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.45), [lam(0x8a8079), lam(0x8a8079), lam(0x8a8079), lam(0x8a8079), new THREE.MeshLambertMaterial({ map: stoneFace([...V.stoneText], V.height) }), lam(0x625d57)]);
  st.position.set(SUMMIT.stone.x, mountainY(SUMMIT.stone.x, SUMMIT.stone.z) + 0.85, SUMMIT.stone.z); st.rotation.y = 0.25; g.add(st);
  const sign = new THREE.Group(); sign.position.set(2.6, mountainY(2.6, 12.5), 12.5); g.add(sign);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.8, 6), postM); pole.position.y = 0.9; sign.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.56, 0.06), [postM, postM, postM, postM, new THREE.MeshLambertMaterial({ map: trailSign(V.sign) }), postM]);
  board.position.y = 1.6; sign.add(board);

  // ---------- 바위 틈 검은 소나무: 화면 가장자리를 액자처럼 (해는 가리지 않게 양옆에만) ----------
  for (const [x, z, h, lean, seed] of [[-7.4, 0.6, 4.2, -0.5, 1], [7.8, 1.6, 3.4, 0.55, 2], [-9.5, 5.5, 3.0, -0.3, 3]] as const) {
    const t = koreanPine(h, lean, seed); t.position.set(x, mY(x, z, id) - 0.15, z); g.add(t);
    boulder(x, mY(x, z, id) + 0.1, z, 0.7 + rnd() * 0.3);
  }

  // ---------- 지리산: 정상 뒤쪽 능선길을 따라 가게 셋 + 갈림길 표지판 ----------
  const shops = id === 'jirisan' ? createShops(g, GLOW) : null;
  if (shops) {
    const sg = new THREE.Group(); sg.position.set(-2.2, mY(-2.2, 15.2, id), 15.2); g.add(sg);
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.9, 6), postM); pole2.position.y = 0.95; sg.add(pole2);
    const shopSign = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const x = c.getContext('2d')!;
      x.fillStyle = '#7a5532'; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#fff6e0'; x.textAlign = 'center'; x.font = '900 52px "Noto Sans KR", sans-serif';
      x.fillText('↓ 장터목 1.6km', 256, 62); x.font = '800 40px "Noto Sans KR", sans-serif'; x.fillText('통천문 · 제석봉 고사목', 256, 132); x.fillText('리어카 · 매점 · 청학당', 256, 196);
      const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const sm = new THREE.MeshLambertMaterial({ map: shopSign });
    const board2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.06), [postM, postM, postM, postM, sm, sm]);
    board2.position.y = 1.65; board2.rotation.y = Math.PI * 0.85; sg.add(board2);
  }

  // ---------- 운해: 발아래 넓게 깔린 구름 두 겹 (천천히 흐름) ----------
  // 반복 무늬 텍스처를 넓게 깔면 일부 폰 GPU에서 무지개 점으로 깨져서, 바닥은 단색 + 위에 구름 덩어리를 많이 띄움
  const base = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0xdfe6ee }));
  base.rotation.x = -Math.PI / 2; base.position.y = -36; g.add(base);
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.y = -31; g.add(haze);

  // 뭉게뭉게 솟은 구름 덩어리 (가까운 것은 크게, 멀수록 작게): 운해가 평면이 아니라 입체로 보이게
  const puffTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const x = cv.getContext('2d')!;
    // 프사 그림처럼: 하얀 몽글 구름 + 위쪽에 연필 테두리
    const blobs: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) blobs.push([34 + rnd() * 188, 70 + rnd() * 18, 20 + rnd() * 26]);
    x.fillStyle = '#ffffff';
    for (const [cx, cy, r] of blobs) { x.beginPath(); x.ellipse(cx, cy, r, r * 0.72, 0, 0, Math.PI * 2); x.fill(); }
    x.beginPath(); x.ellipse(128, 92, 104, 22, 0, 0, Math.PI * 2); x.fill(); // 아래쪽도 둥글게 (네모 끝이 보이지 않게)
    x.globalCompositeOperation = 'destination-over'; x.strokeStyle = LK ? LK.cloudLine : 'rgba(160,140,132,0.55)'; x.lineWidth = 3;
    for (const [cx, cy, r] of blobs) { x.beginPath(); x.ellipse(cx, cy, r + 2, r * 0.72 + 2, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); }
    x.globalCompositeOperation = 'source-over';
    return stable(new THREE.CanvasTexture(cv));
  })();
  const puffs: THREE.Sprite[] = [];
  for (let i = 0; i < 190; i++) {
    // 앞쪽은 멀리까지, 양옆은 가까운 골짜기부터 (능선을 트면서 옆이 보이게 됐으므로)
    const ang = i < 150 ? (rnd() - 0.5) * Math.PI * 1.4 : (rnd() < 0.5 ? -1 : 1) * (Math.PI * (0.35 + rnd() * 0.45)), d = i < 150 ? 24 + Math.pow(rnd(), 0.8) * 520 : 30 + rnd() * 140;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 1 }));
    const w = 18 + d * 0.22 + rnd() * 30; sp.scale.set(w, w * 0.45, 1);
    sp.position.set(Math.sin(ang) * d, -31 + rnd() * 10 + w * 0.12, -Math.cos(ang) * d - 4); g.add(sp); puffs.push(sp);
  }

  // ---------- 겹겹이 이어진 먼 능선 (가까울수록 진하게) ----------
  const ridges = [
    ridge(95, -20, 12, LK ? LK.ridges[0] : 0xc7bdd3, 9.1), ridge(160, -24, 16, LK ? LK.ridges[1] : 0xd0c6db, 1.2), ridge(300, -24, 20, LK ? LK.ridges[2] : 0xd9d0e2, 3.1),
    ridge(470, -28, 26, LK ? LK.ridges[3] : 0xe2dbea, 5.7), ridge(700, -34, 32, LK ? LK.ridges[4] : 0xebe6f1, 8.4),
  ].slice(-V.ridges);
  // 양옆으로도 둘러싸게
  // 양옆으로도 겹겹이 (같은 재질이라 밤낮 색이 함께 바뀜)
  for (const [i, r] of ridges.entries()) { g.add(r); if (i < 3) for (const sd of [-1, 1]) { const side = r.clone(); side.rotation.y = sd * Math.PI * (0.38 + i * 0.04); g.add(side); } }
  // 한라산 백록담: 왼쪽 뒤로 보이는 분화구와 그 안의 작은 호수
  if (V.crater) {
    // 백록담 호수 (분화구 바닥) + 안내 글씨
    const lake = new THREE.Mesh(new THREE.CircleGeometry(CRATER.r * 0.55, 24), new THREE.MeshLambertMaterial({ color: 0x3f6f78 }));
    lake.rotation.x = -Math.PI / 2; lake.position.set(CRATER.x, mountainY(CRATER.x, CRATER.z) + 0.25, CRATER.z); g.add(lake);
    const tag = textSprite('백록담 · Baengnokdam', 0.6); tag.position.set(CRATER.x, mountainY(CRATER.x, CRATER.z) + 6, CRATER.z); g.add(tag);
  }
  const ridgeBase = ridges.map(r => (r.material as THREE.MeshBasicMaterial).color.clone());

  const cDay = new THREE.Color(LK ? LK.cloudDay : 0xfffbf4), cNight = new THREE.Color(LK ? LK.cloudNight : 0x58628a), tmp = new THREE.Color(), dark = new THREE.Color(LK ? LK.ridgeNight : 0x10141f);
  if (LK) stylize(g);
  const spots = id === 'jirisan' && SPOTS_ON ? createSpots(g, mountainY, GLOW) : null;
  // 움직이지 않는 산 장식은 합쳐서 그림 (억새도 흔들림 대신 합침: 폰에서 그리기 1000번 가까이 줄어듦)
  bakeStatic(g);
  return {
    group: g,
    update(dt: number, night: number, low: THREE.Color, t = 0) {
      shops?.update(t, night); spots?.update(t, night);
      // 억새가 바람에 살랑
      // 구름 덩어리가 아주 천천히 흘러감
      for (const [i, sp] of puffs.entries()) { sp.position.x += dt * (0.4 + (i % 5) * 0.12); if (sp.position.x > 600) sp.position.x -= 1200; }
      // 구름색: 낮엔 하얗게, 해 뜰 무렵엔 하늘 아래쪽 색(분홍·주황)이 물듦, 밤엔 푸르스름하게 어둡게
      tmp.copy(cDay).lerp(cNight, night).lerp(low, 0.12 * (1 - night * 0.6));
      for (const m of [base, haze]) (m.material as THREE.MeshBasicMaterial).color.copy(tmp);
      for (const sp of puffs) sp.material.color.copy(tmp);
      (base.material as THREE.MeshBasicMaterial).color.multiplyScalar(0.92);
      ridges.forEach((r, i) => (r.material as THREE.MeshBasicMaterial).color.copy(ridgeBase[i]).lerp(dark, night * 0.55));
    },
  };
}
