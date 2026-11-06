import * as THREE from 'three';

// 반딧불(밤)과 해 앞을 지나가는 새 떼 실루엣 (해 뜰 때)

/** 밤에 내 주변을 둥둥 떠다니는 반딧불 */
export function createFireflies(scene: THREE.Scene, GLOW: THREE.Texture) {
  // 장소 곳곳에 흩어져 각자 천천히 떠돌아다님 (사람을 따라다니지 않음)
  const N = 60, g = new THREE.Group(); scene.add(g);
  const flies = Array.from({ length: N }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: i % 5 ? 0xbfff6a : 0x8af0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.scale.setScalar(0.32); g.add(s);
    return { s, x: (Math.random() - 0.5) * 40, z: -1 + Math.random() * 22, y: 0.5 + Math.random() * 2.4, a: Math.random() * 6.28, sp: 0.25 + Math.random() * 0.4, ph: Math.random() * 100 };
  });
  return {
    update(t: number, night: number, _around: THREE.Vector3, floor: (x: number, z: number) => number) {
      const k = Math.max(0, (night - 0.45) / 0.55);
      g.visible = k > 0.01;
      if (!g.visible) return;
      const ts = t / 1000;
      for (const f of flies) {
        // 방향을 조금씩 틀며 날아다니고, 구역 밖으로 나가면 안쪽으로 돌아옴
        f.a += (Math.sin(ts * 0.7 + f.ph) * 0.9) * 0.016;
        if (Math.abs(f.x) > 20 || f.z < -1 || f.z > 21) f.a = Math.atan2(10 - f.z, -f.x);
        f.x += Math.cos(f.a) * f.sp * 0.016; f.z += Math.sin(f.a) * f.sp * 0.016;
        f.s.position.set(f.x, floor(f.x, f.z) + f.y + Math.sin(ts * 1.3 + f.ph) * 0.3, f.z);
        const blink = Math.max(0, Math.sin(ts * (1.2 + f.sp) + f.ph * 3));
        f.s.material.opacity = k * (0.25 + 0.75 * blink * blink);
      }
    },
  };
}

/** 해 앞을 가로질러 날아가는 새 떼 (검은 실루엣, 노을 프사 느낌) */
/** 갈매기 무리: 꽉 찬 검은 실루엣 3~5마리가 해 앞을 느슨하게 지나감.
 *  날개는 안쪽·바깥쪽 두 마디라 바깥 날개가 살짝 늦게 따라와 자연스럽게 펄럭이고, 가끔 날개를 편 채 미끄러진다.
 *  해 가까이 지날 땐 뒤쪽 금빛 후광 + 날개 가장자리 빛(림 라이트)이 켜진다. */
