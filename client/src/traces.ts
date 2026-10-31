import { T } from './i18n';
import * as THREE from 'three';
import type { Traces } from '../../server/src/protocol';
import { animChar, disposeChar, makeChar, textSprite, type Char } from './character';
import { BODY_COLORS, HAT_COLORS } from './places';
import { floorY } from './beach-extras';

// 오늘 이 해변에 다녀간 진짜 사람들의 흔적.
// 떠난 사람의 마지막 자리에 반투명한 실루엣, 하늘엔 오늘 올라간 풍등이 멀리 남아 있다.
// 이름과 소원 문구는 없다. 서버가 실제 접속 기록으로만 만든다.

interface Ghost { c: Char; label: THREE.Sprite; x: number; z: number }

export function createTraces(scene: THREE.Scene, GLOW: THREE.Texture) {
  let ghosts: Ghost[] = [];
  let sky: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];

  function ghostify(c: Char) {
    c.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.material) return;
      const mat = (m.material as THREE.Material).clone() as THREE.MeshLambertMaterial;
      mat.transparent = true; mat.opacity = 0.28; mat.depthWrite = false;
      if ('emissive' in mat) mat.emissive = new THREE.Color(0x7a6a8a);
      m.material = mat;
      m.renderOrder = 2;
    });
  }

  function clear() {
    for (const g of ghosts) { scene.remove(g.c.root); disposeChar(g.c); }
    for (const l of sky) { scene.remove(l.s); l.s.material.dispose(); }
    ghosts = []; sky = [];
  }

  function set(tr: Traces) {
    clear();
    for (const gh of tr.ghosts) {
      const c = makeChar(BODY_COLORS[gh.look.body % BODY_COLORS.length], HAT_COLORS[gh.look.hat % HAT_COLORS.length]);
      ghostify(c);
      c.state = gh.sit ? 'sit' : 'idle';
      c.root.position.set(gh.x, floorY(gh.x, gh.z) + (gh.sit ? 0.07 : 0), gh.z);
      c.root.rotation.y = gh.ry;
      for (let i = 0; i < 40; i++) animChar(c, 0.05);
      const label = textSprite(T.traceLabel, 0.45);
      label.position.y = 1.75; label.material.opacity = 0.7;
      c.root.add(label);
      scene.add(c.root);
      ghosts.push({ c, label, x: gh.x, z: gh.z });
    }
    // 오늘 올라간 풍등: 바다 위 높은 하늘에 희미하게 떠 있음
    for (const [x, z] of tr.lanterns) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa860, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false }));
      const base = new THREE.Vector3(x * 1.6 + (Math.random() - 0.5) * 6, 16 + Math.random() * 12, z - 34 - Math.random() * 20);
      s.scale.set(1.1, 1.1, 1);
      s.position.copy(base);
      scene.add(s);
      sky.push({ s, base, ph: Math.random() * 6.28 });
    }
  }

  /** 진짜 사람이 그 자리에 있으면 흔적은 비켜 준다 */
  function update(t: number, cam: THREE.Camera, people: THREE.Vector3[]) {
    for (const g of ghosts) {
      const taken = people.some(p => Math.hypot(p.x - g.x, p.z - g.z) < 0.9);
      g.c.root.visible = !taken;
      g.label.visible = !taken && cam.position.distanceTo(g.c.root.position) < 9;
    }
    for (const l of sky) {
      l.s.position.set(l.base.x + Math.sin(t / 4000 + l.ph) * 0.6, l.base.y + Math.sin(t / 2600 + l.ph) * 0.4, l.base.z);
      l.s.material.opacity = 0.35 + Math.sin(t / 700 + l.ph) * 0.1;
    }
  }

  return { set, clear, update, get count() { return ghosts.length; } };
}
