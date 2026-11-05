import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CharState = 'idle' | 'walk' | 'sit' | 'lie';
/** clink = 다른 사람과 커피잔을 부딪치는 동작 (서버가 짝을 지어 줄 때만) */
export type Emote = 'stretch' | 'wave' | 'cheers' | 'clink' | 'clap' | 'skip' | 'dig' | 'give' | 'take' | 'eat' | 'pet' | 'dance';

export interface Char {
  root: THREE.Group;
  inner: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  phase: number;
  state: CharState;
  /** 통나무처럼 높은 자리에 앉았는지 (다리를 아래로 내림) */
  bench: boolean;
  emote: Emote | null;
  emoteT: number;
  /** 짠 할 때만 보이는 머그컵 (오른손에 붙어 있음) */
  mug: THREE.Group;
  steam: THREE.Mesh;
  /** 어깨에 두르는 체크무늬 담요 (켜 두는 상태) */
  blanket: THREE.Group;
}

const SKIN = 0xf2d0b2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 둥근 말풍선 모양의 글자 스프라이트 (이름표, 풍등 소원) */
export function textSprite(text: string, scale = 1) {
  const c = document.createElement('canvas'), g = c.getContext('2d')!;
  const font = '700 44px "Noto Sans KR", sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = 72;
  g.font = font;
  g.fillStyle = 'rgba(14,15,32,.72)';
  g.beginPath(); g.roundRect(6, 6, w - 12, 60, 30); g.fill();
  g.fillStyle = '#fff8ef'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((w / 72) * 0.42 * scale, 0.42 * scale, 1);
  s.renderOrder = 10;
  return s;
}

/** 모자 색을 바탕으로 한 체크무늬(타탄) 텍스처. 같은 색은 한 번만 만든다 */
const tartanCache = new Map<number, THREE.CanvasTexture>();
function tartan(base: number) {
  let tex = tartanCache.get(base);
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, col = new THREE.Color(base);
  const css = (k: number, a = 1) => `rgba(${Math.round(col.r * 255 * k)},${Math.round(col.g * 255 * k)},${Math.round(col.b * 255 * k)},${a})`;
  g.fillStyle = css(0.78); g.fillRect(0, 0, 64, 64);
  g.fillStyle = css(0.45, 0.55); g.fillRect(0, 20, 64, 12); g.fillRect(20, 0, 12, 64); // 굵은 어두운 줄
  g.fillStyle = 'rgba(255,248,235,.55)'; g.fillRect(0, 44, 64, 3); g.fillRect(44, 0, 3, 64); // 가는 밝은 줄
  tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1.5);
  tartanCache.set(base, tex);
  return tex;
}

/** 어깨에 둘러 등 뒤로 늘어지는 숄. 앞쪽은 살짝 열려 있음 (캐릭터 앞 = -z) */
function makeBlanket(hatC: number) {
  const g = new THREE.Group(); g.visible = false;
  const mat = new THREE.MeshLambertMaterial({ map: tartan(hatC), side: THREE.DoubleSide });
  const gap = 0.55; // 앞쪽 트인 각도의 절반
  const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.45, 0.68, 20, 1, true, Math.PI + gap, Math.PI * 2 - gap * 2), mat);
  shawl.position.y = 0.62; g.add(shawl);
  // 어깨 위 접힌 부분
  const roll = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 20, Math.PI * 2 - gap * 2), mat);
  roll.rotation.set(Math.PI / 2, 0, -Math.PI / 2 + gap); roll.position.y = 0.95; g.add(roll);
  return g;
}

