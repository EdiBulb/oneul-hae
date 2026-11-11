import * as THREE from 'three';

/** 청학(靑鶴): 지리산 청학동 전설의 푸른 학. 쪽빛 몸 + 하늘빛 가슴, 붉은 정수리, 금빛 부리, 꼬리 깃은 짙은 남색에 금 테
 *  pose: 'stand' 서 있기 / 'fly' 날기. update(t)로 목·날개가 살아 움직임 */
const P = { body: 0x4a86c8, belly: 0xbfe0f4, deep: 0x2a3c7a, gold: 0xe8c46a, crown: 0xe2504a, leg: 0x34466e, eye: 0x1a1830, line: 0x1e2a4a };
const toon = (() => {
  const d = new Uint8Array([150, 215, 255]); const g = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); g.minFilter = g.magFilter = THREE.NearestFilter; g.needsUpdate = true;
  return (c: number, e = 0.22) => { const m = new THREE.MeshToonMaterial({ color: c, gradientMap: g }); m.emissive.set(c).multiplyScalar(e); return m; };
})();
const lineM = new THREE.MeshBasicMaterial({ color: P.line, side: THREE.BackSide });
function lined(m: THREE.Mesh, w = 0.025) {
  const g = m.geometry; g.computeBoundingSphere(); const r = g.boundingSphere!.radius;
  const h = new THREE.Mesh(g, lineM); const s = 1 + w / Math.max(0.02, r); h.scale.setScalar(s); m.add(h); return m;
}

