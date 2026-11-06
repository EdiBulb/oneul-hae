import * as THREE from 'three';
import { textSprite } from './character';
import { CRATER, SUMMIT, mountainY as mY } from './beach-extras';

// 지리산 천왕봉: 정상 직전 바위 능선에 도착 → 언덕을 넘으면 절벽 끝 전망대.
// 발아래는 운해(구름 바다), 그 위로 겹겹이 이어진 능선이 봉우리만 내밀고 있다.

const lam = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

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
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 산마다 다른 점: 땅 색, 나무, 표지석 글자, 먼 능선 (한라산은 섬이라 사방이 운해) */
const VARIANTS = {
  jirisan: { grass: 0x6d7a45, dry: 0x8c8456, stone: 0x7d786f, path: 0x9b9180, rock: [0x5b5752, 0x6a655e, 0x4c4843], trees: 34, dead: 0.22, stoneText: ['지', '리', '산', '천', '왕', '봉'], height: '1,915m', sign: '천왕봉', ridges: 4, crater: false },
  hallasan: { grass: 0x6f7340, dry: 0x8a6e4c, stone: 0x5a4a42, path: 0x7a5e4e, rock: [0x3e3532, 0x4a3f3a, 0x2f2a28], trees: 16, dead: 0.45, stoneText: ['한', '라', '산', '백', '록', '담'], height: '1,947m', sign: '백록담', ridges: 1, crater: true },
} as const;
export type MountainId = keyof typeof VARIANTS;
export function createMountain(scene: THREE.Scene, id: MountainId = 'jirisan') {
  const V = VARIANTS[id];
  const mountainY = (x: number, z: number) => mY(x, z, id);
  const g = new THREE.Group(); scene.add(g); g.visible = false;

  // ---------- 정상 땅 (바위와 풀이 섞인 능선) ----------
  const W = 64, D = 46, geo = new THREE.PlaneGeometry(W, D, 64, 46);
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0, D / 2 - 1.2);
  const p = geo.attributes.position, col: number[] = [];
  const grass = new THREE.Color(V.grass), dry = new THREE.Color(V.dry), stone = new THREE.Color(V.stone), path = new THREE.Color(V.path), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // 난간 앞쪽 가장자리는 아래로 뚝 떨어지는 절벽
    p.setY(i, z < SUMMIT.edgeZ - 0.4 ? SUMMIT.deckY - 14 : mountainY(x, z));
    const n = Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(x * 0.4 - z * 1.3) * 0.5;
    if (Math.abs(x) < 1.6 + Math.sin(z * 0.5) * 0.4 && z > 1) c.copy(path);
    else if (z < SUMMIT.crestZ + 1 || n > 0.45 || Math.abs(x) > 9) c.copy(stone).lerp(dry, 0.15 + 0.2 * Math.max(0, n));
    else c.copy(grass).lerp(dry, 0.5 + 0.5 * n);
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
  for (let i = 0; i < 46; i++) boulder(-16 + rnd() * 32, SUMMIT.deckY - 2 - rnd() * 34, -1.6 - rnd() * 6 - (i % 3), 2.5 + rnd() * 3.5, 1.1);
  // 전망대 양옆 바위 (시야를 액자처럼)
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) boulder(sx * (6 + i * 1.3 + rnd()), SUMMIT.deckY + 0.6 + rnd() * 1.6, -0.6 + i * 0.9 + rnd(), 1.2 + rnd() * 1.2);
  // 언덕 위 바위: 도착 자리에서 앞이 바로 안 보이게 가려 줌
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 2.1 + (rnd() - 0.5); if (Math.abs(x) < 1.8) continue; boulder(x, mountainY(x, SUMMIT.crestZ) + 0.4, SUMMIT.crestZ + rnd() * 0.8, 0.7 + rnd() * 0.6); }
  // 길가 작은 돌
  for (let i = 0; i < 40; i++) { const x = (rnd() - 0.5) * 22, z = 3 + rnd() * 22; if (Math.abs(x) < 2.2) continue; boulder(x, mountainY(x, z) + 0.1, z, 0.25 + rnd() * 0.4, 0.6); }

  // ---------- 나무: 키 작은 구상나무와 하얗게 말라 죽은 고사목 ----------
  const pineM = lam(0x2f4a32), pineM2 = lam(0x3b5a3a), deadM = lam(0xcfc7b8);
  for (let i = 0; i < V.trees; i++) {
    const sx = rnd() < 0.5 ? -1 : 1, x = sx * (7 + rnd() * 10), z = 4 + rnd() * 24, y = mountainY(x, z);
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
  const bushMs = [lam(0x55693a), lam(0x8e3a22), lam(0xa65a26), lam(0x7a4a24), lam(0x9a6a2a)];
  for (let i = 0; i < 34; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 6), z = 4 + rnd() * 16; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.4, 0), bushMs[i % bushMs.length]); b.scale.y = 0.6; b.position.set(x, mountainY(x, z) + 0.2, z); g.add(b); }

  // ---------- 전망대: 밧줄 난간 + 바위 의자 ----------
  const postM = lam(0x6e4f33), ropeM = new THREE.MeshLambertMaterial({ color: 0xd9c9a3 });
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
    return new THREE.CanvasTexture(cv);
  })();
  const puffs: THREE.Sprite[] = [];
  for (let i = 0; i < 150; i++) {
    const ang = (rnd() - 0.5) * Math.PI * 1.4, d = 24 + Math.pow(rnd(), 0.8) * 520;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.92 }));
    const w = 18 + d * 0.22 + rnd() * 30; sp.scale.set(w, w * 0.45, 1);
    sp.position.set(Math.sin(ang) * d, -31 + rnd() * 10 + w * 0.12, -Math.cos(ang) * d - 4); g.add(sp); puffs.push(sp);
  }

  // ---------- 겹겹이 이어진 먼 능선 (가까울수록 진하게) ----------
  const ridges = [
    ridge(160, -24, 16, 0x4e5d70, 1.2), ridge(300, -24, 20, 0x5f7187, 3.1),
    ridge(470, -28, 26, 0x72859b, 5.7), ridge(700, -34, 32, 0x8798ad, 8.4),
  ].slice(-V.ridges);
  // 양옆으로도 둘러싸게
  for (const [i, r] of ridges.entries()) { g.add(r); if (i < 2) { const side = r.clone(); side.rotation.y = (i ? -1 : 1) * Math.PI / 2.4; g.add(side); } }
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
    update(dt: number, night: number, low: THREE.Color) {
      void dt;
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