export function makeChar(bodyC: number, hatC: number): Char {
  const root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner);
  const M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const add = (m: THREE.Mesh, y: number) => { m.position.y = y; inner.add(m); return m; };
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.36, 0.6, 12), M(bodyC)), 0.62);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), M(SKIN)), 1.17);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.315, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(hatC)), 1.21);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M(0xfff4e6)), 1.54);
  const scarf = add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 6, 16), M(hatC)), 0.93);
  scarf.rotation.x = Math.PI / 2;
  const eyeM = M(0x2a1d16);
  for (const x of [-0.1, 0.1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeM);
    e.position.set(x, 1.17, -0.28); inner.add(e);
  }
  const limb = (x: number, y: number, len: number, r: number, c: number) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), M(c));
    m.position.y = -len / 2; piv.add(m); inner.add(piv);
    return piv;
  };
  const armL = limb(-0.33, 0.86, 0.42, 0.07, bodyC), armR = limb(0.33, 0.86, 0.42, 0.07, bodyC);
  const legL = limb(-0.13, 0.33, 0.33, 0.09, 0x4a4250), legR = limb(0.13, 0.33, 0.33, 0.09, 0x4a4250);
  // 머그컵: 오른팔 끝에 붙이고, 팔이 돌아가도 컵은 똑바로 서 있게 animChar에서 반대로 돌린다
  const mug = new THREE.Group(); mug.position.set(0, -0.46, -0.04); mug.visible = false; armR.add(mug);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.17, 14), M(0xfff6ea)); mug.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), M(0x5a3520));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.081; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), M(0xfff6ea));
  handle.rotation.z = -Math.PI / 2; handle.position.x = 0.085; mug.add(handle);
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  steam.position.y = 0.16; mug.add(steam);
  const blanket = makeBlanket(hatC); inner.add(blanket);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);
  return { root, inner, armL, armR, legL, legR, phase: Math.random() * 6, state: 'idle', bench: false, emote: null, emoteT: 0, mug, steam, blanket };
}

export function disposeChar(c: Char) {
  c.root.traverse(o => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
  });
}

