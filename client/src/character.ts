import * as THREE from 'three';
import { stable } from './stable-tex';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CharState = 'idle' | 'walk' | 'sit' | 'lie';
/** clink = 다른 사람과 커피잔을 부딪치는 동작 (서버가 짝을 지어 줄 때만) */
export type Emote = 'stretch' | 'wave' | 'cheers' | 'clink' | 'clap' | 'skip' | 'dig' | 'give' | 'take' | 'eat' | 'pet' | 'dance' | 'yaho' | 'raise' | 'crow' | 'hop' | 'peck';

export interface Char {
  root: THREE.Group;
  inner: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  phase: number;
  /** 걸음 빠르기 (1 = 보통, 0.6 살살, 1.6 빠른 걸음) */
  pace: number;
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

// ---------- 병아리 몸 (A 동글) ----------
// 몸 가운데 높이와 반지름. 머리와 몸이 하나인 둥근 몸이라 얼굴도 이 구 위에 붙는다. 캐릭터 앞 = -z
export const CHICK = { y: 0.79, r: 0.52, sx: 1, sy: 1.085, sz: 0.88 } as const;
/** 프사 병아리 윤곽 (반지름, 높이) — 몸 너비 1 기준. 옆이 거의 곧고 아래가 가장 넓게 둥근 통 모양 */
const PROFILE: [number, number][] = [[0, 0], [0.2, 0.005], [0.305, 0.025], [0.43, 0.094], [0.49, 0.164], [0.515, 0.233], [0.52, 0.3], [0.508, 0.45], [0.5, 0.62], [0.49, 0.76], [0.45, 0.88], [0.36, 0.975], [0.24, 1.04], [0.12, 1.075], [0, 1.085]];
const BODY_S = CHICK.r * 2, BODY_BASE = CHICK.y - 0.5425 * BODY_S;
/** 몸 표면 앞쪽(-z)의 점: x는 몸 너비 기준(-0.5~0.5), h는 아래에서부터 높이(0~1.085) */
export function bodySurf(x: number, h: number, out = new THREE.Vector3()) {
  let r = 0.5;
  for (let i = 1; i < PROFILE.length; i++) if (PROFILE[i][1] >= h) { const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i]; r = r0 + (r1 - r0) * (h - y0) / Math.max(1e-6, y1 - y0); break; }
  return out.set(x * BODY_S, BODY_BASE + h * BODY_S, -Math.sqrt(Math.max(0, r * r - x * x)) * CHICK.sz * BODY_S);
}
/** 날개 끝 (손 자리): 들고 다니는 것들이 여기 붙는다 */
export const HAND_Y = -0.3;
/** 만화 느낌 음영 (3단) */
let gradTex: THREE.DataTexture | null = null;
function toonGrad() {
  if (gradTex) return gradTex;
  gradTex = new THREE.DataTexture(new Uint8Array([212, 240, 255]), 3, 1, THREE.RedFormat); // 프사 그림처럼 거의 단색 (아주 옅은 2단)
  gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true;
  return gradTex;
}
export const toon = (c: number) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad() });
const FEATHER = 0xf8e7a0, FEATHER2 = 0xf1dc92, BEAK = 0xe8a45b, LINE = 0x3c3530;
/** 구 위의 한 점 (몸 비율 반영) */
const onBody = (x: number, y: number, z: number, k = 1) => new THREE.Vector3(x, y, z).normalize().multiply(new THREE.Vector3(CHICK.sx, CHICK.sy, CHICK.sz)).multiplyScalar(CHICK.r * k).add(new THREE.Vector3(0, CHICK.y, 0));
let bodyGeo: THREE.BufferGeometry | null = null;

