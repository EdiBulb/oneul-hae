import * as THREE from 'three';
import { CARTS, MARKET, MARKET_STALLS, MYEONGDONG, STAGE } from './beach-extras';
import { textSprite } from './character';

// 서울 지하철역 장소들: 광장시장(종로5가), 명동, 홍대입구
// 실제 장소의 분위기만 빌린 일반적인 모습 (특정 가게·상표·사람은 넣지 않음)

const M = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b;
};
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, seg = 14) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); parent.add(c); return c;
};
const pick = <T,>(a: readonly T[], i: number) => a[((i % a.length) + a.length) % a.length];

/** 간판: 색 바탕에 글자 (밤에도 밝게 보이도록 조명 영향을 받지 않는 재질) */
function sign(text: string, bg: string, fg: string, w: number, h: number, font = 'Noto Sans KR') {
  const c = document.createElement('canvas'); c.width = Math.round(256 * w / h); c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 10; g.strokeRect(10, 10, c.width - 20, c.height - 20);
  let size = 150; g.font = `800 ${size}px "${font}", sans-serif`;
  while (g.measureText(text).width > c.width - 60 && size > 40) { size -= 8; g.font = `800 ${size}px "${font}", sans-serif`; }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 8);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
function windows() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 12) for (let x = 4; x < 64; x += 10) {
    g.fillStyle = Math.random() < 0.6 ? '#ffe2a8' : '#8ea2bd'; g.fillRect(x, y, 6, 7);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const WIN = windows();
/** 건물: 창문 무늬 + 벽 색 */
function building(w: number, h: number, d: number, color: number, x: number, z: number, parent: THREE.Object3D) {
  const tex = WIN.clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 4)));
  const wall = new THREE.MeshLambertMaterial({ color, map: tex });
  const top = M(color);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, top, top, wall, wall]);
  b.position.set(x, h / 2, z); parent.add(b); return b;
}
/** 바다를 덮는 바깥 땅 */
function farGround(g: THREE.Object3D, color: number) {
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), M(color)); far.rotation.x = -Math.PI / 2; far.position.set(0, 0.005, -450); g.add(far);
}
/** 가게 주인·버스커 같은 동네 사람 (캐릭터와 비슷한 비율) */
function figure(body: number, hat: number, apron?: number) {
  const c = new THREE.Group();
  cyl(0.27, 0.34, 0.8, M(body), 0, 0.65, 0, c, 10);
  if (apron) box(0.36, 0.5, 0.04, M(apron), 0, 0.55, -0.33, c);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), M(0xf0d2b6)); head.position.y = 1.32; c.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(hat)); cap.position.y = 1.38; c.add(cap);
  const arm = new THREE.Group(); arm.position.set(0.32, 0.95, 0); c.add(arm);
  cyl(0.07, 0.07, 0.5, M(body), 0, -0.25, 0, arm, 8);
  c.userData.arm = arm;
  return c;
}
/** 매달린 전구 (밤에 빛남) */
function bulbs(g: THREE.Object3D, GLOW: THREE.Texture, pts: [number, number, number][], color = 0xffd27a) {
  const out: THREE.Sprite[] = [];
  const bulbM = new THREE.MeshBasicMaterial({ color });
  for (const [x, y, z] of pts) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbM); b.position.set(x, y, z); g.add(b);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    s.scale.setScalar(0.9); s.position.set(x, y, z); g.add(s); out.push(s);
  }
  return out;
}
function steamPuffs(g: THREE.Object3D, GLOW: THREE.Texture, x: number, y: number, z: number, n = 3) {
  const out: { s: THREE.Sprite; y: number; ph: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.25 }));
    s.position.set(x + (i - 1) * 0.25, y, z); g.add(s); out.push({ s, y, ph: i / n });
  }
  return out;
}
function animSteam(list: { s: THREE.Sprite; y: number; ph: number }[], t: number) {
  for (const p of list) {
    const k = (t / 2200 + p.ph) % 1;
    p.s.position.y = p.y + k * 0.9; p.s.scale.setScalar(0.3 + k * 0.7);
    p.s.material.opacity = 0.32 * (1 - k);
  }
}

