import * as THREE from 'three';
import { groundY } from './world';
import { insideSandBoard } from './sand-board';

// 해변의 작은 재미: 바다로 뻗은 데크, 모래 발자국, 얕은 물 찰박임, 밤의 모닥불.

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- 지형: 어디에 설 수 있고, 높이는 얼마인가 ----------
export const PIER = { x: -9, half: 1.1, start: -0.5, end: -26, top: 0.45 };
/** 물에 들어갈 수 있는 깊이 한계 (해안선 z≈-1.8에서 바다 쪽으로) */
export const WADE_MIN_Z = -6;
export const BEACH_X = 22;
export const BONFIRE = { x: 11, z: 10 };
/** 모닥불을 둘러싼 통나무 4개 (반지름, 길이, 굵기) */
const LOG = { r: 2.1, len: 1.3, rad: 0.2, n: 4 };
const logAngle = (i: number) => (i / LOG.n) * Math.PI * 2 + Math.PI / 4;

interface HighSeat { x: number; z: number; ry: number; y: number; bench: true; kind: 'log' | 'pier'; sx: number; sz: number }
/** 높은 자리들 (서버 방석 번호 22번부터 이어짐)
 *  22~29: 통나무 4개 × 2자리, 모닥불을 바라봄 → 일어나면 모닥불 쪽으로 한 걸음
 *  30~32: 데크 끝에 걸터앉는 3자리, 바다를 바라봄 → 일어나면 데크 안쪽으로 한 걸음 */
export function benchSeats() {
  const out: HighSeat[] = [];
  const top = groundY(BONFIRE.z) + LOG.rad * 2;
  for (let i = 0; i < LOG.n; i++) {
    const a = logAngle(i), cx = BONFIRE.x + Math.cos(a) * LOG.r, cz = BONFIRE.z + Math.sin(a) * LOG.r;
    const ax = Math.sin(a), az = -Math.cos(a); // 통나무 방향 (원의 접선)
    for (const k of [-0.32, 0.32]) {
      const x = cx + ax * k, z = cz + az * k;
      out.push({ x, z, ry: Math.atan2(Math.cos(a), Math.sin(a)), y: top, bench: true, kind: 'log', sx: x - Math.cos(a) * 0.5, sz: z - Math.sin(a) * 0.5 });
    }
  }
  // 데크 끝: 엉덩이는 끝에 걸치고 다리는 바다 쪽으로 (오른쪽 끝 가로등 기둥을 피해 3자리)
  const ez = PIER.end + 0.15;
  for (const dx of [-0.65, 0, 0.65]) out.push({ x: PIER.x + dx, z: ez, ry: 0, y: PIER.top, bench: true, kind: 'pier', sx: PIER.x + dx, sz: ez + 0.7 });
  return out;
}
const BENCH = benchSeats();
/** 이 자리가 통나무 위면 그 자리 (다른 사람·흔적의 앉은 높이를 맞출 때) */
export const benchAt = (x: number, z: number) => BENCH.find(s => Math.hypot(s.x - x, s.z - z) < 0.3) ?? null;

export const onPier = (x: number, z: number) => Math.abs(x - PIER.x) < PIER.half && z <= PIER.start && z >= PIER.end;
export type Surface = 'sand' | 'water' | 'wood';
export function surfaceAt(x: number, z: number): Surface {
  if (onPier(x, z) && z < -1.2) return 'wood';
  return z < -1.8 ? 'water' : 'sand';
}
/** 서 있는 발 높이. 물에서는 정강이까지 잠기고, 데크 위는 데크 높이 */
export function floorY(x: number, z: number) {
  if (onPier(x, z)) {
    const k = clamp((PIER.start - z) / 2, 0, 1); // 처음 2m는 경사로
    return groundY(z) * (1 - k) + PIER.top * k;
  }
  if (z < -1.8) return -Math.min(0.4, (-1.8 - z) * 0.15);
  return groundY(z);
}
export function canStand(x: number, z: number) {
  if (onPier(x, z)) return true;
  if (Math.abs(x) > BEACH_X || z > 17 || z < WADE_MIN_Z) return false;
  // 모닥불 한가운데는 못 들어감
  // 모래 게시판 판 위로는 못 올라감
  if (insideSandBoard(x, z)) return false;
  return Math.hypot(x - BONFIRE.x, z - BONFIRE.z) > 0.95;
}

