import * as THREE from 'three';
import { stable } from './stable-tex';
import { textSprite, toon } from './character';
import { trailX } from './beach-extras';

// 멍석 모이 마당: 장터목 길가의 둥근 멍석. 평소엔 모이가 조금, 참새들이 쪼고 있음.
// 해가 뜨면 마고할미가 모이를 뿌려 가득 채우고, 병아리들이 쪼는 만큼 줄어듦.

export const FEED_R = 2.0;
/** 자리: 장터목, 리어카 맞은편 길 왼쪽 (청학당과 마주 봄) */
export const FEED_AT = { x: trailX(83.3) - 3.7, z: 83.3 };
const GN = 520, LOW = 70;

function strawTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!;
  x.fillStyle = '#c9a463'; x.fillRect(0, 0, 256, 256);
  for (let r = 5; r < 128; r += 4.5) { x.strokeStyle = Math.round(r) % 9 < 4 ? '#b58f50' : '#d9b878'; x.lineWidth = 2.5; x.beginPath(); x.arc(128, 128, r, 0, Math.PI * 2); x.stroke(); }
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; x.strokeStyle = 'rgba(120,90,40,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128); x.stroke(); }
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function sparrow() {
  const g = new THREE.Group();
  const ol = new THREE.MeshBasicMaterial({ color: 0x3a2a20, side: THREE.BackSide });
  const outl = (m: THREE.Mesh, k: number) => { const o = new THREE.Mesh(m.geometry, ol); o.position.copy(m.position); o.scale.copy(m.scale).multiplyScalar(k); m.parent!.add(o); };
  const body = new THREE.Group(); g.add(body);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), toon(0x8a5a3a)); b.scale.set(1, 0.85, 1.3); b.position.y = 0.14; body.add(b); outl(b, 1.08);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon(0xe8d8c0)); belly.position.set(0, 0.11, -0.04); body.add(belly);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), toon(0x6a4028)); h.position.set(0, 0.25, -0.13); body.add(h); outl(h, 1.1);
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), toon(0x3a3030)); bk.rotation.x = -Math.PI / 2; bk.position.set(0, 0.24, -0.22); body.add(bk);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), toon(0x5a3a28)); tail.position.set(0, 0.17, 0.2); tail.rotation.x = -0.4; body.add(tail);
  const em = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), em); e.position.set(s * 0.045, 0.27, -0.19); body.add(e); }
  return { g, body };
}

