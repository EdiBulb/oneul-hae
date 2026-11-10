import * as THREE from 'three';
import { stable } from './stable-tex';
import { textSprite, toon } from './character';
import { trailX } from './beach-extras';

// 병아리 청학당: 정상 아래 길가의 작은 정자. 학 훈장님 앞에 방석이 놓여 있고,
// 방석에 앉아 오늘의 목표를 종이에 쓴다. 정자 앞(로컬 -z)이 길 쪽을 본다.

export const HALL = { x: trailX(81) + 5.8, z: 81, ry: Math.PI / 2, w: 3.6, d: 2.8 };
const toWorld = (lx: number, lz: number) => { const c = Math.cos(HALL.ry), s = Math.sin(HALL.ry); return { x: HALL.x + lx * c + lz * s, z: HALL.z - lx * s + lz * c }; };
/** 방석 자리 (로컬 x) */
const CUSHIONS = [-1.2, -0.4, 0.4, 1.2];

function signTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d')!;
  g.fillStyle = '#2e2018'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#c9a25a'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 140);
  g.fillStyle = '#f2e2b8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 70px "Noto Serif KR", "Gowun Batang", serif'; g.fillText('靑 鶴 堂', 256, 70);
  g.font = '700 26px "Noto Sans KR", sans-serif'; g.fillText('병아리 청학당', 256, 128);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** 학 훈장님: 흰 몸에 푸른빛 날개, 머리 위 붉은 점, 검은 갓과 동그란 안경 */
function crane() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ol = new THREE.MeshBasicMaterial({ color: 0x3a2a20, side: THREE.BackSide });
  const outl = (m: THREE.Mesh, k = 1.05) => { const o = new THREE.Mesh(m.geometry, ol); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(k); m.parent!.add(o); };
  const white = toon(0xf8f6f0), blue = toon(0x6fb3c8), dark = toon(0x2a2a30);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), white); torso.scale.set(0.95, 0.85, 1.15); torso.position.y = 0.95; body.add(torso); outl(torso);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), blue); w.scale.set(0.3, 0.7, 1.05); w.position.set(sx * 0.28, 0.95, 0.06); w.rotation.x = -0.25; body.add(w); outl(w, 1.06); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 8), dark); tail.rotation.x = -Math.PI / 2 - 0.5; tail.position.set(0, 0.92, 0.42); body.add(tail);
  // 목 (S자) + 머리
  const pts = [[0, 1.12, -0.12], [0, 1.35, -0.2], [0, 1.55, -0.12], [0, 1.72, -0.16]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.06, 8), white); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.78, -0.18); body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), white); head.add(skull); outl(skull, 1.08);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe0453a)); red.position.y = 0.075; head.add(red);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 8), toon(0x9a9a92)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, -0.02, -0.25); head.add(beak);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeM); e.position.set(sx * 0.07, 0.02, -0.09); head.add(e);
    const glass = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), eyeM); glass.position.set(sx * 0.07, 0.02, -0.11); head.add(glass);
  }
  // 갓
  const gat = new THREE.Group(); gat.position.y = 0.1; head.add(gat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.012, 24), new THREE.MeshLambertMaterial({ color: 0x18181c, transparent: true, opacity: 0.85 })); gat.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.15, 16), dark); crown.position.y = 0.08; gat.add(crown);
  // 다리
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), dark); l.position.set(sx * 0.1, 0.35, 0); g.add(l); }
  return { g, head, body };
}