export function makeChar(_bodyC: number, hatC: number): Char {
  const root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner);
  const M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  bodyGeo ??= (() => {
    const pts = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r * BODY_S, y * BODY_S))).getPoints(48).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const g = new THREE.LatheGeometry(pts, 40); g.scale(1, 1, CHICK.sz); g.translate(0, -(CHICK.y - BODY_BASE), 0); g.computeVertexNormals(); return g;
  })();
  // 몸 (첫 번째 메시: 다른 코드가 몸으로 찾음)
  const bodyMat = toon(FEATHER); bodyMat.emissive.setHex(FEATHER).multiplyScalar(0.3); // 해를 등져도 까맣게 묻히지 않게
  const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = CHICK.y; body.name = 'chickBody'; inner.add(body);
  // 외곽선: 뒷면을 살짝 크게 (갈색)
  const ol = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide })); ol.position.y = CHICK.y; ol.scale.setScalar(1.032); ol.name = 'outline'; inner.add(ol); // 프사처럼 또렷한 연필 선
  // 배
  const belly = new THREE.Mesh(new THREE.SphereGeometry(CHICK.r * 0.6, 16, 12), toon(0xf8e9a6)); belly.visible = false; belly.scale.set(0.95, 0.72, 0.4); belly.position.copy(onBody(0, -0.55, -0.85, 0.78)); inner.add(belly);
  // 눈: 크고 까맣게 + 반짝임 두 개
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x24140c }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.name = 'eye'; bodySurf(sx * 0.27, 0.72, e.position); e.position.z -= 0.004;
    e.lookAt(e.position.clone().sub(new THREE.Vector3(0, CHICK.y, 0)).multiplyScalar(3).add(new THREE.Vector3(0, CHICK.y, 0)));
    const er = CHICK.r * 0.075; // 프사처럼 작은 점 눈
    const ball = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 10), eyeM); ball.scale.set(1, 1.1, 0.45); e.add(ball);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(er * 0.34, 8, 6), hiM); h1.visible = false; h1.position.set(er * 0.32, er * 0.38, er * 0.38); e.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(er * 0.16, 6, 4), hiM); h2.visible = false; h2.position.set(-er * 0.3, -er * 0.36, er * 0.4); e.add(h2);
    inner.add(e);
    // 볼터치
    const ck = new THREE.Mesh(new THREE.CircleGeometry(CHICK.r * 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xf2a08a, transparent: true, opacity: 0.32, depthWrite: false }));
    bodySurf(sx * 0.38, 0.64, ck.position); ck.position.z -= 0.01; ck.lookAt(ck.position.clone().sub(new THREE.Vector3(0, CHICK.y, 0)).multiplyScalar(3).add(new THREE.Vector3(0, CHICK.y, 0))); ck.scale.y = 0.62; inner.add(ck);
  }
  // 부리 (위·아래)
  const beakM = toon(BEAK); beakM.emissive.setHex(BEAK).multiplyScalar(0.2);
  const beak = new THREE.Group(); beak.name = 'beak'; bodySurf(0, 0.665, beak.position); beak.position.z += 0.02; inner.add(beak);
  const bt = new THREE.Mesh(new THREE.ConeGeometry(CHICK.r * 0.13, CHICK.r * 0.22, 12), beakM); bt.rotation.x = -Math.PI / 2; bt.scale.set(1.5, 0.55, 0.42); bt.position.set(0, CHICK.r * 0.03, -CHICK.r * 0.07); beak.add(bt);
  const lower = new THREE.Group(); lower.name = 'beakLow'; beak.add(lower);
  const bb = new THREE.Mesh(new THREE.ConeGeometry(CHICK.r * 0.1, CHICK.r * 0.15, 12), beakM); bb.rotation.x = -Math.PI / 2; bb.scale.set(1.4, 0.5, 0.4); bb.position.set(0, -CHICK.r * 0.04, -CHICK.r * 0.045); lower.add(bb);
  // 머리 위 솜털 세 가닥 (모자를 쓰면 숨김)
  const tuft = new THREE.Group(); tuft.name = 'tuft'; tuft.position.set(0, CHICK.y + CHICK.r * CHICK.sy * 0.97, -0.03); inner.add(tuft);
  for (const [a, h] of [[-0.45, 0.1], [0, 0.13], [0.45, 0.095]] as const) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.026, h, 6), body.material); t.position.set(Math.sin(a) * 0.03, h / 2 - 0.01, 0); t.rotation.z = -a * 0.9; tuft.add(t); }
  // 기본 비니 (사람마다 색이 달라 나를 알아보는 표시)
  const capR = CHICK.r * 1.04;
  const hat0 = new THREE.Mesh(new THREE.SphereGeometry(capR, 20, 10, 0, Math.PI * 2, 0, 1.05), M(hatC)); hat0.scale.set(CHICK.sx, CHICK.sy, CHICK.sz); hat0.position.y = CHICK.y + 0.02; hat0.name = 'hat0'; inner.add(hat0);
  const cuff0 = new THREE.Mesh(new THREE.TorusGeometry(capR * Math.sin(1.05) * 0.99, 0.045, 6, 24), M(new THREE.Color(hatC).multiplyScalar(0.82).getHex())); cuff0.rotation.x = Math.PI / 2; cuff0.position.y = CHICK.y + 0.02 + capR * CHICK.sy * Math.cos(1.05); hat0.add(cuff0); cuff0.position.y -= hat0.position.y;
  const pom0 = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M(0xfff4e6)); pom0.position.y = CHICK.y + CHICK.r * CHICK.sy + 0.1; pom0.name = 'pom0'; inner.add(pom0);
  // 알껍질 모자 (해를 한 번도 안 본 첫날)
  // 프사처럼 머리 위 1/3을 덮는 큰 껍데기, 아래가 굵은 지그재그
  const shellR = 0.55 * BODY_S;
  const shellGeo = new THREE.SphereGeometry(shellR, 44, 16, 0, Math.PI * 2, 0, 1.42), sp = shellGeo.attributes.position, v3 = new THREE.Vector3();
  for (let i = 0; i < sp.count; i++) { v3.fromBufferAttribute(sp, i); const polar = Math.acos(Math.max(-1, Math.min(1, v3.y / shellR))); if (polar > 1.05) { const a = Math.atan2(v3.z, v3.x), zig = Math.abs(((a / (Math.PI * 2)) * 9 % 1 + 1) % 1 - 0.5) * 2; sp.setY(i, v3.y + (zig - 0.5) * 0.14 * ((polar - 1.05) / 0.37)); } }
  shellGeo.computeVertexNormals();
  const shellM = toon(0xf5f2e1); shellM.emissive.setHex(0xf5f2e1).multiplyScalar(0.25); shellM.side = THREE.DoubleSide;
  const shell = new THREE.Mesh(shellGeo, shellM); shell.scale.set(1, 1, 0.92); shell.position.y = BODY_BASE + 0.86 * BODY_S; shell.rotation.z = 0.07; shell.name = 'eggshell'; shell.visible = false; inner.add(shell);
  const sho = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide })); sho.scale.setScalar(1.022); shell.add(sho);
  // 볏 · 고기수염 · 꽁지 (자라면서 커짐)
  const redM = toon(0xe8463a);
  const comb = new THREE.Group(); comb.name = 'comb'; comb.position.set(0, CHICK.y + CHICK.r * CHICK.sy * 0.95, -0.06); comb.visible = false; inner.add(comb);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 - i * 0.006, 10, 8), redM); b.scale.set(0.55, 1, 1); b.position.set(0, 0.035 + (i === 1 ? 0.022 : 0), -0.07 + i * 0.075); comb.add(b); }
  const wattle = new THREE.Group(); wattle.name = 'wattle'; bodySurf(0, 0.6, wattle.position); wattle.visible = false; inner.add(wattle);
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), redM); b.scale.set(0.8, 1.5, 0.7); b.position.set(sx * 0.018, -0.03, 0); wattle.add(b); }
  const tailG = new THREE.Group(); tailG.name = 'tailF'; tailG.position.set(0, CHICK.y - 0.05, CHICK.r * CHICK.sz * 0.95); tailG.visible = false; inner.add(tailG);
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(FEATHER2)); f.scale.set(0.22, 0.85, 0.3); const a = (i - 2) * 0.32; f.position.set(Math.sin(a) * 0.09, 0.16, 0.06); f.rotation.set(0.6, 0, -a); f.name = 'tailFeather'; tailG.add(f); }
  // 기본 목도리
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(CHICK.r * 0.88, 0.065, 8, 24), M(hatC)); scarf.name = 'scarf0';
  scarf.rotation.x = Math.PI / 2 - 0.12; scarf.position.y = CHICK.y - 0.1; scarf.scale.set(1.13, 1.02, 1); inner.add(scarf);
  // 날개 = 팔 (어깨에서 돌아감). 날개 끝(HAND_Y)에 들고 다니는 것들이 붙음
  const outlineM = ol.material as THREE.Material;
  const wing = (sx: number) => {
    const piv = new THREE.Group(); piv.position.set(sx * CHICK.r * 1.0, CHICK.y - 0.08, 0.02); inner.add(piv);
    const wm = toon(FEATHER2); wm.emissive.setHex(FEATHER2).multiplyScalar(0.2);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), wm); w.scale.set(0.3, 0.68, 0.6); w.position.set(sx * 0.03, -0.17, 0.02); w.rotation.z = sx * 0.35; w.name = 'wing'; piv.add(w);
    const wo = new THREE.Mesh(w.geometry, outlineM); wo.scale.copy(w.scale).multiplyScalar(1.06); wo.position.copy(w.position); wo.rotation.copy(w.rotation); piv.add(wo);
    return piv;
  };
  const armL = wing(-1), armR = wing(1);
  // 다리 = 짧은 주황 다리 + 발가락 셋
  const leg = (sx: number) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.15, 0.2, 0); inner.add(piv);
    // 프사처럼 가는 검은 선 다리 + 발가락 셋
    const legM = new THREE.MeshBasicMaterial({ color: 0x2a2522 });
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.19, 6), legM); l.position.y = -0.095; piv.add(l);
    for (const a of [-0.6, 0, 0.6]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 5), legM); toe.rotation.set(-Math.PI / 2, 0, -a); toe.position.set(-Math.sin(a) * 0.04, -0.19, -Math.cos(a) * 0.04); piv.add(toe); }
    return piv;
  };
  const legL = leg(-1), legR = leg(1);
  // 머그컵: 오른쪽 날개 끝에 붙이고, 날개가 돌아가도 컵은 똑바로 서 있게 animChar에서 반대로 돌린다
  const mug = new THREE.Group(); mug.position.set(0, HAND_Y, -0.06); mug.visible = false; armR.add(mug);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.17, 14), M(0xfff6ea)); mug.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), M(0x5a3520));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.081; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), M(0xfff6ea));
  handle.rotation.z = -Math.PI / 2; handle.position.x = 0.085; mug.add(handle);
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  steam.position.y = 0.16; mug.add(steam);
  const blanket = makeBlanket(hatC); blanket.scale.set(1.4, 0.9, 1.4); blanket.position.y = -0.1; inner.add(blanket);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);
  return { root, inner, armL, armR, legL, legR, phase: Math.random() * 6, pace: 1, state: 'idle', bench: false, emote: null, emoteT: 0, mug, steam, blanket };
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
const EMOTE_T: Record<Emote, number> = { stretch: 1.8, wave: 1.9, cheers: 2.6, clink: 2.6, clap: 2.2, skip: 1.1, dig: 1.6, give: 2.2, take: 2.2, eat: 1.8, pet: 2.0, dance: 4.0, yaho: 2.2, raise: 3.2, crow: 2.0, hop: 0.9, peck: 1.8 };
export function animChar(c: Char, dt: number) {
  const fast = c.state === 'walk' ? Math.max(0, Math.min(1, (c.pace - 1.15) / 0.4)) : 0;
  c.phase += dt * (c.state === 'walk' ? 9 * Math.max(0.65, c.pace) * (1 + fast * 0.25) : 1.6);
  let aL = 0, aR = 0, aRz = 0, aLz = 0, lL = 0, lR = 0, y = 0, rx = 0;
  if (c.state === 'walk') {
    const s = Math.sin(c.phase);
    lL = s * 0.6; lR = -s * 0.6; aL = -s * 0.3; aR = s * 0.3; aLz = -0.25; aRz = 0.25; y = Math.abs(Math.cos(c.phase)) * 0.05;
    // 빠른 걸음 (총총): 몸을 앞으로 숙이고, 날개를 옆으로 벌려 파닥, 보폭은 짧게, 통통 튀게
    if (fast > 0) { lL *= 1 - fast * 0.25; lR *= 1 - fast * 0.25; aLz = -0.25 - fast * (0.55 + Math.abs(s) * 0.35); aRz = 0.25 + fast * (0.55 + Math.abs(s) * 0.35); aL *= 1 - fast * 0.6; aR *= 1 - fast * 0.6; y += fast * Math.abs(Math.cos(c.phase)) * 0.06; rx = fast * 0.2; }
  } else if (c.state === 'sit') {
    // 방석: 다리를 앞으로 쭉 / 통나무: 무릎 아래로 다리를 내리고 손은 무릎 위에
    y = -0.16;
    if (c.bench) { lL = lR = 1.05; aL = aR = 0.55; } else { lL = lR = Math.PI / 2; aL = aR = 0.4; }
  } else if (c.state === 'lie') {
    // 모래에 등을 대고 누워 하늘 보기: 팔은 머리 뒤로 깍지
    rx = Math.PI / 2; y = CHICK.r * 0.85; aL = aR = 0; aLz = -1.2; aRz = 1.2; lL = lR = -0.3;
  } else {
    y = Math.sin(c.phase) * 0.012;
  }
  // 꽃다발을 들고 있으면 오른팔을 살짝 앞으로
  // 꽃다발을 들고 있으면 오른팔을 앞으로 (꽃은 아래 animChar 끝에서 똑바로 세움)
  if (c.state !== 'walk' && c.state !== 'lie' && c.armR.getObjectByName('flowers')?.visible) aR = 1.0;
  if (c.state !== 'lie' && FOODS.some(n => c.armR.getObjectByName(n)?.visible)) aR = c.state === 'walk' ? 0.8 : 1.15;
  let rz = c.state === 'walk' ? Math.sin(c.phase) * 0.12 : 0;
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
      // 날개가 짧아 앞에서 못 맞닿으니, 펭귄처럼 날개로 몸통 아래(허벅지 쪽)를 탁탁 침
      const reach = clamp(k * 2, 0, 1), out = Math.abs(Math.sin(c.emoteT * 10)) * 0.75 * reach;
      aL = aR = -0.12 * reach; aLz = -out; aRz = out; lL = lR = 0.12 * out; y += 0.02 * out;
    }
    if (c.emote === 'hop') {
      // 파닥 점프: 날개를 퍼덕이며 폴짝
      const up = Math.sin(clamp(c.emoteT / 0.9, 0, 1) * Math.PI), fl = Math.sin(c.emoteT * 34) * 0.5;
      y += up * 0.85; aLz = -(1.1 + fl); aRz = 1.1 + fl; lL = lR = -0.5 * up;
    }
    if (c.emote === 'peck') {
      // 모이 쪼기: 몸을 앞으로 콕콕
      const d = Math.max(0, Math.sin(c.emoteT * 9)) * k;
      rx = 0.75 * d; y -= 0.05 * d; aLz = -0.35 * k; aRz = 0.35 * k;
    }
    if (c.emote === 'pet') {
      // 쪼그려 앉아 오른손으로 머리를 토닥토닥
      const kk = clamp(k * 2.2, 0, 1), pat = Math.abs(Math.sin(c.emoteT * 8)) * 0.3;
      y -= 0.12 * kk; lL = lR = 1.25 * kk; aR = (0.95 + pat) * kk;
    }
    if (c.emote === 'dig') {
      // 쪼그려 앉아 모래를 토닥토닥
      const kk = clamp(k * 2.2, 0, 1), pat = Math.abs(Math.sin(c.emoteT * 9)) * 0.35;
      y -= 0.12 * kk; lL = lR = 1.3 * kk; aL = aR = (1.0 + pat) * kk; rx = 0.5 * kk;
    }
    if (c.emote === 'dance') {
      // 신나게: 양팔을 번갈아 위로, 무릎 까딱, 몸을 좌우로 흔들기
      const kk = clamp(k * 3, 0, 1), b = c.emoteT * 7.5;
      aL = (1.6 + Math.sin(b) * 1.1) * kk; aR = (1.6 - Math.sin(b) * 1.1) * kk;
      aLz = -0.5 * kk; aRz = 0.5 * kk;
      y += Math.abs(Math.sin(b)) * 0.1 * kk; rz = Math.sin(b / 2) * 0.18 * kk;
      lL = Math.max(0, Math.sin(b)) * 0.4 * kk; lR = Math.max(0, -Math.sin(b)) * 0.4 * kk;
    }
    if (c.emote === 'yaho') {
      // 두 손을 입 옆에 모으고 살짝 뒤로 젖혔다가 앞으로 "야호~"
      const kk = clamp(k * 2.5, 0, 1);
      aL = aR = 2.5 * kk; aLz = -0.75 * kk; aRz = 0.75 * kk; y += 0.04 * kk;
    }
    if (c.emote === 'raise') {
      // 해 뜨는 순간: 들고 있던 걸 하늘로 번쩍 (위아래로 두 번 들썩)
      const kk = clamp(k * 2.4, 0, 1), bob = Math.abs(Math.sin(c.emoteT * 5)) * 0.15;
      aR = (2.95 - bob) * kk; aRz = 0.1 * kk; aL = 0.9 * kk; aLz = -0.4 * kk; y += (0.05 + bob * 0.4) * kk;
    }
    if (c.emote === 'crow') {
      // 해를 보며 울기: 몸을 뒤로 젖히고 부리를 벌리고 날개를 파닥
      const kk = clamp(k * 2.2, 0, 1), flut = kk > 0.6 ? Math.sin(c.emoteT * 30) * 0.18 : 0;
      rx = -0.32 * kk; aL = aR = 0.2 * kk; aLz = -(1.3 * kk + flut); aRz = 1.3 * kk + flut; y += 0.04 * kk;
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
  // 손잡기: 상대 쪽 날개를 옆으로 뻗음
  const hs = c.inner.userData.hold as number | undefined;
  if (hs && !c.emote && c.state !== 'lie') { if (hs < 0) c.armL.rotation.z += (-1.0 - c.armL.rotation.z) * e; else c.armR.rotation.z += (1.0 - c.armR.rotation.z) * e; }
  // 울 때 부리 벌리기
  const low = c.inner.getObjectByName('beakLow');
  if (low) low.rotation.x = c.emote === 'crow' ? -0.6 * clamp(Math.sin(Math.PI * clamp(c.emoteT / 2, 0, 1)) * 2.2, 0, 1) : 0;
  // 눈 깜빡임
  const blink = (c.phase * 0.55) % 5 < 0.08;
  c.inner.children.forEach(ch => { if (ch.name === 'eye') ch.scale.y = blink ? 0.12 : 1; });
  // 쥐불놀이: 오른팔을 옆으로 들고, 손끝에서 불깡통이 세로로 빙글빙글
  const jw = c.inner.getObjectByName('jwibul');
  if (jw?.visible && c.state !== 'lie') {
    aR = 0; aRz = 1.45;
    const sp = (c.inner.userData.jwSpeed as number | undefined) ?? 7;
    jw.rotation.z -= sp * dt;
  }
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
  for (const [arm, name] of [[c.armR, 'flowers'], [c.armL, 'flowersL'], [c.armR, 'ramen'], [c.armR, 'kimbap'], [c.armR, 'coffee'], [c.armR, 'makgeolli'], [c.armR, 'goalPaper']] as const) {
    const f = arm.getObjectByName(name);
    if (f?.visible) { f.rotation.x = -arm.rotation.x; f.rotation.z = -arm.rotation.z; }
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
export const OUTFIT = { sweat: 1, scarf: 2, flowers: 4, ramen: 8 } as const;
/** 옷장 (비트 4~12): 겉옷 3비트, 모자 2비트, 목도리 2비트, 왼손 2비트. 실루엣으로도 구분되게 모양 위주 */
export const WEAR = {
  head: { shift: 4, bits: 7 },    // 0 없음, 1 해 무늬 댕기, 2 햇살 머리띠, 3 봉황 깃털, 4 철쭉 꽃, 5 단풍잎 (모두 볏을 가리지 않게 옆·뒤에)
  neck: { shift: 7, bits: 7 },    // 0 없음, 1 털목도리, 2 노리개, 3 책보, 4 복주머니
  wing: { shift: 10, bits: 7 },   // 0 없음, 1 나뭇가지 지팡이, 2 표주박, 3 붓, 4 연잎 우산 (왼쪽 날개)
  foot: { shift: 0, bits: 3 },    // 0 없음, 1 짚신, 2 버선 (예전 맨투맨·빨간 목도리 비트를 다시 씀)
} as const;
export type WearSlot = keyof typeof WEAR;
export const wearGet = (mask: number, k: WearSlot) => (mask >> WEAR[k].shift) & WEAR[k].bits;
export const wearSet = (mask: number, k: WearSlot, v: number) => (mask & ~(WEAR[k].bits << WEAR[k].shift)) | ((v & WEAR[k].bits) << WEAR[k].shift);
/** 쥐불놀이: 비트 13 켜짐, 14~15 불 색 */
export const JWIBUL = 1 << 13;
export const JW_COLORS = [0xff9a3c, 0x6fb6ff, 0xff8fbf, 0x8dffb0];
export const jwColor = (mask: number) => JW_COLORS[(mask >> 14) & 3];
/** 지리산 가게에서 들고 나온 것: 비트 16~17 (0 없음, 1 김밥, 2 커피, 3 막걸리 주전자) */
export const SHOP_ITEM_SHIFT = 16;
export const SHOP_ITEMS = ['', 'kimbap', 'coffee', 'makgeolli'] as const;
export const itemOf = (mask: number) => (mask >> SHOP_ITEM_SHIFT) & 3;
export const withItem = (mask: number, k: number) => (mask & ~(3 << SHOP_ITEM_SHIFT)) | ((k & 3) << SHOP_ITEM_SHIFT);
export const OUTFIT_MAX = (1 << 18) - 1;
const PAD_COLORS = [0, 0x1d1e24, 0xece8e0, 0x26304f, 0xd2a03c];

/** 체크무늬 (목도리용) */
let plaidTex: THREE.Texture | null = null;
function plaid() {
  if (plaidTex) return plaidTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = '#b8322c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(30,30,50,.55)'; for (const x of [8, 40]) { g.fillRect(x, 0, 12, 64); g.fillRect(0, x, 64, 12); }
  g.fillStyle = 'rgba(255,230,180,.6)'; for (const x of [28, 60]) { g.fillRect(x, 0, 2, 64); g.fillRect(0, x, 64, 2); }
  plaidTex = stable(new THREE.CanvasTexture(c)); plaidTex.wrapS = plaidTex.wrapT = THREE.RepeatWrapping; plaidTex.repeat.set(3, 1);
  return plaidTex;
}

/** 옷장 메시를 한 번만 만들어 두고 켜고 끄기 */
function buildWear(c: Char, o: THREE.Group) {
  const T = (col: number) => toon(col), R = CHICK.r, Y = CHICK.y;
  const ol = new THREE.MeshBasicMaterial({ color: 0x3a2a20, side: THREE.BackSide });
  const outl = (m: THREE.Mesh, k = 1.12) => { const e = new THREE.Mesh(m.geometry, ol); e.position.copy(m.position); e.rotation.copy(m.rotation); e.scale.copy(m.scale).multiplyScalar(k); m.parent!.add(e); };
  const grp = (name: string, parent: THREE.Object3D = o) => { const g = new THREE.Group(); g.name = name; g.visible = false; parent.add(g); return g; };
  // ---- 머리 (볏을 가리지 않게 머리 뒤·옆) ----
  { // 해 무늬 댕기: 머리 뒤 붉은 매듭 + 늘어진 두 가닥 + 작은 해
    const g = grp('w_daenggi'), red = T(0xc0302a);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), red); knot.position.set(0, Y + 0.33, R * 0.86); g.add(knot); outl(knot);
    for (const sx of [-1, 1]) { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.36, 0.02), red); rb.position.set(sx * 0.05, Y + 0.14, R * 0.98); rb.rotation.set(0.32, 0, sx * 0.16); g.add(rb); }
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), new THREE.MeshBasicMaterial({ color: 0xffd060 })); sun.position.set(0.06, Y + 0.02, R * 1.05); g.add(sun);
  }
  { // 햇살 머리띠: 머리 오른쪽 위에 꽂은 작은 해 + 햇살
    const g = grp('w_band');
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), T(0xffc040)); sun.position.set(0.42, Y + 0.36, -0.08); g.add(sun); outl(sun);
    for (let i = 0; i < 6; i++) { const ray = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.07, 4), T(0xffd870)); const a = i / 6 * Math.PI * 2; ray.position.set(0.42 + Math.cos(a) * 0.1, Y + 0.36 + Math.sin(a) * 0.1, -0.08); ray.rotation.z = a - Math.PI / 2; g.add(ray); }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.018, 5, 28, Math.PI * 0.55), T(0xe8b040)); strap.position.set(0, Y + 0.05, 0); strap.rotation.set(0, Math.PI / 2, 0.85); g.add(strap);
  }
  { // 봉황 깃털: 왼쪽 위에 비스듬히 꽂은 붉고 금빛인 긴 깃
    const g = grp('w_feather');
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), T(0xe0453a)); f.scale.set(0.28, 1.5, 0.22); f.position.set(-0.36, Y + 0.5, 0.05); f.rotation.z = 0.55; g.add(f); outl(f, 1.1);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), T(0xffc040)); tip.scale.set(0.5, 1.3, 0.35); tip.position.set(-0.44, Y + 0.7, 0.05); tip.rotation.z = 0.55; g.add(tip);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), T(0x3a6ad0)); eye.position.set(-0.43, Y + 0.68, 0.0); g.add(eye);
  }
  { // 철쭉 꽃: 오른쪽 귀 위 분홍 꽃 한 송이
    const g = grp('w_azalea');
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, pe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), T(0xf07aa8)); pe.scale.set(1, 0.4, 1); pe.position.set(0.48 + Math.cos(a) * 0.05, Y + 0.3, -0.08 + Math.sin(a) * 0.05); g.add(pe); }
    const ct = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), T(0xffe08a)); ct.position.set(0.48, Y + 0.33, -0.08); g.add(ct);
    g.rotation.z = -0.35;
  }
  { // 단풍잎: 왼쪽 머리에 붉은 잎 한 장
    const g = grp('w_maple');
    const sh = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, rr = i % 2 ? 0.045 : 0.1; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(sh), Object.assign(T(0xd8452a), { side: THREE.DoubleSide })); leaf.position.set(-0.47, Y + 0.32, -0.06); leaf.rotation.set(0, -1.1, 0.4); g.add(leaf);
  }
  // ---- 목 ----
  { // 노리개: 가슴 앞 매듭 + 옥 + 술
    const g = grp('w_norigae');
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 6, 10), T(0xc0302a)); knot.position.set(0.12, Y - 0.12, -R * 0.94); g.add(knot);
    const jade = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), T(0x5ab89a)); jade.scale.set(1, 1.3, 0.6); jade.position.set(0.12, Y - 0.2, -R * 0.93); g.add(jade); outl(jade);
    const tas = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), T(0xc0302a)); tas.position.set(0.12, Y - 0.31, -R * 0.88); g.add(tas);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.012, 4, 28), T(0xc0302a)); cord.rotation.x = Math.PI / 2 - 0.12; cord.position.y = Y - 0.08; cord.scale.set(1.2, 1.04, 1); g.add(cord);
  }
  { // 책보: 등에 멘 남색 보따리 + 가슴을 가로지르는 끈
    const g = grp('w_bobae'), blue = T(0x3a5aa0);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), blue); bun.scale.set(1.1, 0.75, 0.6); bun.position.set(0, Y + 0.02, R * 0.92); g.add(bun); outl(bun, 1.06);
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), blue); tie.scale.set(1.4, 0.7, 0.8); tie.position.set(0, Y + 0.16, R * 1.06); g.add(tie);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.02, 4, 28), T(0x2a3a70)); strap.rotation.set(Math.PI / 2, 0.55, 0); strap.position.y = Y; g.add(strap);
  }
  { // 복주머니: 목에 건 작은 붉은 주머니
    const g = grp('w_bok');
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), T(0xd02a3a)); bag.scale.set(1, 1.1, 0.8); bag.position.set(0, Y - 0.2, -R * 0.93); g.add(bag); outl(bag);
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 10), T(0xf0c040)); top.rotation.x = Math.PI / 2; top.position.set(0, Y - 0.12, -R * 0.92); g.add(top);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.01, 4, 28), T(0xf0c040)); cord.rotation.x = Math.PI / 2 - 0.12; cord.position.y = Y - 0.08; cord.scale.set(1.2, 1.04, 1); g.add(cord);
  }
  // ---- 왼쪽 날개 ----
  { const g = grp('w_stick', c.armL); g.position.set(0, HAND_Y, -0.05);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.8, 6), T(0x7a5a3a)); st.position.y = 0.05; g.add(st);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), T(0x5aa86a)); lf.scale.set(1, 0.5, 1.6); lf.position.set(0.04, 0.44, 0); g.add(lf); }
  { const g = grp('w_gourd', c.armL); g.position.set(0, HAND_Y - 0.06, -0.05);
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), T(0xd9a64a)); g.add(a); outl(a);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), T(0xd9a64a)); b2.position.y = 0.1; g.add(b2);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 4, 10), T(0xc0574a)); t.rotation.x = Math.PI / 2; t.position.y = 0.06; g.add(t); }
  { const g = grp('w_brush', c.armL); g.position.set(0, HAND_Y, -0.06);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), T(0xc9a46a)); h.position.y = 0.08; g.add(h);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 6), T(0x1a1a1a)); tip.rotation.x = Math.PI; tip.position.y = -0.1; g.add(tip); }
  { const g = grp('w_lotus', c.armL); g.position.set(0, HAND_Y, -0.05);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.75, 5), T(0x5a8a4a)); st.position.y = 0.33; g.add(st);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.12, 18, 1, true), Object.assign(T(0x5aa86a), { side: THREE.DoubleSide })); leaf.position.y = 0.74; leaf.rotation.x = Math.PI; g.add(leaf); }
  // ---- 발 ----
  for (const leg of [c.legL, c.legR]) {
    const js = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.2), T(0xc9a463)); js.name = 'w_jipsin'; js.position.set(0, -0.19, -0.04); js.visible = false; leg.add(js);
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 8), T(0xf6f2ea)); bs.name = 'w_beoseon'; bs.position.y = -0.11; bs.visible = false; leg.add(bs);
  }
}

