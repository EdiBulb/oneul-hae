import * as THREE from 'three';
import { toon } from './character';

// 전설의 새: 봉황(해 뜰 때 하늘을 가로지름, "엄마일지도 모르는") · 푸른 학(아주 가끔, 소원을 들어준다는)
// 둘 다 병아리와 같은 만화 음영 + 갈색 외곽선. 앞 = +z (lookAt으로 나는 쪽을 봄)

const GOLD = new THREE.Color(0xffd47a), CREAM = new THREE.Color(0xfff3c4), PEACH = new THREE.Color(0xf5a65a), PINK = new THREE.Color(0xf6a2b6), LAV = new THREE.Color(0xaba0ee);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function vColors(geo: THREE.BufferGeometry, fn: (c: THREE.Color, x: number, y: number, z: number) => void) {
  const p = geo.attributes.position, cols: number[] = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo;
}
const vtoon = () => { const m = toon(0xffffff); m.vertexColors = true; return m; };

function phoenix(GLOW: THREE.Texture) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const outlineM = new THREE.MeshBasicMaterial({ color: 0x5a2e14, side: THREE.BackSide });
  const bg = vColors(new THREE.SphereGeometry(1, 28, 20), (c, _x, y) => { const k = (y + 1) / 2; c.copy(GOLD).lerp(PEACH, Math.max(0, 0.35 - k) * 1.4).lerp(CREAM, Math.max(0, k - 0.45) * 1.6); });
  bg.scale(0.95, 0.88, 0.92);
  body.add(new THREE.Mesh(bg, vtoon()));
  const ol = new THREE.Mesh(bg, outlineM); ol.scale.setScalar(1.03); body.add(ol);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toon(0xfff3c8)); chest.scale.set(1, 0.8, 0.42); chest.position.set(0, -0.36, 0.62); body.add(chest);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x3a2418 }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const e = new THREE.Group(), dir = new THREE.Vector3(s * 0.33, 0.2, 0.92).normalize();
    e.position.copy(dir).multiply(new THREE.Vector3(0.95, 0.88, 0.92)).multiplyScalar(0.985); e.lookAt(e.position.clone().multiplyScalar(2));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), eyeM); ball.scale.set(0.85, 1.12, 0.45); e.add(ball);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), hiM); h1.position.set(0.04, 0.05, 0.05); e.add(h1);
    body.add(e);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 12), toon(0xf08a6a)); beak.rotation.x = Math.PI / 2; beak.scale.set(1.1, 1, 0.55); beak.position.set(0, 0.03, 0.98); body.add(beak);
  // 돌돌 말린 볏 셋
  const crestM = toon(0xffb84a), beadM = toon(0xff8a6a);
  [[-0.22, -0.5], [0, 0], [0.22, 0.5]].forEach(([x, a]) => {
    const g = new THREE.Group(); g.position.set(x * 0.9, 0.8, 0.15 - Math.abs(x) * 0.3); g.rotation.z = -a * 0.6; body.add(g);
    const pts: THREE.Vector3[] = []; for (let k = 0; k <= 16; k++) { const s = k / 16; if (s < 0.55) pts.push(new THREE.Vector3(0, s * 0.75, -s * 0.15)); else { const q = (s - 0.55) / 0.45, ang = q * Math.PI * 1.7, r = 0.13 * (1 - q * 0.45); pts.push(new THREE.Vector3(Math.sin(ang) * r * 0.3, 0.41 + Math.sin(ang) * r, -0.08 - (1 - Math.cos(ang)) * r)); } }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.055, 8), crestM));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), beadM); bead.position.copy(pts[16]); g.add(bead);
  });
  // 날개: 둥근 깃털 끝, 금 → 분홍 → 연보라
  const sh = new THREE.Shape(); sh.moveTo(0, 0.05); sh.bezierCurveTo(0.3, 0.55, 0.9, 0.75, 1.55, 0.55);
  const tips = [[1.55, 0.55], [1.5, 0.28], [1.32, 0.05], [1.05, -0.12], [0.72, -0.2], [0.35, -0.2], [0.05, -0.12]];
  for (let i = 1; i < tips.length; i++) { const a = tips[i - 1], b = tips[i]; sh.quadraticCurveTo((a[0] + b[0]) / 2 + 0.1, (a[1] + b[1]) / 2 - 0.12, b[0], b[1]); }
  const wg = vColors(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 6 }), (c, x) => { const k = x / 1.55; c.copy(GOLD).lerp(PINK, Math.min(1, k * 1.5)).lerp(LAV, Math.max(0, k - 0.6) * 2.4); });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.75, 0.15, -0.1); body.add(pivot);
    const tilt = new THREE.Group(); tilt.rotation.x = -Math.PI / 2 + 0.25; pivot.add(tilt); // 날 때는 날개를 옆으로 눕힘
    const m = new THREE.Mesh(wg, vtoon()); (m.material as THREE.Material).side = THREE.DoubleSide; m.scale.set(s, 1, 1); tilt.add(m);
    pivot.userData.s = s; wings.push(pivot);
  }
  // 리본 꼬리 두 가닥 + 끝의 해 방울
  const tailM = vtoon(), tails: { mesh: THREE.Mesh; bead: THREE.Mesh; k: number }[] = [];
  for (let k = 0; k < 2; k++) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), tailM); body.add(mesh);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); body.add(bead);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffd28a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(1.1); bead.add(sp);
    tails.push({ mesh, bead, k });
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); halo.scale.setScalar(5); root.add(halo);
  const tmpV: THREE.Vector3[] = Array.from({ length: 21 }, () => new THREE.Vector3());
  function tail(t: number) {
    for (const T of tails) {
      const amp = T.k ? 0.22 : 0.3, len = T.k ? 2.8 : 3.4;
      for (let i = 0; i <= 20; i++) { const s = i / 20; tmpV[i].set(Math.sin(t * 3 - s * 5 + T.k * 1.5) * amp * s + (T.k ? 0.15 : -0.15) * s, -0.3 - s * 0.5 + Math.sin(t * 2.4 - s * 4 + T.k) * 0.18 * s, -0.7 - s * len); }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tmpV), 30, 1, 6);
      const p = geo.attributes.position, n = geo.attributes.normal, cols: number[] = [], c = new THREE.Color(), ring = 7;
      for (let i = 0; i < p.count; i++) {
        const s = Math.floor(i / ring) / 30, w = lerp(0.18, 0.05, s);
        const cx = p.getX(i) - n.getX(i), cy = p.getY(i) - n.getY(i), cz = p.getZ(i) - n.getZ(i);
        p.setXYZ(i, cx + n.getX(i) * w, cy + n.getY(i) * w * 0.55, cz + n.getZ(i) * w);
        c.copy(GOLD).lerp(PINK, Math.min(1, s * 1.8)).lerp(LAV, Math.max(0, s - 0.5) * 2); cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
      T.mesh.geometry.dispose(); T.mesh.geometry = geo; T.bead.position.copy(tmpV[20]);
    }
  }
  return {
    root, update(t: number) {
      const flap = Math.sin(t * 4.2);
      for (const w of wings) w.rotation.z = w.userData.s * flap * 0.55;
      body.position.y = -flap * 0.12; tail(t);
    },
  };
}