export function createHall(groundAt: (x: number, z: number) => number) {
  const root = new THREE.Group();
  // 바닥 높이: 정자 네 모서리 땅 중 가장 높은 곳에 맞춤
  let top = -99;
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const w = toWorld(lx * HALL.w / 2, lz * HALL.d / 2); top = Math.max(top, groundAt(w.x, w.z)); }
  const FLOOR = top + 0.14;
  root.position.set(HALL.x, 0, HALL.z); root.rotation.y = HALL.ry;
  const wood = toon(0x8a5a3a), pillarM = toon(0x7a3a2a), stone = toon(0x8c857a), roofM = toon(0x3a3e48), floorM = toon(0xb08458);
  const base = new THREE.Mesh(new THREE.BoxGeometry(HALL.w + 0.3, 1.2, HALL.d + 0.3), stone); base.position.y = FLOOR - 0.66; root.add(base);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(HALL.w, 0.08, HALL.d), floorM); floor.position.y = FLOOR - 0.04; root.add(floor);
  for (let i = -3; i <= 3; i++) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.005, HALL.d), toon(0x7a5432)); line.position.set(i * 0.5, FLOOR + 0.001, 0); root.add(line); }
  // 기둥 넷 + 지붕 (처마 끝이 살짝 들린 기와지붕)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.1, 10), pillarM); p.position.set(x * (HALL.w / 2 - 0.15), FLOOR + 1.05, z * (HALL.d / 2 - 0.15)); root.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HALL.w + 0.1, 0.16, HALL.d + 0.1), wood); beam.position.y = FLOOR + 2.12; root.add(beam);
  const roofG = new THREE.ConeGeometry(1, 0.9, 4, 1); roofG.rotateY(Math.PI / 4); roofG.scale(HALL.w * 0.86, 1, HALL.d * 0.86);
  const rp = roofG.attributes.position; for (let i = 0; i < rp.count; i++) { const y = rp.getY(i); if (y < 0) { const ax = Math.abs(rp.getX(i)) / (HALL.w * 0.6), az = Math.abs(rp.getZ(i)) / (HALL.d * 0.6); rp.setY(i, y + Math.pow(Math.min(1, Math.max(ax, az)), 3) * 0.25 + (ax > 0.9 && az > 0.9 ? 0.18 : 0)); } }
  roofG.computeVertexNormals();
  const roof = new THREE.Mesh(roofG, roofM); roof.position.y = FLOOR + 2.62; root.add(roof);
  const roofO = new THREE.Mesh(roofG, new THREE.MeshBasicMaterial({ color: 0x1e1e24, side: THREE.BackSide })); roofO.position.copy(roof.position); roofO.scale.setScalar(1.03); root.add(roofO);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), roofM); ridge.position.y = FLOOR + 3.1; root.add(ridge);
  // 현판
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), new THREE.MeshBasicMaterial({ map: signTex() })); sign.position.set(0, FLOOR + 1.95, -HALL.d / 2 - 0.02); sign.rotation.y = Math.PI; root.add(sign);
  // 서안 (낮은 책상) + 먹·붓
  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.4), wood); desk.position.set(0, FLOOR + 0.3, 0.35); root.add(desk);
  for (const x of [-0.38, 0.38]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.36), wood); l.position.set(x, FLOOR + 0.14, 0.35); root.add(l); }
  const ink = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.1), toon(0x22201e)); ink.position.set(-0.2, FLOOR + 0.345, 0.35); root.add(ink);
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), toon(0xc9a46a)); brush.rotation.z = Math.PI / 2; brush.position.set(0.15, FLOOR + 0.345, 0.35); root.add(brush);
  // 방석 넷 + 위에 놓인 접힌 종이
  const cushM = [toon(0xc0574a), toon(0x4f7aa8), toon(0xd9a64a), toon(0x5a8a5a)];
  CUSHIONS.forEach((x, i) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), cushM[i]); c.position.set(x, FLOOR + 0.04, -0.55); root.add(c);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshLambertMaterial({ color: 0xf6efdc, side: THREE.DoubleSide })); paper.rotation.x = -Math.PI / 2; paper.position.set(x + 0.18, FLOOR + 0.09, -0.85); root.add(paper);
  });
  // 학 훈장님 (서안 뒤에서 방석 쪽을 봄)
  const T = crane(); T.g.position.set(0, FLOOR, 0.85); root.add(T.g);
  const label = textSprite('학 훈장님', 0.6); label.position.set(0, FLOOR + 2.35, 0.85); root.add(label);
  const hint = textSprite('📜', 0.8); hint.position.set(0, FLOOR + 2.75, 0.85); hint.visible = false; root.add(hint);
  const tmp = new THREE.Vector3();
  let talkT = 0;
  return {
    root, label,
    /** 이름표 글자를 바꿀 때 (영어) */
    floor: FLOOR,
    craneWorld: () => T.g.getWorldPosition(tmp).clone(),
    /** 가장 가까운 빈 방석 자리 (세계 좌표)와, 학을 바라보는 각도 */
    cushionNear(px: number, pz: number) {
      let best = CUSHIONS[0], bd = 1e9;
      for (const x of CUSHIONS) { const w = toWorld(x, -0.55), d = Math.hypot(w.x - px, w.z - pz); if (d < bd) { bd = d; best = x; } }
      const w = toWorld(best, -0.55), c = toWorld(0, 0.85);
      return { x: w.x, z: w.z, y: FLOOR + 0.08, face: Math.atan2(-(c.x - w.x), -(c.z - w.z)) };
    },
    talk(sec = 2.5) { talkT = sec; },
    showHint(on: boolean) { hint.visible = on; },
    update(dt: number, t: number) {
      if (talkT > 0) talkT -= dt;
      T.head.rotation.x = talkT > 0 ? Math.sin(t * 6) * 0.12 : Math.sin(t * 0.7) * 0.05;
      T.body.rotation.y = Math.sin(t * 0.4) * 0.08;
      hint.position.y = FLOOR + 2.75 + Math.sin(t * 3) * 0.05;
    },
  };
}
