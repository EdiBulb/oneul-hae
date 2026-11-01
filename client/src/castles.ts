import * as THREE from 'three';
import type { Castle } from '../../server/src/protocol';
import { groundY } from './world';

// 모래성 그리기: level 1 모래 더미 → 2 성벽과 모서리 탑 → 3 가운데 큰 탑과 깃발.
// towers는 다른 사람들이 하나씩 얹어 준 작은 탑 (최대 4개).

const sand = new THREE.MeshLambertMaterial({ color: 0xc8a879, flatShading: true });
const wet = new THREE.MeshLambertMaterial({ color: 0xb39467, flatShading: true });
const pole = new THREE.MeshLambertMaterial({ color: 0x6b5340 });
const FLAGS = [0xff7a5c, 0xffc457, 0x7cc4ff, 0xb48cff, 0x7fd18b];

function hash(s: string) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

function buildMesh(c: Castle) {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };
  if (c.level === 1) {
    const mound = add(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sand, 0, 0, 0);
    mound.scale.y = 0.6;
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), wet, 0.05, 0.38, 0); // 양동이로 찍은 작은 탑
  } else {
    add(new THREE.BoxGeometry(1.0, 0.34, 1.0), sand, 0, 0.17, 0);
    // 성벽 위 톱니
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const along = -0.25 + i * 0.17;
      add(new THREE.BoxGeometry(0.1, 0.1, 0.1), sand, along + 0.04, 0.39, s * 0.45);
      add(new THREE.BoxGeometry(0.1, 0.1, 0.1), sand, s * 0.45, 0.39, along + 0.04);
    }
    // 모서리 탑
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
      add(new THREE.CylinderGeometry(0.13, 0.15, 0.56, 8), wet, x, 0.28, z);
    }
    if (c.level >= 3) {
      add(new THREE.CylinderGeometry(0.22, 0.26, 0.6, 10), sand, 0, 0.64, 0);
      add(new THREE.ConeGeometry(0.29, 0.32, 10), wet, 0, 1.1, 0);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), pole, 0, 1.45, 0);
      const flagGeo = new THREE.PlaneGeometry(0.22, 0.13); flagGeo.translate(0.11, 0, 0);
      const flag = add(flagGeo, new THREE.MeshLambertMaterial({ color: FLAGS[hash(c.id) % FLAGS.length], side: THREE.DoubleSide }), 0, 1.6, 0);
      flag.name = 'flag';
    }
  }
  // 다른 사람이 얹어 준 탑
  for (let i = 0; i < c.towers; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, r = 0.78;
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.38, 7), sand, Math.cos(a) * r, 0.19, Math.sin(a) * r);
    add(new THREE.ConeGeometry(0.12, 0.16, 7), wet, Math.cos(a) * r, 0.46, Math.sin(a) * r);
  }
  g.rotation.y = (hash(c.id) % 628) / 100;
  return g;
}

export function createCastles(scene: THREE.Scene) {
  const map = new Map<string, { c: Castle; g: THREE.Group; pop: number }>();

  function upsert(c: Castle, animate = true) {
    const old = map.get(c.id);
    if (old) { scene.remove(old.g); old.g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); }
    const g = buildMesh(c);
    g.position.set(c.x, groundY(c.z), c.z);
    scene.add(g);
    map.set(c.id, { c, g, pop: animate ? 0 : 1 });
  }
  function setAll(list: Castle[]) { clear(); list.forEach(c => upsert(c, false)); }
  function clear() { for (const id of [...map.keys()]) { const v = map.get(id)!; scene.remove(v.g); v.g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); map.delete(id); } }

  /** 내 앞 가까이에 있는 성 (쌓기 버튼이 '올리기/탑 얹기'로 바뀌도록) */
  function near(x: number, z: number, r = 1.6) {
    let best: Castle | null = null, bd = r;
    for (const { c } of map.values()) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  function update(dt: number, t: number) {
    for (const v of map.values()) {
      if (v.pop < 1) {
        v.pop = Math.min(1, v.pop + dt * 2.5);
        const k = v.pop, s = 0.6 + 0.4 * k + Math.sin(Math.PI * k) * 0.12;
        v.g.scale.set(s, s, s);
      }
      const flag = v.g.getObjectByName('flag');
      if (flag) flag.rotation.y = Math.sin(t / 300 + v.c.x) * 0.4;
    }
  }
  return { upsert, setAll, clear, near, update, get count() { return map.size; } };
}
