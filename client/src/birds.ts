import * as THREE from 'three';
import { stable } from './stable-tex';
import { DRAW_SP, drawBird } from './bird-draw';

/**
 * 하늘의 새들 — 여러 종류 · 여러 대형으로 시간에 따라 랜덤하게 날아감
 * - 종류: 기러기, 갈매기, 제비, 작은 새, 황금 새(해돋이 순간 하루 한 번)
 * - 대형: 해에서 오는 갈매기, 긴 행렬, 황금 새, 제비 둘, 작은 새 떼
 * - 기본은 검은 실루엣, 해에 가까울수록 날개 가장자리가 금빛 (역광)
 * 그리기: 날갯짓 9장면을 캔버스에 미리 그려 한 장의 그림(아틀라스)으로 만들고,
 * 모든 새를 한 번의 그리기 호출(인스턴싱)로 그림. 아주 먼 새는 작은 'v' 획 그림으로 바꿔 보이게 함
 */

type Sp = { span: number; flap: number; glide: number; row: number }; // 모양은 bird-draw.ts의 DRAW_SP
const SP: Record<'goose' | 'gull' | 'swallow' | 'small' | 'golden', Sp> = {
  goose:   { span: 1.6,  flap: 3.0, glide: 0,    row: 0 },
  gull:    { span: 1.3,  flap: 3.4, glide: 0.45, row: 1 },
  swallow: { span: 0.34, flap: 9,   glide: 0.25, row: 2 },
  small:   { span: 0.3,  flap: 11,  glide: 0,    row: 3 },
  golden:  { span: 2.2,  flap: 1.4, glide: 0.55, row: 4 },
};
const ROW_TICK = 5, ROWS = 6, COLS = 9, CELL = 160, FILL = 0.4; // 날개 반폭 = 칸의 40%
const frameF = (i: number) => -1 + (2 * i) / (COLS - 1);           // 칸 번호 → 날갯짓 값 -1..1
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = THREE.MathUtils.clamp;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------- 아틀라스: 날갯짓 장면들을 미리 그려 둠 (모양은 bird-draw.ts) ----------
/** base: 실루엣(황금 새는 금빛 그대로), rim: 역광 빛 마스크 (흰색, 셰이더에서 금빛으로 칠함) */
function buildAtlas() {
  const mk = () => { const c = document.createElement('canvas'); c.width = COLS * CELL; c.height = ROWS * CELL; return c; };
  const baseC = mk(), rimC = mk(), base = baseC.getContext('2d')!, rim = rimC.getContext('2d')!;
  const s = CELL * FILL;
  for (const [key, sp] of Object.entries(SP) as [keyof typeof SP, Sp][]) {
    const ds = DRAW_SP[key], gold = key === 'golden';
    for (let i = 0; i < COLS; i++) {
      const f = frameF(i), cx = i * CELL + CELL / 2, cy = sp.row * CELL + CELL * 0.45;
      for (const [g, mode] of [[base, gold ? 'gold' : 'base'], [rim, 'rim']] as const) {
        if (mode === 'rim' && gold) continue;
        g.save(); g.beginPath(); g.rect(i * CELL, sp.row * CELL, CELL, CELL); g.clip();
        g.translate(cx, cy); g.scale(s, s);
        if (gold) { g.shadowColor = 'rgba(255,200,110,.9)'; g.shadowBlur = s * 0.25; }
        drawBird(g, ds, f, mode);
        g.restore();
      }
    }
  }
  // 아주 먼 새: 굵은 'v' 획 (작게 줄어도 사라지지 않게)
  for (let i = 0; i < COLS; i++) {
    const f = frameF(i), cx = i * CELL + CELL / 2, cy = ROW_TICK * CELL + CELL / 2, up = (f * 0.5 + 0.2 + 0.07) * s;
    for (const [g, col, w] of [[base, '#120a07', 0.3], [rim, '#fff', 0.42]] as const) {
      g.save(); g.translate(cx, cy); g.strokeStyle = col; g.lineWidth = s * w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-s, -up); g.quadraticCurveTo(-s * 0.4, -up * 0.2 - s * 0.15, 0, 0); g.quadraticCurveTo(s * 0.4, -up * 0.2 - s * 0.15, s, -up); g.stroke();
      g.restore();
    }
  }
  const tex = (c: HTMLCanvasElement) => { const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t; };
  return { base: tex(baseC), rim: tex(rimC) };
}

