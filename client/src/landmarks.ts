import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { trailX, POND, SPOTS_ON as SPOTS } from './beach-extras';
import { hipRoof } from './hall';
import { blueCrane, craneEmblem } from './crane';
import { koreanPine } from './place-scenery';
import { stable } from './stable-tex';
import { stylize } from './look';
import { regionOpen } from './regions';
import { bakeStatic } from './bake';
import { onProgress } from './progress';

/** 새 장소 시안 (주소에 ?spots=1): 천왕샘 · 당산나무 · 운해 그네 · 봉황바위 */
export const SPOTS_ON = SPOTS;

/** 천왕샘 연못 가운데 (beach-extras POND) */
export const SPRING = { x: POND.x, z: POND.z, r: POND.rx };
/** 당산나무: 장터목 마당 왼쪽 위 */
export const DANGSAN = { x: trailX(91) - 7.2, z: 91 };
/** 운해 그네: 꽃밭 끝 바위 턱, 바깥(+x) 구름바다를 봄 */
export const SWING = { x: trailX(62) + 27.5, z: 62 };
/** 봉황바위: 정상에서 왼쪽 앞 구름바다 위로 솟은 바위 봉우리 (못 가는 곳) */
export const PHOENIX_ROCK = new THREE.Vector3(-46, 26, -128);

/** 한옥 지붕: 기와 + 처마 밑(서까래 빛 판) + 단청 띠. 아래에서 봐도 납작한 판이 아니라 처마로 보이게 */
function koreanRoof(w: number, d: number, h: number, lift: number, tile: number) {
  const g = hipRoof(w, d, h, lift, new THREE.MeshToonMaterial({ color: tile }));
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, d * 0.86), new THREE.MeshToonMaterial({ color: 0xe8d2a8, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = -h / 2 + 0.03; under.userData.noLine = true; g.add(under);
  const band = new THREE.MeshToonMaterial({ color: 0x5aa88a });
  for (const [bw, bd, x, z] of [[w * 0.8, 0.07, 0, d * 0.4], [w * 0.8, 0.07, 0, -d * 0.4], [0.07, d * 0.8, w * 0.4, 0], [0.07, d * 0.8, -w * 0.4, 0]] as const) { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.09, bd), band); b.position.set(x, -h / 2 - 0.02, z); g.add(b); }
  return g;
}
const toon = (c: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, ...extra });
const rand = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

