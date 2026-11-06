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