// ---------- 광장시장 (종로5가) ----------
// 반투명 아치 지붕이 덮인 먹자골목. 양옆 노점 12곳마다 간판·메뉴판·조명·의자, 음식은 가게마다 다름.
/** 두 줄 간판: 위 한국어 크게, 아래 영어 작게 */
function sign2(ko: string, en: string, bg: string, fg: string, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = Math.round(256 * w / h); c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 8; g.strokeRect(12, 12, c.width - 24, c.height - 24);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 130; g.font = `900 ${size}px "Noto Sans KR", sans-serif`;
  while (g.measureText(ko).width > c.width - 70 && size > 40) { size -= 6; g.font = `900 ${size}px "Noto Sans KR", sans-serif`; }
  g.fillText(ko, c.width / 2, 100);
  g.font = '700 54px "Noto Sans KR", sans-serif'; g.globalAlpha = 0.9; g.fillText(en, c.width / 2, 200);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
/** 칠판 메뉴판 */
function menuBoard(lines: string[]) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#23372c'; g.fillRect(14, 14, 228, 292);
  g.fillStyle = '#f3efe2'; g.textAlign = 'center';
  g.font = '800 40px "Noto Sans KR", sans-serif'; g.fillText('메뉴', 128, 66);
  g.fillStyle = 'rgba(243,239,226,.5)'; g.fillRect(50, 84, 156, 3);
  g.fillStyle = '#f3efe2'; g.font = '700 34px "Noto Sans KR", sans-serif';
  lines.forEach((l, i) => g.fillText(l, 128, 140 + i * 58));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshLambertMaterial({ map: tex }));
}
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** 가게 카운터 위 음식 진열 (가게 좌표계: x는 골목 쪽이 -side, 카운터 윗면 y=0.95) */
function counterFood(food: number, s: THREE.Group, side: number, GLOW: THREE.Texture, steam: ReturnType<typeof steamPuffs>, world: THREE.Object3D, wx: number, wz: number) {
  const top = 0.95, x0 = 0.05 * side;
  const tray = (c: number, w = 0.8, d = 0.9, z = 0) => box(w, 0.05, d, M(c), x0, top + 0.025, z, s);
  const puff = (z: number, n = 2, y = 0.25) => steam.push(...steamPuffs(world, GLOW, wx, top + y, wz + z, n));
  switch (food) {
    case 1: { // 빈대떡 철판
      box(0.9, 0.06, 1.6, M(0x2a2725), x0, top + 0.03, -0.3, s);
      for (let i = 0; i < 4; i++) cyl(0.2, 0.2, 0.04, M(0xd9a441), x0 + (i % 2 - 0.5) * 0.4, top + 0.08, -0.85 + Math.floor(i / 2) * 0.5, s, 16);
      cyl(0.18, 0.16, 0.3, M(0xb8b2a6), x0, top + 0.15, 0.85, s, 14); // 녹두 반죽 통
      cyl(0.16, 0.16, 0.02, M(0xe4d18a), x0, top + 0.31, 0.85, s, 14);
      puff(-0.5, 3); break;
    }
    case 2: { // 떡볶이 큰 철판
      box(0.9, 0.12, 1.4, M(0x2f2f2f), x0, top + 0.06, -0.2, s);
      box(0.82, 0.03, 1.3, M(0xd8401f), x0, top + 0.12, -0.2, s);
      for (let i = 0; i < 22; i++) { const r = cyl(0.03, 0.03, 0.16, M(0xf2d9c4), x0 - 0.3 + (i % 5) * 0.15, top + 0.15, -0.75 + Math.floor(i / 5) * 0.28, s, 6); r.rotation.z = Math.PI / 2; r.rotation.y = i; }
      tray(0xf0d58a, 0.6, 0.5, 0.75); for (let i = 0; i < 6; i++) box(0.12, 0.06, 0.16, M(0xd9a23f), x0 - 0.15 + (i % 3) * 0.15, top + 0.08, 0.65 + Math.floor(i / 3) * 0.2, s);
      puff(-0.2); break;
    }
    case 3: { // 마약김밥 산더미
      tray(0xe9e2d3, 0.8, 1.6);
      for (let i = 0; i < 40; i++) { const r = cyl(0.04, 0.04, 0.1, M(0x1d2a21), x0 - 0.28 + (i % 6) * 0.11, top + 0.08 + Math.floor(i / 24) * 0.07, -0.6 + (Math.floor(i / 6) % 4) * 0.36, s, 8); r.rotation.x = Math.PI / 2; }
      for (const z of [0.55, 0.75]) { cyl(0.06, 0.05, 0.04, M(0xffffff), x0, top + 0.05, z + 0.1, s, 10); cyl(0.05, 0.05, 0.01, M(0xe8c23a), x0, top + 0.075, z + 0.1, s, 10); }
      break;
    }
    case 4: { // 모둠전 진열대
      tray(0xd7cbb2, 0.85, 1.9);
      const cols = [0xe2b54a, 0x7fb25a, 0xd9822f, 0xe8cf7a, 0xc95b3a];
      for (let i = 0; i < 25; i++) { const j = cyl(0.07, 0.07, 0.03, M(cols[i % 5]), x0 - 0.3 + (i % 5) * 0.15, top + 0.07 + (i % 2) * 0.02, -0.8 + Math.floor(i / 5) * 0.4, s, 10); j.scale.z = 0.75; }
      break;
    }
    case 5: { // 칼국수: 큰 솥 + 반죽 밀대
      cyl(0.32, 0.3, 0.45, M(0xa8acb0), x0, top + 0.22, -0.5, s, 18);
      cyl(0.3, 0.3, 0.02, M(0xe8dcbf), x0, top + 0.44, -0.5, s, 18);
      box(0.7, 0.04, 0.8, M(0xcfb58a), x0, top + 0.02, 0.5, s);
      box(0.5, 0.03, 0.5, M(0xf2ebd8), x0, top + 0.055, 0.5, s);
      const pin = cyl(0.03, 0.03, 0.6, M(0xb68c58), x0, top + 0.1, 0.5, s, 8); pin.rotation.x = Math.PI / 2;
      puff(-0.5, 3, 0.5); break;
    }
    case 6: { // 육회 접시들
      for (let i = 0; i < 4; i++) {
        const z = -0.9 + i * 0.6;
        cyl(0.2, 0.16, 0.03, M(0xffffff), x0, top + 0.02, z, s, 16);
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb32a36)); m.scale.y = 0.6; m.position.set(x0, top + 0.035, z); s.add(m);
        const y = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M(0xf2b632)); y.position.set(x0, top + 0.1, z); s.add(y);
      }
      break;
    }
    case 7: { // 순대 찜기
      cyl(0.35, 0.35, 0.3, M(0x8d9298), x0, top + 0.15, -0.4, s, 18);
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.07, 0.04, 8, 20), M(0x3a2626)); t.rotation.x = Math.PI / 2; t.position.set(x0, top + 0.33, -0.4); s.add(t); }
      box(0.6, 0.04, 0.5, M(0xcfb58a), x0, top + 0.02, 0.6, s);
      for (let i = 0; i < 6; i++) { const r = cyl(0.04, 0.04, 0.03, M(0x3a2626), x0 - 0.15 + i * 0.06, top + 0.06, 0.6, s, 10); r.rotation.z = Math.PI / 2; }
      puff(-0.4, 3, 0.4); break;
    }
    case 8: { // 꿀떡·인절미 쟁반
      const cols = [0xf6b5c8, 0xffffff, 0xa9d98a, 0xf4e18a];
      for (let t = 0; t < 3; t++) {
        const z = -0.8 + t * 0.8; box(0.7, 0.04, 0.65, M(0x8a6a44), x0, top + 0.02, z, s);
        for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(t === 1 ? 0xd9bf7a : cols[(i + t) % 4])); b.position.set(x0 - 0.22 + (i % 4) * 0.15, top + 0.08, z - 0.22 + Math.floor(i / 4) * 0.15); if (t === 1) b.scale.set(1.3, 0.7, 1); s.add(b); }
      }
      break;
    }
    case 9: { // 꽈배기 쟁반 + 튀김 냄비
      box(0.75, 0.04, 1.0, M(0xe8dcc0), x0, top + 0.02, -0.4, s);
      for (let i = 0; i < 10; i++) { const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.05, 0.025, 32, 6, 2, 3), M(0xd59a45)); k.scale.set(0.8, 0.8, 2.2); k.rotation.x = Math.PI / 2; k.position.set(x0 - 0.22 + (i % 4) * 0.15, top + 0.08, -0.8 + Math.floor(i / 4) * 0.3); s.add(k); }
      cyl(0.28, 0.25, 0.25, M(0x333333), x0, top + 0.12, 0.6, s, 16); cyl(0.26, 0.26, 0.02, M(0xc9902a), x0, top + 0.24, 0.6, s, 16);
      puff(0.6, 2, 0.35); break;
    }
    case 10: { // 식혜 냉장 진열장
      box(0.8, 0.8, 1.2, M(0xd8eef8, { transparent: true, opacity: 0.35 }), x0, top + 0.4, -0.2, s);
      for (let i = 0; i < 12; i++) { cyl(0.06, 0.05, 0.15, M(i % 3 === 2 ? 0x8a4a2a : 0xf0e3c2), x0 - 0.2 + (i % 3) * 0.2, top + 0.1 + Math.floor(i / 6) * 0.35, -0.6 + (Math.floor(i / 3) % 2) * 0.35, s, 10); }
      cyl(0.2, 0.2, 0.5, M(0xb9bec4), x0, top + 0.25, 0.75, s, 14); // 식혜 통
      break;
    }
    case 11: { // 잡채 큰 쟁반
      cyl(0.45, 0.42, 0.06, M(0xc0c4c8), x0, top + 0.03, -0.3, s, 20);
      for (let i = 0; i < 30; i++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.08 + (i % 4) * 0.05, 0.008, 4, 16), M(0x8a5a35)); n.rotation.x = Math.PI / 2 + (i % 3 - 1) * 0.2; n.position.set(x0 + Math.cos(i) * 0.15, top + 0.08 + (i % 3) * 0.015, -0.3 + Math.sin(i) * 0.15); s.add(n); }
      for (let i = 0; i < 14; i++) box(0.06, 0.012, 0.012, M(i % 2 ? 0xe5772c : 0x3e8a3a), x0 + Math.cos(i * 1.7) * 0.25, top + 0.12, -0.3 + Math.sin(i * 1.7) * 0.25, s);
      box(0.6, 0.06, 0.5, M(0x6b3a22), x0, top + 0.03, 0.7, s); // 떡갈비
      break;
    }
    case 12: { // 어묵 국물 통
      box(0.8, 0.2, 1.5, M(0x9aa0a6), x0, top + 0.1, -0.1, s);
      box(0.72, 0.02, 1.42, M(0xd9b07a), x0, top + 0.19, -0.1, s);
      for (let i = 0; i < 14; i++) {
        const z = -0.7 + (i % 7) * 0.2, x = x0 + (i < 7 ? -0.15 : 0.15);
        const st = cyl(0.008, 0.008, 0.5, M(0xe9d3a8), x, top + 0.35, z, s, 4); st.rotation.z = (i < 7 ? 1 : -1) * 0.5;
        const f = box(0.12, 0.05, 0.02, M(0xd99a55), x - (i < 7 ? 1 : -1) * 0.06, top + 0.25, z, s); f.rotation.z = (i < 7 ? 1 : -1) * 0.5;
      }
      puff(-0.1, 3, 0.3); break;
    }
  }
}
function market(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g);
  farGround(g, 0x6f6a62);
  const L = MARKET.front - MARKET.back, zc = (MARKET.front + MARKET.back) / 2;
  // 바닥: 젖은 듯한 타일 줄 + 가운데 배수로
  for (let z = MARKET.back; z < MARKET.front; z += 1.0) { const l = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.03), M(0x6a655d)); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.015, z); g.add(l); }
  const drain = new THREE.Mesh(new THREE.PlaneGeometry(0.3, L), M(0x3e3b37)); drain.rotation.x = -Math.PI / 2; drain.position.set(0, 0.018, zc); g.add(drain);
  for (let z = MARKET.back; z < MARKET.front; z += 0.25) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.04), M(0x5c5852)); gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0.02, z); g.add(gr); }
  // 아치 지붕과 철골
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, L, 24, 1, true, -Math.PI / 2, Math.PI),
    M(0xdfe8e0, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  roof.rotation.x = Math.PI / 2; roof.position.set(0, 3.2, zc); g.add(roof);
  const steel = M(0x51606a);
  for (let z = MARKET.back; z <= MARKET.front; z += 3.2) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.06, 4, 20, Math.PI), steel); rib.position.set(0, 3.2, z); g.add(rib);
  }
  const ridge = box(0.12, 0.12, L, steel, 0, 7.8, zc, g); void ridge;
  // 골목 끝 벽 + 현수막, 바깥 건물
  box(9, 7, 0.4, M(0x8a7e70), 0, 3.5, MARKET.back - 0.2, g);
  const endBanner = sign2('광장시장 먹자골목', 'Gwangjang Market Food Alley', '#f4ead2', '#a8302a', 5, 1.1); endBanner.position.set(0, 4.2, MARKET.back + 0.02); g.add(endBanner);
  for (const sx of [-1, 1]) for (let z = MARKET.back; z < MARKET.front; z += 6) building(6, 7 + ((z * 7) & 3), 6, pick([0x9a8f82, 0x8b8c8f, 0xa59585], z), sx * 8.4, z + 3, g);
  for (let x = -40; x <= 40; x += 9) if (Math.abs(x) > 12) building(8, 8 + (x & 5), 8, pick([0x9d958a, 0x878a90, 0xb3a796], x), x, MARKET.back - 14, g);
  // 노점
  const steam: ReturnType<typeof steamPuffs> = [];
  const vendors: THREE.Group[] = [];
  const lamps: THREE.Sprite[] = [];
  let flip: THREE.Mesh | null = null;
  const stoolM = [M(0xd8392b), M(0x2f6fd0)];
  MARKET_STALLS.forEach((sl, i) => {
    const side = sl.side, z = sl.z;
    const s = new THREE.Group(); s.position.set(side * 2.75, 0, z); g.add(s);
    // 카운터 (앞면 타일) + 뒤 벽 + 선반
    box(1.0, 0.9, 2.9, M(0xb9b0a2), 0, 0.45, 0, s);
    box(0.02, 0.6, 2.8, M(i % 2 ? 0x8fb5c4 : 0xc4b28f), -side * 0.51, 0.45, 0, s);
    box(1.06, 0.06, 2.96, M(0xd8d4cc), 0, 0.92, 0, s);
    box(0.3, 3.0, 3.0, M(0x6e5a45), side * 1.6, 1.5, 0, s);
    for (const dz of [-1.55, 1.55]) box(1.9, 2.6, 0.08, M(0x7d6a55), side * 0.65, 1.3, dz, s); // 옆 가게와의 칸막이
    for (const y of [1.3, 1.85]) {
      box(0.5, 0.05, 2.8, M(0x8a7259), side * 1.35, y, 0, s);
      for (let k = 0; k < 5; k++) cyl(0.09, 0.07, 0.08 + (k % 2) * 0.04, M(k % 3 ? 0xf3f1ec : 0xb9bec4), side * 1.35, y + 0.06, -1.1 + k * 0.55, s, 10); // 그릇 더미
    }
    // 바닥 장독·박스
    for (const dz of [-1.0, 1.1]) { const jar = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), M(0x5a3a26)); jar.scale.y = 1.2; jar.position.set(side * 1.15, 0.26, dz); s.add(jar); cyl(0.12, 0.12, 0.05, M(0x4a2e1e), side * 1.15, 0.53, dz, s, 10); }
    box(0.45, 0.35, 0.45, M(0xc9a46a), side * 1.2, 0.18, 0, s);
    // 차양
    const aw = box(2.4, 0.06, 3.1, M(sl.aw), side * 0.4, 2.68, 0, s); aw.rotation.z = side * 0.19;
    const fr = box(0.04, 0.18, 3.1, M(0xffffff), -side * 0.78, 2.4, 0, s); void fr;
    // 간판: 골목을 향해 (양쪽 끝에서 비스듬히 읽히도록 살짝 입구 쪽으로)
    const sg = sign2(`${sl.emoji} ${sl.ko}`, sl.en, hex(sl.aw), '#fffaf0', 2.7, 0.8);
    sg.position.set(-side * 0.8, 3.1, 0); sg.rotation.y = -side * Math.PI / 2; s.add(sg);
    // 골목 쪽으로 튀어나온 작은 세로 간판 (입구에서 줄지어 보임)
    const fl = sign2(sl.ko, sl.en, '#fff6e0', hex(sl.aw), 1.05, 0.55);
    fl.position.set(-side * 1.15, 3.55, 1.2); s.add(fl);
    const flB = fl.clone(); flB.rotation.y = Math.PI; flB.position.z = 1.19; s.add(flB);
    box(0.03, 0.3, 0.03, M(0x333333), -side * 1.15, 3.95, 1.2, s);
    // 메뉴판 (뒤 벽)
    const mb = menuBoard(sl.menu); mb.position.set(side * 1.44, 2.62, 0.85); mb.rotation.y = -side * Math.PI / 2; s.add(mb);
    // 카운터 위 매달린 등
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 12, 1, true), M(0x2f3a33, { side: THREE.DoubleSide })); shade.position.set(-side * 0.1, 2.1, 0); s.add(shade);
    box(0.01, 0.4, 0.01, M(0x222222), -side * 0.1, 2.38, 0, s);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); bulb.position.set(-side * 0.1, 2.02, 0); s.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc870, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
    glow.scale.setScalar(1.6); glow.position.set(side * 2.65, 1.95, z); g.add(glow); lamps.push(glow);
    // 주인
    const v = figure(pick([0xf3efe6, 0x9fb6d1, 0xe7c7a0, 0xd8a9b8], i), pick([0xf4f1ea, 0xd3423a, 0x3c5a7a, 0x5a8a5a], i + 1), 0xe9e4d8);
    v.position.set(side * 0.85, 0, 0.3); v.rotation.y = side * Math.PI / 2; s.add(v); vendors.push(v);
    // 음식
    counterFood(sl.food, s, side, GLOW, steam, g, side * 2.75, z);
    if (sl.food === 1) { flip = cyl(0.2, 0.2, 0.04, M(0xd9a441), 0.05 * side + 0.2, 1.03, -0.85, s, 16); }
    // 의자 (beach-extras 좌석과 같은 자리)
    for (const dz of i === 0 ? [-1.2, -0.4, 0.4, 1.2] : [-0.6, 0.6]) {
      cyl(0.2, 0.2, 0.06, stoolM[(i + (dz > 0 ? 1 : 0)) % 2], side * 1.75, 0.44, z + dz, g, 12);
      cyl(0.04, 0.05, 0.42, M(0x8a8f94), side * 1.75, 0.21, z + dz, g, 6);
    }
  });
  // 골목 위 전구 줄과 붉은 초롱
  const pts: [number, number, number][] = [];
  for (let z = MARKET.back + 1; z < MARKET.front; z += 1.6) { pts.push([-0.9, 4.4, z]); pts.push([0.9, 4.4, z]); }
  const lights = bulbs(g, GLOW, pts);
  for (let z = MARKET.back + 2; z < MARKET.front; z += 4) for (const x of [-0.5, 0.5]) {
    const ln = cyl(0.18, 0.18, 0.4, M(x < 0 ? 0xd8392b : 0xf0c040, { emissive: x < 0 ? 0x5a1010 : 0x5a4010 }), x, 5.2, z, g, 12);
    box(0.01, 0.6, 0.01, M(0x222222), x, 5.7, z, g); void ln;
  }
  // 입구: 붉은 기둥과 큰 간판, 안쪽에 먹자골목 현수막
  for (const sx of [-1, 1]) box(0.22, 4.6, 0.22, M(0x7a2b22), sx * 2.45, 2.3, MARKET.front + 0.1, g);
  const gate = sign('광장시장 · Gwangjang Market', '#a8302a', '#fff3d6', 4.8, 0.7); gate.position.set(0, 4.5, MARKET.front + 0.15); g.add(gate);
  const back = gate.clone(); back.rotation.y = Math.PI; back.position.z = MARKET.front + 0.05; g.add(back);
  const inner = sign2('먹자골목', 'Food Alley · 12 stalls', '#2f5a3a', '#fff3d6', 2.6, 0.7); inner.position.set(0, 3.6, MARKET.front - 2.5); g.add(inner);
  const innerB = inner.clone(); innerB.rotation.y = Math.PI; innerB.position.z = MARKET.front - 2.51; g.add(innerB);
  return {
    group: g,
    update(_dt: number, t: number, night: number) {
      animSteam(steam, t);
      for (const s of lights) s.material.opacity = 0.08 + 0.6 * night;
      for (const s of lamps) s.material.opacity = 0.22 + 0.5 * night;
      // 주인들이 가끔 손을 움직임 (뒤집기·썰기·담기)
      vendors.forEach((v, i) => { (v.userData.arm as THREE.Group).rotation.x = 0.9 + Math.sin(t / 300 + i * 1.7) * 0.35; });
      // 빈대떡 주인이 5초마다 한 장을 휙 뒤집음
      if (flip) { const k = (t % 5000) / 600; const u = Math.min(1, k); flip.position.y = 1.03 + Math.sin(Math.PI * u) * 0.35; flip.rotation.x = Math.PI * u; }
    },
  };
}