function carved(lines: string[], w = 256, h = 512, color = 'rgba(90,70,70,.85)', vertical = true, bg = '') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (vertical) { x.font = `900 ${Math.floor(w * 0.62)}px "Noto Serif KR", serif`; const ch = [...lines[0]]; ch.forEach((t, i) => x.fillText(t, w / 2, (i + 0.5) * h / ch.length)); }
  else lines.forEach((l, i) => { x.font = `${i ? 700 : 900} ${i ? 34 : 56}px "Noto Sans KR", sans-serif`; x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 64); });
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createSpots(parent: THREE.Group, mY: (x: number, z: number) => number, GLOW: THREE.Texture) {
  const g = new THREE.Group(); parent.add(g);
  const rnd = rand(11);
  const stone = [toon(0xcdbcc4), toon(0xd8c8cc), toon(0xbcaab6)];
  const rock = (parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, m = stone[Math.floor(rnd() * 3)]) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), m); r.scale.set(sx, sy, sz); r.position.set(x, y, z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); parent.add(r); return r;
  };
  const anim: ((t: number, night: number) => void)[] = [];

  // ---------- 천왕샘 · 청학지(靑鶴池): 샘물이 바위벽을 타고 흘러내려 고인 맑은 연못, 가운데 섬에 청학정 ----------
  const P0 = POND, wy = P0.y;
  const pg = new THREE.Group(); g.add(pg);
  const at = (a: number, d: number) => [P0.x + Math.cos(a) * P0.rx * d, P0.z + Math.sin(a) * P0.rz * d] as const;
  const ISLE = { x: P0.x + P0.isle.dx, z: P0.z + P0.isle.dz, r: P0.isle.r };
  {
    // 물: 아주 맑은 청록빛. 가장자리는 투명해 바닥이 비치고, 가운데로 갈수록 깊은 하늘빛. 햇살 무늬가 일렁임
    const geo = new THREE.CircleGeometry(1, 64); geo.rotateX(-Math.PI / 2); geo.scale(P0.rx, 1, P0.rz);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, shallow: { value: new THREE.Color(0x9ff0f0) }, deep: { value: new THREE.Color(0x2fa8e0) }, night: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float time; uniform vec3 shallow; uniform vec3 deep; uniform float night; varying vec2 vP;
        void main(){
          float d = length(vP / vec2(${P0.rx.toFixed(1)}, ${P0.rz.toFixed(1)}));
          vec3 c = mix(shallow, deep, smoothstep(0.15, 0.95, 1.0 - d));
          float w = sin(vP.x * 1.3 + time * 0.9) * sin(vP.y * 1.7 - time * 0.7) + sin((vP.x + vP.y) * 2.3 + time * 1.3) * 0.5;
          c += vec3(1.0) * smoothstep(0.95, 1.4, w) * 0.35;
          c += vec3(1.0) * smoothstep(0.86, 1.0, d) * 0.35;
          c = mix(c, c * vec3(0.35, 0.45, 0.7) + vec3(0.02, 0.06, 0.14), night * 0.75);
          gl_FragColor = vec4(c, mix(0.55, 0.88, smoothstep(0.0, 0.8, 1.0 - d)));
        }`,
    });
    const water = new THREE.Mesh(geo, mat); water.position.set(P0.x, wy + 0.02, P0.z); water.userData.noStyle = true; water.renderOrder = 2; pg.add(water);
    anim.push((t, night) => { mat.uniforms.time.value = t / 1000; mat.uniforms.night.value = night; });
    // 신비로운 물안개 반짝임
    for (let i = 0; i < 26; i++) { const [x, z] = at(rnd() * 6.28, 0.2 + rnd() * 0.7); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xbff4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(0.35 + rnd() * 0.3); sp.position.set(x, wy + 0.25 + rnd() * 0.6, z); sp.userData.ph = rnd() * 6; pg.add(sp); anim.push(t => { sp.position.y = wy + 0.4 + Math.sin(t / 1300 + sp.userData.ph) * 0.25; sp.material.opacity = 0.25 + 0.25 * Math.sin(t / 900 + sp.userData.ph); }); }
  }
  // 돌 둑: 둘레를 다듬은 바위로 두름 (선착장 자리 0rad = 길 쪽만 비움)
  for (let i = 0; i < 84; i++) { const a = i / 84 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.12) continue; const [x, z] = at(a, 1.03 + (i % 2) * 0.04); rock(pg, x, wy + 0.15 + (i % 3) * 0.06, z, 0.5 + rnd() * 0.25, 0.32, 0.42); }
  // 섬: 둥근 돌 둑 + 잔디 + 청학정
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; rock(pg, ISLE.x + Math.cos(a) * ISLE.r * 0.98, wy + 0.25, ISLE.z + Math.sin(a) * ISLE.r * 0.98, 0.45, 0.4, 0.38); }
  const iy = mY(ISLE.x, ISLE.z);
  {
    const pav = new THREE.Group(); pav.position.set(ISLE.x, iy, ISLE.z); pav.rotation.y = Math.PI / 2; pg.add(pav); // 정면(+z)이 선착장(+x) 쪽
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.45, 3.0), toon(0xe0d4cc)); base.position.y = 0.22; pav.add(base);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.4), toon(0xd6c8c0)); st.position.set(0, 0.08 - (sx > 0 ? 0 : 0) , 1.65); if (sx < 0) pav.add(st); }
    const pillar = toon(0xd8685a), green = toon(0x5aa88a);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.0, 10), pillar); p.position.set(sx * 1.15, 1.45, sz * 1.15); pav.add(p); }
    for (const [w, d, x, z] of [[2.5, 0.16, 0, -1.15], [2.5, 0.16, 0, 1.15], [0.16, 2.5, -1.15, 0], [0.16, 2.5, 1.15, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.26, d), green); b.position.set(x, 2.45, z); pav.add(b); }
    // 난간
    for (const [w, d, x, z] of [[2.3, 0.06, 0, -1.15], [0.06, 2.3, -1.15, 0], [0.06, 2.3, 1.15, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), pillar); b.position.set(x, 0.85, z); pav.add(b); }
    const roof = koreanRoof(3.6, 3.6, 1.4, 0.6, 0x8a96b8); roof.position.y = 3.2; pav.add(roof);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toon(0xe6c272, { emissive: 0x5a4010 })); knob.position.y = 4.05; pav.add(knob);
    const plq = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), new THREE.MeshBasicMaterial({ map: carved(['靑鶴亭'], 512, 184, '#f4e2b4', false, '#2a3c7a') })); plq.position.set(0, 2.45, 1.25); pav.add(plq);
  }
  // 버드나무: 물가에 늘어진 연둣빛 가지
  const willow = (x: number, z: number, h: number) => {
    const w = new THREE.Group(), y = mY(x, z); w.position.set(x, y, z); w.rotation.y = rnd() * 6; pg.add(w);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 7), toon(0x9a8064)); tr.position.y = h / 2; tr.rotation.z = (rnd() - 0.5) * 0.2; w.add(tr);
    const leafA = toon(0xc4e09a), leafB = toon(0xaed488);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), leafB); crown.scale.set(1.1, 0.55, 1.1); crown.position.y = h + 0.1; w.add(crown);
    for (let i = 0; i < 46; i++) { const a = rnd() * 6.28, r = 0.3 + rnd() * 1.15, L = 1.2 + rnd() * (h - 0.6); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.012, L, 4), i % 2 ? leafA : leafB); st.position.set(Math.cos(a) * r, h - L / 2 + 0.1, Math.sin(a) * r); st.userData.noLine = true; st.userData.ph = rnd() * 6; w.add(st); }
  };
  willow(ISLE.x - 1.9, ISLE.z - 1.6, 3.0); willow(ISLE.x + 0.4, ISLE.z + 2.4, 2.4);
  for (const [a, d, h] of [[0.6, 1.25, 3.2], [-0.7, 1.22, 3.0], [2.3, 1.2, 3.4], [-2.4, 1.25, 3.1], [1.5, 1.3, 2.8], [-1.5, 1.28, 3.3]] as const) { const [x, z] = at(a, d); willow(x, z, h); }
  // 연잎과 연꽃
  const padM = toon(0x8ccc8a), lotusM = toon(0xf7b8cc, { emissive: 0x3a1420 });
  for (let i = 0; i < 34; i++) { const a = rnd() * 6.28, dd = 0.45 + rnd() * 0.45, [x, z] = at(a, dd); if (Math.hypot(x - ISLE.x, z - ISLE.z) < ISLE.r + 0.6 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; const pad = new THREE.Mesh(new THREE.CircleGeometry(0.32 + rnd() * 0.2, 12, 0.3, Math.PI * 1.85), padM); pad.rotation.x = -Math.PI / 2; pad.rotation.z = rnd() * 6; pad.position.set(x, wy + 0.05, z); pad.userData.noLine = true; pg.add(pad); if (i % 3 === 0) { const lo = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 7), lotusM); lo.position.set(x + 0.1, wy + 0.2, z); lo.userData.noLine = true; pg.add(lo); } }
  // 샘: 서쪽 끝 바위벽에서 물이 흘러내림 (천왕샘 물줄기)
  {
    const [sx, sz] = at(Math.PI, 1.12), sy = mY(sx, sz), src = new THREE.Group(); src.position.set(sx, sy, sz); pg.add(src);
    rock(src, -1.4, 1.4, 0, 1.8, 2.2, 2.4); rock(src, -1.0, 3.2, -1.2, 1.4, 1.5, 1.4); rock(src, -1.2, 2.6, 1.6, 1.3, 1.6, 1.3); rock(src, -0.6, 0.5, -2.2, 1.1, 0.8, 1.0); rock(src, -0.6, 0.5, 2.3, 1.0, 0.8, 1.0);
    const fallTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const x = cv.getContext('2d')!; for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; x.fillRect(Math.random() * 60, Math.random() * 256, 3, 30 + Math.random() * 60); } const t = stable(new THREE.CanvasTexture(cv)); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.4), new THREE.MeshBasicMaterial({ map: fallTex, color: 0xcff6ff, transparent: true, opacity: 0.9, depthWrite: false })); fall.position.set(0.75, 1.9, 0.1); fall.rotation.y = Math.PI / 2; fall.scale.set(1, 1.25, 1); fall.userData.noStyle = true; src.add(fall);
    anim.push(t => { fallTex.offset.y = (t / 900) % 1; });
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.position.set(0.9, wy - sy + 0.06, 0.1); foam.userData.noStyle = true; src.add(foam);
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.3), [toon(0xc8b8b8), toon(0xc8b8b8), toon(0xc8b8b8), toon(0xc8b8b8), new THREE.MeshToonMaterial({ color: 0xffffff, map: carved(['天王泉'], 256, 512, 'rgba(110,80,80,.9)', true, '#d8cccc') }), toon(0xc8b8b8)]);
    mk.position.set(0.3, 0.65, 3.0); mk.rotation.y = 0.9; src.add(mk);
  }
  // 선착장 (길 쪽, 동쪽): 돌계단 + 일각문. 문 위에 청학 문양 (청학이 산다고 전해지는 곳의 바깥)
  {
    const [lx, lz] = at(0, 1.12), ly = mY(lx, lz), dock = new THREE.Group(); dock.position.set(lx, ly, lz); dock.rotation.y = -Math.PI / 2; pg.add(dock); // 앞(+z)이 물(-x)
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.5), toon(0xd6cac4)); st.position.set(0, 0.0 - i * 0.12, 0.2 + i * 0.45); dock.add(st); }
    const gate = new THREE.Group(); gate.position.set(0, 0, -1.0); dock.add(gate);
    const post = toon(0xb08462);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), post); p.position.set(sx * 1.2, 1.45, 0); gate.add(p); const ft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), toon(0xd6cac4)); ft.position.set(sx * 1.2, 0.15, 0); gate.add(ft); }
    const lint = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.24), post); lint.position.y = 2.0; gate.add(lint);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), toon(0xf0e4d2)); panel.position.y = 2.55; gate.add(panel);
    const groof = koreanRoof(3.2, 1.6, 0.9, 0.38, 0x9aa6c4); groof.position.y = 3.3; gate.add(groof);
    // 양옆 낮은 돌담 + 기와 지붕돌
    for (const sx of [-1, 1]) { const wl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.4), toon(0xe2d6c8)); wl.position.set(sx * 2.55, 0.6, 0); gate.add(wl); const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.6), toon(0x9aa6c4)); cap.position.set(sx * 2.55, 1.28, 0); gate.add(cap); for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), toon(0xbcaab6)); st.position.set(sx * (1.7 + i * 0.55), 0.35 + (i % 2) * 0.3, -0.21); gate.add(st); } }
    // 둥근 청학 문양: 두 인방 사이 (밖 = 길 쪽 -z 면)
    const emTex = stable(new THREE.CanvasTexture(craneEmblem(512))); emTex.colorSpace = THREE.SRGBColorSpace;
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), new THREE.MeshBasicMaterial({ map: emTex, transparent: true }));
    em.position.set(0, 2.55, -0.08); em.scale.setScalar(0.85); em.rotation.y = Math.PI; em.userData.noStyle = true; gate.add(em);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 6, 40), toon(0xe6c272, { emissive: 0x5a4010 })); ring.position.copy(em.position); ring.scale.setScalar(0.85); gate.add(ring);
    // 문 안쪽(물 쪽)에도 같은 문양
    const em2 = em.clone(); em2.position.z = 0.08; em2.rotation.y = 0; gate.add(em2);
    // 돌기둥: 靑鶴池
    const sg2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), [toon(0xd0c4c4), toon(0xd0c4c4), toon(0xd0c4c4), toon(0xd0c4c4), toon(0xd0c4c4), new THREE.MeshToonMaterial({ color: 0xffffff, map: carved(['靑鶴池'], 256, 768, 'rgba(70,60,90,.9)', true, '#dcd2d2') })]);
    sg2.position.set(1.7, 0.6, -1.3); gate.add(sg2);
  }
  // 자라 할아범: 선착장 앞 물 위에서 기다림. 등에 방석, 이끼 낀 등딱지, 하얀 눈썹
  const turtle = new THREE.Group(); turtle.userData.dynamic = true;
  {
    const [tx, tz] = at(0, 0.82); turtle.position.set(tx, wy - 0.05, tz); turtle.rotation.y = -Math.PI / 2; pg.add(turtle); // 머리(+z)가 섬 쪽
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x6fb08c)); shell.scale.set(1.15, 0.55, 1.4); turtle.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 28), toon(0xe6c272, { emissive: 0x4a3410 })); rim.rotation.x = Math.PI / 2; rim.scale.set(1.15, 1.4, 1); rim.position.y = 0.03; turtle.add(rim);
    for (let i = 0; i < 7; i++) { const a = i / 6 * Math.PI * 2, r = i === 6 ? 0 : 0.6, u = new THREE.Vector3(Math.cos(a) * r, Math.sqrt(1 - r * r), Math.sin(a) * r); const sc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 6), toon(0x5a9a78)); sc2.position.set(u.x * 1.15, u.y * 0.55 + 0.01, u.z * 1.4); sc2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(u.x / 1.15, u.y / 0.55, u.z / 1.4).normalize()); sc2.userData.noLine = true; turtle.add(sc2); }
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + rnd() * 0.08, 0), toon(0x9cc87a)); m.scale.y = 0.5; m.position.set((rnd() - 0.5) * 1.2, 0.45, (rnd() - 0.5) * 1.6); m.userData.noLine = true; turtle.add(m); }
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.12, 16), toon(0xe88a8a)); cushion.position.set(0, 0.6, -0.15); turtle.add(cushion);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 10), toon(0x8cc49c)); neck.rotation.x = 1.1; neck.position.set(0, 0.1, 1.5); turtle.add(neck);
    const hd = new THREE.Group(); hd.position.set(0, 0.3, 1.82); turtle.add(hd);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), toon(0x8cc49c)); skull.scale.set(1, 0.85, 1.15); hd.add(skull);
    for (const sd of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a2030 })); e.position.set(sd * 0.17, 0.08, 0.2); e.scale.y = 0.45; hd.add(e); // 졸린 눈
      const brow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), toon(0xffffff)); brow.rotation.z = sd * 1.9; brow.position.set(sd * 0.27, 0.16, 0.16); brow.userData.noLine = true; hd.add(brow); // 하얀 긴 눈썹
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0xf4a0a0, { emissive: 0x401818 })); ch.scale.set(0.5, 0.7, 1); ch.position.set(sd * 0.22, -0.04, 0.17); hd.add(ch);
    }
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), toon(0xffffff)); beard.rotation.x = Math.PI + 0.3; beard.position.set(0, -0.22, 0.24); beard.userData.noLine = true; hd.add(beard);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), toon(0x8cc49c)); fl.scale.set(1.3, 0.25, 0.6); fl.position.set(sx * 1.1, -0.05, sz * 0.85); fl.rotation.y = sx * sz * 0.6; fl.userData.sx = sx; fl.userData.sz = sz; turtle.add(fl); }
    const wake = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); wake.rotation.x = -Math.PI / 2; wake.scale.set(1, 1.2, 1); wake.position.y = 0.06; wake.userData.noStyle = true; turtle.add(wake);
    hd.userData.dynamic = true; bakeStatic(turtle);
    anim.push(t => { turtle.position.y = wy - 0.05 + Math.sin(t / 900) * 0.04; hd.rotation.y = Math.sin(t / 2600) * 0.25; wake.scale.setScalar(1 + ((t / 2400) % 1) * 0.25); (wake.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - ((t / 2400) % 1)); });
  }
  // 청학: 섬 정자 앞에 서 있음 (가끔 내려옴) + 하늘을 도는 한 마리
  const craneStand = blueCrane('stand'); craneStand.g.userData.dynamic = true; craneStand.g.position.set(ISLE.x + 1.5, iy, ISLE.z - 1.5); craneStand.g.rotation.y = Math.PI / 2 + 0.5; craneStand.g.scale.setScalar(1.15); pg.add(craneStand.g);
  const craneFly = blueCrane('fly'); craneFly.g.userData.dynamic = true; craneFly.g.scale.setScalar(1.2); pg.add(craneFly.g);
  anim.push(t => { craneStand.update(t); craneFly.update(t); const a = t / 9000; craneFly.g.position.set(P0.x + Math.cos(a) * 9, wy + 7 + Math.sin(t / 2000) * 0.6, P0.z + Math.sin(a) * 7); craneFly.g.rotation.set(0, -a, -0.25); });

  // ---------- 당산나무 + 오색 소원 리본 ----------
  const dangsanG = new THREE.Group(); g.add(dangsanG);
  {
    const d = new THREE.Group(), y = mY(DANGSAN.x, DANGSAN.z); d.position.set(DANGSAN.x, y, DANGSAN.z); dangsanG.add(d);
    // 돌담 둘레 (낮은 단)
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; rock(d, Math.cos(a) * 2.5, 0.2, Math.sin(a) * 2.5, 0.38, 0.28, 0.3); }
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.5, 0.32, 28), toon(0xb8cf8e)); bed.position.y = 0.16; d.add(bed);
    // 굵고 비틀린 줄기 + 큰 가지 넷
    const bark = toon(0x9a7a62), trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 3.4, 9), bark); trunk.position.y = 1.9; trunk.rotation.z = 0.08; d.add(trunk);
    const tips: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3, L = 2.6 + rnd() * 0.8, up = 0.75 + rnd() * 0.25;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, L, 7), bark);
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(up), Math.cos(up), Math.sin(a) * Math.sin(up)).normalize();
      br.position.set(dir.x * L / 2, 3.3 + dir.y * L / 2, dir.z * L / 2); br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); d.add(br);
      tips.push(new THREE.Vector3(dir.x * L, 3.3 + dir.y * L, dir.z * L));
    }
    // 수관: 몽글몽글 큰 잎 덩어리
    const leafM = [toon(0xa8d494, { emissive: 0x24381c }), toon(0xbcdfa2, { emissive: 0x24381c }), toon(0x9ccb8a, { emissive: 0x24381c })];
    for (const tp of tips) for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + rnd() * 0.6, 1), leafM[(k + tips.indexOf(tp)) % 3]); b.position.copy(tp).add(new THREE.Vector3((rnd() - 0.5) * 1.6, 0.4 + rnd() * 0.8, (rnd() - 0.5) * 1.6)); b.scale.y = 0.75; d.add(b); }
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), leafM[1]); top.position.set(0, 6.6, 0); top.scale.y = 0.7; d.add(top);
    // 금줄: 새끼줄 + 하얀 종이
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.05, 6, 28), toon(0xd8c08a)); rope.rotation.x = Math.PI / 2; rope.position.y = 1.5; d.add(rope);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, pp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), toon(0xffffff, { side: THREE.DoubleSide })); pp.position.set(Math.cos(a) * 0.84, 1.33, Math.sin(a) * 0.84); pp.rotation.y = -a + Math.PI / 2; d.add(pp); }
    // 오색 리본: 낮은 가지에서 늘어져 바람에 살랑
    const COLS = [0xf28c8c, 0xf6d26a, 0x8cc4f0, 0xffffff, 0x9fd49a, 0xf7a8c8];
    const ribbons: THREE.Mesh[] = [];
    for (let i = 0; i < 90; i++) {
      const tp = tips[i % tips.length], k = 0.3 + rnd() * 0.6;
      const at = new THREE.Vector3(0, 3.3, 0).lerp(tp, k); at.y -= 0.1;
      const L = 0.5 + rnd() * 0.5, geo = new THREE.PlaneGeometry(0.07, L, 1, 4); geo.translate(0, -L / 2, 0);
      const r = new THREE.Mesh(geo, toon(COLS[i % COLS.length], { side: THREE.DoubleSide })); r.position.copy(at); r.rotation.y = rnd() * 6; r.userData.ph = rnd() * 6; r.userData.noLine = true; r.userData.dynamic = true; d.add(r); ribbons.push(r);
    }
    anim.push(t => { for (const r of ribbons) { r.rotation.z = Math.sin(t / 700 + r.userData.ph) * 0.18; r.rotation.x = Math.sin(t / 900 + r.userData.ph * 1.3) * 0.12; } });
    // 안내 돌: 소원을 묶는 나무
    const sg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.12), [toon(0xb08a66), toon(0xb08a66), toon(0xb08a66), toon(0xb08a66), new THREE.MeshToonMaterial({ color: 0xffffff, map: carved(['당산나무'], 512, 256, '#5a4030', false, '#f3e4c8') }), toon(0xb08a66)]);
    sg.position.set(2.0, 0.75, 2.6); sg.rotation.y = 0.6; d.add(sg);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), toon(0x8a6a4e)); sp.position.set(2.0, 0.3, 2.6); d.add(sp);
  }

  // ---------- 운해 그네 ----------
  const swingG = new THREE.Group(); g.add(swingG);
  {
    const w = new THREE.Group(), y = mY(SWING.x, SWING.z); w.position.set(SWING.x, y, SWING.z); w.rotation.y = -Math.PI / 2; swingG.add(w); // 앞(-z)이 바깥(+x)
    // 바위 턱: 구름 쪽으로 툭 튀어나옴
    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 1.4, 9), stone[1]); ledge.position.set(0, -0.6, -1.0); ledge.scale.z = 1.25; w.add(ledge);
    rock(w, -2.2, -0.3, -0.4, 0.8, 0.6, 0.7); rock(w, 2.1, -0.2, -0.2, 0.7, 0.5, 0.6);
    const wood = toon(0xc08e5e);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 7), wood); leg.position.set(sx * 1.25, 1.55, -1.0 + sz * 0.55); leg.rotation.x = -sz * 0.17; w.add(leg); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 8), wood); beam.rotation.z = Math.PI / 2; beam.position.set(0, 3.2, -1.0); w.add(beam);
    const swing = new THREE.Group(); swing.userData.dynamic = true; swing.position.set(0, 3.15, -1.0); w.add(swing);
    const ropeM = toon(0xe8d4a8);
    for (const sx of [-0.42, 0.42]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 5), ropeM); r.position.set(sx, -1.25, 0); r.userData.noLine = true; swing.add(r); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.38), toon(0xd8a26e)); seat.position.y = -2.5; swing.add(seat);
    // 꽃 덩굴: 기둥에 감긴 분홍 꽃
    const fl = [toon(0xf7a8c8), toon(0xffffff), toon(0xf28cb4)];
    for (let i = 0; i < 40; i++) { const sx = i % 2 ? -1 : 1, hh = rnd() * 3.1, f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), fl[i % 3]); f.position.set(sx * (1.25 - hh * 0.0) + (rnd() - 0.5) * 0.15, 0.05 + hh, -1.0 + (rnd() - 0.5) * 0.4); f.userData.noLine = true; w.add(f); }
    for (let i = 0; i < 16; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), fl[i % 3]); f.position.set(-1.3 + i * 0.17, 3.3 + Math.sin(i) * 0.05, -1.0); f.userData.noLine = true; w.add(f); }
    anim.push(t => { swing.rotation.x = Math.sin(t / 1300) * 0.28; });
  }

  // ---------- 봉황바위 (못 가는 곳: 구름바다 위로 솟은 바위 봉우리, 봉황이 여기서 날아옴) ----------
  {
    const pr = new THREE.Group(); pr.position.copy(PHOENIX_ROCK); g.add(pr);
    const pm = [toon(0xd6c6d0), toon(0xe2d4da), toon(0xc8b6c4)];
    // 아래가 굵고 위로 갈수록 가늘게 쌓인 바위 기둥 (구름 아래까지)
    for (let i = 0; i < 18; i++) { const k = i / 17, s = 22 - k * 15; rock(pr, (rnd() - 0.5) * 5 * (1 - k), -60 + i * 3.6, (rnd() - 0.5) * 5 * (1 - k), s * (0.9 + rnd() * 0.2), 4.2, s * (0.8 + rnd() * 0.25), pm[i % 3]); }
    // 옆의 작은 봉우리 둘
    for (const [ox, oz, h] of [[-26, 10, 0.55], [24, 14, 0.42]] as const) for (let i = 0; i < 10; i++) { const k = i / 9, s = 14 - k * 9; rock(pr, ox + (rnd() - 0.5) * 3, -60 + i * 3.6 * h * 2, oz, s, 4, s * 0.9, pm[(i + 1) % 3]); }
    // 꼭대기: 비스듬한 소나무 + 금빛 둥지 (봉황 자리)
    const pine = koreanPine(4.2, -0.5, 4); pine.scale.setScalar(3.2); pine.position.set(-2.5, 3.2, 0.4); pr.add(pine);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 6, 16), toon(0xe6b85a, { emissive: 0x6a4410 })); nest.rotation.x = Math.PI / 2; nest.scale.setScalar(1.6); nest.position.set(2.5, 4.8, 0); pr.add(nest);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffd28a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    halo.scale.set(26, 26, 1); halo.position.set(1, 5, 0); halo.userData.noStyle = true; pr.add(halo);
    // 새긴 글씨 鳳凰臺 (정상에서 보이게 앞면에)
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.6), new THREE.MeshBasicMaterial({ map: carved(['鳳凰臺'], 256, 768, 'rgba(150,90,80,.8)'), transparent: true, depthWrite: false, fog: false }));
    tag.scale.setScalar(1.6); tag.position.set(3.0, -12, 15); tag.lookAt(0, -12, 200); tag.userData.noStyle = true; pr.add(tag);
    anim.push((t, night) => { (halo.material as THREE.SpriteMaterial).opacity = (0.35 + 0.15 * Math.sin(t / 1500)) * (1 - night * 0.6); });
  }

  stylize(g);
  // 움직이지 않는 장식은 합쳐서 그리기 횟수를 줄임 (보였다 숨었다 하는 장소는 따로 합치고, 바깥 합치기에선 빼 둠)
  for (const grp of [pg, dangsanG, swingG]) { bakeStatic(grp); grp.userData.dynamic = true; }
  /** 진행에 따라 열리는 장소: regions.ts 조건으로 보였다 숨었다 */
  const refresh = () => { dangsanG.visible = regionOpen('dangsan'); swingG.visible = regionOpen('swing'); };
  refresh(); onProgress(refresh);
  return { update(t: number, night: number) { for (const a of anim) a(t, night); }, refresh };
}
