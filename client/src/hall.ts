import * as THREE from 'three';
import { stable } from './stable-tex';
import { animChar, makeChar, setGrowth, textSprite, toon } from './character';
import { INDOOR, trailX } from './beach-extras';

// 병아리 청학당.
// 밖(외관): 길가의 기와 학당. 앞이 열려 있어 병아리들이 방석에 앉아 쓰는 모습이 보임 (장식, 자리·자세 고정).
// 안(실내): 계단을 오르면 화면이 어두워졌다가 INDOOR의 따로 지은 방으로 넘어감. 거기 병아리는 진짜 사람들.

/** 외관 자리. 로컬 -z(앞, 계단)가 길 쪽을 봄 */
export const HALL = { x: trailX(81) + 7.2, z: 81, ry: Math.PI / 2, w: 7.5, d: 5.5 };
const toWorld = (lx: number, lz: number) => { const c = Math.cos(HALL.ry), s = Math.sin(HALL.ry); return { x: HALL.x + lx * c + lz * s, z: HALL.z - lx * s + lz * c }; };
const toLocal = (x: number, z: number) => { const dx = x - HALL.x, dz = z - HALL.z, c = Math.cos(HALL.ry), s = Math.sin(HALL.ry); return { lx: dx * c - dz * s, lz: dx * s + dz * c }; };
/** 실내 방석 자리 (실내 로컬): 3줄 × 4 */
const SPOTS: [number, number][] = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) SPOTS.push([(c - 1.5) * 1.5, -INDOOR.d / 2 + 1.9 + r * 1.4]);
const CRANE_Z = INDOOR.d / 2 - 1.15;

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

function scrollTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#f3e8cf'; g.fillRect(0, 0, 256, 512); g.strokeStyle = '#8a6a3a'; g.lineWidth = 8; g.strokeRect(10, 10, 236, 492);
  g.fillStyle = '#2a1e18'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 150px "Noto Serif KR", "Gowun Batang", serif'; g.fillText('日', 128, 150); g.fillText('出', 128, 330);
  g.font = '700 30px "Noto Sans KR", sans-serif'; g.fillText('오늘의 해', 128, 460);
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function latticeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  x.fillStyle = '#fff3d6'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#7a4a2a'; x.lineWidth = 6;
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 16); x.lineTo(128, i * 16); x.stroke(); }
  return stable(new THREE.CanvasTexture(c));
}
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
function hipRoof(w: number, d: number, h: number, lift: number, mat: THREE.Material) {
  const gq = new THREE.ConeGeometry(1, h, 4, 1); gq.rotateY(Math.PI / 4); gq.scale(w * 0.75, 1, d * 0.75);
  const p = gq.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) { const ax = Math.abs(p.getX(i)) / (w * 0.53), az = Math.abs(p.getZ(i)) / (d * 0.53); p.setY(i, y + Math.pow(Math.min(1, Math.max(ax, az)), 3) * lift + (ax > 0.9 && az > 0.9 ? lift * 0.7 : 0)); } }
  gq.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(gq, mat));
  const o = new THREE.Mesh(gq, new THREE.MeshBasicMaterial({ color: 0x1e1e24, side: THREE.BackSide })); o.scale.setScalar(1.02); g.add(o);
  return g;
}
function frame(g: THREE.Object3D, w: number, d: number, y: number, m: THREE.Material) {
  for (const [bw, bd, x, z] of [[w, 0.24, 0, -d / 2], [w, 0.24, 0, d / 2], [0.24, d, -w / 2, 0], [0.24, d, w / 2, 0]]) { const b = box(bw, 0.24, bd, m); b.position.set(x, y, z); g.add(b); }
}
/** 방석 + 작은 서안 (서안은 훈장님 쪽, +z) */
function cushionSet(g: THREE.Object3D, x: number, z: number, y: number, m: THREE.Material) {
  const cu = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 18), m); cu.scale.z = 0.85; cu.position.set(x, y + 0.05, z); g.add(cu);
  const dm = toon(0x6a4028);
  const desk = box(0.7, 0.05, 0.32, dm); desk.position.set(x, y + 0.3, z + 0.62); g.add(desk);
  for (const s of [-1, 1]) { const l = box(0.05, 0.28, 0.28, dm); l.position.set(x + s * 0.3, y + 0.14, z + 0.62); g.add(l); }
}
/** 앉아서 쓰는 장식 병아리 (외관용, 고정) */
function sittingChick(g: THREE.Object3D, x: number, y: number, z: number, ry: number, stage: number) {
  const c = makeChar(0xffd65a, 0); c.state = 'sit'; setGrowth(c, stage);
  for (let i = 0; i < 40; i++) animChar(c, 0.05);
  c.root.position.set(x, y, z); c.root.rotation.y = ry; g.add(c.root);
}