/** 걷기·앉기·기지개·손 흔들기·짠 동작을 부드럽게 보간 */
const EMOTE_T: Record<Emote, number> = { stretch: 1.8, wave: 1.9, cheers: 2.6, clink: 2.6, clap: 2.2, skip: 1.1, dig: 1.6, give: 2.2, take: 2.2, eat: 1.8, pet: 2.0, dance: 4.0 };
export function animChar(c: Char, dt: number) {
  c.phase += dt * (c.state === 'walk' ? 9 : 1.6);
  let aL = 0, aR = 0, aRz = 0, aLz = 0, lL = 0, lR = 0, y = 0, rx = 0;
  if (c.state === 'walk') {
    const s = Math.sin(c.phase);
    lL = s * 0.6; lR = -s * 0.6; aL = -s * 0.5; aR = s * 0.5; y = Math.abs(Math.cos(c.phase)) * 0.06;
  } else if (c.state === 'sit') {
    // 방석: 다리를 앞으로 쭉 / 통나무: 무릎 아래로 다리를 내리고 손은 무릎 위에
    y = -0.3;
    if (c.bench) { lL = lR = 1.05; aL = aR = 0.75; } else { lL = lR = Math.PI / 2; aL = aR = 0.55; }
  } else if (c.state === 'lie') {
    // 모래에 등을 대고 누워 하늘 보기: 팔은 머리 뒤로 깍지
    rx = Math.PI / 2; y = 0.3; aL = aR = Math.PI * 0.85; aLz = -0.5; aRz = 0.5; lR = 0.25;
  } else {
    y = Math.sin(c.phase) * 0.012;
  }
  // 꽃다발을 들고 있으면 오른팔을 살짝 앞으로
  // 꽃다발을 들고 있으면 오른팔을 앞으로 (꽃은 아래 animChar 끝에서 똑바로 세움)
  if (c.state !== 'walk' && c.state !== 'lie' && c.armR.getObjectByName('flowers')?.visible) aR = 1.0;
  if (c.state !== 'lie' && FOODS.some(n => c.armR.getObjectByName(n)?.visible)) aR = c.state === 'walk' ? 0.8 : 1.15;
  let rz = 0;
  if (c.emote) {
    c.emoteT += dt;
    const T = EMOTE_T[c.emote] ?? 1.9;
    const u = clamp(c.emoteT / T, 0, 1), k = Math.sin(Math.PI * u);
    if (c.emote === 'stretch') { aL = aR = Math.PI * 0.95 * k; y += 0.05 * k; }
    if (c.emote === 'wave') { aRz = (2.4 + Math.sin(c.emoteT * 12) * 0.35) * k; aR = 0; }
    if (c.emote === 'cheers') {
      // 혼자: 컵을 입가로 가져가 한 모금 (중간에 살짝 기울임)
      const sip = clamp((u - 0.35) / 0.3, 0, 1);
      aR = (1.5 + 0.9 * Math.sin(Math.PI * sip)) * clamp(k * 1.6, 0, 1); aRz = 0.35 * clamp(k * 1.6, 0, 1);
    }
    if (c.emote === 'clink') {
      // 둘이: 팔을 앞으로 쭉 내밀고, 가운데쯤 컵을 '톡' 두 번 부딪친 뒤 한 모금
      const reach = clamp(k * 1.8, 0, 1);
      const tap = u > 0.3 && u < 0.55 ? Math.abs(Math.sin((u - 0.3) / 0.25 * Math.PI * 2)) * 0.18 : 0;
      const sip = clamp((u - 0.6) / 0.25, 0, 1);
      aR = (1.45 + tap + 0.85 * Math.sin(Math.PI * sip)) * reach; aRz = 0.12 * reach;
      y += 0.03 * Math.sin(Math.PI * clamp((u - 0.3) / 0.25, 0, 1));
    }
    if (c.emote === 'clap') {
      // 두 손을 앞으로 모아 짝짝짝
      const reach = clamp(k * 2, 0, 1), tap = Math.abs(Math.sin(c.emoteT * 13)) * 0.3;
      aL = aR = 1.3 * reach; aLz = -(0.25 + tap) * reach; aRz = (0.25 + tap) * reach;
    }
    if (c.emote === 'pet') {
      // 쪼그려 앉아 오른손으로 머리를 토닥토닥
      const kk = clamp(k * 2.2, 0, 1), pat = Math.abs(Math.sin(c.emoteT * 8)) * 0.3;
      y -= 0.3 * kk; lL = lR = 1.25 * kk; aR = (0.95 + pat) * kk;
    }
    if (c.emote === 'dig') {
      // 쪼그려 앉아 모래를 토닥토닥
      const kk = clamp(k * 2.2, 0, 1), pat = Math.abs(Math.sin(c.emoteT * 9)) * 0.35;
      y -= 0.32 * kk; lL = lR = 1.3 * kk; aL = aR = (1.0 + pat) * kk;
    }
    if (c.emote === 'dance') {
      // 신나게: 양팔을 번갈아 위로, 무릎 까딱, 몸을 좌우로 흔들기
      const kk = clamp(k * 3, 0, 1), b = c.emoteT * 7.5;
      aL = (1.6 + Math.sin(b) * 1.1) * kk; aR = (1.6 - Math.sin(b) * 1.1) * kk;
      aLz = -0.5 * kk; aRz = 0.5 * kk;
      y += Math.abs(Math.sin(b)) * 0.1 * kk; rz = Math.sin(b / 2) * 0.18 * kk;
      lL = Math.max(0, Math.sin(b)) * 0.4 * kk; lR = Math.max(0, -Math.sin(b)) * 0.4 * kk;
    }
    if (c.emote === 'eat') { const up = Math.sin(Math.PI * u); aR = 1.15 + 0.85 * up; aRz = 0.3 * up; }
    if (c.emote === 'give') { aR = 1.0 + 0.5 * clamp(k * 2, 0, 1); aRz = -0.15 * clamp(k * 2, 0, 1); }
    if (c.emote === 'take') { aL = 1.5 * clamp(k * 2, 0, 1); aLz = 0.15 * clamp(k * 2, 0, 1); }
    if (c.emote === 'skip') {
      // 물수제비: 팔을 뒤로 젖혔다가 옆으로 낮게 휙
      aR = u < 0.4 ? -0.9 * (u / 0.4) : -0.9 + 2.3 * clamp((u - 0.4) / 0.25, 0, 1) * (1 - clamp((u - 0.75) / 0.25, 0, 1));
      aRz = 0.9 * k; y -= 0.06 * k;
    }
    if (c.emoteT >= T) { c.emote = null; c.emoteT = 0; }
  }
  const hasMug = c.emote === 'cheers' || c.emote === 'clink';
  c.mug.visible = hasMug;
  if (hasMug) {
    c.mug.rotation.x = -c.armR.rotation.x; c.mug.rotation.z = -c.armR.rotation.z; // 컵은 늘 똑바로
    const s = (c.emoteT * 0.9) % 1;
    c.steam.position.y = 0.14 + s * 0.22; c.steam.scale.setScalar(0.7 + s * 0.9);
    (c.steam.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - s);
  }
  const e = 1 - Math.pow(0.0005, dt);
  c.armL.rotation.x += (aL - c.armL.rotation.x) * e;
  c.armR.rotation.x += (aR - c.armR.rotation.x) * e;
  c.armR.rotation.z += (aRz - c.armR.rotation.z) * e;
  c.armL.rotation.z += (aLz - c.armL.rotation.z) * e;
  c.inner.rotation.x += (rx - c.inner.rotation.x) * e;
  c.inner.rotation.z += (rz - c.inner.rotation.z) * e;
  c.legL.rotation.x += (lL - c.legL.rotation.x) * e;
  c.legR.rotation.x += (lR - c.legR.rotation.x) * e;
  c.inner.position.y += (y - c.inner.position.y) * e;
  // 꽃다발은 팔이 어떻게 움직여도 꽃이 위로 오게
  for (const [arm, name] of [[c.armR, 'flowers'], [c.armL, 'flowersL'], [c.armR, 'ramen'], [c.armR, 'food']] as const) {
    const f = arm.getObjectByName(name);
    if (f?.visible) { f.rotation.x = -arm.rotation.x; f.rotation.z = -arm.rotation.z; }
  }
  const fs = c.armR.getObjectByName('food');
  if (fs?.visible) for (const ch of fs.children) if (ch.visible && ch.userData.steam) {
    const sm = ch.userData.steam as THREE.Mesh, k = (c.phase * 0.5) % 1;
    sm.position.y = 0.14 + k * 0.2; sm.scale.setScalar(0.7 + k); (sm.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - k);
  }
  const bs = c.armR.getObjectByName('bsteam') as THREE.Mesh | undefined;
  if (bs?.parent?.visible) { const k = (c.phase * 0.5) % 1; bs.position.y = 0.14 + k * 0.2; bs.scale.setScalar(0.7 + k); (bs.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - k); }
  // 걸을 때 담요 자락이 살짝 펄럭임
  if (c.blanket.visible) c.blanket.rotation.x = c.state === 'walk' ? 0.08 + Math.sin(c.phase * 2) * 0.04 : 0;
}