// ---------- 데크 ----------
function plankTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a6544'; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.fillRect(0, y, 64, 30);
    g.fillStyle = 'rgba(40,24,12,.6)'; g.fillRect(0, y + 30, 64, 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createPier(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group();
  const tex = plankTexture(); tex.repeat.set(1, 12);
  const wood = new THREE.MeshLambertMaterial({ map: tex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4d3523 });
  const len = PIER.start - 2 - PIER.end, w = PIER.half * 2 + 0.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, len), wood);
  deck.position.set(PIER.x, PIER.top - 0.06, PIER.end + len / 2); g.add(deck);
  // 경사로
  const y0 = groundY(PIER.start), rampLen = Math.hypot(2, PIER.top - y0);
  const rampTex = tex.clone(); rampTex.repeat.set(1, 1); rampTex.needsUpdate = true;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, rampLen), new THREE.MeshLambertMaterial({ map: rampTex }));
  ramp.position.set(PIER.x, (y0 + PIER.top) / 2 - 0.05, PIER.start - 1);
  ramp.rotation.x = Math.atan2(PIER.top - y0, 2); g.add(ramp);
  // 기둥과 난간
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.9, 6);
  for (let z = PIER.start - 2; z >= PIER.end; z -= 3) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, dark); p.position.set(PIER.x + s * (PIER.half + 0.08), PIER.top - 0.15, z); g.add(p);
    }
  }
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), dark);
    rail.position.set(PIER.x + s * (PIER.half + 0.08), PIER.top + 0.75, PIER.end + len / 2); g.add(rail);
  }
  // 끝의 작은 등: 밤에 켜짐
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), dark);
  pole.position.set(PIER.x + PIER.half, PIER.top + 0.8, PIER.end + 0.3); g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulb.position.set(PIER.x + PIER.half, PIER.top + 1.65, PIER.end + 0.3); g.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(3, 3, 1); halo.position.copy(bulb.position); g.add(halo);
  scene.add(g);
  return {
    update(night: number) {
      halo.material.opacity = night * 0.8; halo.visible = night > 0.02;
      (bulb.material as THREE.MeshBasicMaterial).color.setRGB(0.55 + 0.45 * night, 0.5 + 0.35 * night, 0.4 + 0.22 * night);
    },
  };
}

// ---------- 발자국 + 물결 ----------
const PRINTS = 360, PRINT_LIFE = 28;
interface Walker { x: number; z: number; acc: number; side: number }