function crane() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const ol = new THREE.MeshBasicMaterial({ color: 0x2e3a44, side: THREE.BackSide });
  const white = toon(0xf8f6f0), blue = toon(0x6fb3c8), deep = toon(0x3f7f9a), dark = toon(0x2a2a30);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), white); torso.scale.set(0.8, 0.7, 1.5); body.add(torso);
  const to = new THREE.Mesh(torso.geometry, ol); to.scale.copy(torso.scale).multiplyScalar(1.05); body.add(to);
  // 앞으로 길게 뻗은 목 + 머리 (붉은 정수리, 긴 부리)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.4, 8), white); neck.rotation.x = Math.PI / 2 - 0.15; neck.position.set(0, 0.12, 1.25); body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), white); head.position.set(0, 0.22, 1.95); body.add(head);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe0453a)); red.position.set(0, 0.31, 1.95); body.add(red);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.42, 8), toon(0x9a9a92)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.2, 2.25); body.add(beak);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1210 }); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeM); e.position.set(s * 0.1, 0.25, 2.0); body.add(e); }
  // 뒤로 뻗은 다리
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), dark); l.rotation.x = Math.PI / 2 + 0.1; l.position.set(s * 0.1, -0.15, -1.4); body.add(l); }
  // 넓은 날개: 몸쪽은 흰색, 끝으로 갈수록 푸른빛, 맨 끝 깃은 짙은 쪽빛
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.32, 0.12, 0.15); body.add(piv);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.9), white); inner.position.set(s * 0.65, 0, 0); piv.add(inner);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), blue); mid.position.set(s * 1.85, 0, -0.08); piv.add(mid);
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.75), deep); f.position.set(s * (2.5 + i * 0.12), 0, -0.25 - i * 0.04); f.rotation.y = s * (0.2 + i * 0.12); piv.add(f); }
    piv.userData.s = s; wings.push(piv);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 6), dark); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.02, -0.95); tail.scale.set(1, 1, 0.3); body.add(tail);
  return {
    root, update(t: number) {
      const flap = Math.sin(t * 2.2);
      for (const w of wings) w.rotation.z = w.userData.s * flap * 0.45;
      body.position.y = -flap * 0.15;
    },
  };
}