/** 쥐불놀이 깡통: 오른쪽 어깨 옆 한 점을 중심으로 줄 끝의 깡통이 돈다 */
function applyJwibul(c: Char, mask: number) {
  let jw = c.inner.getObjectByName('jwibul') as THREE.Group | undefined;
  const on = !!(mask & JWIBUL);
  if (!jw) {
    if (!on) return;
    jw = new THREE.Group(); jw.name = 'jwibul'; jw.position.set(0.82, CHICK.y + 0.08, 0.05); c.inner.add(jw);
    const R = 0.8;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, R, 4), new THREE.MeshBasicMaterial({ color: 0x9a8f86 }));
    wire.position.y = R / 2; jw.add(wire);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.16, 10), new THREE.MeshLambertMaterial({ color: 0x3a2a22 }));
    can.name = 'can'; can.position.y = R; jw.add(can);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb35c }));
    ember.name = 'ember'; ember.position.y = R + 0.02; jw.add(ember);
  }
  jw.visible = on;
  ((jw.getObjectByName('ember') as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(jwColor(mask));
}

// ---------- 성장 단계 ----------
/** 해를 본 날 수 → 단계 (0 알에서 막 깸 … 5 다 자란 닭). 30번째 해에 봉황 (모습은 아직 준비 중) */
export const GROWTH_DAYS = [0, 1, 3, 7, 14, 20];
export const PHOENIX_AT = 30;
export const growthOf = (days: number) => GROWTH_DAYS.reduce((g, d, i) => (days >= d ? i : g), 0);
const GROWTH = [
  { s: 0.86, w: 0, comb: 0, wat: 0, tail: 0 },
  { s: 0.9, w: 0, comb: 0, wat: 0, tail: 0 },
  { s: 1.0, w: 0, comb: 0, wat: 0, tail: 0 },
  { s: 1.04, w: 0.5, comb: 0.35, wat: 0, tail: 0.3 },
  { s: 1.1, w: 0.88, comb: 0.7, wat: 0.55, tail: 0.65 },
  { s: 1.18, w: 1, comb: 1, wat: 1, tail: 1 },
];
const YEL = new THREE.Color(FEATHER), YEL2 = new THREE.Color(FEATHER2), WHT = new THREE.Color(0xfffaf0), WHT2 = new THREE.Color(0xeee6d6);
export function setGrowth(c: Char, g: number) {
  g = clamp(Math.round(g), 0, GROWTH.length - 1);
  const G = GROWTH[g]; c.inner.userData.g = g;
  c.inner.scale.setScalar(G.s);
  const body = c.inner.getObjectByName('chickBody') as THREE.Mesh;
  (body.material as THREE.MeshToonMaterial).color.copy(YEL).lerp(WHT, G.w);
  (body.material as THREE.MeshToonMaterial).emissive.copy((body.material as THREE.MeshToonMaterial).color).multiplyScalar(0.3);
  for (const arm of [c.armL, c.armR]) ((arm.getObjectByName('wing') as THREE.Mesh).material as THREE.MeshToonMaterial).color.copy(YEL2).lerp(WHT2, G.w);
  c.inner.getObjectByName('tailF')!.traverse(o => { if (o.name === 'tailFeather') ((o as THREE.Mesh).material as THREE.MeshToonMaterial).color.copy(YEL2).lerp(WHT2, G.w); });
  const comb = c.inner.getObjectByName('comb')!, wat = c.inner.getObjectByName('wattle')!, tail = c.inner.getObjectByName('tailF')!;
  comb.scale.setScalar(Math.max(0.01, G.comb)); wat.scale.setScalar(Math.max(0.01, G.wat)); tail.scale.setScalar(Math.max(0.01, G.tail));
  wat.visible = G.wat > 0; tail.visible = G.tail > 0;
  headTop(c);
}
export const growthStage = (c: Char) => (c.inner.userData.g as number | undefined) ?? 2;
/** 머리 위: 모자를 쓰면 모자만, 안 쓰면 첫날엔 알껍질 / 그다음엔 솜털 → 볏 */
function headTop(c: Char) {
  const o = c.inner.getObjectByName('outfit');
  const g = growthStage(c), G = GROWTH[g];
  const bare = true; // 모자는 없음: 알껍데기·솜털·볏이 늘 보임
  c.inner.getObjectByName('eggshell')!.visible = bare && g === 0;
  c.inner.getObjectByName('tuft')!.visible = bare && g > 0 && G.comb < 0.3;
  c.inner.getObjectByName('comb')!.visible = bare && G.comb > 0;
}

/** 옷장 상태 반영 (머리·목·날개·발) */
function applyWear(c: Char, o: THREE.Group, mask: number) {
  const head = wearGet(mask, 'head'), neck = wearGet(mask, 'neck'), wing = wearGet(mask, 'wing'), foot = wearGet(mask, 'foot');
  ['', 'w_daenggi', 'w_band', 'w_feather', 'w_azalea', 'w_maple'].forEach((n, i) => { if (n) o.getObjectByName(n)!.visible = head === i; });
  o.getObjectByName('scarf')!.visible = neck === 1;
  ['', '', 'w_norigae', 'w_bobae', 'w_bok'].forEach((n, i) => { if (n) o.getObjectByName(n)!.visible = neck === i; });
  ['', 'w_stick', 'w_gourd', 'w_brush', 'w_lotus'].forEach((n, i) => { if (n) c.armL.getObjectByName(n)!.visible = wing === i; });
  for (const leg of [c.legL, c.legR]) { leg.getObjectByName('w_jipsin')!.visible = foot === 1; leg.getObjectByName('w_beoseon')!.visible = foot === 2; }
  // 예전 기본 비니·목도리는 쓰지 않음 (맨 병아리가 기본)
  for (const n of ['hat0', 'pom0', 'scarf0']) { const g = c.inner.getObjectByName(n); if (g) g.visible = false; }
}
/** 손에 드는 먹을거리 (그 장소를 떠나면 내려놓음) */
export const HELD = OUTFIT.ramen;
const FOODS = ['ramen', 'kimbap', 'coffee', 'makgeolli', 'goalPaper'];

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



/** 오른손에 드는 가게 먹을거리: 은박 김밥, 종이컵 커피, 노란 양은 주전자 */
function buildShopItems(c: Char) {
  const L = (col: number, em = 0) => new THREE.MeshLambertMaterial({ color: col, emissive: em });
  const k = new THREE.Group(); k.name = 'kimbap'; k.position.set(0, HAND_Y, -0.1); k.scale.setScalar(1.5); k.visible = false; c.armR.add(k);
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), L(0xc9ccd2, 0x202226)); foil.rotation.x = Math.PI / 2 - 0.3; k.add(foil);
  const end = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 10), [L(0x16221a), L(0xf4efe2), L(0xf4efe2)]); end.rotation.x = Math.PI / 2 - 0.3; end.position.set(0, 0.03, -0.1); k.add(end);
  const cf = new THREE.Group(); cf.name = 'coffee'; cf.position.set(0, HAND_Y, -0.1); cf.scale.setScalar(1.5); cf.visible = false; c.armR.add(cf);
  cf.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.13, 12), L(0xf3ece0)));
  const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.043, 0.05, 12), L(0x8a5a3a)); sl.position.y = -0.005; cf.add(sl);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.02, 12), L(0xe9e1d2)); lid.position.y = 0.075; cf.add(lid);
  const mk = new THREE.Group(); mk.name = 'makgeolli'; mk.position.set(0, HAND_Y - 0.02, -0.12); mk.scale.setScalar(1.5); mk.visible = false; c.armR.add(mk);
  const yel = L(0xe2b13c, 0x3a2a08);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), yel); body.scale.y = 0.85; mk.add(body);
  const lidK = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.025, 10), yel); lidK.position.y = 0.06; mk.add(lidK);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.1, 6), yel); sp.position.set(0, 0.02, -0.08); sp.rotation.x = -0.9; mk.add(sp);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 4, 12, Math.PI), yel); hd.position.y = 0.055; hd.rotation.y = Math.PI / 2; mk.add(hd);
}