// ---------- 무리 ----------
type V3 = [number, number, number]; // [오른쪽, 위, 해 쪽 앞] (생길 때 카메라 기준)
type Bird = { seed: number; [k: string]: any };
type Group = { sp: Sp; birds: Bird[]; t: number; pos(b: Bird): V3; done(): boolean; fade(p: V3, b: Bird): number; bank?(b: Bird): number };
type Ctx = { D: V3; halfW: number }; // D: 해 방향, halfW: 화면 반폭 / 거리

const SCENES = {
  fromSun(c: Ctx): Group { // 갈매기: 해 쪽에서 점처럼 나타나 머리 위로
    const { D } = c, birds: Bird[] = [];
    for (let i = 0, n = Math.floor(rnd(4, 8)); i < n; i++) birds.push({ seed: Math.random(), spd: rnd(0.9, 1.15),
      st: [D[0] * 260 + rnd(-14, 14), D[1] * 260 + rnd(-6, 8), D[2] * 260 + rnd(-30, 30)], en: [rnd(-7, 7), rnd(5, 9), -2] });
    return { sp: SP.gull, birds, t: 0,
      pos(b) { const k = clamp(this.t * 0.042 * b.spd, 0, 1), e = 1 - (1 - k) ** 2.2; return [lerp(b.st[0], b.en[0], e) + Math.sin(this.t * 0.6 + b.seed * 9) * 1.5, lerp(b.st[1], b.en[1], e), lerp(b.st[2], b.en[2], e)]; },
      done() { return this.t > 26; }, fade(p) { return clamp(p[2] / 3, 0, 1) * clamp((300 - p[2]) / 60, 0, 1); } };
  },
  ribbon(c: Ctx): Group { // 긴 행렬: 앞 새가 간 길을 그대로 따라감
    const n = Math.floor(rnd(30, 42)), dir = Math.random() < 0.5 ? 1 : -1, z = rnd(110, 150), y0 = rnd(26, 40), birds: Bird[] = [];
    for (let i = 0; i < n; i++) birds.push({ seed: Math.random(), lag: i * 0.42 + rnd(0, 0.12), jy: rnd(-0.6, 0.6), jz: rnd(-3, 3) });
    const x0 = -dir * z * c.halfW * 1.5;
    return { sp: SP.goose, birds, t: 0,
      pos(b) { const t = this.t - b.lag; return [x0 + dir * t * 9, y0 + Math.sin(t * 0.32) * 6 + Math.sin(t * 0.9 + 1) * 2 + b.jy, z + Math.sin(t * 0.21) * 18 + b.jz]; },
      done() { return this.t > 75; }, fade(_p, b) { return clamp((this.t - b.lag) / 1.5, 0, 1); },
      bank(b) { return dir * 0.15 + Math.cos((this.t - b.lag) * 0.32) * 0.15; } };
  },
  golden(c: Ctx): Group { // 황금 새: 해에서 천천히 활공하며 다가옴
    const { D } = c, st: V3 = [D[0] * 160, D[1] * 160 + 2, D[2] * 160], en: V3 = [-2.5, 5.5, 2.5];
    return { sp: SP.golden, birds: [{ seed: 0.3 }], t: 0,
      pos() { const k = clamp(this.t / 24, 0, 1), e = k * k * (3 - 2 * k); return [lerp(st[0], en[0], e) + Math.sin(this.t * 0.4) * 2.5 * (1 - e), lerp(st[1], en[1], e) + Math.sin(this.t * 0.9) * 0.3, lerp(st[2], en[2], e)]; },
      done() { return this.t > 25; }, fade(p) { return clamp(p[2] / 3, 0, 1) * clamp(this.t / 2, 0, 1); },
      bank() { return Math.sin(this.t * 0.4) * 0.18; } };
  },
  swallows(c: Ctx): Group { // 제비 둘: 낮게 휘저으며
    const dir = Math.random() < 0.5 ? 1 : -1, z = rnd(14, 22), x0 = -dir * z * c.halfW * 1.4;
    return { sp: SP.swallow, birds: [{ seed: 0.1, o: 0 }, { seed: 0.7, o: 0.55 }], t: 0,
      pos(b) { const t = this.t - b.o; return [x0 + dir * t * 7 + Math.sin(t * 2.2 + b.seed * 5) * 1.2, 0.6 + Math.abs(Math.sin(t * 1.4 + b.seed * 3)) * 2.2, z + Math.sin(t * 1.1 + b.seed) * 3]; },
      done() { return this.t > 14; }, fade() { return 1; },
      bank(b) { const t = this.t - b.o; return Math.cos(t * 2.2 + b.seed * 5) * 0.5; } };
  },
  murmur(c: Ctx): Group { // 작은 새 떼: 모였다 흩어짐
    const dir = Math.random() < 0.5 ? 1 : -1, z = rnd(70, 95), y0 = rnd(18, 26), birds: Bird[] = [], x0 = -dir * z * c.halfW * 1.6;
    for (let i = 0; i < 70; i++) birds.push({ seed: Math.random(), a: rnd(0, 6.28), b: rnd(0, 6.28), r: Math.sqrt(Math.random()) });
    return { sp: SP.small, birds, t: 0,
      pos(b) {
        const t = this.t, cx = x0 + dir * t * 6, br = 4 + 3 * Math.sin(t * 0.5), ang = b.a + t * 0.4 + Math.sin(t * 0.7 + b.b) * 0.6;
        return [cx + Math.cos(ang) * br * 1.8 * b.r + Math.sin(t * 0.3) * 4 * b.r, y0 + Math.sin(ang * 1.3 + b.b) * br * b.r + Math.sin(t * 0.45) * 3, z + Math.sin(ang + t) * 4 * b.r];
      },
      done() { return this.t > 45; }, fade() { return clamp(this.t / 2, 0, 1); } };
  },
};
type Key = keyof typeof SCENES;