type Kind = 'phoenix' | 'crane';
export function createLegends(scene: THREE.Scene, GLOW: THREE.Texture) {
  const P = phoenix(GLOW), C = crane();
  P.root.visible = C.root.visible = false; scene.add(P.root, C.root);
  const flights: { kind: Kind; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; arc: number; scale: number; done?: () => void }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  return {
    /** 해 쪽 하늘을 가로지르게 띄움. 다 날아가면 done */
    fly(kind: Kind, camera: THREE.Camera, sunDir: THREE.Vector3, done?: () => void) {
      if (flights.some(f => f.kind === kind)) return;
      const f = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize(), right = new THREE.Vector3(f.z, 0, -f.x);
      const c = camera.position.clone(), dist = kind === 'phoenix' ? 48 : 34, h = Math.min(dist * 0.16, Math.max(0.5, Math.tan(Math.max(0.01, Math.asin(sunDir.y))) * dist)) + (kind === "phoenix" ? 0.3 : 2); // 해 높이 그대로 해 앞을 지나감
      const base = c.clone().addScaledVector(f, dist).addScaledVector(up, h);
      const side = Math.random() < 0.5 ? -1 : 1, span = kind === 'phoenix' ? 34 : 28;
      flights.push({ kind, t: 0, dur: kind === 'phoenix' ? 13 : 16, from: base.clone().addScaledVector(right, -span * side), to: base.clone().addScaledVector(right, span * side), arc: kind === 'phoenix' ? 5 : 2.5, scale: kind === "phoenix" ? 3.2 : 2.0, done });
    },
    flying: () => flights.length > 0,
    update(dt: number, t: number) {
      for (let i = flights.length - 1; i >= 0; i--) {
        const F = flights[i], obj = F.kind === 'phoenix' ? P : C; F.t += dt;
        const k = F.t / F.dur;
        if (k >= 1) { obj.root.visible = false; flights.splice(i, 1); F.done?.(); continue; }
        const pos = new THREE.Vector3().lerpVectors(F.from, F.to, k); pos.y += Math.sin(k * Math.PI) * F.arc;
        const ahead = new THREE.Vector3().lerpVectors(F.from, F.to, Math.min(1, k + 0.01)); ahead.y += Math.sin(Math.min(1, k + 0.01) * Math.PI) * F.arc;
        obj.root.visible = true; obj.root.position.copy(pos); obj.root.lookAt(ahead);
        // 나타날 때·사라질 때 부드럽게 커지고 작아짐
        obj.root.scale.setScalar(F.scale * Math.min(1, k * 6, (1 - k) * 6));
        obj.update(t);
      }
    },
  };
}
