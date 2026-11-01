import { T } from './i18n';
import * as THREE from 'three';
import type { DogState } from '../../server/src/protocol';
import { animChar, makeChar, textSprite } from './character';
import { groundY } from './world';

// 해변 풍경: 갈매기, 강아지, 낚시하는 동네 주민.
// 사람(접속자)과 분명히 다르게 생겼고, 인원수에는 절대 포함하지 않는다.

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const M = (c: number) => new THREE.MeshLambertMaterial({ color: c });

// ---------- 갈매기 ----------
function makeGull() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), M(0xf4f1ea));
  body.scale.set(1, 0.8, 2.1); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M(0xf4f1ea));
  head.position.set(0, 0.1, -0.36); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), M(0xf0b43c));
  beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.08, -0.5); g.add(beak);
  const wingGeo = new THREE.BoxGeometry(0.7, 0.02, 0.26); wingGeo.translate(0.35, 0, 0);
  const wingM = M(0xd9dde2);
  const wl = new THREE.Mesh(wingGeo, wingM), wr = new THREE.Mesh(wingGeo, wingM);
  wr.rotation.y = Math.PI; g.add(wl, wr);
  const tipM = M(0x3a3f48);
  for (const w of [wl, wr]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.24), tipM); tip.position.x = 0.62; w.add(tip); }
  return { g, wl, wr };
}

interface Gull { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; mode: 'circle' | 'ground' | 'flee'; t: number; r: number; h: number; speed: number; cx: number; cz: number; vy: number; rest: number }