export function createFlock(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  const ink = new THREE.MeshBasicMaterial({ color: 0x120a07, fog: false, side: THREE.DoubleSide });
  // 날개 모양 (오른쪽 날개 기준, 몸통 쪽이 x=0)
  const inner = new THREE.Shape();
  inner.moveTo(0, 0.12); inner.bezierCurveTo(0.6, 0.32, 1.2, 0.34, 1.6, 0.22); inner.lineTo(1.6, -0.12); inner.bezierCurveTo(1.1, -0.06, 0.5, -0.14, 0, -0.2); inner.closePath();
  const outer = new THREE.Shape();
  outer.moveTo(0, 0.22); outer.bezierCurveTo(0.7, 0.2, 1.4, 0.0, 2.1, -0.32); outer.bezierCurveTo(1.4, -0.22, 0.6, -0.18, 0, -0.12); outer.closePath();
  const gIn = new THREE.ShapeGeometry(inner, 6), gOut = new THREE.ShapeGeometry(outer, 8);
  const body = new THREE.Shape();
  body.moveTo(-0.62, 0); body.bezierCurveTo(-0.4, 0.2, 0.3, 0.2, 0.7, 0.04); body.lineTo(0.95, 0.0); body.lineTo(0.7, -0.06); body.bezierCurveTo(0.3, -0.2, -0.4, -0.2, -0.62, 0);
  const gBody = new THREE.ShapeGeometry(body, 6);
  const rimMat = (o: number) => new THREE.SpriteMaterial({ map: GLOW, color: 0xffb04a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: o });
  const N = 5;
  const birds = Array.from({ length: N }, (_, i) => {
    const b = new THREE.Group();
    const wing = (side: 1 | -1) => {
      const root = new THREE.Group(), mIn = new THREE.Mesh(gIn, ink), elbow = new THREE.Group(), mOut = new THREE.Mesh(gOut, ink);
      root.scale.x = side; elbow.position.x = 1.55; elbow.add(mOut); root.add(mIn, elbow); b.add(root);
      return { root, elbow };
    };
    const L = wing(-1), R = wing(1);
    const bd = new THREE.Mesh(gBody, ink); bd.rotation.z = Math.PI / 2; bd.scale.set(1, 1.15, 1); b.add(bd);
    // 해 앞을 지날 때 켜지는 빛: 뒤쪽 큰 후광 + 몸에 붙은 작은 반짝임
    const halo = new THREE.Sprite(rimMat(0)); halo.scale.set(9, 9, 1); halo.position.z = -0.5; halo.renderOrder = 4; b.add(halo);
    const rim = new THREE.Sprite(rimMat(0)); rim.scale.set(5.5, 2.2, 1); rim.position.z = 0.2; rim.renderOrder = 6; b.add(rim);
    g.add(b);
    const sc = [1.25, 1, 0.85, 0.7, 0.6][i];
    b.scale.setScalar(sc * 3.6);
    return { b, L, R, halo, rim, sc, ph: Math.random() * 6, sp: 5 + Math.random() * 2.5,
      ox: i * 11 + (Math.random() - 0.5) * 6, oy: (Math.random() - 0.5) * 14, oz: (Math.random() - 0.5) * 40,
      glide: Math.random() * 6, bob: Math.random() * 6 };
  });
  let t0 = -1;
  const right = new THREE.Vector3(), toB = new THREE.Vector3(), base = new THREE.Vector3();
  return {
    fly() {
      t0 = 0; g.visible = true;
      for (const bd of birds) { bd.ph = Math.random() * 6; bd.glide = Math.random() * 6; }
    },
    update(dt: number, camera: THREE.Camera, sunDir: THREE.Vector3) {
      if (t0 < 0) return;
      t0 += dt;
      const T = 22, k = t0 / T;
      if (k > 1) { t0 = -1; g.visible = false; return; }
      // 해 방향 300m 앞, 오른쪽 → 왼쪽으로 해 원반을 가로지르며 아주 살짝 올라감
      right.set(-sunDir.z, 0, sunDir.x).normalize();
      base.copy(camera.position).addScaledVector(sunDir, 300);
      for (const bd of birds) {
        const x = (0.5 - k) * 160 + bd.ox - 14;
        const p = bd.b.position.copy(base).addScaledVector(right, x).addScaledVector(sunDir, bd.oz);
        p.y += bd.oy + 3 + k * 8 + Math.sin(t0 * 0.9 + bd.bob) * 1.2;
        bd.b.lookAt(camera.position);
        bd.b.rotateZ(Math.sin(t0 * 0.7 + bd.bob) * 0.08); // 살짝 기우뚱
        // 날갯짓: 4초 중 1.3초는 날개를 편 채 활공
        const cyc = (t0 + bd.glide) % 4, flap = cyc < 2.7 ? 1 : 0.15;
        const a = t0 * bd.sp + bd.ph, f = Math.sin(a) * 0.55 * flap + 0.12;
        const fo = Math.sin(a - 0.9) * 0.45 * flap - 0.08;
        bd.L.root.rotation.z = -f; bd.R.root.rotation.z = f;
        bd.L.elbow.rotation.z = fo; bd.R.elbow.rotation.z = fo;
        // 해와 가까울수록 빛남 (화면상 각도로)
        toB.copy(p).sub(camera.position).normalize();
        const near = THREE.MathUtils.clamp((toB.dot(sunDir) - 0.985) / 0.0148, 0, 1);
        const glow = near * near;
        bd.halo.material.opacity = glow * 0.75; bd.rim.material.opacity = glow * 0.9;
        bd.halo.visible = bd.rim.visible = glow > 0.01;
      }
    },
  };
}

