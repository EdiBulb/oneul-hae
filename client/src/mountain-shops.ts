import * as THREE from 'three';
import { stable } from './stable-tex';
import { SHOPS, mountainY, shopToWorld as worldOf, type Shop } from './beach-extras';

// 장터목 마당의 소박한 가게 둘 (피드백: "화려하면 안 됨, 허름하고 낡은 리어카 느낌")
// ☕ 커피 리어카: 녹슨 바퀴 나무 리어카 + 바랜 파란 천막 + 보온병·종이컵 + 골판지 손글씨 + 석유 등잔 + "알아서 드세요" 상자
// 🍙🍶 대피소 매점: 돌벽 + 녹슨 함석지붕 + 바랜 간판 + 불 켜진 창구 둘(김밥 · 막걸리) + 드럼통 난로 + 플라스틱 의자

const lam = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });
function box(p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); p.add(b); return b;
}
function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, seg = 12) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); p.add(c); return c;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const M = {
  plank: lam(0x7a5a3e), plankDark: lam(0x4a3424), rust: lam(0x6a3a26), tire: lam(0x221c1a), tarp: lam(0x5f7f96, { side: THREE.DoubleSide }),
  pole: lam(0x5a4a3c), cup: lam(0xece4d4), stone: lam(0x5c5650), tin: lam(0x6a5c54, { side: THREE.DoubleSide }), window: glow(0xffd99a),
  foil: lam(0xc9ccd2, { emissive: 0x202226 }), nori: lam(0x16221a), kettle: lam(0xe2b13c, { emissive: 0x3a2a08 }), drum: lam(0x4a3a34),
  ember: glow(0xff8a3c), crate: lam(0x8a6440),
};
const thermosC = [0x8a9aa8, 0xb5523e, 0x7a8a6a];

/** 골판지 손글씨 "커피 한 잔" */
const cardTex = () => canvasTex(256, 160, g => {
  g.fillStyle = '#c9a777'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(90,60,30,.25)'; g.lineWidth = 2; for (let x = 6; x < 256; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
  g.fillStyle = '#2a1a12'; g.textAlign = 'center'; g.font = '700 54px "Gaegu", "Noto Sans KR", sans-serif'; g.fillText('커피 한 잔', 128, 78); g.font = '700 30px "Gaegu", "Noto Sans KR", sans-serif'; g.fillText('따뜻함 · 공짜', 128, 126);
});
const boxTex = () => canvasTex(128, 96, g => { g.fillStyle = '#8a6440'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#2a1a12'; g.fillRect(36, 12, 56, 8); g.fillStyle = '#f3e8cf'; g.textAlign = 'center'; g.font = '700 26px "Gaegu", "Noto Sans KR", sans-serif'; g.fillText('알아서', 64, 52); g.fillText('드세요', 64, 82); });
const hutSignTex = () => canvasTex(512, 112, g => {
  g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, 512, 112);
  g.fillStyle = 'rgba(120,90,60,.22)'; g.fillRect(300, 0, 60, 112); g.fillRect(20, 80, 120, 14);
  g.fillStyle = '#2f5a7a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 58px "Noto Sans KR", sans-serif'; g.fillText('장터목 대피소 매점', 256, 58);
});
const windowTex = (text: string) => canvasTex(256, 96, g => { g.fillStyle = '#fff1d0'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#5a3a20'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 48px "Gaegu", "Noto Sans KR", sans-serif'; g.fillText(text, 128, 50); });

/** 바닥: 경사진 땅에 낮은 돌 축대 */
function base(p: THREE.Group, w: number, d: number, y0: number) { box(p, w, 1.4, d, M.stone, 0, y0 - 0.68, 0); }

function cart(s: Shop, y: number) {
  const g = new THREE.Group();
  const by = y + 0.62;
  // 짐칸 (판자) + 손잡이
  box(g, s.w, 0.42, s.d, M.plank, 0, by, 0);
  for (let i = 0; i < 3; i++) box(g, s.w + 0.01, 0.015, s.d + 0.01, M.plankDark, 0, by - 0.14 + i * 0.12, 0);
  for (const sx of [-1, 1]) { const h = box(g, 1.1, 0.05, 0.05, M.plankDark, -s.w / 2 - 0.5, by - 0.05, sx * (s.d / 2 - 0.1)); h.rotation.z = 0.25; }
  // 녹슨 바퀴 둘
  for (const sx of [-1, 1]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 16), M.tire); wh.position.set(0.15, y + 0.33, sx * (s.d / 2 + 0.06)); g.add(wh); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), M.rust); hub.rotation.x = Math.PI / 2; hub.position.copy(wh.position); g.add(hub); }
  // 기둥 넷 + 바랜 천막
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.025, 0.025, 1.25, M.pole, ax * (s.w / 2 - 0.08), by + 0.82, az * (s.d / 2 - 0.08), 6);
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(s.w + 0.4, s.d + 0.5, 6, 2), M.tarp);
  const tp = tarp.geometry.attributes.position; for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin((tp.getX(i) / (s.w + 0.4) + 0.5) * Math.PI * 3) * 0.05);
  tarp.rotation.x = -Math.PI / 2; tarp.rotation.y = 0; tarp.position.set(0, by + 1.45, 0); tarp.rotation.z = 0.08; g.add(tarp);
  // 보온병 셋 + 종이컵 탑
  thermosC.forEach((c, i) => { cyl(g, 0.07, 0.07, 0.34, lam(c), 0.25 + i * 0.22, by + 0.38, -0.15, 10); cyl(g, 0.075, 0.075, 0.06, lam(0x2a2a30), 0.25 + i * 0.22, by + 0.58, -0.15, 10); });
  for (let i = 0; i < 7; i++) cyl(g, 0.05, 0.04, 0.05, M.cup, -0.65, by + 0.24 + i * 0.045, -0.1, 10);
  // 골판지 손글씨 (길 쪽 = 앞 +z)
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.47), new THREE.MeshLambertMaterial({ map: cardTex() })); card.position.set(-0.35, by + 0.02, s.d / 2 + 0.012); card.rotation.z = -0.04; g.add(card);
  // 석유 등잔 (기둥에 걸림)
  const lamp = new THREE.Group(); lamp.position.set(s.w / 2 - 0.08, by + 1.18, s.d / 2 - 0.08); g.add(lamp);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glow(0xffe0a0)); glass.scale.y = 1.4; lamp.add(glass);
  box(lamp, 0.12, 0.03, 0.12, lam(0x2a2a2a), 0, -0.1, 0); box(lamp, 0.1, 0.02, 0.1, lam(0x2a2a2a), 0, 0.11, 0);
  // "알아서 드세요" 나무 상자
  const hb = new THREE.Group(); hb.position.set(s.w / 2 + 0.45, y, s.d / 2 + 0.2); g.add(hb);
  const bx = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), [M.crate, M.crate, M.crate, M.crate, new THREE.MeshLambertMaterial({ map: boxTex() }), M.crate]); bx.position.y = 0.2; hb.add(bx);
  return { g, lamp: glass };
}