export function createBeachLife(scene: THREE.Scene) {
  const gulls: Gull[] = [];
  for (let i = 0; i < 6; i++) {
    const { g, wl, wr } = makeGull();
    scene.add(g);
    const ground = i >= 4;
    gulls.push({ g, wl, wr, mode: ground ? 'ground' : 'circle', t: rand(0, 6.28), r: rand(14, 30), h: rand(7, 14), speed: rand(0.12, 0.22) * (Math.random() < 0.5 ? 1 : -1), cx: rand(-8, 8), cz: rand(-28, -14), vy: 0, rest: 0 });
  }
  function landGull(gl: Gull) {
    gl.mode = 'ground';
    gl.g.position.set(rand(-14, 14), groundY(0) + 0.12, rand(-1.2, 1.5));
    gl.g.rotation.set(0, rand(0, 6.28), 0);
    gl.wl.rotation.z = gl.wr.rotation.z = 0;
    gl.g.visible = true;
  }
  gulls.filter(x => x.mode === 'ground').forEach(landGull);

  // ---------- 강아지 ----------
  const dog = new THREE.Group();
  const fur = M(0xb07a45), dark = M(0x5a3b22);
  const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.7), fur); dBody.position.y = 0.38; dog.add(dBody);
  const dHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.3), fur); dHead.position.set(0, 0.6, -0.42); dog.add(dHead);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), M(0xd9b48a)); snout.position.set(0, 0.55, -0.6); dog.add(snout);
  for (const x of [-0.12, 0.12]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), dark); ear.position.set(x, 0.74, -0.38); dog.add(ear); }
  const tail = new THREE.Group(); tail.position.set(0, 0.48, 0.35);
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.26, 6), fur); tailM.position.y = 0.12; tailM.rotation.x = 0.5; tail.add(tailM); dog.add(tail);
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.11, -0.25], [0.11, -0.25], [-0.11, 0.25], [0.11, 0.25]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), fur); l.geometry.translate(0, -0.13, 0); l.position.set(x, 0.26, z); dog.add(l); legs.push(l);
  }
  const dShadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false }));
  dShadow.rotation.x = -Math.PI / 2; dShadow.position.y = 0.02; dog.add(dShadow);
  dog.position.set(-6, groundY(1), 1);
  scene.add(dog);
  const dogState = { target: new THREE.Vector3(4, 0, 0.5), wait: 0, phase: 0 };
  // 몸을 기울이는 축 (앉기·발라당)
  const pose = new THREE.Group(); dog.add(pose);
  for (const ch of [...dog.children]) if (ch !== pose && ch !== dShadow) pose.add(ch);
  let dogName = textSprite('', 0.5);
  dog.add(dogName);
  /** 서버가 정한 강아지 (연결 안 됐을 땐 null → 혼자 어슬렁) */
  let net: DogState | null = null;
  // 하트
  const hearts: { s: THREE.Sprite; t: number }[] = [];
  const heartTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    // 하트 모양을 직접 그림 (이모지 글꼴이 없는 기기에서도 분홍 하트)
    g.fillStyle = '#ff5f87';
    g.beginPath(); g.moveTo(32, 54);
    g.bezierCurveTo(6, 36, 6, 12, 22, 12); g.bezierCurveTo(28, 12, 32, 17, 32, 21);
    g.bezierCurveTo(32, 17, 36, 12, 42, 12); g.bezierCurveTo(58, 12, 58, 36, 32, 54);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(22, 22, 5, 3, -0.6, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  function heartBurst(n = 3) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.28); scene.add(s);
      s.position.set(dog.position.x + rand(-0.25, 0.25), dog.position.y + 0.9, dog.position.z + rand(-0.25, 0.25));
      hearts.push({ s, t: -i * 0.25 });
    }
  }

  // ---------- 낚시하는 동네 주민 ----------
  const fisher = makeChar(0x6b6f5a, 0xd9b36a);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 16), M(0xd9b36a));
  brim.position.y = 1.24; fisher.inner.add(brim);
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 10), M(0x6a4a2e));
  stool.position.y = 0.14; fisher.root.add(stool);
  const rod = new THREE.Group(); rod.position.set(0.25, 0.8, -0.2);
  const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 2.6, 5), M(0x2b2b2b));
  rodM.position.y = 1.3; rod.add(rodM); rod.rotation.x = -1.05; fisher.inner.add(rod);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.25, 2.25, -2.6), new THREE.Vector3(0.25, -0.1, -3.4)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  fisher.root.add(line);
  const tag = textSprite(T.fisher, 0.55); tag.position.y = 1.85; fisher.root.add(tag);
  fisher.state = 'sit';
  fisher.root.position.set(17.5, groundY(-1.4) + 0.2, -1.4);
  fisher.root.rotation.y = 0.15;
  scene.add(fisher.root);
  for (let i = 0; i < 40; i++) animChar(fisher, 0.05);
  fisher.armL.rotation.x = fisher.armR.rotation.x = 1.0;

  function update(dt: number, t: number, me: THREE.Vector3, cam: THREE.Camera) {
    // 갈매기
    for (const gl of gulls) {
      if (gl.mode === 'circle') {
        gl.t += gl.speed * dt;
        const x = gl.cx + Math.cos(gl.t) * gl.r, z = gl.cz + Math.sin(gl.t) * gl.r * 0.6;
        const y = gl.h + Math.sin(t / 900 + gl.r) * 0.8;
        gl.g.position.set(x, y, z);
        gl.g.rotation.y = Math.atan2(-(-Math.sin(gl.t) * gl.speed), -(Math.cos(gl.t) * gl.speed * 0.6)) ;
        gl.g.rotation.z = -Math.sign(gl.speed) * 0.25;
        const flap = Math.sin(t / 140 + gl.r) * 0.55 * (Math.sin(t / 1700 + gl.r) > 0.2 ? 1 : 0.15);
        gl.wl.rotation.z = flap; gl.wr.rotation.z = -flap;
      } else if (gl.mode === 'ground') {
        // 가끔 고개를 까딱
        gl.g.rotation.x = Math.sin(t / 300 + gl.r) > 0.96 ? 0.25 : 0;
        if (gl.g.position.distanceTo(me) < 3.2) { gl.mode = 'flee'; gl.vy = 3; gl.rest = 0; }
      } else {
        gl.vy = Math.min(gl.vy + 2 * dt, 6);
        gl.g.position.y += gl.vy * dt; gl.g.position.z -= 3 * dt;
        const flap = Math.sin(t / 70) * 0.8; gl.wl.rotation.z = flap; gl.wr.rotation.z = -flap;
        if (gl.g.position.y > 16) { gl.g.visible = false; gl.rest += dt; }
        if (gl.rest > 25) landGull(gl);
      }
    }
    // 강아지
    const p = dog.position;
    let moving = false, mode: DogState['mode'] = 'wander';
    if (net) {
      // 서버 위치로 부드럽게 따라감 (1초마다 오므로 그 사이를 채움)
      mode = net.mode;
      const dx = net.x - p.x, dz = net.z - p.z, d = Math.hypot(dx, dz);
      if (d > 6) { p.x = net.x; p.z = net.z; }
      else if (d > 0.05) {
        const sp = Math.min(d, (mode === 'follow' ? 2.4 : 1.6) * dt);
        p.x += (dx / d) * sp; p.z += (dz / d) * sp; moving = d > 0.12;
      }
      const want = moving ? Math.atan2(-dx, -dz) : net.ry;
      let dr = want - dog.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      dog.rotation.y += dr * Math.min(1, dt * 8);
    } else {
      const d = Math.hypot(dogState.target.x - p.x, dogState.target.z - p.z);
      if (dogState.wait > 0) dogState.wait -= dt;
      else if (d > 0.1) {
        const sp = Math.min(d, 1.4 * dt);
        p.x += (dogState.target.x - p.x) / d * sp; p.z += (dogState.target.z - p.z) / d * sp;
        dog.rotation.y = Math.atan2(-(dogState.target.x - p.x), -(dogState.target.z - p.z)); moving = true;
      } else {
        dogState.wait = rand(2, 6);
        if (Math.random() < 0.3) dogState.target.set(me.x + rand(-1.5, 1.5), 0, me.z - rand(1, 2));
        else dogState.target.set(rand(-16, 14), 0, rand(-1.4, 4));
      }
    }
    p.y = groundY(p.z);
    // 자세: 앉기는 엉덩이를 내리고, 발라당은 옆으로 누워 배를 보임
    const e = 1 - Math.pow(0.002, dt);
    // 발라당: 발 높이를 축으로 거의 뒤집으므로, 그만큼 몸을 들어 올려 등이 모래 위에 닿게 한다
    const tRx = mode === 'sit' ? -0.45 : 0, tRz = mode === 'belly' ? 2.9 : 0, tY = mode === 'sit' ? -0.08 : mode === 'belly' ? 0.72 : 0;
    pose.rotation.x += (tRx - pose.rotation.x) * e; pose.rotation.z += (tRz - pose.rotation.z) * e; pose.position.y += (tY - pose.position.y) * e;
    if (moving) {
      dogState.phase += dt * (mode === 'follow' ? 16 : 12);
      legs.forEach((l, i) => (l.rotation.x = Math.sin(dogState.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5));
      tail.rotation.z = Math.sin(t / (mode === 'follow' ? 60 : 120)) * (mode === 'follow' ? 0.7 : 0.3);
    } else if (mode === 'belly') {
      legs.forEach((l, i) => (l.rotation.x = Math.sin(t / 90 + i) * 0.5)); // 다리 버둥버둥
      tail.rotation.z = Math.sin(t / 50) * 0.8;
    } else {
      legs.forEach(l => (l.rotation.x *= 0.8));
      tail.rotation.z = Math.sin(t / (mode === 'sit' ? 45 : 70)) * (mode === 'sit' ? 0.9 : 0.6);
    }
    dogName.visible = cam.position.distanceTo(p) < 14;
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      h.s.visible = h.t > 0;
      if (h.t > 0) { h.s.position.y += dt * 0.6; h.s.position.x += Math.sin(h.t * 4 + i) * dt * 0.15; h.s.material.opacity = Math.max(0, 1 - h.t / 1.6); }
      if (h.t > 1.6) { scene.remove(h.s); h.s.material.dispose(); hearts.splice(i, 1); }
    }
    // 동네 주민: 낚싯대가 살짝 흔들림
    rod.rotation.x = -1.05 + Math.sin(t / 900) * 0.04;
    tag.visible = cam.position.distanceTo(fisher.root.position) < 22;
  }

  return {
    update,
    /** 서버에서 온 강아지 상태 (null이면 혼자 어슬렁) */
    setDog(d: DogState | null) { if (d && !net) { dog.position.x = d.x; dog.position.z = d.z; } net = d; },
    setName(name: string) { dog.remove(dogName); dogName = textSprite(name, 0.5); dogName.position.y = 1.15; dog.add(dogName); },
    heartBurst,
    get dogPos() { return dog.position; },
  };
}