function flapOf(sp: Sp, t: number, seed: number) {
  const ph = t * sp.flap * Math.PI * 2 + seed * 7;
  if (!sp.glide) return Math.sin(ph);
  return (t * 0.35 + seed) % 1 < sp.glide ? 0.38 + Math.sin(t * 1.3 + seed) * 0.05 : Math.sin(ph);
}

// ---------- 그리기 (인스턴싱) ----------
const MAX = 180;
export function createBirds(scene: THREE.Scene) {
  const atlas = buildAtlas();
  const quad = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3), iData = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4), iLight = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  for (const a of [iPos, iData, iLight]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iData', iData); geo.setAttribute('iLight', iLight);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uBase: { value: atlas.base }, uRim: { value: atlas.rim }, uRimCol: { value: new THREE.Color(1, 0.74, 0.42) }, uViewH: { value: 800 } },
    vertexShader: /* glsl */`
      attribute vec3 iPos; attribute vec4 iData; attribute vec2 iLight;
      uniform float uViewH;
      varying vec2 vUv; varying float vLight; varying float vAlpha;
      void main() {
        vec4 mv = viewMatrix * vec4(iPos, 1.0);
        float Q = iData.x;                                         // 칸 하나의 실제 크기
        float pxPerUnit = projectionMatrix[1][1] * 0.5 * uViewH / max(0.5, -mv.z);
        float spanPx = Q * ${FILL.toFixed(2)} * pxPerUnit;          // 화면에서 날개 반폭(px)
        float tick = step(spanPx, 5.0);
        float k = max(1.0, 3.0 / max(spanPx, 0.001));              // 너무 작으면 최소 크기 유지
        float b = iData.w; vec2 c = position.xy;
        c = vec2(c.x * cos(b) - c.y * sin(b), c.x * sin(b) + c.y * cos(b));
        mv.xy += c * Q * k;
        float row = mix(iData.z, ${ROW_TICK}.0, tick);
        vUv = vec2((iData.y + uv.x) / ${COLS}.0, 1.0 - (row + 1.0 - uv.y) / ${ROWS}.0);
        vLight = iLight.x; vAlpha = iLight.y / sqrt(k);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uBase; uniform sampler2D uRim; uniform vec3 uRimCol;
      varying vec2 vUv; varying float vLight; varying float vAlpha;
      void main() {
        vec4 b = texture2D(uBase, vUv);
        float r = texture2D(uRim, vUv).a * vLight;
        float a = b.a + r * (1.0 - b.a);
        if (a * vAlpha < 0.01) discard;
        vec3 col = (b.rgb * b.a + uRimCol * r * (1.0 - b.a * 0.45)) / max(a, 0.001);
        gl_FragColor = vec4(col, a * vAlpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 4; // 햇빛 번짐(5)보다 먼저 → 해 앞을 지나면 빛에 묻힘
  scene.add(mesh);

  const groups: { g: Group; key: Key; o: THREE.Vector3; R: THREE.Vector3; Fw: THREE.Vector3 }[] = [];
  let clock = 0, nextAt = rnd(6, 12), goldenDone = false;
  const D = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), tmp = new THREE.Vector3(), toB = new THREE.Vector3();

  function ctxFor(camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3): Ctx {
    fwd.set(sunDir.x, 0, sunDir.z); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const el = Math.max(0.03, Math.asin(clamp(sunDir.y, -1, 1)));
    return { D: [0, Math.sin(el), Math.cos(el)], halfW: Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect };
  }
  function spawn(key: Key, camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) {
    const c = ctxFor(camera, sunDir);
    right.set(-fwd.z, 0, fwd.x);
    groups.push({ g: SCENES[key](c), key, o: camera.position.clone(), R: right.clone(), Fw: fwd.clone() });
    if (groups.length > 2) groups.shift();
  }
  function pick(alt: number): Key | null {
    if (alt < -9) return null; // 밤에는 새 없음
    const w: Partial<Record<Key, number>> = alt < -1.5 ? { ribbon: 3, murmur: 2, fromSun: 1.5, swallows: 0.5 }
      : alt < 6 ? { fromSun: 2.5, ribbon: 2, murmur: 1.2, swallows: 1 }
      : { fromSun: 3, swallows: 3, murmur: 2, ribbon: 1 };
    for (const g of groups) if (w[g.key]) w[g.key]! *= 0.2; // 같은 무리 연달아 나오지 않게
    let sum = 0; for (const k in w) sum += w[k as Key]!;
    let r = Math.random() * sum;
    for (const k in w) { r -= w[k as Key]!; if (r <= 0) return k as Key; }
    return 'fromSun';
  }

  return {
    /** 해가 지평선을 넘는 순간: 황금 새 (그날 한 번) */
    sunrise(camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) {
      if (goldenDone) return; goldenDone = true;
      spawn('golden', camera, sunDir); nextAt = Math.max(nextAt, 26);
    },
    /** 테스트용: 지금 떠 있는 무리와 새 수 */
    debug() { return { groups: groups.map(G => [G.key, Math.round(G.g.t)]), n: geo.instanceCount }; },
    /** 테스트용: 특정 무리 바로 띄우기 */
    spawn(key: Key, camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) { spawn(key, camera, sunDir); },
    update(dt: number, camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3, alt: number, viewH: number) {
      clock += dt;
      if (alt < -3) goldenDone = false; // 다음 해돋이에 다시
      if ((nextAt -= dt) <= 0) { nextAt = rnd(30, 90); const k = pick(alt); if (k) spawn(k, camera, sunDir); }
      mat.uniforms.uViewH.value = viewH;
      const day = clamp((alt + 6) / 8, 0.25, 1);
      let n = 0;
      for (let gi = groups.length - 1; gi >= 0; gi--) {
        const G = groups[gi], g = G.g; g.t += dt;
        if (g.done()) { groups.splice(gi, 1); continue; }
        const sp = g.sp, Q = (sp.span / 2) / FILL;
        for (const b of g.birds) {
          if (n >= MAX) break;
          const p = g.pos(b); if (p[2] < -6) continue;
          const a = g.fade(p, b); if (a <= 0.01) continue;
          tmp.copy(G.o).addScaledVector(G.R, p[0]).addScaledVector(G.Fw, p[2]); tmp.y += p[1];
          toB.copy(tmp).sub(camera.position).normalize();
          const ang = Math.acos(clamp(toB.dot(sunDir), -1, 1)), light = sp === SP.golden ? 0 : clamp(1 - ang / 0.5, 0, 1) ** 1.6 * day;
          const f = flapOf(sp, clock, b.seed), frame = Math.round((clamp(f, -1, 1) + 1) / 2 * (COLS - 1));
          iPos.setXYZ(n, tmp.x, tmp.y, tmp.z);
          iData.setXYZW(n, Q, frame, sp.row, g.bank ? g.bank(b) : Math.sin(clock * 0.5 + b.seed * 6) * 0.06);
          iLight.setXY(n, light, a);
          n++;
        }
      }
      geo.instanceCount = n; mesh.visible = n > 0;
      if (n) { iPos.needsUpdate = iData.needsUpdate = iLight.needsUpdate = true; }
    },
  };
}