function hut(s: Shop, y: number) {
  const g = new THREE.Group(); base(g, s.w + 0.4, s.d + 0.4, y);
  const H = 2.0, { w, d } = s;
  // 돌벽 (돌 줄눈)
  box(g, w, H, d, M.stone, 0, y + H / 2, 0);
  for (let r = 1; r < 6; r++) box(g, w + 0.02, 0.02, d + 0.02, lam(0x46413c), 0, y + r * H / 6, 0);
  // 녹슨 함석지붕 (한쪽으로 기운 외지붕)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.05, d + 0.7, 12, 1, 1), M.tin);
  const rp = roof.geometry.attributes.position; for (let i = 0; i < rp.count; i++) rp.setY(i, rp.getY(i) + Math.abs(Math.sin(rp.getX(i) * 9)) * 0.03);
  roof.geometry.computeVertexNormals(); roof.position.set(0, y + H + 0.18, 0.1); roof.rotation.x = 0.16; g.add(roof);
  box(g, 0.6, 0.02, 0.4, lam(0x8a4a2a), -0.9, y + H + 0.25, 0.3).rotation.x = 0.16; // 녹 얼룩
  // 바랜 간판
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.52), new THREE.MeshLambertMaterial({ map: hutSignTex() })); sign.position.set(0, y + H - 0.32, d / 2 + 0.012); g.add(sign);
  // 창구 둘 (김밥 · 막걸리): 불 켜진 창 + 나무 선반 + 창 안에 보이는 것
  for (const [dx, label, kind] of [[-0.9, '김밥', 'k'], [0.9, '막걸리', 'm']] as const) {
    box(g, 1.05, 0.72, 0.03, M.window, dx, y + 1.05, d / 2 + 0.01);
    box(g, 1.2, 0.06, 0.06, M.plankDark, dx, y + 1.44, d / 2 + 0.03);
    box(g, 1.25, 0.06, 0.32, M.plank, dx, y + 0.66, d / 2 + 0.15);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: windowTex(label) })); lab.position.set(dx, y + 1.62, d / 2 + 0.02); g.add(lab);
    if (kind === 'k') for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), M.foil); k.rotation.z = Math.PI / 2; k.position.set(dx - 0.3 + i * 0.3, y + 0.73, d / 2 + 0.18); g.add(k); }
    else { const k = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.kettle); k.scale.y = 0.85; k.position.set(dx, y + 0.78, d / 2 + 0.18); g.add(k); cyl(g, 0.012, 0.025, 0.14, M.kettle, dx + 0.12, y + 0.82, d / 2 + 0.18, 6).rotation.z = -0.9; }
  }
  // 드럼통 난로 + 연통
  const dr = new THREE.Group(); dr.position.set(w / 2 + 0.6, y, d / 2 + 0.6); g.add(dr);
  cyl(dr, 0.26, 0.26, 0.72, M.drum, 0, 0.36, 0, 14);
  box(dr, 0.24, 0.12, 0.02, M.ember, 0, 0.42, 0.26);
  cyl(dr, 0.05, 0.05, 1.4, lam(0x5a5a5a), 0, 1.4, 0, 8);
  return { g, ember: dr };
}

