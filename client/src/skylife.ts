import * as THREE from 'three';

// 하늘의 작은 움직임: 밤엔 별똥별, 낮엔 천천히 흘러가는 구름.

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  }
  return new THREE.CanvasTexture(c);
}

export function createSkyLife(scene: THREE.Scene, GLOW: THREE.Texture) {
  // ---------- 구름 ----------
  const tex = cloudTexture();
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    const a = (i / 7) * Math.PI * 1.4 - Math.PI * 0.7; // 바다 쪽 하늘에 고르게
    const d = rand(380, 560);
    s.userData = { x: Math.sin(a) * d, y: rand(70, 150), z: -Math.cos(a) * d, speed: rand(1.2, 3) };
    s.scale.set(rand(160, 260), rand(55, 85), 1);
    s.renderOrder = -1;
    scene.add(s);
    return s;
  });

  // ---------- 별똥별 ----------
  const TRAIL = 16;
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xe8f0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    const k = 1 - i / TRAIL; s.scale.set(7 * k + 1, 7 * k + 1, 1); s.visible = false; s.renderOrder = -1;
    scene.add(s); return s;
  });
  let star: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  let nextStar = performance.now() + rand(20000, 40000);
  const dir = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();

  function shoot(camera: THREE.Camera) {
    camera.getWorldDirection(dir);
    if (dir.y < 0.15) dir.y = 0.35; // 땅을 보고 있으면 하늘 쪽으로
    dir.normalize();
    side.crossVectors(dir, up).normalize();
    const from = camera.position.clone().addScaledVector(dir, 520).addScaledVector(side, rand(-200, 60)).add(tmp.set(0, rand(30, 110), 0));
    const to = from.clone().addScaledVector(side, rand(160, 260)).add(tmp.set(0, -rand(60, 120), 0));
    star = { from, to, t: 0 };
  }

  /** 별똥별이 지나간 순간 true. lying: 누워서 별 보는 중이면 자주 */
  function update(dt: number, t: number, alt: number, camera: THREE.Camera, lying: boolean) {
    // 구름: 낮에 또렷, 새벽엔 해 쪽이 물든 색
    const day = clamp((alt + 3) / 8, 0, 1), warm = clamp(1 - alt / 10, 0, 1);
    for (const s of clouds) {
      const u = s.userData as { x: number; y: number; z: number; speed: number };
      u.x += u.speed * dt; if (u.x > 620) u.x = -620;
      s.position.set(camera.position.x + u.x, u.y, camera.position.z + u.z);
      s.material.opacity = day * 0.7;
      s.material.color.setRGB(1, 1 - warm * 0.22, 1 - warm * 0.32);
      s.visible = day > 0.01;
    }
    let fired = false;
    const night = alt < -6;
    if (!star && night && performance.now() > nextStar) {
      shoot(camera); fired = true;
      nextStar = performance.now() + (lying ? rand(25000, 60000) : rand(150000, 300000));
    }
    if (!night && !star) nextStar = Math.max(nextStar, performance.now() + 8000);
    if (star) {
      star.t += dt / 0.9;
      for (let i = 0; i < TRAIL; i++) {
        const k = star.t - i * 0.022;
        const s = trail[i];
        s.visible = k > 0 && k < 1;
        if (s.visible) { s.position.lerpVectors(star.from, star.to, k); s.material.opacity = (1 - i / TRAIL) * Math.sin(Math.PI * clamp(star.t, 0, 1)); }
      }
      if (star.t > 1 + TRAIL * 0.022) { star = null; trail.forEach(s => (s.visible = false)); }
    }
    void t;
    return fired;
  }
  /** 테스트·연출용: 바로 하나 떨어뜨리기 */
  const force = () => { nextStar = 0; };
  return { update, force };
}