export function createFootprints(scene: THREE.Scene) {
  const geo = new THREE.CircleGeometry(0.075, 10); geo.rotateX(-Math.PI / 2); geo.scale(1, 1, 1.7);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, PRINTS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const born = new Float32Array(PRINTS).fill(-1e9);
  const fresh = new THREE.Color(0x8f7556), sand = new THREE.Color(0xcdb28a), wetSand = new THREE.Color(0x8f7a5e), c = new THREE.Color();
  for (let i = 0; i < PRINTS; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, sand); }
  scene.add(mesh);
  let next = 0, clock = 0;

  // 물결 고리
  const ringGeo = new THREE.RingGeometry(0.16, 0.22, 24); ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 24 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); return { m, age: 9 };
  });
  let ringNext = 0;
  function ripple(x: number, z: number, big = 1) {
    const r = rings[ringNext++ % rings.length];
    r.m.position.set(x, 0.02, z); r.age = 0; r.m.visible = true; r.m.userData.big = big;
  }

  const walkers = new Map<string, Walker>();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);

  /** 걷는 사람마다 매 프레임 부른다. 한 걸음 내디딜 때 그 바닥 종류를 돌려준다 */
  function step(key: string, x: number, z: number, ry: number): Surface | null {
    let w = walkers.get(key);
    if (!w) { walkers.set(key, { x, z, acc: 0, side: 1 }); return null; }
    const d = Math.hypot(x - w.x, z - w.z);
    w.x = x; w.z = z;
    if (d > 2) { w.acc = 0; return null; } // 순간이동은 무시
    w.acc += d;
    if (w.acc < 0.42) return null;
    w.acc = 0; w.side = -w.side;
    const surf = surfaceAt(x, z);
    if (surf === 'sand') {
      const ox = Math.cos(ry) * 0.11 * w.side, oz = -Math.sin(ry) * 0.11 * w.side;
      const px = x + ox, pz = z + oz;
      q.setFromAxisAngle(up, ry);
      m4.compose(v.set(px, groundY(pz) + 0.006, pz), q, s1);
      const i = next++ % PRINTS;
      mesh.setMatrixAt(i, m4); born[i] = clock;
      mesh.instanceMatrix.needsUpdate = true;
    } else if (surf === 'water') ripple(x, z);
    return surf;
  }
  const forget = (key: string) => walkers.delete(key);

  function update(dt: number) {
    clock += dt;
    for (let i = 0; i < PRINTS; i++) {
      const age = clock - born[i];
      if (age > PRINT_LIFE + 1) continue;
      if (age > PRINT_LIFE) { mesh.setMatrixAt(i, zero); mesh.instanceMatrix.needsUpdate = true; born[i] = -1e9; continue; }
      mesh.getMatrixAt(i, m4); v.setFromMatrixPosition(m4);
      const base = v.z < -1.6 ? wetSand : sand; // 물가에서는 젖은 모래색으로 사라짐
      c.copy(fresh).lerp(base, Math.pow(age / PRINT_LIFE, 1.6));
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    for (const r of rings) {
      if (!r.m.visible) continue;
      r.age += dt;
      const k = r.age / 1.2;
      r.m.scale.setScalar((1 + k * 2) * (r.m.userData.big ?? 1));
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.38 * (1 - k));
      if (k >= 1) r.m.visible = false;
    }
  }
  function clear() {
    for (let i = 0; i < PRINTS; i++) { mesh.setMatrixAt(i, zero); born[i] = -1e9; }
    mesh.instanceMatrix.needsUpdate = true; walkers.clear();
  }
  return { step, forget, update, clear, ripple };
}

// ---------- 모닥불 ----------
export function createBonfire(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); g.position.set(BONFIRE.x, groundY(BONFIRE.z), BONFIRE.z);
  const stoneM = new THREE.MeshLambertMaterial({ color: 0x5b5550, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneM);
    s.position.set(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72); s.rotation.set(a, a * 2, 0); s.scale.y = 0.7; g.add(s);
  }
  const logM = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), logM);
    const a = (i / 3) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.18, 0.32, Math.sin(a) * 0.18);
    l.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); g.add(l);
  }
  // 둘러앉는 통나무 의자 (앉을 수 있음: benchSeats)
  const benchM = new THREE.MeshLambertMaterial({ color: 0x7a5434 });
  for (let i = 0; i < LOG.n; i++) {
    const a = logAngle(i);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(LOG.rad, LOG.rad, LOG.len, 8), benchM);
    b.rotation.z = Math.PI / 2; b.rotation.y = -a + Math.PI / 2;
    b.position.set(Math.cos(a) * LOG.r, LOG.rad, Math.sin(a) * LOG.r); g.add(b);
  }
  // 불꽃: 겹친 빛 + 위로 튀는 불티
  const flame = (color: number, s: number, y: number) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(s, s * 1.4, 1); sp.position.y = y; g.add(sp); return sp;
  };
  const flames = [flame(0xff5a1e, 2.2, 0.75), flame(0xff9a3a, 1.5, 0.7), flame(0xffe08a, 0.8, 0.55)];
  const embers = Array.from({ length: 16 }, () => {
    const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    e.scale.set(0.12, 0.12, 1); g.add(e);
    return { e, t: Math.random() * 2.5, x: 0, z: 0 };
  });
  const light = new THREE.PointLight(0xff8a3d, 0, 16, 1.4); light.position.y = 1; g.add(light);
  scene.add(g);

  let level = 0;
  function update(dt: number, t: number, night: number) {
    level += (night - level) * Math.min(1, dt * 0.8);
    const on = level > 0.02;
    const flick = 0.85 + Math.sin(t / 90) * 0.06 + Math.sin(t / 37) * 0.05 + Math.random() * 0.05;
    flames.forEach((f, i) => {
      f.visible = on;
      const k = level * flick * (1 - i * 0.05);
      f.scale.set([2.2, 1.5, 0.8][i] * k, [2.2, 1.5, 0.8][i] * 1.4 * k * (0.95 + Math.sin(t / (60 + i * 20)) * 0.08), 1);
      f.material.opacity = 0.85 * level;
    });
    light.intensity = level * 2.6 * Math.PI * flick;
    for (const em of embers) {
      em.e.visible = on;
      em.t += dt;
      if (em.t > 2.5) { em.t = 0; em.x = (Math.random() - 0.5) * 0.4; em.z = (Math.random() - 0.5) * 0.4; }
      em.e.position.set(em.x + Math.sin(em.t * 3 + em.x * 9) * 0.15, 0.4 + em.t * 1.1, em.z);
      em.e.material.opacity = level * (1 - em.t / 2.5);
    }
  }
  return { update, get level() { return level; } };
}