/** 이동 방향 (vx, vz)을 바라보는 회전각. 캐릭터의 앞은 -z */
export const faceAngle = (vx: number, vz: number) => Math.atan2(-vx, -vz);

export function turnTo(c: Char, ang: number, dt: number) {
  let d = ang - c.root.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  c.root.rotation.y += d * (1 - Math.pow(0.0001, dt));
}

// ---------- 소품 (주문진 사진 자리용) ----------
// 1: 회색 맨투맨 + 검은 슬랙스, 2: 빨간 목도리, 4: 메밀꽃 다발.
// 이름 없는 평범한 옷과 소품만 쓰고, 특정 인물의 얼굴·이름은 쓰지 않는다.
export const OUTFIT = { sweat: 1, scarf: 2, flowers: 4, ramen: 8, hanbok: 16 } as const;
/** 손에 든 시장 음식: 32~480 자리(4비트)에 음식 번호 1~15 */
export const FOOD_MASK = 15 << 5;
export const foodBits = (id: number) => (id & 15) << 5;
export const foodOf = (mask: number) => (mask >> 5) & 15;
/** 손에 드는 먹을거리 (그 장소를 떠나면 내려놓음) */
export const HELD = OUTFIT.ramen | FOOD_MASK;
const FOODS = ['ramen', 'food'];

