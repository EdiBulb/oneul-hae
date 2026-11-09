import * as THREE from 'three';
import { stable } from './stable-tex';
import { textSprite } from './character';
import { CRATER, SHOPS, SUMMIT, mountainY as mY, worldToShop } from './beach-extras';
import { koreanPine } from './place-scenery';
import { createShops } from './mountain-shops';

// 지리산 천왕봉: 정상 직전 바위 능선에 도착 → 언덕을 넘으면 절벽 끝 전망대.
// 발아래는 운해(구름 바다), 그 위로 겹겹이 이어진 능선이 봉우리만 내밀고 있다.

const lam = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
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
  jirisan: { grass: 0x6d7a45, dry: 0x8c8456, stone: 0x7d786f, path: 0x9b9180, rock: [0x5b5752, 0x6a655e, 0x4c4843], trees: 34, dead: 0.22, stoneText: ['지', '리', '산', '천', '왕', '봉'], height: '1,915m', sign: '천왕봉', ridges: 5, crater: false },
  hallasan: { grass: 0x6f7340, dry: 0x8a6e4c, stone: 0x5a4a42, path: 0x7a5e4e, rock: [0x3e3532, 0x4a3f3a, 0x2f2a28], trees: 16, dead: 0.45, stoneText: ['한', '라', '산', '백', '록', '담'], height: '1,947m', sign: '백록담', ridges: 1, crater: true },
} as const;
export type MountainId = keyof typeof VARIANTS;
export function createMountain(scene: THREE.Scene, id: MountainId, GLOW: THREE.Texture) {
  const V = VARIANTS[id];
  const SEASON = seasonNow();
  const mountainY = (x: number, z: number) => mY(x, z, id);
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  /** 가게 자리 근처엔 나무·덤불·돌을 두지 않음 */
  const clearOf = (x: number, z: number) => id !== 'jirisan' || SHOPS.every(s => { const [lx, lz] = worldToShop(s, x, z); return Math.abs(lx) > s.w / 2 + 3.2 || Math.abs(lz) > s.d / 2 + 2.6; });

  // ---------- 정상 땅 (바위와 풀이 섞인 능선) ----------
  const W = 150, D = 76, geo = new THREE.PlaneGeometry(W, D, 110, 64);
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0, D / 2 - 1.2);
  const p = geo.attributes.position, col: number[] = [];
  const SNOW = new THREE.Color(0xeef2f7), grass = new THREE.Color(V.grass), dry = new THREE.Color(V.dry), stone = new THREE.Color(V.stone), path = new THREE.Color(V.path), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // 난간 앞쪽 가장자리는 아래로 뚝 떨어지는 절벽
    p.setY(i, z < SUMMIT.edgeZ - 0.4 ? SUMMIT.deckY - 14 : mountainY(x, z));
    const n = Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(x * 0.4 - z * 1.3) * 0.5;
    if (Math.abs(x) < 1.6 + Math.sin(z * 0.5) * 0.4 && z > 1 && z < 40) c.copy(path);
    else if (z < SUMMIT.crestZ + 1 || n > 0.45 || Math.abs(x) > 9) c.copy(stone).lerp(dry, 0.15 + 0.2 * Math.max(0, n));
    else c.copy(grass).lerp(dry, 0.5 + 0.5 * n);
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
  const pineM = lam(0x2f4a32), pineM2 = lam(0x3b5a3a), deadM = lam(0xcfc7b8);
  for (let i = 0; i < V.trees; i++) {
    const sx = rnd() < 0.5 ? -1 : 1, x = sx * (7 + rnd() * 10), z = 4 + rnd() * 24, y = mountainY(x, z);
    if (!clearOf(x, z)) continue;
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
    spring: [0x55693a, 0xd8689c, 0x4f6a34, 0xe58ab4, 0xc94f86], // 철쭉·진달래
    summer: [0x4f6a34, 0x5d7a3a, 0x44602e, 0x5d7a3a, 0x6b8440],
    autumn: [0x55693a, 0x8e3a22, 0xa65a26, 0x7a4a24, 0x9a6a2a], // 단풍
    late: [0x6a5a3e, 0x7a4a2a, 0x82704a, 0x5e5038, 0x8a6a40],
    winter: [0x5a5248, 0x6a6258, 0x4e4a44, 0x625a50, 0x58524a],
  };
  const bushMs = BUSH[SEASON].map(c => lam(c));
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

  // ---------- 전망대: 밧줄 난간 + 바위 의자 ----------
  const postM = lam(0x6e4f33), ropeM = new THREE.MeshLambertMaterial({ color: 0xd9c9a3 });
  // 양옆 밧줄 난간: 벽 대신 낮은 난간으로 길을 막고 시야는 트이게
  for (const sx of [-1, 1]) {
    for (let z = 0; z <= SUMMIT.crestZ + 0.01; z += 1.0) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 6), postM); post.position.set(sx * 5.35, mY(sx * 5.35, z, id) + 0.5, z - 0.05); g.add(post); }
    for (const yy of [0.55, 0.95]) {
      const a = new THREE.Vector3(sx * 5.35, mY(sx * 5.35, -0.05, id) + yy, -0.05), b = new THREE.Vector3(sx * 5.35, mY(sx * 5.35, SUMMIT.crestZ, id) + yy, SUMMIT.crestZ - 0.05);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), ropeM); rope.position.copy(a).lerp(b, 0.5); rope.lookAt(b); rope.rotateX(Math.PI / 2); g.add(rope);
    }
  }
  for (let x = -5; x <= 5.01; x += 1.25) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 6), postM); post.position.set(x, SUMMIT.deckY + 0.5, SUMMIT.edgeZ - 0.05); g.add(post); }
  for (const y of [0.55, 0.95]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 10.1, 6), ropeM); rope.rotation.z = Math.PI / 2; rope.position.set(0, SUMMIT.deckY + y, SUMMIT.edgeZ - 0.05); g.add(rope); }
  for (let i = 0; i < 6; i++) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.42, 7), rockM[i % 3]);
    seat.position.set(-3.75 + i * 1.5, SUMMIT.deckY + 0.21, 0.75); seat.rotation.y = i; g.add(seat);
  }

  // ---------- 정상 표지석과 안내판 ----------
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.45), [lam(0x625d57), lam(0x625d57), lam(0x625d57), lam(0x625d57), new THREE.MeshLambertMaterial({ map: stoneFace([...V.stoneText], V.height) }), lam(0x625d57)]);
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
      x.fillText('☕ 구름 카페', 256, 70); x.fillText('🍙 천왕 김밥', 256, 140); x.fillText('🍶 산 막걸리', 256, 210);
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
    for (let i = 0; i < 14; i++) {
      const cx = 40 + rnd() * 176, cy = 60 + rnd() * 30, r = 22 + rnd() * 34;
      const gr = x.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(235,238,245,0.7)'); gr.addColorStop(1, 'rgba(220,225,235,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    return stable(new THREE.CanvasTexture(cv));
  })();
  const puffs: THREE.Sprite[] = [];
  for (let i = 0; i < 190; i++) {
    // 앞쪽은 멀리까지, 양옆은 가까운 골짜기부터 (능선을 트면서 옆이 보이게 됐으므로)
    const ang = i < 150 ? (rnd() - 0.5) * Math.PI * 1.4 : (rnd() < 0.5 ? -1 : 1) * (Math.PI * (0.35 + rnd() * 0.45)), d = i < 150 ? 24 + Math.pow(rnd(), 0.8) * 520 : 30 + rnd() * 140;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.92 }));
    const w = 18 + d * 0.22 + rnd() * 30; sp.scale.set(w, w * 0.45, 1);
    sp.position.set(Math.sin(ang) * d, -31 + rnd() * 10 + w * 0.12, -Math.cos(ang) * d - 4); g.add(sp); puffs.push(sp);
  }

  // ---------- 겹겹이 이어진 먼 능선 (가까울수록 진하게) ----------
  const ridges = [
    ridge(95, -20, 12, 0x3a4658, 9.1), ridge(160, -24, 16, 0x4e5d70, 1.2), ridge(300, -24, 20, 0x5f7187, 3.1),
    ridge(470, -28, 26, 0x72859b, 5.7), ridge(700, -34, 32, 0x8798ad, 8.4),
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

  const cDay = new THREE.Color(0xf6f8fb), cNight = new THREE.Color(0x2a3352), tmp = new THREE.Color(), dark = new THREE.Color(0x10141f);
  return {
    group: g,
    update(dt: number, night: number, low: THREE.Color, t = 0) {
      shops?.update(t, night);
      // 억새가 바람에 살랑
      for (const tuft of seasonG.children) if (tuft.userData.ph !== undefined) tuft.rotation.z = Math.sin(t * 1.3 + tuft.userData.ph) * 0.06;
      // 구름 덩어리가 아주 천천히 흘러감
      for (const [i, sp] of puffs.entries()) { sp.position.x += dt * (0.4 + (i % 5) * 0.12); if (sp.position.x > 600) sp.position.x -= 1200; }
      // 구름색: 낮엔 하얗게, 해 뜰 무렵엔 하늘 아래쪽 색(분홍·주황)이 물듦, 밤엔 푸르스름하게 어둡게
      tmp.copy(cDay).lerp(cNight, night).lerp(low, 0.35 * (1 - night * 0.6));
      for (const m of [base, haze]) (m.material as THREE.MeshBasicMaterial).color.copy(tmp);
      for (const sp of puffs) sp.material.color.copy(tmp);
      (base.material as THREE.MeshBasicMaterial).color.multiplyScalar(0.92);
      ridges.forEach((r, i) => (r.material as THREE.MeshBasicMaterial).color.copy(ridgeBase[i]).lerp(dark, night * 0.75));
    },
  };
}