/** 해 고도 → 밤의 정도 (해 뜨면 0, 동트기 전 어두우면 1) */
export const nightness = (alt: number) => clamp((2 - alt) / 6, 0, 1);

// ---------- 물수제비 ----------
// 손에서 날아간 돌이 물 위에서 통통 튀다가 가라앉는다. 튀는 횟수는 던질 때 정해진다.
interface Stone { m: THREE.Mesh; hops: { x: number; z: number; len: number; h: number }[]; i: number; t: number; dx: number; dz: number; sx: number; sz: number; sy: number; land: boolean; sink: number }
export function createStones(scene: THREE.Scene, onBounce: (x: number, z: number, last: boolean, mine: boolean) => void) {
  const geo = new THREE.SphereGeometry(0.07, 8, 6); geo.scale(1, 0.45, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6e6a66 });
  const list: (Stone & { mine: boolean })[] = [];

  /** 튈 횟수: 대부분 2~5번, 가끔 8번 넘게 */
  const rollSkips = () => Math.max(0, Math.round(1 + Math.pow(Math.random(), 1.6) * 9 + (Math.random() - 0.5) * 2));

  function toss(from: THREE.Vector3, ry: number, mine: boolean, skips = rollSkips()) {
    const dx = -Math.sin(ry), dz = -Math.cos(ry);
    const m = new THREE.Mesh(geo, mat);
    const sx = from.x + dx * 0.4, sz = from.z + dz * 0.4, sy = from.y + 0.95;
    m.position.set(sx, sy, sz); scene.add(m);
    // 첫 착지는 3.5m 앞, 이후 점점 짧고 낮게
    const hops: Stone['hops'] = [];
    let x = sx + dx * 3.5, z = sz + dz * 3.5, len = 3.5, h = 0.9;
    hops.push({ x, z, len, h });
    const land = z >= -1.8; // 바다 쪽이 아니면 모래에 툭 떨어짐
    if (!land) for (let i = 0; i < skips; i++) {
      len *= 0.78; h *= 0.6;
      x += dx * len; z += dz * len;
      hops.push({ x, z, len, h: Math.max(h, 0.08) });
    }
    list.push({ m, hops, i: 0, t: 0, dx, dz, sx, sz, sy, land, sink: -1, mine });
    return land ? -1 : skips;
  }

  function update(dt: number) {
    for (let k = list.length - 1; k >= 0; k--) {
      const s = list[k];
      if (s.sink >= 0) {
        s.sink += dt; s.m.position.y -= dt * 0.6;
        if (s.sink > 0.6) { scene.remove(s.m); list.splice(k, 1); }
        continue;
      }
      const hop = s.hops[s.i];
      const dur = 0.18 + hop.len * 0.09;
      s.t += dt;
      const u = Math.min(1, s.t / dur);
      const px = s.i === 0 ? s.sx : s.hops[s.i - 1].x, pz = s.i === 0 ? s.sz : s.hops[s.i - 1].z;
      const py = s.i === 0 ? s.sy : 0.02, ty = s.land ? floorY(hop.x, hop.z) + 0.03 : 0.02;
      s.m.position.set(px + (hop.x - px) * u, py + (ty - py) * u + Math.sin(Math.PI * u) * hop.h, pz + (hop.z - pz) * u);
      s.m.rotation.y += dt * 20;
      if (u >= 1) {
        const last = s.i === s.hops.length - 1;
        if (!s.land) onBounce(hop.x, hop.z, last, s.mine);
        s.i++; s.t = 0;
        if (last) { s.sink = 0; if (s.land) s.sink = 0.3; }
      }
    }
  }
  return { toss, update, roll: rollSkips };
}
