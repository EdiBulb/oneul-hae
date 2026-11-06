import * as THREE from 'three';

/** 밤 하늘 불꽃 + 쥐불놀이 불꼬리. 둘 다 더해지는(Additive) 작은 빛 알갱이를 재사용한다 */
export const FIRE_COLORS = [0xff9fbf, 0xffc070, 0x9fd7ff, 0xc9a7ff, 0x8dffb0, 0xffe08a];

interface P { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; g: number; size: number }

export function createNightFx(scene: THREE.Scene, GLOW: THREE.Texture) {
  const pool: P[] = [];
  const live: P[] = [];
  const get = () => {
    const p = pool.pop() ?? (() => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      s.renderOrder = 3; scene.add(s);
      return { s, v: new THREE.Vector3(), life: 0, max: 1, g: 0, size: 1 } as P;
    })();
    p.s.visible = true; live.push(p); return p;
  };
  const spawn = (pos: THREE.Vector3, vel: THREE.Vector3, color: number, max: number, size: number, g: number) => {
    if (live.length > 900) return;
    const p = get();
    p.s.position.copy(pos); p.v.copy(vel); p.life = 0; p.max = max; p.size = size; p.g = g;
    p.s.material.color.setHex(color); p.s.scale.setScalar(size); p.s.material.opacity = 1;
  };

  // 불꽃: 바다 위로 쏘아 올려 터짐
  const rockets: { pos: THREE.Vector3; vy: number; t: number; color: number; top: number }[] = [];
  function firework(x: number, colorIdx: number, center: THREE.Vector3) {
    const color = FIRE_COLORS[colorIdx % FIRE_COLORS.length];
    rockets.push({ pos: new THREE.Vector3(center.x + x, 2, center.z - 55 - Math.random() * 20), vy: 30, t: 0, color, top: 26 + Math.random() * 10 });
  }
  function burst(at: THREE.Vector3, color: number) {
    const n = 70;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = 11 + Math.random() * 3;
      spawn(at, new THREE.Vector3(r * Math.cos(th) * sp, u * sp, r * Math.sin(th) * sp), i % 5 ? color : 0xfff4d6, 1.8 + Math.random() * 0.6, 2.2, -6);
    }
    spawn(at, new THREE.Vector3(), 0xffffff, 0.35, 14, 0);
  }

  /** 쥐불놀이 깡통에서 불티가 꼬리처럼 */
  const tmp = new THREE.Vector3();
  function ember(pos: THREE.Vector3, color: number, speed: number) {
    const k = Math.min(1, speed / 14);
    spawn(pos, tmp.set((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4), color, 0.35 + 0.6 * k, 0.55 + 0.25 * k, -0.4);
    if (Math.random() < 0.25 * k) spawn(pos, tmp.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), 0xffe6a0, 0.5, 0.18, -3);
  }

  function update(dt: number) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt; r.pos.y += r.vy * dt; r.vy = Math.max(4, r.vy - 9 * dt);
      spawn(r.pos, tmp.set((Math.random() - 0.5) * 0.6, -1, 0), 0xffd6a0, 0.5, 0.9, 0);
      if (r.pos.y >= r.top) { burst(r.pos, r.color); rockets.splice(i, 1); }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      if (p.life >= p.max) { p.s.visible = false; live.splice(i, 1); pool.push(p); continue; }
      p.v.y += p.g * dt; p.v.multiplyScalar(1 - 0.9 * dt);
      p.s.position.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max;
      p.s.material.opacity = k * k; p.s.scale.setScalar(p.size * (0.5 + 0.5 * k));
    }
  }
  return { firework, ember, update };
}