/** 가을 낙엽: 내 주변으로 팔랑팔랑 떨어지고, 땅에도 조금 쌓여 있음 (살짝 어두운 단풍색이라 해를 가리지 않음) */
export function createLeaves(scene: THREE.Scene) {
  const N = 70, GROUND = 140;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.09); shape.quadraticCurveTo(0.08, -0.02, 0, 0.09); shape.quadraticCurveTo(-0.08, -0.02, 0, -0.09);
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const COLS = [0x9a3b22, 0xb5562a, 0x8a4a1f, 0xa87a2a, 0x6e2f1d, 0xc0702e].map(c => new THREE.Color(c));
  const fall = new THREE.InstancedMesh(geo, mat, N), lay = new THREE.InstancedMesh(geo, mat, GROUND);
  fall.frustumCulled = lay.frustumCulled = false;
  scene.add(fall, lay);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1.4, 1.4, 1.4);
  const leaves = Array.from({ length: N }, (_, i) => {
    fall.setColorAt(i, COLS[i % COLS.length]);
    return { x: 0, y: -99, z: 0, vy: 0, ph: Math.random() * 6, sp: 0.6 + Math.random() * 0.8 };
  });
  for (let i = 0; i < GROUND; i++) lay.setColorAt(i, COLS[(i * 7) % COLS.length]);
  let on = false;
  const respawn = (l: typeof leaves[number], c: THREE.Vector3, top: boolean) => {
    l.x = c.x + (Math.random() - 0.5) * 22; l.z = c.z + (Math.random() - 0.5) * 18;
    l.y = c.y + (top ? 6 + Math.random() * 3 : Math.random() * 8); l.vy = 0.5 + Math.random() * 0.5;
  };
  return {
    /** floor: 그 자리 땅 높이 */
    setOn(v: boolean, center: THREE.Vector3, floor: (x: number, z: number) => number) {
      on = v; fall.visible = lay.visible = v;
      if (!v) return;
      for (const l of leaves) respawn(l, center, false);
      // 땅에 떨어져 있는 낙엽
      for (let i = 0; i < GROUND; i++) {
        const x = (Math.random() - 0.5) * 26, z = 2 + Math.random() * 24;
        p.set(x, floor(x, z) + 0.03, z); e.set(-Math.PI / 2, 0, Math.random() * 6); q.setFromEuler(e);
        lay.setMatrixAt(i, m4.compose(p, q, sc));
      }
      lay.instanceMatrix.needsUpdate = true;
    },
    update(dt: number, t: number, center: THREE.Vector3, floor: (x: number, z: number) => number) {
      if (!on) return;
      const ts = t / 1000;
      leaves.forEach((l, i) => {
        l.y -= l.vy * dt;
        // 좌우로 흔들리며 바람 따라 살짝 흘러감
        l.x += (Math.sin(ts * l.sp + l.ph) * 0.6 + 0.25) * dt;
        l.z += Math.cos(ts * l.sp * 0.7 + l.ph) * 0.3 * dt;
        if (l.y < floor(l.x, l.z) + 0.05 || Math.abs(l.x - center.x) > 14 || Math.abs(l.z - center.z) > 12) respawn(l, center, true);
        p.set(l.x, l.y, l.z);
        e.set(ts * l.sp * 2 + l.ph, Math.sin(ts + l.ph) * 1.5, ts * l.sp + l.ph); q.setFromEuler(e);
        fall.setMatrixAt(i, m4.compose(p, q, sc));
      });
      fall.instanceMatrix.needsUpdate = true;
    },
  };
}