/** 메밀꽃 다발: 붉은 줄기 끝에 작고 하얀 꽃송이가 몽글몽글, 크라프트지로 감쌈. 꽃이 위로 오게 세운다 */
function makeBuckwheat() {
  const g = new THREE.Group();
  const petals: THREE.BufferGeometry[] = [], stems: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = [];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(-0.3, 0.3), lean = rnd(0.12, 0.32), h = rnd(0.26, 0.4);
    const tx = Math.sin(lean) * Math.cos(a) * h, tz = Math.sin(lean) * Math.sin(a) * h, ty = 0.06 + Math.cos(lean) * h;
    const st = new THREE.CylinderGeometry(0.004, 0.006, h, 4); st.translate(0, h / 2, 0);
    st.rotateZ(-Math.sin(lean) * Math.cos(a)); st.rotateX(Math.sin(lean) * Math.sin(a)); st.translate(0, 0.06, 0);
    stems.push(st);
    // 줄기 끝 꽃송이: 아주 작은 꽃 여러 개가 둥글게 모임
    for (let k = 0; k < 11; k++) {
      const r = rnd(0.008, 0.016), p = new THREE.SphereGeometry(r, 5, 4);
      p.translate(tx + rnd(-0.03, 0.03), ty + rnd(-0.02, 0.035), tz + rnd(-0.03, 0.03));
      petals.push(p);
    }
    if (i % 3 === 0) {
      const lf = new THREE.SphereGeometry(0.03, 6, 4); lf.scale(1, 0.25, 0.7);
      lf.translate(tx * 0.45, 0.06 + ty * 0.4, tz * 0.45); leaves.push(lf);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(stems), new THREE.MeshLambertMaterial({ color: 0xa8495b })));
  g.add(new THREE.Mesh(mergeGeometries(petals), new THREE.MeshLambertMaterial({ color: 0xfbf8f2, emissive: 0x2a2622 })));
  if (leaves.length) g.add(new THREE.Mesh(mergeGeometries(leaves), new THREE.MeshLambertMaterial({ color: 0x5f8f4e })));
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.035, 0.2, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xc9ac80, side: THREE.DoubleSide }));
  wrap.position.y = 0.06; g.add(wrap);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12), new THREE.MeshLambertMaterial({ color: 0xf1ebe0 }));
  tie.rotation.x = Math.PI / 2; tie.position.y = 0.03; g.add(tie);
  return g;
}