export function setOutfit(c: Char, mask: number) {
  let o = c.inner.getObjectByName('outfit') as THREE.Group | undefined;
  if (!o) {
    o = new THREE.Group(); o.name = 'outfit'; c.inner.add(o);
    // 빨간 목도리: 목에 두르고 한 자락은 가슴 앞으로
    const scarf = new THREE.Group(); scarf.name = 'scarf';
    const red = new THREE.MeshLambertMaterial({ color: 0xd06a5c }); // 옅은 수채 다홍
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CHICK.r * 0.9, 0.075, 8, 24), red); ring.rotation.x = Math.PI / 2 - 0.12; ring.position.y = CHICK.y - 0.1; ring.scale.set(1.13, 1.02, 1); scarf.add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.05), red); tail.position.set(0.12, CHICK.y - 0.27, -CHICK.r * 0.93); tail.rotation.set(0.3, 0, 0.08); scarf.add(tail);
    o.add(scarf);
    // 맨투맨 밑단 시보리
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.03, 6, 18), new THREE.MeshLambertMaterial({ color: 0x7c7e84 }));
    hem.name = 'hem'; hem.rotation.x = Math.PI / 2; hem.position.y = 0.34; hem.visible = false; o.add(hem);
    // 꽃다발: 오른손(들고 있을 때)과 왼손(받는 순간) 두 군데
    for (const [arm, name] of [[c.armR, 'flowers'], [c.armL, 'flowersL']] as const) {
      const f = makeBuckwheat(); f.name = name; f.position.set(0, HAND_Y + 0.02, -0.05); f.visible = false; arm.add(f);
    }
    // 라면 그릇: 오른손에 종이 용기 + 젓가락 + 김
    const bowl = new THREE.Group(); bowl.name = 'ramen'; bowl.position.set(0, HAND_Y, -0.06); bowl.visible = false; c.armR.add(bowl);
    const cupM = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
    const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.13, 14), cupM); bowl.add(cupMesh);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.105, 0.04, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0xd8302f, side: THREE.DoubleSide })); band.position.y = 0.02; bowl.add(band);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), new THREE.MeshLambertMaterial({ color: 0xc8541f })); soup.rotation.x = -Math.PI / 2; soup.position.y = 0.06; bowl.add(soup);
    for (let k = 0; k < 6; k++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 8), new THREE.MeshLambertMaterial({ color: 0xf1d08a })); n.rotation.x = Math.PI / 2; n.position.set((k % 3 - 1) * 0.035, 0.065, (k < 3 ? -1 : 1) * 0.025); bowl.add(n); }
    for (const dx of [-0.012, 0.012]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.26, 4), new THREE.MeshLambertMaterial({ color: 0xc9a46a })); ch.position.set(0.05 + dx, 0.12, 0); ch.rotation.z = -0.5; bowl.add(ch); }
    const bsteam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
    bsteam.name = 'bsteam'; bsteam.position.y = 0.14; bowl.add(bsteam);
    buildShopItems(c);
    buildWear(c, o);
  }
  c.armR.getObjectByName('flowers')!.visible = !!(mask & OUTFIT.flowers);
  c.armR.getObjectByName('ramen')!.visible = !!(mask & OUTFIT.ramen);
  const item = itemOf(mask), jw = !!(mask & JWIBUL);
  SHOP_ITEMS.forEach((n, k) => { if (n) c.armR.getObjectByName(n)!.visible = item === k && !jw && !(mask & OUTFIT.ramen); });
  o.userData.mask = mask;
  // 목표 종이를 쥐고 있으면 가게 먹을거리는 내려놓음
  if (c.armR.getObjectByName('goalPaper')?.visible) SHOP_ITEMS.forEach(n => { if (n) c.armR.getObjectByName(n)!.visible = false; });
  applyWear(c, o, mask);
  applyJwibul(c, mask);
  headTop(c);
}
/** 청학당에서 접은 오늘의 목표 종이: 오른쪽 날개 끝에 꼭 쥠 (가게 먹을거리는 잠시 내려놓음) */
export function setGoalPaper(c: Char, on: boolean) {
  let p = c.armR.getObjectByName('goalPaper') as THREE.Group | undefined;
  if (!p) {
    p = new THREE.Group(); p.name = 'goalPaper'; p.position.set(0, HAND_Y + 0.02, -0.08); c.armR.add(p);
    const M = (col: number) => new THREE.MeshLambertMaterial({ color: col });
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.025), M(0xf3e8cf)); sheet.rotation.z = 0.12; p.add(sheet);
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.008, 0.027), M(0xd8c69e)); fold.rotation.z = 0.12; p.add(fold);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 10), M(0xc0574a)); tie.rotation.set(Math.PI / 2, 0, 0.12); tie.position.y = 0.0; tie.scale.set(1.6, 1, 1); p.add(tie);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.18, depthWrite: false })); glow.name = 'paperGlow'; p.add(glow);
  }
  p.visible = on;
  for (const n of SHOP_ITEMS) if (n) { const it = c.armR.getObjectByName(n); if (it && on) it.visible = false; }
}
/** 헤드랜턴: 이마의 작은 불빛과 앞쪽 땅을 비추는 빛 (밤·새벽에만) */
let lampTex: THREE.Texture | null = null;
export function setLamp(c: Char, k: number) {
  let L = c.inner.getObjectByName('lamp') as THREE.Group | undefined;
  if (!L) {
    if (!lampTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,252,230,1)'); gr.addColorStop(0.3, 'rgba(255,240,190,.55)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); lampTex = new THREE.CanvasTexture(cv); }
    L = new THREE.Group(); L.name = 'lamp'; c.inner.add(L);
    const p = onBody(0, 0.55, -0.83, 1.02); L.position.copy(p);
    const band = new THREE.Mesh(new THREE.TorusGeometry(CHICK.r * 0.86, 0.018, 4, 24), new THREE.MeshLambertMaterial({ color: 0x2a2a30 })); band.rotation.x = Math.PI / 2 - 0.25; band.position.set(0, CHICK.y + CHICK.r * 0.5 - p.y, -p.z); L.add(band);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a3a40 })); L.add(box);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.025, 10), new THREE.MeshBasicMaterial({ color: 0xfffbe0 })); bulb.position.z = -0.026; bulb.rotation.y = Math.PI; L.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(0.55); glow.position.z = -0.05; glow.name = 'lampGlow'; L.add(glow);
    // 앞쪽 땅을 비추는 빛줄기 (원뿔)
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2 - 0.45; beam.position.set(0, -0.45, -1.0); beam.name = 'beam'; L.add(beam);
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 })); spot.scale.set(1.2, 0.6, 1); spot.position.set(0, -p.y + 0.05, -1.8); spot.name = 'spot'; L.add(spot);
  }
  L.visible = k > 0.02;
  if (L.visible) { (L.getObjectByName('lampGlow') as THREE.Sprite).material.opacity = k; ((L.getObjectByName('beam') as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.04 * k; (L.getObjectByName('spot') as THREE.Sprite).material.opacity = 0.35 * k; }
  // 모자를 쓰면 띠가 모자 위로 보이도록 조금 바깥
}
export const outfitOf = (c: Char) => ((c.inner.getObjectByName('outfit')?.userData.mask as number) ?? 0);
/** 받는 순간 왼손에 꽃 보이기 */
export function showLeftFlowers(c: Char, on: boolean) { const f = c.armL.getObjectByName('flowersL'); if (f) f.visible = on; }
