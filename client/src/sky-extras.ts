import * as THREE from 'three';

// 반딧불(밤)과 해 앞을 지나가는 새 떼 실루엣 (해 뜰 때)

/** 밤에 내 주변을 둥둥 떠다니는 반딧불 */
export function createFireflies(scene: THREE.Scene, GLOW: THREE.Texture) {
  const N = 46, g = new THREE.Group(); scene.add(g);
  const flies = Array.from({ length: N }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: i % 5 ? 0xbfff6a : 0x8af0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.scale.setScalar(0.32); g.add(s);
    return { s, cx: (Math.random() - 0.5) * 30, cz: Math.random() * 18 - 2, y: 0.5 + Math.random() * 2.4, ph: Math.random() * 100, sp: 0.3 + Math.random() * 0.5, r: 0.6 + Math.random() * 1.6 };
  });
  return {
    update(t: number, night: number, around: THREE.Vector3, floor: (x: number, z: number) => number) {
      const k = Math.max(0, (night - 0.45) / 0.55);
      g.visible = k > 0.01;
      if (!g.visible) return;
      const ts = t / 1000;
      for (const f of flies) {
        const x = around.x + f.cx + Math.sin(ts * f.sp + f.ph) * f.r, z = around.z + f.cz * 0.8 + Math.cos(ts * f.sp * 0.8 + f.ph) * f.r - 3;
        f.s.position.set(x, floor(x, z) + f.y + Math.sin(ts * 1.3 + f.ph) * 0.25, z);
        // 깜빡깜빡
        const blink = Math.max(0, Math.sin(ts * (1.2 + f.sp) + f.ph * 3));
        f.s.material.opacity = k * (0.25 + 0.75 * blink * blink);
      }
    },
  };
}

/** 해 앞을 가로질러 날아가는 새 떼 (검은 실루엣, 노을 프사 느낌) */
export function createFlock(scene: THREE.Scene) {
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  const m = new THREE.MeshBasicMaterial({ color: 0x1a1418, fog: false, side: THREE.DoubleSide });
  const birds = Array.from({ length: 9 }, (_, i) => {
    const b = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), m); wl.position.x = -1.2; b.add(wl);
    const wr = wl.clone(); wr.position.x = 1.2; b.add(wr);
    const body = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), m); b.add(body);
    // V 대형
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    b.position.set(side * row * 5, -row * 2.4 + (Math.random() - 0.5), 0);
    g.add(b);
    return { b, wl, wr, ph: Math.random() * 6 };
  });
  let t0 = -1;
  return {
    fly() { t0 = 0; g.visible = true; },
    update(dt: number, camera: THREE.Camera, sunDir: THREE.Vector3) {
      if (t0 < 0) return;
      t0 += dt;
      const T = 16, k = t0 / T;
      if (k > 1) { t0 = -1; g.visible = false; return; }
      // 해 방향 400m 앞, 오른쪽 → 왼쪽으로 가로지르며 살짝 올라감
      const right = new THREE.Vector3(-sunDir.z, 0, sunDir.x).normalize();
      g.position.copy(camera.position).addScaledVector(sunDir, 400).addScaledVector(right, (0.5 - k) * 260);
      g.position.y += 18 + k * 30;
      g.lookAt(camera.position);
      for (const bd of birds) {
        const f = Math.sin((t0 * 7 + bd.ph)) * 0.6;
        bd.wl.rotation.z = f; bd.wr.rotation.z = -f;
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
