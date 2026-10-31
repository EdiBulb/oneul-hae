import * as THREE from 'three';
import { groundY } from './world';
import { textSprite } from './character';

// 해변 왼쪽 위에 있는 모래 게시판: 나무틀 안에 고른 모래, 갈퀴 자국, 작은 팻말.
// 글은 3D에 그리지 않는다 (폰에서 읽기 어려움). 가까이 가서 버튼을 누르면
// 카메라가 판 쪽으로 다가간 뒤 평평한 화면(index.html #sand)으로 보여 준다.

export const SAND = { x: -14, z: 9, w: 2.8, d: 1.9, ry: 0.35 };

/** 판 안쪽으로는 걸어 들어가지 못하게 (판 좌표계 기준 직사각형 + 여유) */
export function insideSandBoard(x: number, z: number) {
  const dx = x - SAND.x, dz = z - SAND.z, c = Math.cos(SAND.ry), s = Math.sin(SAND.ry);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < SAND.w / 2 + 0.25 && Math.abs(lz) < SAND.d / 2 + 0.25;
}

function sandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e4d0aa'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(160,128,88,.35)' : 'rgba(255,246,228,.45)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.2, 1.2);
  }
  // 갈퀴로 고른 물결 자국
  g.strokeStyle = 'rgba(140,108,72,.35)'; g.lineWidth = 2;
  for (let y = 14; y < 128; y += 22) {
    g.beginPath();
    for (let x = 0; x <= 128; x += 4) g.lineTo(x, y + Math.sin(x / 10) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.4);
  return t;
}

export function createSandBoard(scene: THREE.Scene) {
  const g = new THREE.Group();
  const y0 = groundY(SAND.z);
  g.position.set(SAND.x, y0, SAND.z); g.rotation.y = SAND.ry;
  const wood = new THREE.MeshLambertMaterial({ color: 0x6e4a2c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4f341e });

  const sand = new THREE.Mesh(new THREE.BoxGeometry(SAND.w, 0.22, SAND.d), new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.position.y = 0.11; g.add(sand);
  // 나무틀
  const rail = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), wood); m.position.set(x, 0.15, z); g.add(m);
  };
  rail(SAND.w + 0.24, 0.12, 0, SAND.d / 2 + 0.06); rail(SAND.w + 0.24, 0.12, 0, -SAND.d / 2 - 0.06);
  rail(0.12, SAND.d, SAND.w / 2 + 0.06, 0); rail(0.12, SAND.d, -SAND.w / 2 - 0.06, 0);
  // 팻말
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), dark);
  post.position.set(SAND.w / 2 + 0.25, 0.65, -SAND.d / 2); g.add(post);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.05), wood);
  sign.position.set(SAND.w / 2 + 0.25, 1.25, -SAND.d / 2); sign.rotation.y = -0.3; g.add(sign);
  // 모래에 꽂힌 갈퀴
  const rake = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), wood);
  handle.rotation.z = 0.5; handle.position.set(0, 0.5, 0); rake.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), dark);
  head.position.set(0.26, 0.04, 0); rake.add(head);
  rake.position.set(-SAND.w / 2 + 0.3, 0.2, SAND.d / 2 - 0.3); rake.rotation.y = 0.6; g.add(rake);
  scene.add(g);

  // 판 위에 뜨는 이름표 ("모래 게시판 · 오늘 N개")
  let label: THREE.Sprite | null = null;
  function setLabel(text: string) {
    if (label) { g.remove(label); label.material.map?.dispose(); label.material.dispose(); }
    label = textSprite(text, 0.6);
    label.position.set(0, 1.7, 0);
    g.add(label);
  }

  const center = new THREE.Vector3(SAND.x, y0 + 0.25, SAND.z);
  /** 게시판을 볼 때 카메라 자리: 판 앞쪽(바다 반대편) 위에서 내려다봄 */
  const viewPos = new THREE.Vector3(SAND.x + Math.sin(SAND.ry) * 2.6, y0 + 3.3, SAND.z + Math.cos(SAND.ry) * 2.6);

  return {
    center, viewPos, setLabel,
    update(cam: THREE.Camera) { if (label) label.visible = cam.position.distanceTo(center) < 24; },
    distance: (p: THREE.Vector3) => Math.hypot(p.x - SAND.x, p.z - SAND.z),
  };
}