export function blueCrane(pose: 'stand' | 'fly' = 'stand') {
  const g = new THREE.Group();
  const M = { body: toon(P.body), belly: toon(P.belly), deep: toon(P.deep, 0.15), gold: toon(P.gold, 0.3), crown: toon(P.crown, 0.35), leg: toon(P.leg), eye: new THREE.MeshBasicMaterial({ color: P.eye }), hi: new THREE.MeshBasicMaterial({ color: 0xffffff }) };
  const root = new THREE.Group(); g.add(root);
  root.position.y = pose === 'stand' ? 1.08 : 0;

  // 몸통: 가로로 길쭉한 물방울 (앞 +z)
  const body = lined(new THREE.Mesh(new THREE.SphereGeometry(0.4, 22, 16), M.body)); body.scale.set(0.7, 0.66, 1.25); root.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 12), M.belly); belly.scale.set(0.62, 0.55, 1.05); belly.position.set(0, -0.07, 0.1); root.add(belly);

  // 목: 부드러운 S자 관 하나 (가슴에서 머리까지)
  const neckCurve = pose === 'stand'
    ? new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, 0.36), new THREE.Vector3(0, 0.42, 0.5), new THREE.Vector3(0, 0.78, 0.36), new THREE.Vector3(0, 1.08, 0.42), new THREE.Vector3(0, 1.26, 0.56)])
    : new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, 0.36), new THREE.Vector3(0, 0.12, 0.8), new THREE.Vector3(0, 0.14, 1.2), new THREE.Vector3(0, 0.12, 1.55)]);
  const neckGeo = new THREE.TubeGeometry(neckCurve, 32, 0.075, 10, false);
  { const pos = neckGeo.attributes.position, n = 33; // 아래는 굵고 위로 갈수록 가늘게
    const cen = neckCurve.getSpacedPoints(32);
    for (let i = 0; i < pos.count; i++) { const k = Math.floor(i / 11), c = cen[Math.min(32, k)], tk = k / n, sc = 1.5 - tk * 0.75; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * sc, c.y + (pos.getY(i) - c.y) * sc, c.z + (pos.getZ(i) - c.z) * sc); }
    neckGeo.computeVertexNormals(); }
  const neck = lined(new THREE.Mesh(neckGeo, M.body), 0.02); root.add(neck);
  // 목 앞쪽 흰 줄 (하늘빛)
  const throat = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 32, 0.05, 8, false), M.belly); throat.position.set(0, -0.01, 0.035); throat.scale.set(0.8, 1, 1); root.add(throat);
  const end = neckCurve.getPoint(1), dir = neckCurve.getTangent(1);
  const head = new THREE.Group(); head.position.copy(end); root.add(head);
  head.lookAt(end.clone().add(new THREE.Vector3(0, pose === 'stand' ? -0.05 : 0, 1)));
  const skull = lined(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), M.belly), 0.018); skull.scale.set(0.9, 0.95, 1.2); head.add(skull);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.crown); crown.position.set(0, 0.065, 0.0); crown.scale.set(1, 0.6, 1.3); head.add(crown);
  const beak = lined(new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.36, 8), M.gold), 0.012); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.015, 0.26); head.add(beak);
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), M.eye); e.position.set(sd * 0.078, 0.022, 0.05); head.add(e);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), M.hi); h.position.set(sd * 0.088, 0.032, 0.06); head.add(h);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), toon(0xf4a0a0, 0.3)); ch.scale.set(0.45, 0.8, 1); ch.position.set(sd * 0.085, -0.02, 0.0); head.add(ch);
  }
  void dir;

  // 접은 날개: 몸 양옆을 덮고 뒤로 흘러내리는 쪽빛 깃 (끝은 금 테)
  const folded = new THREE.Group(); root.add(folded);
  for (const sd of [-1, 1]) {
    const w = lined(new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 10), M.deep), 0.015); w.scale.set(0.3, 0.55, 1.35); w.position.set(sd * 0.22, 0.04, -0.12); w.rotation.x = 0.18; folded.add(w);
  }
  // 꼬리 '치마': 늘어진 깃 다발
  const tail = new THREE.Group(); tail.position.set(0, 0.0, -0.46); root.add(tail);
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.17, f = lined(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.6, 6), M.deep), 0.012);
    f.rotation.x = -Math.PI / 2 - 0.75; f.rotation.z = a; f.position.set(Math.sin(a) * 0.16, -0.1, -0.12); tail.add(f);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M.gold); tip.position.y = -0.3; f.add(tip);
  }

  // 펼친 날개 (날 때): 깃 끝이 갈라진 넓은 날개 판
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.2); wingShape.bezierCurveTo(0.6, 0.32, 1.2, 0.3, 1.75, 0.08);
  const notch = [[1.7, -0.2], [1.6, -0.06], [1.48, -0.34], [1.36, -0.16], [1.22, -0.42], [1.08, -0.22], [0.92, -0.44], [0.76, -0.26]];
  for (const [x, y] of notch) wingShape.lineTo(x, y);
  wingShape.bezierCurveTo(0.5, -0.38, 0.2, -0.3, 0, -0.2); wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.03, bevelEnabled: false }); wingGeo.rotateX(Math.PI / 2);
  const wings: THREE.Group[] = [];
  if (pose === 'fly') for (const sd of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sd * 0.2, 0.12, 0.02); root.add(w); wings.push(w); w.userData.s = sd;
    const m = lined(new THREE.Mesh(wingGeo, M.body), 0.015); m.scale.set(sd, 1, 1); w.add(m);
    const tipM = new THREE.Mesh(wingGeo, M.deep); tipM.scale.set(sd * 0.55, 1.2, 1.02); tipM.position.set(sd * 0.78, 0.01, -0.02); w.add(tipM);
  }
  folded.visible = pose === 'stand';

  // 다리
  const legs: THREE.Group[] = [];
  for (const sd of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(sd * 0.11, -0.2, 0.02); root.add(L); legs.push(L);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.024, 0.42, 6), M.leg); thigh.position.set(0, -0.2, -0.05); thigh.rotation.x = 0.25; L.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), M.leg); knee.position.set(0, -0.41, -0.1); L.add(knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.48, 6), M.leg); shin.position.set(0, -0.64, -0.07); shin.rotation.x = -0.12; L.add(shin);
    for (const ta of [-0.5, 0, 0.5, Math.PI]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.16, 5), M.leg); toe.rotation.x = Math.PI / 2; toe.rotation.y = ta; toe.position.set(Math.sin(ta) * 0.07, -0.87, Math.cos(ta) * 0.07 - 0.04); L.add(toe); }
  }

  const update = (t: number) => {
    if (pose === 'fly') {
      const flap = Math.sin(t / 300);
      for (const w of wings) w.rotation.z = w.userData.s * flap * 0.6;
      for (const L of legs) L.rotation.x = 1.4;
      tail.rotation.x = 0.55; root.position.y = -flap * 0.06;
    } else {
      root.rotation.x = -0.05 + Math.sin(t / 2200) * 0.02;
      head.rotation.z = Math.sin(t / 1700) * 0.08;
    }
  };
  update(0);
  return { g, update };
}