// ---------- 명동 ----------
// 양옆으로 화장품·옷 가게 간판이 가득한 큰길, 가운데 노점 수레, 멀리 남산 위 타워
function myeongdong(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g);
  farGround(g, 0x8e877d);
  // 바닥 보도블록 줄
  for (let z = -40; z < MYEONGDONG.front; z += 1.2) { const l = new THREE.Mesh(new THREE.PlaneGeometry(MYEONGDONG.half * 2, 0.03), M(0x9c958a)); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.02, z); g.add(l); }
  const SIGNS = [
    ['K-BEAUTY', '#e8457a', '#fff'], ['화장품 · COSMETICS', '#ffffff', '#d23a6e'], ['SALE 50%', '#ffde3b', '#c42727'],
    ['카페 · CAFE', '#3b2a22', '#f4d9a8'], ['기념품 · Souvenirs', '#2d6bd1', '#fff'], ['환전 · Exchange', '#1a8a5a', '#fff'],
    ['SKIN CARE', '#7ad1e8', '#0e3a52'], ['옷 · FASHION', '#111111', '#ffffff'], ['MASK PACK', '#f2a3c4', '#5a1d3a'],
    ['안경 · Glasses', '#f07a2a', '#fff'], ['문구 · Stationery', '#8a5ad6', '#fff'], ['양말 · Socks', '#ffc0cb', '#3a2a5a'],
  ] as const;
  const COLORS = [0xd8cfc2, 0xb9bcc2, 0xcab39a, 0xe2ddd2, 0x9fa6ad, 0xc7b7c9];
  let si = 0;
  for (const side of [-1, 1]) {
    for (let z = MYEONGDONG.front - 3, i = 0; z > -60; i++) {
      const w = 5 + ((i * 7 + (side > 0 ? 3 : 0)) % 4), h = 9 + ((i * 13 + side * 5 + 40) % 14);
      const cz = z - w / 2;
      building(6, h, w, pick(COLORS, i + side), side * (MYEONGDONG.half + 3.6), cz, g);
      // 1층 가게 간판 (길 쪽을 봄)
      const [txt, bg, fg] = pick(SIGNS, si++);
      const s = sign(txt, bg, fg, w * 0.8, 0.9); s.position.set(side * (MYEONGDONG.half + 0.55), 3.4, cz); s.rotation.y = -side * Math.PI / 2; g.add(s);
      // 위층 세로 간판 (길 쪽으로 튀어나옴)
      if (i % 2 === 0) {
        const [t2, b2, f2] = pick(SIGNS, si + 5);
        const v = sign(t2, b2, f2, 2.6, 0.7); v.rotation.z = side * Math.PI / 2; v.rotation.y = 0;
        v.position.set(side * (MYEONGDONG.half + 0.1), 6.5 + (i % 3), cz + w / 2 - 0.4); g.add(v);
      }
      // 1층 쇼윈도
      box(0.05, 2.2, w * 0.8, M(0xbfe6ff, { transparent: true, opacity: 0.5, emissive: 0x2a3a48 }), side * (MYEONGDONG.half + 0.58), 1.4, cz, g);
      z -= w;
    }
  }
  // 멀리 남산과 타워
  const hill = new THREE.Mesh(new THREE.ConeGeometry(90, 55, 8), M(0x50684a, { flatShading: true })); hill.position.set(30, 22, -360); g.add(hill);
  const tower = new THREE.Group(); tower.position.set(30, 49, -360); g.add(tower);
  cyl(1.6, 2.6, 30, M(0xe8e8e4), 0, 15, 0, tower, 10);
  cyl(5, 4.2, 4, M(0xd9d9d4), 0, 31, 0, tower, 14);
  cyl(0.5, 0.8, 16, M(0xdc3d3d), 0, 41, 0, tower, 8);
  const towerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff6a8a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  towerGlow.scale.setScalar(26); towerGlow.position.set(30, 80, -360); g.add(towerGlow);
  // 노점 수레
  const steam: ReturnType<typeof steamPuffs> = [];
  const NAMES = { egg: '계란빵 · Egg bread', tteok: '떡볶이 · Tteokbokki', hotteok: '호떡 · Hotteok' } as const;
  for (const c of CARTS) {
    const cart = new THREE.Group(); cart.position.set(c.x, 0, c.z); g.add(cart);
    box(1.1, 0.85, 1.3, M(0xc9c4ba), -0.35, 0.55, 0, cart);
    for (const dz of [-0.5, 0.5]) { const wh = cyl(0.14, 0.14, 0.08, M(0x2a2a2a), -0.92, 0.14, dz, cart, 12); wh.rotation.z = Math.PI / 2; }
    for (const [dx, dz] of [[-0.85, -0.6], [-0.85, 0.6], [0.15, -0.6], [0.15, 0.6]]) box(0.05, 1.3, 0.05, M(0x777777), dx, 1.6, dz, cart);
    box(1.4, 0.08, 1.6, M(c.kind === 'tteok' ? 0xd83a2e : c.kind === 'egg' ? 0xf0b93a : 0x2f8a5a), -0.35, 2.28, 0, cart);
    const top = 0.99;
    if (c.kind === 'tteok') {
      box(0.9, 0.08, 1.1, M(0x333333), -0.35, top, 0, cart);
      box(0.82, 0.03, 1.0, M(0xd8401f), -0.35, top + 0.05, 0, cart);
      for (let i = 0; i < 14; i++) { const r = cyl(0.03, 0.03, 0.16, M(0xf6e9d8), -0.65 + (i % 5) * 0.14, top + 0.08, -0.4 + Math.floor(i / 5) * 0.35, cart, 6); r.rotation.z = Math.PI / 2; }
      steam.push(...steamPuffs(g, GLOW, c.x - 0.35, top + 0.2, c.z));
    } else if (c.kind === 'egg') {
      for (let i = 0; i < 8; i++) box(0.16, 0.1, 0.22, M(0xe4a849), -0.6 + (i % 4) * 0.18, top + 0.05, -0.2 + Math.floor(i / 4) * 0.35, cart);
    } else {
      box(0.9, 0.06, 1.1, M(0x2a2725), -0.35, top, 0, cart);
      for (let i = 0; i < 6; i++) cyl(0.13, 0.13, 0.035, M(0xc98a3a), -0.55 + (i % 2) * 0.4, top + 0.05, -0.35 + Math.floor(i / 2) * 0.35, cart, 14);
      steam.push(...steamPuffs(g, GLOW, c.x - 0.35, top + 0.15, c.z, 2));
    }
    const v = figure(pick([0xf2f0ea, 0x5d7fa8, 0xd7553f], c.z), 0xf4f1ea, 0xe9e4d8); v.position.set(0.55, 0, 0); v.rotation.y = Math.PI / 2; cart.add(v);
    const tag = textSprite(NAMES[c.kind], 0.45); tag.position.set(-0.3, 2.75, 0); cart.add(tag);
  }
  // 길을 가로지르는 전구 줄과 가로등
  const pts: [number, number, number][] = [];
  for (let z = -36; z < MYEONGDONG.front; z += 6) for (let x = -MYEONGDONG.half; x <= MYEONGDONG.half; x += 1.5) pts.push([x, 6.2 - Math.cos((x / MYEONGDONG.half) * Math.PI / 2) * 0.6, z]);
  const lights = bulbs(g, GLOW, pts, 0xfff0c0);
  return {
    group: g,
    update(_dt: number, t: number, night: number) {
      animSteam(steam, t);
      for (const s of lights) s.material.opacity = 0.04 + 0.6 * night;
      towerGlow.material.opacity = 0.75 * night;
    },
  };
}