export function createFeed(scene: THREE.Scene, x: number, z: number, y: number, label: string) {
  const root = new THREE.Group(); root.position.set(x, y, z); scene.add(root);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(FEED_R, FEED_R, 0.06, 40), Object.assign(toon(0xffffff), { map: strawTex() })); mat.position.y = 0.03; root.add(mat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(FEED_R, 0.06, 6, 40), toon(0x9a7240)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; root.add(rim);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), Object.assign(toon(0xd9b46a), { side: THREE.DoubleSide })); bowl.position.y = 0.47; root.add(bowl);
  const bowlIn = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), toon(0xf2d27a)); bowlIn.rotation.x = -Math.PI / 2; bowlIn.position.y = 0.43; root.add(bowlIn);
  const sg = textSprite('🌾 ' + label, 0.55); sg.position.set(0, 1.5, 0); root.add(sg);
  // 모이 알갱이
  const grainM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshLambertMaterial({ color: 0xf0c64e }), GN); root.add(grainM);
  grainM.frustumCulled = false;
  type G = { x: number; z: number; on: boolean; y: number; air: number; sx: number; sz: number };
  const grains: G[] = [];
  for (let i = 0; i < GN; i++) { const a = Math.random() * 6.283, r = 0.5 + Math.sqrt(Math.random()) * (FEED_R - 0.65); grains.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, on: i < LOW, y: 0.08, air: -1, sx: 0, sz: 0 }); }
  let left = LOW, dirty = true;
  const dummy = new THREE.Object3D();
  function draw() {
    for (let i = 0; i < GN; i++) { const g = grains[i]; if (g.on && g.air > -1 && g.air < 1) continue; dummy.position.set(g.x, g.on ? g.y : -9, g.z); dummy.updateMatrix(); grainM.setMatrixAt(i, dummy.matrix); }
    grainM.instanceMatrix.needsUpdate = true; dirty = false;
  }
  // 참새 다섯
  const birds = Array.from({ length: 5 }, (_, i) => {
    const s = sparrow(); const a = i * 1.3, r = 0.8 + (i % 3) * 0.35;
    const home = new THREE.Vector3(Math.cos(a) * r, 0.06, Math.sin(a) * r);
    s.g.position.copy(home); s.g.rotation.y = Math.random() * 6; root.add(s.g);
    return { ...s, home, st: 'peck' as 'peck' | 'fly' | 'away' | 'back', t: Math.random() * 3, v: new THREE.Vector3(), awayT: 0, ph: Math.random() * 6 };
  });
  const loc = new THREE.Vector3();
  let sparkle = 0;
  return {
    root,
    get left() { return left; },
    get full() { return left > GN * 0.6; },
    /** 모이를 뿌림: 할미 손(세계 좌표)에서 멍석 곳곳으로 포물선 */
    scatter(fromX: number, fromZ: number, n = 150) {
      const sx = fromX - x, sz = fromZ - z;
      for (let k = 0; k < n && left < GN; k++, left++) { const g = grains[left]; g.on = true; g.air = -Math.random() * 0.5; g.sx = sx; g.sz = sz; }
      for (const b of birds) if (b.st === 'peck' || b.st === 'back') { b.st = 'fly'; b.v.set((Math.random() - 0.5) * 2, 2.2 + Math.random(), (Math.random() - 0.5) * 2); }
    },
    /** 누가 쪼면 그 근처 모이가 조금 줄어듦 (최소 한 줌은 남김) */
    peck(wx: number, wz: number, n = 6) {
      const lx = wx - x, lz = wz - z;
      for (let k = 0; k < n && left > LOW; k++) {
        let best = -1, bd = 1e9;
        for (let i = 0; i < left; i++) { const g = grains[i]; if (g.air >= 0 && g.air < 1) continue; const d = (g.x - lx * 0.55) ** 2 + (g.z - lz * 0.55) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best < 0) break;
        // 맨 뒤 것과 자리를 바꿔 끄기
        left--; const a = grains[best], b = grains[left];
        [a.x, b.x] = [b.x, a.x]; [a.z, b.z] = [b.z, a.z]; [a.y, b.y] = [b.y, a.y]; [a.air, b.air] = [b.air, a.air]; [a.sx, b.sx] = [b.sx, a.sx]; [a.sz, b.sz] = [b.sz, a.sz];
        b.on = false;
      }
      dirty = true;
    },
    /** 같이 쪼았을 때: 모이가 잠깐 반짝 */
    shine() { sparkle = 1.2; },
    /** 멍석 가장자리에서 가운데를 보는 자리 (세계 좌표) */
    edgeSpot(px: number, pz: number) { const a = Math.atan2(pz - z, px - x); return { x: x + Math.cos(a) * (FEED_R + 0.3), z: z + Math.sin(a) * (FEED_R + 0.3) }; },
    update(dt: number, t: number, chicks: THREE.Vector3[]) {
      // 날아가는 모이
      for (let i = 0; i < left; i++) {
        const g = grains[i]; if (g.air < 0 && g.air > -1) { g.air += dt; if (g.air >= 0) g.air = 0; else continue; }
        if (g.air < 0 || g.air >= 1) continue;
        g.air = Math.min(1, g.air + dt * 1.5); const k = g.air;
        dummy.position.set(g.sx + (g.x - g.sx) * k, 0.08 + Math.sin(k * Math.PI) * 1.2 + (1 - k) * 0.9, g.sz + (g.z - g.sz) * k);
        dummy.updateMatrix(); grainM.setMatrixAt(i, dummy.matrix); grainM.instanceMatrix.needsUpdate = true;
        if (k >= 1) { g.y = 0.08; dirty = true; }
      }
      if (dirty) draw();
      if (sparkle > 0) { sparkle -= dt; (grainM.material as THREE.MeshLambertMaterial).emissive.setRGB(1, 0.8, 0.3).multiplyScalar(Math.max(0, sparkle) * 0.8 * (0.6 + 0.4 * Math.sin(t * 20))); }
      // 참새: 병아리가 가까이 오면 날아갔다가 잠시 뒤 돌아옴
      for (const b of birds) {
        const wp = loc.set(x + b.g.position.x, y, z + b.g.position.z);
        const near = chicks.some(c => Math.hypot(c.x - wp.x, c.z - wp.z) < 1.3);
        if ((b.st === 'peck' || b.st === 'back') && near) { b.st = 'fly'; b.v.set((Math.random() - 0.5) * 2, 2 + Math.random(), (Math.random() - 0.5) * 2); }
        if (b.st === 'peck') { b.body.rotation.x = Math.max(0, Math.sin(t * 7 + b.ph)) * 0.6; b.t -= dt; if (b.t < 0) { b.t = 1 + Math.random() * 2; b.g.rotation.y += (Math.random() - 0.5) * 2; } }
        else if (b.st === 'fly') { b.g.position.addScaledVector(b.v, dt); b.v.y += 0.5 * dt; b.g.rotation.z = Math.sin(t * 30) * 0.3; if (b.g.position.y > 7) { b.st = 'away'; b.g.visible = false; b.awayT = 6 + Math.random() * 6; } }
        else if (b.st === 'away') { b.awayT -= dt; const homeW = loc.set(x + b.home.x, y, z + b.home.z); if (b.awayT < 0 && !chicks.some(c => Math.hypot(c.x - homeW.x, c.z - homeW.z) < 1.8)) { b.st = 'back'; b.g.visible = true; b.g.position.set(b.home.x + 3, 5, b.home.z + 2); } }
        else if (b.st === 'back') { b.g.position.lerp(b.home, Math.min(1, dt * 1.6)); b.g.rotation.z = 0; if (b.g.position.distanceTo(b.home) < 0.05) b.st = 'peck'; }
      }
    },
  };
}