/** 시장 음식 12가지 (번호는 beach-extras MARKET_STALLS의 food와 같음) */
export const FOOD = { bindae: 1, tteokbokki: 2, gimbap: 3, jeon: 4, kalguksu: 5, yukhoe: 6, sundae: 7, kkultteok: 8, kkwabaegi: 9, sikhye: 10, japchae: 11, eomuk: 12 } as const;
const lm = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o;
}
function buildFoods(arm: THREE.Object3D) {
  const root = new THREE.Group(); root.name = 'food'; root.position.set(0, -0.46, -0.08); root.visible = false; arm.add(root);
  const plateG = new THREE.CylinderGeometry(0.16, 0.13, 0.025, 16), white = lm(0xf5f3ee);
  const sticks = (p: THREE.Object3D, x = 0.1) => { for (const dx of [-0.012, 0.012]) { const ch = mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.24, 4), lm(0xc9a46a), x + dx, 0.06, 0, p); ch.rotation.z = -1.2; } };
  const steam = (p: THREE.Object3D) => {
    const sm = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.14, 0, p);
    p.userData.steam = sm;
  };
  const make = (id: number, fn: (p: THREE.Group) => void) => { const p = new THREE.Group(); p.userData.id = id; p.visible = false; fn(p); root.add(p); };
  // 1 빈대떡: 접시 위 노릇한 전
  make(1, p => {
    mesh(plateG, white, 0, 0, 0, p);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14), lm(0xd49a3c), 0, 0.03, 0, p);
    for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), lm(k % 2 ? 0x6aa35a : 0xa8432c), Math.cos(k * 1.3) * 0.06, 0.05, Math.sin(k * 1.3) * 0.06, p);
    sticks(p); steam(p);
  });
  // 2 떡볶이: 종이컵 + 빨간 떡 + 꼬치
  make(2, p => {
    mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.13, 12), white, 0, 0, 0, p);
    const sc = mesh(new THREE.CircleGeometry(0.08, 12), lm(0xd8341f), 0, 0.066, 0, p); sc.rotation.x = -Math.PI / 2;
    for (let k = 0; k < 4; k++) { const r = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), lm(0xe0582c), (k % 2 - 0.5) * 0.06, 0.08, (k < 2 ? -1 : 1) * 0.025, p); r.rotation.z = Math.PI / 2 + k; }
    const pk = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), lm(0xe9d3a8), 0.03, 0.15, 0, p); pk.rotation.z = -0.3;
  });
  // 3 마약김밥: 작은 김밥 6개 + 겨자 소스 종지
  make(3, p => {
    mesh(plateG, white, 0, 0, 0, p);
    for (let k = 0; k < 6; k++) {
      const x = (k % 3 - 1) * 0.06, z = (k < 3 ? -0.035 : 0.035) - 0.02;
      const r = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), lm(0x1d2a21), x, 0.03, z, p); r.rotation.x = Math.PI / 2;
      const f = mesh(new THREE.CircleGeometry(0.018, 8), lm(0xf6f0de), x, 0.03, z + 0.046, p); void f;
    }
    mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.025, 10), white, 0.08, 0.025, 0.08, p);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 10), lm(0xe8c23a), 0.08, 0.04, 0.08, p);
  });
  // 4 모둠전: 노랑·초록·주황 전
  make(4, p => {
    mesh(plateG, white, 0, 0, 0, p);
    [[0xe2b54a, -0.05, -0.03], [0x7fb25a, 0.05, -0.02], [0xd9822f, 0, 0.05], [0xe8cf7a, 0.06, 0.07]].forEach(([c, x, z]) => {
      const j = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), lm(c), x, 0.025, z, p); j.scale.z = 0.7;
    });
    sticks(p);
  });
  // 5 칼국수: 스테인리스 그릇 + 면 + 호박
  make(5, p => {
    mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 16), lm(0xb9bec4), 0, 0, 0, p);
    const br = mesh(new THREE.CircleGeometry(0.11, 14), lm(0xe9dcc0), 0, 0.041, 0, p); br.rotation.x = -Math.PI / 2;
    for (let k = 0; k < 7; k++) { const n = mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 8), lm(0xf4ecd6), (k % 4 - 1.5) * 0.04, 0.045, (k < 4 ? -1 : 1) * 0.03, p); n.rotation.x = Math.PI / 2; }
    for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.03, 0.01, 0.015), lm(0x6aa35a), -0.04 + k * 0.04, 0.05, 0.06, p);
    sticks(p, 0.12); steam(p);
  });
  // 6 육회: 붉은 고기 + 노른자 + 배채
  make(6, p => {
    mesh(plateG, white, 0, 0, 0, p);
    for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(0.01, 0.01, 0.07), lm(0xf6f1d6), -0.08 + k * 0.032, 0.02, 0.06, p);
    const m = mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lm(0xb32a36), 0, 0.012, -0.02, p); m.scale.y = 0.6;
    mesh(new THREE.SphereGeometry(0.025, 10, 8), lm(0xf2b632), 0, 0.055, -0.02, p);
    for (let k = 0; k < 6; k++) mesh(new THREE.SphereGeometry(0.006, 4, 4), lm(0xf7f2e0), Math.cos(k) * 0.04, 0.05, -0.02 + Math.sin(k) * 0.04, p);
  });
  // 7 순대: 썬 순대 + 간
  make(7, p => {
    mesh(plateG, white, 0, 0, 0, p);
    for (let k = 0; k < 7; k++) { const r = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), lm(0x3a2626), -0.075 + k * 0.025, 0.03, -0.02, p); r.rotation.z = Math.PI / 2 - 0.4; }
    for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.035, 0.02, 0.03), lm(0x6b3a2a), -0.05 + k * 0.05, 0.025, 0.06, p);
    mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.015, 8), lm(0xc49a6c), 0.09, 0.02, 0.07, p);
  });
  // 8 꿀떡: 알록달록 동그란 떡
  make(8, p => {
    mesh(plateG, white, 0, 0, 0, p);
    const cols = [0xf6b5c8, 0xffffff, 0xa9d98a, 0xf4e18a];
    for (let k = 0; k < 9; k++) mesh(new THREE.SphereGeometry(0.028, 10, 8), lm(cols[k % 4]), (k % 3 - 1) * 0.06, 0.035, (Math.floor(k / 3) - 1) * 0.06, p);
    const pk = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), lm(0xe9d3a8), 0.04, 0.1, 0, p); pk.rotation.z = -0.4;
  });
  // 9 꽈배기: 꼬인 도넛을 종이에 싸서
  make(9, p => {
    const paper = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xf2ead8, side: THREE.DoubleSide }), 0, 0, 0, p); void paper;
    const tw = new THREE.Group(); tw.position.y = 0.12; p.add(tw);
    for (let k = 0; k < 2; k++) {
      const strand = mesh(new THREE.TorusKnotGeometry(0.03, 0.016, 32, 6, 2, 1 + k), lm(0xd59a45), 0, 0, 0, tw);
      strand.scale.set(0.9, 2.4, 0.9);
    }
    for (let k = 0; k < 10; k++) mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), lm(0xffffff), Math.cos(k * 2.1) * 0.035, 0.05 + (k % 5) * 0.03, Math.sin(k * 2.1) * 0.035, p);
  });
  // 10 식혜: 투명 컵 + 쌀알 + 빨대
  make(10, p => {
    mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.14, 12), new THREE.MeshLambertMaterial({ color: 0xdfeef8, transparent: true, opacity: 0.45 }), 0, 0.02, 0, p);
    mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.1, 12), lm(0xf0e3c2), 0, 0, 0, p);
    for (let k = 0; k < 8; k++) mesh(new THREE.SphereGeometry(0.006, 4, 4), lm(0xffffff), Math.cos(k * 0.8) * 0.03, 0.052, Math.sin(k * 0.8) * 0.03, p);
    const straw = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), lm(0xe8455a), 0.015, 0.12, 0, p); straw.rotation.z = -0.25;
  });
  // 11 잡채: 반짝이는 당면 + 당근·시금치
  make(11, p => {
    mesh(plateG, white, 0, 0, 0, p);
    for (let k = 0; k < 10; k++) { const n = mesh(new THREE.TorusGeometry(0.035 + (k % 3) * 0.012, 0.005, 4, 12), lm(0x8a5a35), Math.cos(k) * 0.03, 0.025 + (k % 2) * 0.008, Math.sin(k) * 0.03, p); n.rotation.x = Math.PI / 2 + (k % 3 - 1) * 0.3; }
    for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), lm(k % 2 ? 0xe5772c : 0x3e8a3a), Math.cos(k * 1.7) * 0.06, 0.04, Math.sin(k * 1.7) * 0.06, p);
    sticks(p);
  });
  // 12 어묵: 종이컵 국물 + 꼬치에 접힌 어묵
  make(12, p => {
    mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.1, 12), white, 0, 0, 0, p);
    const br = mesh(new THREE.CircleGeometry(0.07, 12), lm(0xd9b07a), 0, 0.051, 0, p); br.rotation.x = -Math.PI / 2;
    const stick = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 4), lm(0xe9d3a8), 0, 0.12, 0, p); void stick;
    for (let k = 0; k < 4; k++) { const f = mesh(new THREE.BoxGeometry(0.07, 0.035, 0.012), lm(0xd99a55), 0, 0.12 + k * 0.035, 0, p); f.rotation.y = (k % 2 ? 1 : -1) * 0.5; }
    steam(p);
  });
}