// ---------- 홍대 ----------
// 버스킹 무대와 벽화, 네온 간판. 버스커가 1분에 45초씩 연주하고 15초 쉼
function graffiti() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3a44'; g.fillRect(0, 0, 1024, 256);
  const cols = ['#ff4f8b', '#ffd23f', '#3bceac', '#4f7cff', '#ff8a3d', '#b05cff', '#ffffff'];
  for (let i = 0; i < 40; i++) {
    g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85;
    g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 256, 20 + Math.random() * 70, 14 + Math.random() * 40, Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 14; i++) { g.strokeStyle = cols[(i * 3) % cols.length]; g.lineWidth = 6; g.beginPath(); g.moveTo(Math.random() * 1024, Math.random() * 256); g.bezierCurveTo(Math.random() * 1024, Math.random() * 256, Math.random() * 1024, Math.random() * 256, Math.random() * 1024, Math.random() * 256); g.stroke(); }
  g.font = '900 150px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 18; g.strokeStyle = '#111'; g.strokeText('HONGDAE', 512, 135);
  g.fillStyle = '#ffe14f'; g.fillText('HONGDAE', 512, 135);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hongdae(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g);
  farGround(g, 0x7f7a76);
  const wallZ = STAGE.z - STAGE.d / 2 - 1.4;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(22, 4.2, 0.4), [M(0x3a3a44), M(0x3a3a44), M(0x3a3a44), M(0x3a3a44), new THREE.MeshLambertMaterial({ map: graffiti() }), M(0x3a3a44)]);
  wall.position.set(0, 2.1, wallZ); g.add(wall);
  // 뒤와 옆 건물 + 네온 간판
  const NEON = [['LIVE', '#ff2e88'], ['노래방 · Karaoke', '#3be0ff'], ['PHOTO', '#ffe14f'], ['카페 · CAFE', '#a1ff5c'], ['BAR', '#ff8a3d'], ['BOOKS', '#c58bff']] as const;
  let ni = 0;
  for (let x = -30; x <= 30; x += 8) {
    const h = 9 + ((x * 3 + 60) % 7);
    building(7.6, h, 8, pick([0x5a5560, 0x6b6470, 0x4f5660, 0x725e5e], x), x, wallZ - 6, g);
    const [txt, col] = pick(NEON, ni++);
    const s = sign(txt, '#16131c', col, 4, 1.1); s.position.set(x, 6 + (ni % 3), wallZ - 1.95); g.add(s);
  }
  for (const sx of [-1, 1]) for (let z = wallZ + 2; z < 20; z += 8) {
    building(8, 10 + ((z * 5) & 7), 7.6, pick([0x625b66, 0x52606a, 0x6c5f58], z + sx), sx * 26, z + 4, g);
    const [txt, col] = pick(NEON, ni++);
    const s = sign(txt, '#16131c', col, 4, 1.1); s.position.set(sx * 21.9, 5, z + 4); s.rotation.y = -sx * Math.PI / 2; g.add(s);
  }
  // 무대
  const st = new THREE.Group(); st.position.set(STAGE.x, 0, STAGE.z); g.add(st);
  box(STAGE.w, STAGE.h, STAGE.d, M(0x3b2f28), 0, STAGE.h / 2, 0, st);
  box(STAGE.w + 0.1, 0.05, STAGE.d + 0.1, M(0x5a4636), 0, STAGE.h, 0, st);
  for (const sx of [-1, 1]) {
    box(0.7, 1.2, 0.6, M(0x161616), sx * 2.8, STAGE.h + 0.6, -0.4, st);
    for (const y of [0.35, 0.85]) { const cone = cyl(0.2, 0.2, 0.02, M(0x444444), sx * 2.8, STAGE.h + y, -0.09, st, 14); cone.rotation.x = Math.PI / 2; }
  }
  cyl(0.02, 0.02, 1.4, M(0x222222), 0.6, STAGE.h + 0.7, 0.7, st, 6);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M(0x333333)); mic.position.set(0.6, STAGE.h + 1.42, 0.7); st.add(mic);
  const busker = figure(0x2c2c34, 0x9a3a3a); busker.position.set(0, STAGE.h, 0.2); st.add(busker);
  const guitar = new THREE.Group(); guitar.position.set(0, 0.7, -0.3); guitar.rotation.z = -0.5; busker.add(guitar);
  box(0.4, 0.5, 0.12, M(0xc07a3a), 0, 0, 0, guitar);
  box(0.07, 0.6, 0.05, M(0x5a3a22), 0, 0.5, 0, guitar);
  // 버스커는 관객(+z) 쪽을 봄
  busker.rotation.y = Math.PI;
  const zone = textSprite('🎸 버스킹 존 · Busking zone', 0.55); zone.position.set(0, 3.2, STAGE.z); g.add(zone);
  // 무대 조명
  const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff7ac0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  spot.scale.set(7, 4, 1); spot.position.set(0, 1.8, STAGE.z + 0.5); g.add(spot);
  const pts: [number, number, number][] = [];
  for (let x = -10; x <= 10; x += 1.2) for (const z of [-2, 4]) pts.push([x, 5 - Math.cos((x / 10) * Math.PI / 2) * 0.8, z]);
  const lights = bulbs(g, GLOW, pts, 0xffc6e8);
  let t0 = 0, playing = false;
  return {
    group: g,
    get playing() { return playing; },
    update(dt: number, t: number, night: number) {
      t0 += dt;
      playing = (t0 % 60) < 45;
      const arm = busker.userData.arm as THREE.Group;
      arm.rotation.x = playing ? 1.0 + Math.sin(t / 110) * 0.35 : 0.2;
      busker.position.y = STAGE.h + (playing ? Math.abs(Math.sin(t / 260)) * 0.04 : 0);
      busker.rotation.z = playing ? Math.sin(t / 520) * 0.05 : 0;
      const pulse = playing ? 0.35 + Math.abs(Math.sin(t / 260)) * 0.35 : 0;
      spot.material.opacity = pulse * (0.4 + 0.6 * night);
      spot.material.color.setHSL(((t / 6000) % 1), 0.8, 0.65);
      for (const s of lights) s.material.opacity = 0.04 + 0.6 * night;
    },
  };
}

export function createSeoulScenery(scene: THREE.Scene, GLOW: THREE.Texture) {
  const mk = market(scene, GLOW), md = myeongdong(scene, GLOW), hd = hongdae(scene, GLOW);
  let id = '';
  return {
    setPlace(p: string) { id = p; mk.group.visible = p === 'gwangjang'; md.group.visible = p === 'myeongdong'; hd.group.visible = p === 'hongdae'; },
    /** 홍대 버스커가 지금 연주 중인지 */
    get busking() { return id === 'hongdae' && hd.playing; },
    update(dt: number, t: number, night: number) {
      if (id === 'gwangjang') mk.update(dt, t, night);
      if (id === 'myeongdong') md.update(dt, t, night);
      if (id === 'hongdae') hd.update(dt, t, night);
    },
  };
}