/** 청학 문양 (참고 로고를 그대로 쓰지 않고 바꿈): 떠오르는 해 앞을 날아오르는 학 + 발아래 운해 + 구름 소용돌이, 붉은 낙관 '靑鶴' */
export function craneEmblem(size = 512, bg = '#1f2a4a') {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')!; x.scale(size / 512, size / 512);
  const gold = '#e6c272', ink = bg || '#1f2a4a';
  if (bg) { x.fillStyle = bg; x.beginPath(); x.arc(256, 256, 252, 0, Math.PI * 2); x.fill(); }
  // 해 + 운해 (원 안에만)
  x.save(); x.beginPath(); x.arc(256, 256, 206, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#e8735c'; x.beginPath(); x.arc(300, 352, 104, 0, Math.PI * 2); x.fill();
  x.fillStyle = ink; x.fillRect(0, 352, 512, 200);
  x.strokeStyle = gold; x.lineWidth = 4.5; x.lineCap = 'round';
  for (let r = 0; r < 4; r++) { const y0 = 356 + r * 28, off = r % 2 ? 22 : 0; x.beginPath(); for (let k = -1; k < 14; k++) { const px = k * 44 + off; x.moveTo(px - 22, y0 + 6); x.quadraticCurveTo(px, y0 - 14, px + 22, y0 + 6); } x.stroke(); }
  x.restore();
  // 두 겹 테
  x.strokeStyle = gold; x.lineWidth = 8; x.beginPath(); x.arc(256, 256, 226, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2.5; x.beginPath(); x.arc(256, 256, 208, 0, Math.PI * 2); x.stroke();
  // 구름 소용돌이 (영지 구름): 동그란 머리 셋 + 길게 끌리는 꼬리
  const cloud = (cx: number, cy: number, s: number, flip: number) => {
    x.save(); x.translate(cx, cy); x.scale(s * flip, s); x.strokeStyle = gold; x.fillStyle = ink; x.lineWidth = 3.4 / s;
    x.beginPath(); x.moveTo(-70, 16); x.bezierCurveTo(-40, 12, -30, 26, 0, 22); x.bezierCurveTo(30, 18, 50, 24, 74, 14); x.stroke();
    for (const [ox, oy, r] of [[-22, 0, 17], [8, -10, 21], [38, 0, 15]] as const) { x.beginPath(); x.arc(ox, oy, r, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(ox, oy, r, Math.PI * 0.75, Math.PI * 2.55); x.stroke(); x.beginPath(); x.arc(ox + r * 0.18, oy + r * 0.1, r * 0.45, Math.PI * 1.1, Math.PI * 2.7); x.stroke(); }
    x.restore();
  };
  cloud(104, 300, 0.85, 1); cloud(420, 232, 0.72, -1);
  // 날아오르는 학
  x.save(); x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = gold; x.lineWidth = 4;
  const fill = (col: string, path: () => void) => { x.beginPath(); path(); x.closePath(); x.fillStyle = col; x.fill(); x.stroke(); };
  // 뒤 날개: 깃 다섯 장이 부채처럼 위로 (맨 끝 깃은 테 밖까지)
  const feather = (bx: number, by: number, ang: number, len: number, w: number, col: string) => { x.save(); x.translate(bx, by); x.rotate(ang); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -w, len * 0.85, -w * 0.8, len, 0); x.bezierCurveTo(len * 0.85, w * 0.5, len * 0.3, w * 0.7, 0, 0); x.closePath(); x.fillStyle = col; x.fill(); x.stroke(); x.restore(); };
  for (let i = 0; i < 6; i++) feather(250 - i * 6, 244 - i * 2, -2.05 + i * 0.13, 222 - i * 18, 24, i < 3 ? '#2a3c7a' : '#3a64a8');
  // 다리 (뒤로 길게)
  x.lineWidth = 5; x.beginPath(); x.moveTo(214, 284); x.lineTo(132, 352); x.moveTo(222, 290); x.lineTo(148, 364); x.stroke(); x.lineWidth = 4;
  // 꼬리 깃
  fill('#2a3c7a', () => { x.moveTo(214, 276); x.lineTo(160, 300); x.lineTo(180, 286); x.lineTo(150, 286); x.lineTo(186, 268); x.lineTo(206, 262); });
  // 몸 + 목 + 머리
  fill('#4a86c8', () => { x.moveTo(196, 276); x.bezierCurveTo(220, 250, 262, 236, 300, 226); x.bezierCurveTo(330, 216, 352, 186, 368, 150); x.bezierCurveTo(374, 136, 384, 128, 396, 126); x.lineTo(452, 112); x.lineTo(398, 140); x.bezierCurveTo(386, 150, 372, 196, 344, 236); x.bezierCurveTo(314, 272, 250, 292, 196, 276); });
  // 앞 날개: 아래로 휘감는 깃 넷
  for (let i = 0; i < 4; i++) feather(262, 252, 2.45 + i * 0.12, 120 - i * 14, 18, i < 2 ? '#2a3c7a' : '#4a86c8');
  // 붉은 정수리, 금 눈
  x.fillStyle = '#e2504a'; x.beginPath(); x.ellipse(388, 122, 10, 6, -0.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = gold; x.beginPath(); x.arc(400, 130, 3.2, 0, Math.PI * 2); x.fill();
  x.restore();
  // 낙관
  x.fillStyle = '#c8402e'; x.fillRect(376, 386, 50, 50); x.fillStyle = '#fbe8d8'; x.font = '900 20px "Noto Serif KR", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('靑', 401, 400); x.fillText('鶴', 401, 422);
  return c;
}