export function setOutfit(c: Char, mask: number) {
  let o = c.inner.getObjectByName('outfit') as THREE.Group | undefined;
  if (!o) {
    o = new THREE.Group(); o.name = 'outfit'; c.inner.add(o);
    // 빨간 목도리: 목에 두르고 한 자락은 가슴 앞으로
    const scarf = new THREE.Group(); scarf.name = 'scarf';
    const red = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.075, 8, 18), red); ring.rotation.x = Math.PI / 2; ring.position.y = 0.94; scarf.add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.05), red); tail.position.set(0.1, 0.72, -0.3); tail.rotation.z = 0.08; scarf.add(tail);
    o.add(scarf);
    // 맨투맨 밑단 시보리
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.03, 6, 18), new THREE.MeshLambertMaterial({ color: 0x7c7e84 }));
    hem.name = 'hem'; hem.rotation.x = Math.PI / 2; hem.position.y = 0.34; o.add(hem);
    // 꽃다발: 오른손(들고 있을 때)과 왼손(받는 순간) 두 군데
    for (const [arm, name] of [[c.armR, 'flowers'], [c.armL, 'flowersL']] as const) {
      const f = makeBuckwheat(); f.name = name; f.position.set(0, -0.44, -0.05); f.visible = false; arm.add(f);
    }
    // 라면 그릇: 오른손에 종이 용기 + 젓가락 + 김
    const bowl = new THREE.Group(); bowl.name = 'ramen'; bowl.position.set(0, -0.46, -0.06); bowl.visible = false; c.armR.add(bowl);
    const cupM = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
    const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.13, 14), cupM); bowl.add(cupMesh);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.105, 0.04, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0xd8302f, side: THREE.DoubleSide })); band.position.y = 0.02; bowl.add(band);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), new THREE.MeshLambertMaterial({ color: 0xc8541f })); soup.rotation.x = -Math.PI / 2; soup.position.y = 0.06; bowl.add(soup);
    for (let k = 0; k < 6; k++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf1d08a })); n.rotation.x = Math.PI / 2; n.position.set((k % 3 - 1) * 0.035, 0.065, (k < 3 ? -1 : 1) * 0.025); bowl.add(n); }
    for (const dx of [-0.012, 0.012]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.26, 4), new THREE.MeshLambertMaterial({ color: 0xc9a46a })); ch.position.set(0.05 + dx, 0.12, 0); ch.rotation.z = -0.5; bowl.add(ch); }
    const bsteam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
    bsteam.name = 'bsteam'; bsteam.position.y = 0.14; bowl.add(bsteam);
    buildFoods(c.armR);
    // 한복: 짧은 저고리 + 고름 + 넓게 퍼지는 긴 치마 (색은 사람마다 다르게)
    const hb = new THREE.Group(); hb.name = 'hanbok'; hb.visible = false; o.add(hb);
    const HB = [[0xf6c1cc, 0x3d5aa8], [0xfbe3a1, 0xc8324a], [0xbfe3cf, 0x8a4fb0], [0xcfe0ff, 0xe36a8c], [0xffffff, 0x2f7d6d]];
    const [top, skirt] = HB[Math.floor(Math.random() * HB.length)];
    const jeogori = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.36, 14), new THREE.MeshLambertMaterial({ color: top })); jeogori.position.y = 0.8; hb.add(jeogori);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.03), new THREE.MeshLambertMaterial({ color: 0xffffff })); collar.position.set(0.06, 0.86, -0.34); collar.rotation.z = -0.5; hb.add(collar);
    const goreum = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.02), new THREE.MeshLambertMaterial({ color: skirt })); goreum.position.set(0.1, 0.62, -0.36); goreum.rotation.z = 0.12; hb.add(goreum);
    const chima = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.62, 0.66, 18, 1, true), new THREE.MeshLambertMaterial({ color: skirt, side: THREE.DoubleSide })); chima.position.y = 0.33; hb.add(chima);
    // 원래 옷 색 기억 (맨투맨을 벗으면 되돌림)
    const firstMesh = (g: THREE.Object3D) => g.children.find(ch => (ch as THREE.Mesh).isMesh) as THREE.Mesh;
    const body = c.inner.children.find(ch => (ch as THREE.Mesh).isMesh) as THREE.Mesh;
    o.userData.parts = {
      top: [body, firstMesh(c.armL), firstMesh(c.armR)].map(m => ({ m, c: (m.material as THREE.MeshLambertMaterial).color.getHex() })),
      legs: [firstMesh(c.legL), firstMesh(c.legR)].map(m => ({ m, c: (m.material as THREE.MeshLambertMaterial).color.getHex() })),
    };
  }
  const sweat = !!(mask & OUTFIT.sweat);
  const parts = o.userData.parts as { top: { m: THREE.Mesh; c: number }[]; legs: { m: THREE.Mesh; c: number }[] };
  // 재질을 따로 복제해서 다른 캐릭터와 색을 공유하지 않게
  for (const { m, c: orig } of parts.top) { if (!m.userData.own) { m.material = (m.material as THREE.Material).clone(); m.userData.own = true; } (m.material as THREE.MeshLambertMaterial).color.setHex(sweat ? 0x8d9097 : orig); }
  for (const { m, c: orig } of parts.legs) { if (!m.userData.own) { m.material = (m.material as THREE.Material).clone(); m.userData.own = true; } (m.material as THREE.MeshLambertMaterial).color.setHex(sweat ? 0x1b1b21 : orig); }
  o.getObjectByName('hem')!.visible = sweat;
  o.getObjectByName('scarf')!.visible = !!(mask & OUTFIT.scarf);
  o.getObjectByName('hanbok')!.visible = !!(mask & OUTFIT.hanbok);
  c.armR.getObjectByName('flowers')!.visible = !!(mask & OUTFIT.flowers);
  c.armR.getObjectByName('ramen')!.visible = !!(mask & OUTFIT.ramen);
  const fid = foodOf(mask), fg = c.armR.getObjectByName('food')!;
  fg.visible = fid > 0;
  for (const ch of fg.children) ch.visible = ch.userData.id === fid;
  o.userData.mask = mask;
}
export const outfitOf = (c: Char) => ((c.inner.getObjectByName('outfit')?.userData.mask as number) ?? 0);
/** 받는 순간 왼손에 꽃 보이기 */
export function showLeftFlowers(c: Char, on: boolean) { const f = c.armL.getObjectByName('flowersL'); if (f) f.visible = on; }
