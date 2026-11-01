import * as THREE from 'three';

export type CharState = 'idle' | 'walk' | 'sit' | 'lie';
/** clink = 다른 사람과 커피잔을 부딪치는 동작 (서버가 짝을 지어 줄 때만) */
export type Emote = 'stretch' | 'wave' | 'cheers' | 'clink' | 'clap' | 'skip';

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
const EMOTE_T: Record<Emote, number> = { stretch: 1.8, wave: 1.9, cheers: 2.6, clink: 2.6, clap: 2.2, skip: 1.1 };
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
  c.legL.rotation.x += (lL - c.legL.rotation.x) * e;
  c.legR.rotation.x += (lR - c.legR.rotation.x) * e;
  c.inner.position.y += (y - c.inner.position.y) * e;
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
