import * as THREE from 'three';
import { stable } from './stable-tex';
import { PYEONGSANG, SHOPS, mountainY, shopToWorld as worldOf, type Shop } from './beach-extras';

// 지리산 능선길 가게 셋. 멀리서도 무슨 가게인지 알 수 있게 건물 모양·색·지붕 위 큰 상징물을 다르게.
// ☕ 구름 카페: 큰 유리창 원목 오두막 + 지붕 위 커다란 커피잔
// 🍙 천왕 김밥: 주황 줄무늬 천막 가판대 + 지붕 위 단면이 보이는 커다란 김밥
// 🍶 산 막걸리 주막: 초가지붕·흰 흙벽 + 酒 등불 + 막걸리 깃발 + 노란 양은 주전자

const lam = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const glow = (c: number) => new THREE.MeshBasicMaterial({ color: c });
function box(p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); p.add(b); return b;
}
function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, seg = 14) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); p.add(c); return c;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const signTex = (text: string, bg: string, fg: string, w = 512, h = 128, font = 72) => canvasTex(w, h, g => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${font}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`; g.fillText(text, w / 2, h / 2 + 4);
});
const stripeTex = (a: string, b: string, n = 8) => canvasTex(256, 32, g => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 256 / n, 0, 256 / n, 32); } });

// 공용 재질
const M = {
  wood: lam(0x5a3a26), woodDark: lam(0x2c1d15), woodLight: lam(0x8a6040), stone: lam(0x5e5953), roofDark: lam(0x1e1612),
  cream: lam(0xf1e9da), brown: lam(0x7a4a2e), white: lam(0xe8e0d0), red: lam(0xc8302a), blue: lam(0x2a64b8),
  window: glow(0xffd99a), door: glow(0xffc77a), paper: glow(0xffdf9e),
  nori: lam(0x16221a), foil: lam(0xc9ccd2, { emissive: 0x202226 }), rice: lam(0xf4efe2), kettle: lam(0xe2b13c, { emissive: 0x3a2a08 }),
  thatch: lam(0xc49a58, { flatShading: true }), wall: lam(0xd8ccb4), pillar: lam(0x4a3020),
};

/** 가게 하나를 놓을 바닥: 경사진 땅에 돌 축대를 쌓아 평평하게 */
function base(p: THREE.Group, s: Shop, y0: number) {
  box(p, s.w + 0.5, 1.6, s.d + 0.5, M.stone, 0, y0 - 0.75, 0);
}

function cafe(s: Shop, y: number) {
  const g = new THREE.Group(); base(g, s, y);
  const { w, d } = s, H = 2.3;
  // 원목 벽 + 박공지붕
  box(g, w, H, d, M.wood, 0, y + H / 2, 0);
  for (let i = 1; i < 8; i++) box(g, w + 0.02, 0.025, d + 0.02, M.woodDark, 0, y + i * H / 8, 0);
  const roof = new THREE.Shape(); roof.moveTo(-w / 2 - 0.35, 0); roof.lineTo(0, 1.25); roof.lineTo(w / 2 + 0.35, 0); roof.lineTo(-w / 2 - 0.35, 0);
  const rg = new THREE.ExtrudeGeometry(roof, { depth: d + 0.5, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.5) / 2);
  const r = new THREE.Mesh(rg, M.roofDark); r.position.y = y + H; g.add(r);
  // 큰 유리창 (안쪽 불빛) + 창살, 문
  box(g, w * 0.5, H * 0.5, 0.04, M.window, -w * 0.18, y + H * 0.55, d / 2 + 0.01);
  box(g, 0.06, H * 0.5, 0.06, M.woodDark, -w * 0.18, y + H * 0.55, d / 2 + 0.03);
  box(g, w * 0.5 + 0.1, 0.07, 0.06, M.woodDark, -w * 0.18, y + H * 0.3, d / 2 + 0.03);
  box(g, 0.8, 1.7, 0.04, M.door, s.door, y + 0.85, d / 2 + 0.01);
  box(g, 0.95, 0.08, 0.08, M.woodDark, s.door, y + 1.74, d / 2 + 0.03);
  // 크림·갈색 줄무늬 차양
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.6), new THREE.MeshLambertMaterial({ map: stripeTex('#e8dcc6', '#7a4a2e'), side: THREE.DoubleSide }));
  aw.position.set(-w * 0.18, y + H * 0.88, d / 2 + 0.28); aw.rotation.x = -0.9; g.add(aw);
  // 간판
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.42), new THREE.MeshBasicMaterial({ map: signTex('구름 카페', '#3a2418', '#ffe2b0') }));
  sign.position.set(0, y + H + 0.45, d / 2 + 0.27); g.add(sign);
  // 지붕 위 커다란 커피잔 (상징물)
  const cup = new THREE.Group(); cup.position.set(0, y + H + 1.35, 0); g.add(cup);
  cyl(cup, 0.62, 0.46, 0.85, M.cream, 0, 0.42, 0, 20);
  cyl(cup, 0.6, 0.53, 0.26, M.brown, 0, 0.48, 0, 20);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.58, 20), lam(0x3a2214)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.82; cup.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI * 1.2), M.cream); handle.position.set(0.66, 0.45, 0); handle.rotation.z = -Math.PI * 0.6; cup.add(handle);
  cyl(cup, 0.95, 0.85, 0.08, M.cream, 0, 0.0, 0, 22);
  return { g };
}

function kimbap(s: Shop, y: number) {
  const g = new THREE.Group(); base(g, s, y);
  const { w, d } = s, H = 1.9;
  // 가판대 몸체: 아래 나무 + 위 불빛 칸 + 카운터
  box(g, w, H, d, M.woodLight, 0, y + H / 2, 0);
  box(g, w - 0.3, 0.8, 0.04, M.window, 0, y + 1.25, d / 2 + 0.01);
  box(g, w + 0.25, 0.08, 0.5, lam(0xc9a070), 0, y + 0.85, d / 2 + 0.2);
  // 카운터 위 은박 김밥 더미 + 썰어 둔 김밥
  for (let i = 0; i < 6; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8), M.foil); k.rotation.z = Math.PI / 2; k.position.set(-1.2 + (i % 3) * 0.3, y + 0.95 + Math.floor(i / 3) * 0.11, d / 2 + 0.2); g.add(k); }
  for (let i = 0; i < 6; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), [M.nori, M.rice, M.rice]); k.rotation.x = Math.PI / 2; k.position.set(0.4 + i * 0.15, y + 0.96, d / 2 + 0.25); g.add(k); }
  // 주황 줄무늬 천막 (앞으로 비스듬히)
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, 1.0), new THREE.MeshLambertMaterial({ map: stripeTex('#e86a2a', '#f4efe2', 10), side: THREE.DoubleSide }));
  aw.position.set(0, y + H + 0.1, d / 2 + 0.4); aw.rotation.x = -1.0; g.add(aw);
  for (const sx of [-1, 1]) box(g, 0.07, H + 0.3, 0.07, M.woodDark, sx * (w / 2 + 0.2), y + (H + 0.3) / 2, d / 2 + 0.8);
  box(g, w + 0.2, 0.12, d + 0.2, M.roofDark, 0, y + H + 0.06, 0);
  // 빨간 간판
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.45), new THREE.MeshBasicMaterial({ map: signTex('천왕 김밥', '#e8532a', '#fff6e6') }));
  sign.position.set(0, y + H + 0.55, d / 2 - 0.1); g.add(sign);
  box(g, 2.15, 0.5, 0.06, M.woodDark, 0, y + H + 0.55, d / 2 - 0.15);
  // 지붕 위 커다란 김밥 (양쪽 끝 단면이 보이게 가로로 눕힘)
  const cut = canvasTex(256, 256, c => {
    c.fillStyle = '#16221a'; c.beginPath(); c.arc(128, 128, 128, 0, 7); c.fill();
    c.fillStyle = '#f6f1e4'; c.beginPath(); c.arc(128, 128, 106, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 160; i++) { const a = Math.random() * 7, r = Math.random() * 100; c.fillRect(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 4, 3); }
    ([['#e9a33a', 128, 80], ['#3f8a46', 84, 130], ['#d2493c', 172, 136], ['#f2d04a', 128, 176], ['#8a5a3a', 128, 128]] as const).forEach(([col, x, yy]) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, yy, 22, 18, 0, 0, 7); c.fill(); });
  });
  const capM = new THREE.MeshLambertMaterial({ map: cut });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 20), [M.nori, capM, capM]);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, y + H + 1.25, -0.1); g.add(roll);
  for (let i = -2; i <= 2; i++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.03, 20, 1, true), lam(0x2a3a2a)); band.rotation.z = Math.PI / 2; band.position.set(i * 0.5, y + H + 1.25, -0.1); g.add(band); }
  box(g, 0.08, 0.6, 0.08, M.woodDark, -0.8, y + H + 0.5, -0.1); box(g, 0.08, 0.6, 0.08, M.woodDark, 0.8, y + H + 0.5, -0.1);
  return { g };
}

function jumak(s: Shop, y: number) {
  const g = new THREE.Group(); base(g, s, y);
  const { w, d } = s, H = 2.0;
  // 흰 흙벽 + 나무 기둥 + 창호지 문
  box(g, w, H, d, M.wall, 0, y + H / 2, 0);
  for (const fx of [-0.5, -0.17, 0.17, 0.5]) box(g, 0.14, H, 0.14, M.pillar, fx * w, y + H / 2, d / 2 + 0.02);
  box(g, w + 0.1, 0.12, 0.14, M.pillar, 0, y + H - 0.06, d / 2 + 0.02);
  const paper = canvasTex(128, 192, c => { c.fillStyle = '#ffdf9e'; c.fillRect(0, 0, 128, 192); c.strokeStyle = '#5a3a24'; c.lineWidth = 6; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 48); c.lineTo(128, i * 48); c.stroke(); } for (let i = 0; i <= 2; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 192); c.stroke(); } });
  const pm = new THREE.MeshBasicMaterial({ map: paper });
  for (const dx of [-0.42, 0.42]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), pm); p.position.set(dx, y + 0.85, d / 2 + 0.03); g.add(p); }
  // 초가지붕: 둥글고 두툼한 볏짚
  const roof = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.thatch);
  roof.scale.set(w / 2 + 0.7, 0.95, d / 2 + 0.7); roof.position.y = y + H - 0.05; g.add(roof);
  for (const k of [0.45, 0.8]) { const rope = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 4, 24), lam(0x6a4a24)); rope.rotation.x = Math.PI / 2; rope.scale.set((w / 2 + 0.75) * Math.cos(Math.asin(k)) + 0.02, (d / 2 + 0.75) * Math.cos(Math.asin(k)) + 0.02, 1); rope.position.y = y + H - 0.05 + 0.95 * k; g.add(rope); }
  // 간판 (처마 아래)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex('산 막걸리', '#3a2418', '#ffe2b0') }));
  sign.position.set(0, y + H + 0.1, d / 2 + 0.6); g.add(sign);
  // 酒 등불 둘 (빨강·흰)
  const lanterns: THREE.Mesh[] = [];
  for (const [dx, bg, fg] of [[-1, '#d8402a', '#fff0d0'], [1, '#f4ece0', '#c8302a']] as const) {
    const tex = canvasTex(128, 128, c => { c.fillStyle = bg; c.fillRect(0, 0, 128, 128); c.fillStyle = fg; c.font = '900 70px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('酒', 64, 68); });
    const lt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12), new THREE.MeshBasicMaterial({ map: tex }));
    lt.position.set(dx * (w / 2 - 0.25), y + H - 0.45, d / 2 + 0.45); g.add(lt); lanterns.push(lt);
  }
  // 막걸리 깃발 (장대) + 노란 양은 주전자 (상징물)
  const px = -w / 2 - 0.9;
  cyl(g, 0.05, 0.06, 4.6, M.woodDark, px, y + 2.3, d / 2, 6);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.7), new THREE.MeshLambertMaterial({ map: canvasTex(128, 288, c => { c.fillStyle = '#f4ece0'; c.fillRect(0, 0, 128, 288); c.fillStyle = '#3a2418'; c.font = '900 72px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; ['막', '걸', '리'].forEach((t, i) => c.fillText(t, 64, 82 + i * 86)); }), side: THREE.DoubleSide }));
  flag.position.set(px + 0.42, y + 3.5, d / 2); g.add(flag);
  const kettle = new THREE.Group(); kettle.position.set(0.3, y + H + 1.15, 0.2); kettle.scale.setScalar(2.3); g.add(kettle);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), M.kettle); body.scale.y = 0.82; kettle.add(body);
  cyl(kettle, 0.17, 0.2, 0.08, M.kettle, 0, 0.24, 0); cyl(kettle, 0.05, 0.05, 0.06, M.kettle, 0, 0.3, 0, 8);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.38, 8), M.kettle); spout.position.set(0.32, 0.1, 0); spout.rotation.z = -0.9; kettle.add(spout);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), M.kettle); hd.position.y = 0.22; kettle.add(hd);
  // 평상 + 소반 (파전·사발)
  const ps = new THREE.Group(); g.add(ps);
  const pgy = mountainY(...worldOf(s, PYEONGSANG.lx, PYEONGSANG.lz), 'jirisan') - y;
  box(ps, PYEONGSANG.w, 0.1, PYEONGSANG.d, M.woodLight, PYEONGSANG.lx, y + pgy + PYEONGSANG.h, PYEONGSANG.lz);
  for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ps, 0.1, PYEONGSANG.h, 0.1, M.woodDark, PYEONGSANG.lx + ax * (PYEONGSANG.w / 2 - 0.1), y + pgy + PYEONGSANG.h / 2, PYEONGSANG.lz + az * (PYEONGSANG.d / 2 - 0.1));
  const top = y + pgy + PYEONGSANG.h + 0.05;
  cyl(ps, 0.42, 0.42, 0.05, lam(0x8a3a22), PYEONGSANG.lx, top + 0.2, PYEONGSANG.lz + 0.15, 16);
  for (const a of [0, 1, 2, 3]) cyl(ps, 0.025, 0.025, 0.2, lam(0x5a2416), PYEONGSANG.lx + Math.cos(a * 1.57 + 0.78) * 0.3, top + 0.1, PYEONGSANG.lz + 0.15 + Math.sin(a * 1.57 + 0.78) * 0.3, 5);
  cyl(ps, 0.2, 0.2, 0.03, lam(0xe8b04a), PYEONGSANG.lx - 0.12, top + 0.24, PYEONGSANG.lz + 0.15, 14);
  cyl(ps, 0.09, 0.06, 0.08, lam(0xf0eadc), PYEONGSANG.lx + 0.2, top + 0.27, PYEONGSANG.lz + 0.2, 10);
  return { g, lanterns };
}


/** 의자 + 테이블 (가게 쪽 좌표) */
function chairs(g: THREE.Group, s: Shop, y: number, style: 'wood' | 'plastic') {
  for (let i = 0; i < s.seats.length; i += 2) {
    const a = s.seats[i], b = s.seats[i + 1];
    if (a.kind !== 'chair') continue;
    const tx = (a.lx + b.lx) / 2, tz = a.lz, gy = mountainY(...worldOf(s, tx, tz), 'jirisan') - y;
    if (style === 'wood') { cyl(g, 0.5, 0.5, 0.06, M.woodLight, tx, y + gy + 0.74, tz, 16); cyl(g, 0.05, 0.08, 0.74, M.woodDark, tx, y + gy + 0.37, tz, 6); }
    else { box(g, 1.0, 0.05, 0.7, M.red, tx, y + gy + 0.66, tz); for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.04, 0.66, 0.04, M.red, tx + ax * 0.45, y + gy + 0.33, tz + az * 0.3); }
    for (const [k, st] of [[0, a], [1, b]] as const) {
      const cy = mountainY(...worldOf(s, st.lx, st.lz), 'jirisan') - y;
      if (style === 'wood') {
        box(g, 0.45, 0.06, 0.45, M.wood, st.lx, y + cy + 0.42, st.lz);
        const back = box(g, 0.06, 0.5, 0.45, M.wood, st.lx + (k ? 0.2 : -0.2), y + cy + 0.7, st.lz); void back;
        for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.04, 0.42, 0.04, M.woodDark, st.lx + ax * 0.18, y + cy + 0.21, st.lz + az * 0.18);
      } else {
        cyl(g, 0.2, 0.17, 0.42, k ? M.red : M.blue, st.lx, y + cy + 0.21, st.lz, 12);
      }
    }
    // 테이블 위 작은 것 (컵·은박 김밥)
    const top = y + gy + (style === 'wood' ? 0.78 : 0.7);
    if (style === 'wood') cyl(g, 0.06, 0.05, 0.12, M.cream, tx + 0.1, top + 0.06, tz, 10);
    else { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8), M.foil); k.rotation.z = Math.PI / 2; k.position.set(tx, top + 0.05, tz); g.add(k); }
  }
}

/** 줄 전구 (카페 테라스) */
function stringLights(g: THREE.Group, GLOW: THREE.Texture, pts: THREE.Vector3[]) {
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.01, 4), M.woodDark));
  const bulbs: THREE.Sprite[] = [];
  for (let i = 1; i < 12; i++) {
    const p = curve.getPoint(i / 12);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), glow(0xfff2c8)); b.position.copy(p); b.position.y -= 0.05; g.add(b);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })); sp.scale.setScalar(0.6); sp.position.copy(b.position); g.add(sp); bulbs.push(sp);
  }
  return bulbs;
}

export function createShops(parent: THREE.Group, GLOW: THREE.Texture) {
  const g = new THREE.Group(); parent.add(g);
  const steam: THREE.Sprite[] = [], warm: THREE.Sprite[] = [];
  let lanterns: THREE.Mesh[] = [], bulbs: THREE.Sprite[] = [];
  const steamM = new THREE.SpriteMaterial({ map: GLOW, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.35 });
  for (const s of SHOPS) {
    const y = mountainY(s.x, s.z, 'jirisan') + 0.05;
    const holder = new THREE.Group(); holder.position.set(s.x, 0, s.z); holder.rotation.y = s.ry; g.add(holder);
    if (s.id === 'cafe') {
      const c = cafe(s, y); holder.add(c.g); chairs(c.g, s, y, 'wood');
      for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(steamM.clone()); sp.position.set(-0.2 + i * 0.15, y + 2.3 + 1.35 + 0.9, 0); sp.userData.k = i / 4; sp.userData.base = sp.position.clone(); c.g.add(sp); steam.push(sp); }
      bulbs = stringLights(c.g, GLOW, [new THREE.Vector3(s.w / 2, y + 2.0, s.d / 2), new THREE.Vector3(3.4, y + 1.85, 1.8), new THREE.Vector3(4.6, y + 2.1, 0), new THREE.Vector3(3.4, y + 1.85, -1.9)]);
    } else if (s.id === 'kimbap') {
      const c = kimbap(s, y); holder.add(c.g); chairs(c.g, s, y, 'plastic');
    } else {
      const c = jumak(s, y); holder.add(c.g); lanterns = c.lanterns;
    }
    // 문 앞 따뜻한 불빛 (들어가는 곳 표시)
    const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    w.scale.set(2.2, 2.2, 1); w.position.set(s.door, y + 0.9, s.d / 2 + 0.5); holder.add(w); warm.push(w);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 28), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.door, mountainY(...worldOf(s, s.door, s.d / 2 + 0.7), 'jirisan') + 0.04, s.d / 2 + 0.7); holder.add(ring); ring.userData.ring = true;
    warm.push(ring as unknown as THREE.Sprite);
  }
  return {
    group: g,
    update(t: number, night: number) {
      const tt = t / 1000;
      for (const sp of steam) {
        const k = (tt * 0.25 + sp.userData.k) % 1, b = sp.userData.base as THREE.Vector3;
        sp.position.set(b.x + Math.sin(tt + sp.userData.k * 6) * 0.15, b.y + k * 1.6, b.z);
        sp.scale.setScalar(0.5 + k * 1.2); sp.material.opacity = 0.4 * (1 - k) * (1 - night * 0.5);
      }
      const on = 0.35 + night * 0.65; // 밤·새벽일수록 불빛이 또렷
      for (const w of warm) { const m = (w as unknown as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = (w.userData.ring ? 0.35 + 0.25 * Math.sin(tt * 2.4) : 0.55) * (w.userData.ring ? 1 : on); }
      for (const b of bulbs) b.material.opacity = 0.25 + 0.6 * on;
      for (const [i, l] of lanterns.entries()) l.rotation.y = Math.sin(tt * 0.8 + i) * 0.12;
    },
  };
}