/** 앉을 곳: 리어카 옆 나무 상자, 매점 앞 플라스틱 의자 */
function seatsFor(g: THREE.Group, s: Shop, y: number, style: 'crate' | 'plastic') {
  const cols = [0x3f7a5a, 0xc0574a, 0x4f7aa8];
  s.seats.forEach((t, i) => {
    const cy = mountainY(...worldOf(s, t.lx, t.lz), 'jirisan') - y;
    if (style === 'crate') { const b = box(g, 0.48, t.h, 0.4, M.crate, t.lx, y + cy + t.h / 2, t.lz); b.rotation.y = t.ry; box(g, 0.49, 0.02, 0.41, M.plankDark, t.lx, y + cy + t.h * 0.5, t.lz).rotation.y = t.ry; }
    else { cyl(g, 0.19, 0.16, t.h, lam(cols[i % 3]), t.lx, y + cy + t.h / 2, t.lz, 12); }
  });
}

export function createShops(parent: THREE.Group, GLOW: THREE.Texture) {
  const g = new THREE.Group(); parent.add(g);
  const warm: { sp: THREE.Sprite | THREE.Mesh; ring?: boolean }[] = [], flick: THREE.Sprite[] = [], steam: THREE.Sprite[] = [];
  const steamM = new THREE.SpriteMaterial({ map: GLOW, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.35 });
  const addGlow = (p: THREE.Object3D, x: number, y: number, z: number, s: number, c = 0xffb060, op = 0.55) => { const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); w.scale.set(s, s, 1); w.position.set(x, y, z); p.add(w); return w; };
  for (const s of SHOPS) {
    const y = mountainY(s.x, s.z, 'jirisan') + 0.05;
    const holder = new THREE.Group(); holder.position.set(s.x, 0, s.z); holder.rotation.y = s.ry; g.add(holder);
    if (s.id === 'cart') {
      const c = cart(s, y); holder.add(c.g); seatsFor(c.g, s, y, 'crate');
      flick.push(addGlow(c.g, s.w / 2 - 0.08, y + 1.8, s.d / 2 - 0.08, 2.4, 0xffc070, 0.7));
      for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(steamM.clone()); sp.position.set(0.25 + i * 0.22, y + 1.3, -0.15); sp.userData.k = i / 3; sp.userData.base = sp.position.clone(); c.g.add(sp); steam.push(sp); }
    } else if (s.id === 'hut') {
      const c = hut(s, y); holder.add(c.g); seatsFor(c.g, s, y, 'plastic');
      flick.push(addGlow(c.ember, 0, 0.5, 0.3, 1.6, 0xff8a3c, 0.6));
      for (const dx of [-0.9, 0.9]) warm.push({ sp: addGlow(c.g, dx, y + 1.05, s.d / 2 + 0.4, 2.0) });
    }
    // 창구·리어카 앞 동그라미 (여기에 서면 받아 감)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.57, 28), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.5, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.door, mountainY(...worldOf(s, s.door, s.d / 2 + 0.7), 'jirisan') + 0.04, s.d / 2 + 0.7); holder.add(ring);
    warm.push({ sp: ring, ring: true });
  }
  return {
    group: g,
    update(t: number, night: number) {
      const tt = t / 1000, on = 0.35 + night * 0.65;
      for (const w of warm) { const m = w.sp.material as THREE.MeshBasicMaterial; m.opacity = w.ring ? 0.3 + 0.22 * Math.sin(tt * 2.4) : 0.5 * on; }
      // 등잔·난로 불빛이 흔들림
      for (const [i, f] of flick.entries()) f.material.opacity = (0.45 + Math.sin(tt * 9 + i) * 0.06 + Math.sin(tt * 13.7 + i * 2) * 0.05) * on;
      for (const sp of steam) {
        const k = (tt * 0.3 + sp.userData.k) % 1, b = sp.userData.base as THREE.Vector3;
        sp.position.set(b.x + Math.sin(tt + sp.userData.k * 6) * 0.08, b.y + k * 0.9, b.z);
        sp.scale.setScalar(0.25 + k * 0.6); sp.material.opacity = 0.35 * (1 - k);
      }
    },
  };
}
