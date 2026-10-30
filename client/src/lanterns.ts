import * as THREE from 'three';
import { textSprite } from './character';

interface Lantern { g: THREE.Group; vy: number; vz: number; sway: number; age: number }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function createLanterns(scene: THREE.Scene, GLOW: THREE.Texture) {
  const list: Lantern[] = [];
  const geo = new THREE.CylinderGeometry(0.24, 0.17, 0.38, 10, 1, true);

  /** label이 있으면 풍등 위에 소원이 보인다 (내 풍등만) */
  function launch(pos: THREE.Vector3, label?: string) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, side: THREE.DoubleSide, fog: false })));
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff9a4a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    flame.scale.set(1.5, 1.5, 1); g.add(flame);
    if (label) { const l = textSprite(label, 0.7); l.position.y = 0.55; g.add(l); }
    g.position.set(pos.x, pos.y + 1.6, pos.z - 1.8);
    scene.add(g);
    list.push({ g, vy: 0.75 + Math.random() * 0.35, vz: -0.25 - Math.random() * 0.3, sway: Math.random() * 6, age: 0 });
    if (list.length > 80) remove(0);
  }

  function remove(i: number) {
    const L = list[i];
    scene.remove(L.g);
    L.g.traverse(o => { const m = o as THREE.Mesh | THREE.Sprite; (m.material as THREE.Material | undefined)?.dispose(); });
    list.splice(i, 1);
  }

  function update(dt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const L = list[i];
      L.age += dt;
      L.g.position.y += L.vy * dt;
      L.g.position.z += L.vz * dt;
      L.g.position.x += Math.sin(L.age * 0.7 + L.sway) * 0.25 * dt;
      const fade = clamp(1 - (L.age - 40) / 12, 0, 1);
      L.g.children.forEach(ch => { ((ch as THREE.Mesh).material as THREE.Material).opacity = fade; });
      if (fade <= 0) remove(i);
    }
  }

  const clear = () => { while (list.length) remove(0); };
  return { launch, update, clear };
}
