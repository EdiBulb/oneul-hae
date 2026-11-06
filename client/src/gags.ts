import * as THREE from 'three';
import { animChar, faceAngle, makeChar, textSprite, turnTo, type Char } from './character';

// 웃긴 순간들: 천왕봉 '야호' 메아리, 해 뜬 뒤 헐레벌떡 뛰어오는 늦잠 잔 사람

/** 캐릭터 머리 위 말풍선 (ms 뒤 사라짐, 새로 말하면 바꿈) */
export function say(c: Char, text: string, ms = 2200, scale = 0.85) {
  const old = c.root.userData.bubble as THREE.Sprite | undefined;
  if (old) { c.root.remove(old); old.material.map?.dispose(); old.material.dispose(); }
  const s = textSprite(text, scale); s.position.y = 2.75; c.root.add(s); c.root.userData.bubble = s;
  clearTimeout(c.root.userData.bubbleT);
  c.root.userData.bubbleT = setTimeout(() => { if (c.root.userData.bubble === s) { c.root.remove(s); c.root.userData.bubble = undefined; } }, ms);
}

/** 산 너머에서 돌아오는 메아리 글자와 가끔 오는 엉뚱한 대답 */
export function createEcho(scene: THREE.Scene) {
  const live: { s: THREE.Sprite; t: number; life: number; base: number; vy: number }[] = [];
  const add = (text: string, pos: THREE.Vector3, scale: number, delay: number, life: number) => {
    setTimeout(() => {
      const s = textSprite(text, scale); s.position.copy(pos); s.material.opacity = 0; s.material.depthTest = false; s.renderOrder = 6;
      scene.add(s); live.push({ s, t: 0, life, base: 1, vy: 0.6 });
    }, delay);
  };
  return {
    /** 메아리 3번 (점점 멀고 흐리게). reply가 있으면 마지막에 산에서 대답 */
    shout(from: THREE.Vector3, echo: string, reply: string | null) {
      const side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Vector3(from.x + side * (3 + i * 5), from.y + 4 + i * 1.2, from.z - 14 - i * 10);
        add(echo, p, 3.2 - i * 0.8, 900 + i * 750, 2.6);
      }
      if (reply) add(reply, new THREE.Vector3(from.x - side * 4, from.y + 5, from.z - 18), 2.6, 3400, 3.6);
    },
    update(dt: number) {
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i]; e.t += dt;
        const k = e.t / e.life;
        e.s.material.opacity = Math.min(1, e.t * 3) * (1 - Math.max(0, (k - 0.6) / 0.4));
        e.s.position.y += e.vy * dt;
        if (k >= 1) { scene.remove(e.s); e.s.material.map?.dispose(); e.s.material.dispose(); live.splice(i, 1); }
      }
    },
  };
}

/** 늦잠 잔 사람: 잠옷 차림·까치집 머리로 등산로를 뛰어 올라와 전망대에서 털썩 */
export function createLateSleeper(scene: THREE.Scene, floor: (x: number, z: number) => number) {
  const c = makeChar(0xe8b8d8, 0x3a2a20);
  // 잠옷 줄무늬
  const stripeM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const y of [0.45, 0.62, 0.79]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 18), stripeM); st.rotation.x = Math.PI / 2; st.position.y = y; c.inner.add(st); }
  // 까치집 머리 (삐죽삐죽)
  const hairM = new THREE.MeshLambertMaterial({ color: 0x3a2a20 });
  for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), hairM); const a = i * 1.05; h.position.set(Math.cos(a) * 0.12, 1.72, Math.sin(a) * 0.12); h.rotation.set(Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8); c.inner.add(h); }
  // 달리는 뒤로 날리는 바람선
  const windM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  const wind = new THREE.Group(); c.root.add(wind);
  for (const [y, len] of [[0.9, 0.5], [1.2, 0.7], [1.5, 0.4]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len), windM); w.position.set(0.15 - y * 0.1, y, 0.5 + len / 2); wind.add(w); }
  c.root.visible = false; scene.add(c.root);
  let mode: 'off' | 'run' | 'flop' | 'leave' = 'off', t = 0, goal = new THREE.Vector3();
  const START = new THREE.Vector3(1.8, 0, 27), STOP = new THREE.Vector3(1.6, 0, 2.2);
  return {
    get busy() { return mode !== 'off'; },
    get pos() { return c.root.position; },
    start(lines: { huff: string; flop: string }) {
      mode = 'run'; t = 0; c.root.visible = true; wind.visible = true;
      c.root.position.set(START.x, floor(START.x, START.z), START.z); goal.copy(STOP);
      c.state = 'walk'; say(c, lines.huff, 6000);
      c.root.userData.flop = lines.flop;
    },
    update(dt: number) {
      if (mode === 'off') return;
      t += dt;
      const p = c.root.position;
      const speed = mode === 'run' ? 3.6 : 1.1;
      if (mode === 'run' || mode === 'leave') {
        const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.15) {
          if (mode === 'run') {
            // 도착: "벌써 떴어요?" 하고 털썩
            mode = 'flop'; t = 0; c.state = 'sit'; c.bench = false; wind.visible = false;
            say(c, c.root.userData.flop as string, 4500, 1);
          } else { mode = 'off'; c.root.visible = false; }
        } else {
          p.x += dx / d * speed * dt; p.z += dz / d * speed * dt;
          turnTo(c, faceAngle(dx, dz), dt);
          // 뛸 때는 다리를 더 빨리
          c.phase += dt * (mode === 'run' ? 7 : 0);
        }
        p.y = floor(p.x, p.z);
      } else if (mode === 'flop') {
        turnTo(c, 0, dt); // 해 쪽을 멍하니 바라봄
        p.y = floor(p.x, p.z);
        if (t > 5.5) { mode = 'leave'; c.state = 'walk'; goal.copy(START); }
      }
      animChar(c, dt);
    },
  };
}