export function createHall(groundAt: (x: number, z: number) => number) {
  const cm = [toon(0x3f6fb0), toon(0xc0453a), toon(0x3f8f6a)];
  const stoneM = toon(0x8c857a), floorM = toon(0xc29a6a), pillarM = toon(0x7a3a2a), wallM = toon(0xefe4cc), beamM = toon(0x8a5a3a);
  // ================= 밖 =================
  const root = new THREE.Group();
  let top = -99;
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const w = toWorld(lx * HALL.w / 2, lz * HALL.d / 2); top = Math.max(top, groundAt(w.x, w.z)); }
  const front = toWorld(0, -HALL.d / 2 - 1.6), frontY = groundAt(front.x, front.z);
  const F = top + 0.6, W = HALL.w, D = HALL.d, H = 2.7;
  root.position.set(HALL.x, 0, HALL.z); root.rotation.y = HALL.ry;
  const base = box(W + 0.6, F - top + 1.6, D + 0.6, stoneM); base.position.y = F - (F - top + 1.6) / 2; root.add(base);
  const fl = box(W, 0.08, D, floorM); fl.position.y = F; root.add(fl);
  // 돌계단: 길 높이에서 마루까지
  const steps = 4, rise = (F - frontY) / steps;
  for (let i = 0; i < steps; i++) { const st = box(2.4, rise * (i + 1) + 0.6, 0.42, stoneM); st.position.set(0, frontY + rise * (i + 1) - (rise * (i + 1) + 0.6) / 2, -D / 2 - 0.3 - (steps - 1 - i) * 0.42); root.add(st); }
  // 문턱 (빛나는 판)
  const sill = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.85 })); sill.rotation.x = -Math.PI / 2; sill.position.set(0, F + 0.05, -D / 2 + 0.35); root.add(sill);
  for (const z of [-D / 2 + 0.15, D / 2 - 0.15]) for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, H, 12), pillarM); p.position.set(-W / 2 + 0.15 + i * (W - 0.3) / 3, F + H / 2, z); root.add(p); }
  const backWall = box(W - 0.3, H - 0.2, 0.1, wallM); backWall.position.set(0, F + (H - 0.2) / 2, D / 2 - 0.15); root.add(backWall);
  for (const s of [-1, 1]) { const sw = box(0.1, H - 0.2, D - 0.3, wallM); sw.position.set(s * (W / 2 - 0.15), F + (H - 0.2) / 2, 0); root.add(sw); }
  frame(root, W + 0.2, D + 0.2, F + H + 0.1, beamM);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: signTex() })); sign.position.set(0, F + H - 0.25, -D / 2 - 0.12); sign.rotation.y = Math.PI; root.add(sign);
  const roof = hipRoof(W * 1.22, D * 1.3, 1.8, 0.5, toon(0x3a3e48)); roof.position.y = F + H + 1.05; root.add(roof);
  // 장식: 방석 8 + 앉아 쓰는 병아리 6 + 훈장님 (모두 고정)
  let k = 0;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const x = (c - 1.5) * 1.5, z = -1.1 + r * 1.3;
    cushionSet(root, x, z, F + 0.04, cm[(r + c) % 3]);
    if ((r * 4 + c) % 4 !== 3) sittingChick(root, x, F + 0.12, z, Math.PI + (c - 1.5) * 0.05, [1, 2, 0, 3, 2, 1][k++ % 6]);
  }
  const outCrane = crane(); outCrane.g.scale.setScalar(1.25); outCrane.g.position.set(0, F + 0.04, D / 2 - 0.8); root.add(outCrane.g);
  const outLabel = textSprite('학 훈장님', 0.6); outLabel.position.set(0, F + 2.9, D / 2 - 0.8); root.add(outLabel);

  // ================= 안 =================
  const inner = new THREE.Group(); inner.position.set(INDOOR.x, INDOOR.y, INDOOR.z);
  const IW = INDOOR.w, ID = INDOOR.d, IH = 3.4;
  // 바깥 하늘·산이 안 보이게 감싸는 어둠
  const dark = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: 0x241a14, side: THREE.BackSide, fog: false })); dark.position.y = 10; inner.add(dark);
  const ifl = box(IW, 0.1, ID, toon(0xc9a06e)); ifl.position.y = -0.05; inner.add(ifl);
  for (let i = -10; i <= 10; i++) { const l = box(0.015, 0.005, ID, toon(0x8a6440)); l.position.set(i * 0.5, 0.002, 0); inner.add(l); }
  const iwall = toon(0xf1e6cf);
  const wall = (w: number, x: number, z: number, ry: number, h = IH) => { const m = box(w, h, 0.15, iwall); m.position.set(x, h / 2, z); m.rotation.y = ry; inner.add(m); };
  wall(IW, 0, ID / 2, 0); wall(ID, -IW / 2, 0, Math.PI / 2); wall(ID, IW / 2, 0, Math.PI / 2);
  // 앞벽은 낮게 잘라 둠 (위에서 들여다보는 시점). 가운데가 문
  for (const sx of [-1, 1]) wall((IW - 1.8) / 2, sx * (IW + 1.8) / 4, -ID / 2, 0, 0.5);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.6 })); glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.012, -ID / 2 + 0.45); inner.add(glow);
  for (const x of [-IW / 2 + 0.2, -IW / 6, IW / 6, IW / 2 - 0.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, IH, 12), pillarM); p.position.set(x, IH / 2, ID / 2 - 0.2); inner.add(p); }
  for (const [bw, bd, x, z] of [[IW, 0.2, 0, ID / 2], [0.2, ID, -IW / 2, 0], [0.2, ID, IW / 2, 0]] as const) { const b = box(bw, 0.22, bd, toon(0x6a4028)); b.position.set(x, IH, z); inner.add(b); }
  const lat = latticeTex();
  for (const s of [-1, 1]) for (const z of [-1.8, 1.6]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.4), new THREE.MeshBasicMaterial({ map: lat })); w.position.set(s * (IW / 2 - 0.09), 1.9, z); w.rotation.y = -s * Math.PI / 2; inner.add(w);
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.22 })); sun.rotation.x = -Math.PI / 2; sun.position.set(s * (IW / 2 - 1.4), 0.012, z); inner.add(sun);
  }
  SPOTS.forEach(([x, z], i) => cushionSet(inner, x, z, 0, cm[i % 3]));
  // 훈장님 단 + 큰 서안 + 족자
  const dais = box(3.2, 0.45, 1.7, toon(0x9a6a44)); dais.position.set(0, 0.22, ID / 2 - 1.05); inner.add(dais);
  const T = crane(); T.g.scale.setScalar(1.5); T.g.position.set(0, 0.45, CRANE_Z); inner.add(T.g);
  const bd = toon(0x5a3420);
  const bigDesk = box(1.3, 0.07, 0.5, bd); bigDesk.position.set(0, 0.62, ID / 2 - 2.15); inner.add(bigDesk);
  for (const s of [-1, 1]) { const l = box(0.07, 0.42, 0.44, bd); l.position.set(s * 0.56, 0.41, ID / 2 - 2.15); inner.add(l); }
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9), new THREE.MeshBasicMaterial({ map: scrollTex() })); scroll.position.set(0, 2.3, ID / 2 - 0.1); scroll.rotation.y = Math.PI; inner.add(scroll);
  for (const x of [-3.6, 3.6]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffd28a })); l.position.set(x, 2.6, ID / 2 - 0.5); inner.add(l); }
  const label = textSprite('학 훈장님', 0.6); label.position.set(0, 3.55, CRANE_Z); inner.add(label);
  const hint = textSprite('📜', 0.8); hint.position.set(0, 3.95, CRANE_Z); hint.visible = false; inner.add(hint);

  const tmp = new THREE.Vector3();
  let talkT = 0;
  const stairs = toWorld(0, -D / 2 - 0.3 - (steps - 1) * 0.42 - 0.3);
  return {
    root, inner, label, outLabel,
    floor: F,
    craneWorld: () => T.g.getWorldPosition(tmp).clone(),
    /** 계단 앞을 밟으면 들어감 (밖, 세계 좌표) */
    atStairs(x: number, z: number) { const { lx, lz } = toLocal(x, z); return Math.abs(lx) < 1.15 && lz > -D / 2 - 0.3 - steps * 0.42 - 0.25 && lz < -D / 2 + 0.6; },
    /** 외관 안으로는 못 걸어 들어감 (계단은 위 atStairs가 받아 줌) */
    blocks(x: number, z: number) { const { lx, lz } = toLocal(x, z); return Math.abs(lx) < W / 2 + 0.4 && lz > -D / 2 - 0.35 && lz < D / 2 + 0.4; },
    /** 나와서 서는 곳 (계단 아래, 길 쪽을 봄) */
    outSpot() { const w = toWorld(0, -D / 2 - 0.3 - steps * 0.42 - 0.9); return { x: w.x, z: w.z, face: HALL.ry + Math.PI }; },
    stairsWorld: stairs,
    /** 실내 들어와서 서는 곳 (문 앞, 훈장님 쪽을 봄) */
    inSpot() { return { x: INDOOR.x, z: INDOOR.z - ID / 2 + 1.0, face: Math.PI }; },
    /** 실내 문턱 (밟으면 나감) */
    atDoor(x: number, z: number) { return Math.abs(x - INDOOR.x) < 1.0 && z < INDOOR.z - ID / 2 + 0.45; },
    /** 가장 가까운 방석 자리 (세계 좌표)와, 훈장님을 바라보는 각도 */
    cushionNear(px: number, pz: number) {
      let best = SPOTS[0], bdist = 1e9;
      for (const sp of SPOTS) { const d = Math.hypot(INDOOR.x + sp[0] - px, INDOOR.z + sp[1] - pz); if (d < bdist) { bdist = d; best = sp; } }
      return { x: INDOOR.x + best[0], z: INDOOR.z + best[1], y: INDOOR.y + 0.1, face: Math.PI };
    },
    talk(sec = 2.5) { talkT = sec; },
    showHint(on: boolean) { hint.visible = on; },
    update(dt: number, t: number) {
      if (talkT > 0) talkT -= dt;
      T.head.rotation.x = talkT > 0 ? Math.sin(t * 6) * 0.12 : Math.sin(t * 0.7) * 0.05;
      T.body.rotation.y = Math.sin(t * 0.4) * 0.08;
      outCrane.head.rotation.x = Math.sin(t * 0.9) * 0.08;
      hint.position.y = 3.95 + Math.sin(t * 3) * 0.05;
    },
  };
}
