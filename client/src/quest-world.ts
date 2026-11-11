// 퀘스트에 쓰이는 장소 꾸밈: 밤 숲 도깨비 소굴, 장터목 윷판, 고갯길 팻말, 산아랫마을
import * as THREE from 'three';
import { FOREST, VILLAGE, TRAIL, trailX } from './beach-extras';
import { regionOpen } from './regions';
import { onProgress, questStep, questDone } from './progress';
import { bakeStatic } from './bake';
import { stylize } from './look';
import { textSprite } from './character';

const tn = (c: number) => new THREE.MeshToonMaterial({ color: c });
export function createQuestWorld(scene: THREE.Scene, floor: (x: number, z: number) => number, GLOW: THREE.Texture, at: { heungbu: { x: number; z: number }; bak: { x: number; z: number } }) {
  const put = (g: THREE.Object3D, x: number, z: number, ry = 0) => { g.position.set(x, floor(x, z), z); g.rotation.y = ry; return g; };
  const rock = (p: THREE.Object3D, x: number, z: number, s: number, c = 0xcdbcc4) => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), tn(c)); r.position.set(x, floor(x, z) + s * 0.3, z); r.rotation.set(x, z, x * z); p.add(r); };
  // ---- 밤 숲 소굴: 돌 둘레 + 파란 모닥불 + 버섯 ----
  const den = new THREE.Group(); scene.add(den);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; if (Math.abs(Math.sin(a / 2 - 0.4)) < 0.25) continue; rock(den, FOREST.x + Math.cos(a) * 6.4, FOREST.z + Math.sin(a) * 6.4, 0.6 + (i % 3) * 0.2, 0xa8a0c0); }
  for (let i = 0; i < 10; i++) { const a = i * 2.4, r = 4 + (i % 3), x = FOREST.x + Math.cos(a) * r, z = FOREST.z + Math.sin(a) * r, m = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.26, 6), tn(0xfff4e0)); st.position.y = 0.13; m.add(st); const cp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), tn([0xf28c8c, 0x9fb0e8, 0xf6d26a][i % 3])); cp.position.y = 0.24; m.add(cp); den.add(put(m, x, z)); }
  const fireG = new THREE.Group(); put(fireG, FOREST.x + 0.8, FOREST.z - 2.2); den.add(fireG);
  for (let i = 0; i < 5; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), tn(0x8a6a4e)); lg.rotation.set(Math.PI / 2, i * 1.26, 0.3); lg.position.y = 0.15; fireG.add(lg); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.2, r = 7.6 + (i % 3) * 1.4, t = new THREE.Group(), h = 2.6 + (i % 4) * 0.7; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), tn(0x8a6a5c)); tr.position.y = 0.5; t.add(tr); for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(1.1 - k * 0.28, h * 0.5, 7), tn(k % 2 ? 0x6a9a8a : 0x5a8a7e)); cn.position.y = 1 + k * h * 0.28; t.add(cn); } den.add(put(t, FOREST.x + Math.cos(a) * r, FOREST.z + Math.sin(a) * r)); }
  stylize(den); bakeStatic(den);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x7fd8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); flame.scale.set(2.6, 3.4, 1); flame.position.set(FOREST.x + 0.8, floor(FOREST.x + 0.8, FOREST.z - 2.2) + 0.9, FOREST.z - 2.2); scene.add(flame);
  // ---- 장터목 윷판: 멍석 + 윷가락 ----
  const yut = new THREE.Group(); put(yut, at.heungbu.x - 1.3, at.heungbu.z + 0.2); scene.add(yut);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 20), tn(0xe8d08a)); mat.position.y = 0.03; yut.add(mat);
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 3, 6), tn(i % 2 ? 0xfaf0d8 : 0x9a6a44)); s.rotation.set(Math.PI / 2, 0, i * 0.8); s.position.set(-0.3 + i * 0.2, 0.1, (i % 2) * 0.25 - 0.1); yut.add(s); }
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, d = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0x5a4030 })); d.rotation.x = -Math.PI / 2; d.position.set(Math.cos(a) * 0.9, 0.055, Math.sin(a) * 0.9); yut.add(d); }
  stylize(yut); bakeStatic(yut);
  // 박 넝쿨 (자라는 단계: 싹 → 넝쿨 → 박)
  const vine = new THREE.Group(); put(vine, at.bak.x, at.bak.z); scene.add(vine);
  const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), tn(0x9fd49a)); sprout.position.y = 0.15; vine.add(sprout);
  const leaves = new THREE.Group(); for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), tn(0x8fbf7e)); l.scale.y = 0.3; l.position.set(Math.cos(i) * 0.5 * (i / 9 + 0.3), 0.1 + i * 0.05, Math.sin(i) * 0.5 * (i / 9 + 0.3)); leaves.add(l); } vine.add(leaves);
  const gourd = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), tn(0xdcecb8)); gourd.scale.y = 0.85; gourd.position.set(0.3, 0.4, 0.2); vine.add(gourd);
  // ---- 고갯길 팻말 + 산아랫마을 ----
  const sign = textSprite('↓ 산아랫마을', 0.5); sign.position.set(trailX(TRAIL.end) + 2.4, floor(trailX(TRAIL.end) + 2.4, TRAIL.end) + 1.7, TRAIL.end); scene.add(sign);
  const vil = new THREE.Group(); scene.add(vil);
  const hut = (x: number, z: number, ry: number, s = 1) => {
    const h = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.4), tn(0xf0e4d2)); wall.position.y = 0.8; h.add(wall);
    const roof = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), tn(0xe2c880)); roof.scale.set(1, 0.6, 0.85); roof.position.y = 1.55; h.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.06), tn(0xb08462)); door.position.set(0.5, 0.6, -1.21); h.add(door);
    for (const sx of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), tn(0x9a7a5c)); p.position.set(sx, 0.8, -1.25); h.add(p); }
    h.scale.setScalar(s); vil.add(put(h, x, z, ry));
  };
  hut(VILLAGE.x - 7.5, VILLAGE.z - 6.5, 0.3); hut(VILLAGE.x + 7.5, VILLAGE.z - 5.5, -0.4, 0.9); hut(VILLAGE.x - 1.5, VILLAGE.z + 9.5, Math.PI, 1.1);
  // 아궁이 + 솥 (팥죽 할머니), 독 (콩쥐), 돌담, 감나무
  const agungi = new THREE.Group(); const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.9), tn(0xbcaab6)); st.position.y = 0.3; agungi.add(st); const pot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), tn(0x4a4450)); pot.rotation.x = Math.PI; pot.position.y = 0.95; agungi.add(pot); vil.add(put(agungi, VILLAGE.x - 4.6, VILLAGE.z - 3.6));
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.9, 12), tn(0x8a6a58)); jar.position.set(VILLAGE.x + 4.6, floor(VILLAGE.x + 4.6, VILLAGE.z - 1.6) + 0.45, VILLAGE.z - 1.6); vil.add(jar);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; if (Math.abs(a - Math.PI * 1.5) < 0.35) continue; rock(vil, VILLAGE.x + Math.cos(a) * 12, VILLAGE.z + Math.sin(a) * 12, 0.5, 0xd8ccc0); }
  for (const [dx, dz] of [[-10, 3], [10, 4], [3, -9], [-4, 12], [9, -9]]) { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6), tn(0x9a7a5c)); tr.position.y = 1.1; t.add(tr); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), tn(0x9fc184)); cr.position.y = 2.8; cr.scale.y = 0.8; t.add(cr); for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), tn(0xf2a455)); f.position.set(Math.cos(k * 1.3) * 1.1, 2.5 + (k % 2) * 0.5, Math.sin(k * 1.3) * 1.1); t.add(f); } vil.add(put(t, VILLAGE.x + dx, VILLAGE.z + dz)); }
  stylize(vil); bakeStatic(vil);
  const vname = textSprite('산아랫마을', 0.7); vname.position.set(VILLAGE.x, floor(VILLAGE.x, VILLAGE.z - 12) + 2.6, VILLAGE.z - 12); scene.add(vname);

  const refresh = () => {
    const f = regionOpen('nightForest'); den.visible = f; flame.visible = f;
    const v = regionOpen('village'); vil.visible = v; vname.visible = v; sign.visible = true;
    const hb = questStep('heungbu'); vine.visible = hb >= 5 || questDone('heungbu'); sprout.visible = hb === 5; leaves.visible = hb >= 6; gourd.visible = hb === 7;
  };
  refresh(); onProgress(refresh);
  return { update(t: number, night: boolean, jiri: boolean) { for (const o of [den, yut, vine, vil, sign, vname, flame]) if (!jiri) o.visible = false; if (jiri) { refresh(); flame.visible = den.visible && night; flame.scale.y = 3.4 + Math.sin(t * 9) * 0.3; yut.visible = true; } } };
}
