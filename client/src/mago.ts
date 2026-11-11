import * as THREE from 'three';
import { textSprite, toon } from './character';
import { lined, face } from './npcs';

// 마고할미: 지리산 산신령. 흰 쪽진 머리에 비녀, 옅은 쪽빛 두루마기, 박 달린 지팡이, 발밑엔 작은 구름.
// 앞 = -z (캐릭터와 같음). 병아리보다 조금 크고, 살짝 떠 있다.

export function createMago(name: string) {
  // 다른 NPC와 같은 규칙: 큰 머리 2등신, 동그란 눈 + 반짝임, 볼 홍조, 먹선 외곽선. 대표색은 연쪽빛 두루마기, 대표 물건은 박 달린 지팡이와 발밑 구름
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const tn = (c: number, e = 0.28) => { const m = toon(c); m.emissive.setHex(c).multiplyScalar(e); return m; };
  // 발밑 구름
  const cloud = new THREE.Group(); root.add(cloud);
  const cloudM = tn(0xffffff, 0.45);
  for (const [x, z, r] of [[-0.34, 0.05, 0.22], [-0.08, -0.14, 0.27], [0.22, 0.0, 0.24], [0.02, 0.22, 0.22], [0.4, 0.14, 0.17]] as const) { const c = lined(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudM), 0.02); c.scale.y = 0.55; c.position.set(x, 0.06, z); cloud.add(c); }
  body.position.y = 0.22;
  // 두루마기: 짧고 둥근 종 모양 (2등신)
  const robeM = tn(0xb8c4ec);
  const robePts = [[0.0, 0], [0.44, 0], [0.46, 0.06], [0.42, 0.3], [0.33, 0.52], [0.22, 0.64], [0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = lined(new THREE.Mesh(new THREE.LatheGeometry(robePts, 28), robeM), 0.025); body.add(robe);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.03, 6, 28), tn(0xfffaf2, 0.35)); hem.rotation.x = Math.PI / 2; hem.position.y = 0.04; body.add(hem);
  // 흰 깃 + 붉은 고름
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 20, Math.PI), tn(0xfffaf2, 0.35)); collar.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI); collar.position.set(0, 0.6, -0.04); body.add(collar);
  const goreumM = tn(0xe0606a, 0.3);
  for (const [x, rz, l] of [[0.06, 0.15, 0.24], [0.1, 0.45, 0.2]] as const) { const gr = new THREE.Mesh(new THREE.BoxGeometry(0.05, l, 0.02), goreumM); gr.position.set(x, 0.44 - l / 2 + 0.06, -0.33); gr.rotation.set(-0.35, 0, rz); body.add(gr); }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), goreumM); knot.position.set(0.07, 0.5, -0.31); body.add(knot);
  // 소매와 손
  const sleeveM = tn(0xa8b6e4), skinM = tn(0xfbe4cf, 0.3);
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.3, 0.5, 0); body.add(piv);
    const sl = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), sleeveM), 0.015); sl.position.set(sx * 0.07, -0.12, -0.06); sl.rotation.set(-0.3, 0, sx * 0.4); piv.add(sl);
    const hand = lined(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinM), 0.012); hand.position.set(sx * 0.13, -0.25, -0.12); piv.add(hand);
    arms.push(piv);
  }
  // 지팡이 + 박 (오른손)
  const staff = new THREE.Group(); staff.position.set(0.44, 0.0, -0.14); body.add(staff);
  const poleM = tn(0x8a6040, 0.2);
  const pole = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.3, 7), poleM), 0.012); pole.position.y = 0.65; staff.add(pole);
  const gourdM = tn(0xe8b85a, 0.35);
  const g1 = lined(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), gourdM), 0.012); g1.position.set(0.06, 1.05, 0); staff.add(g1);
  const g2 = lined(new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), gourdM), 0.012); g2.position.set(0.06, 1.17, 0); staff.add(g2);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 4, 10), goreumM); tie.rotation.x = Math.PI / 2; tie.position.set(0.06, 1.12, 0); staff.add(tie);
  const knob = lined(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), poleM), 0.012); knob.position.y = 1.31; staff.add(knob);
  // 얼굴: 크고 동그란 머리
  const head = new THREE.Group(); head.position.y = 0.97; body.add(head);
  const skull = lined(new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), skinM), 0.025); skull.scale.set(1, 0.96, 0.94); head.add(skull);
  face(head, -0.01, -0.33, 0.13, 0.95, 0xf49a9a);
  // 흰 머리: 가운데 가르마로 양쪽을 덮고, 뒤통수 위에 쪽진 머리 + 금비녀(옥 끝)
  const hairM = tn(0xfbf8f2, 0.4);
  for (const sx of [-1, 1]) { const h = lined(new THREE.Mesh(new THREE.SphereGeometry(0.372, 20, 14, sx > 0 ? 0 : Math.PI, Math.PI, 0, 1.45), hairM), 0.015); h.rotation.set(0.72, 0, sx * -0.18); h.position.set(sx * 0.008, 0.03, 0.03); head.add(h); }
  // 가르마 양옆으로 둥글게 넘긴 앞머리
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), hairM); f.scale.set(1.15, 0.55, 0.7); f.position.set(sx * 0.15, 0.24, -0.2); f.rotation.z = sx * -0.35; head.add(f); }
  const bun = lined(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), hairM), 0.02); bun.position.set(0, 0.18, 0.3); head.add(bun);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), tn(0xe6c272, 0.4)); pin.rotation.z = Math.PI / 2; pin.position.set(0, 0.2, 0.32); head.add(pin);
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), tn(0x6cc08a, 0.4)); tip.position.set(sx * 0.26, 0.2, 0.32); head.add(tip); }
  // 흰 눈썹 (복슬) + 웃는 입
  for (const sx of [-1, 1]) { const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.08, 3, 6), hairM); brow.rotation.z = Math.PI / 2 - sx * 0.25; brow.position.set(sx * 0.13, 0.12, -0.32); head.add(brow); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 4, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x24140c })); mouth.position.set(0, -0.13, -0.335); mouth.rotation.set(0, 0, Math.PI); head.add(mouth);
  // 이름표 + 말 걸 수 있다는 표시 (머리 위 말풍선)
  const label = textSprite(name, 0.62); label.position.y = 1.95; root.add(label);
  const hint = textSprite('💬', 0.8); hint.position.y = 2.3; hint.visible = false; root.add(hint);
  // 그림자
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);

  let talkT = 0, faceTo: number | null = null;
  return {
    root,
    /** 말하는 동안 고개를 끄덕이고 지팡이를 살짝 흔듦 */
    talk(sec = 2.5) { talkT = sec; },
    /** 이 방향을 보게 (y 회전) */
    look(ang: number | null) { faceTo = ang; },
    showHint(on: boolean) { hint.visible = on; },
    update(dt: number, t: number) {
      body.position.y = 0.22 + Math.sin(t * 1.4) * 0.03;
      cloud.position.y = Math.sin(t * 1.4) * 0.02; cloud.rotation.y += dt * 0.15;
      if (talkT > 0) talkT -= dt;
      const nod = talkT > 0 ? Math.sin(t * 7) * 0.08 : 0;
      head.rotation.x = nod; head.rotation.z = Math.sin(t * 0.8) * 0.04;
      staff.rotation.z = talkT > 0 ? Math.sin(t * 5) * 0.05 : 0;
      arms[0].rotation.x = talkT > 0 ? 0.25 + Math.sin(t * 6) * 0.15 : 0;
      hint.position.y = 2.3 + Math.sin(t * 3) * 0.05;
      if (faceTo !== null) { let d = faceTo - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * Math.min(1, dt * 4); }
    },
  };
}
