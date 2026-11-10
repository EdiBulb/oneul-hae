import * as THREE from 'three';
import { textSprite, toon } from './character';

// 마고할미: 지리산 산신령. 흰 쪽진 머리에 비녀, 옅은 쪽빛 두루마기, 박 달린 지팡이, 발밑엔 작은 구름.
// 앞 = -z (캐릭터와 같음). 병아리보다 조금 크고, 살짝 떠 있다.

export function createMago(name: string) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const outlineM = new THREE.MeshBasicMaterial({ color: 0x4a3420, side: THREE.BackSide });
  const withOutline = (m: THREE.Mesh, k = 1.035) => { const o = new THREE.Mesh(m.geometry, outlineM); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(k); m.parent!.add(o); return m; };
  // 발밑 구름
  const cloud = new THREE.Group(); root.add(cloud);
  const cloudM = new THREE.MeshToonMaterial({ color: 0xffffff });
  for (const [x, z, r] of [[-0.32, 0.05, 0.22], [-0.08, -0.12, 0.27], [0.2, 0.0, 0.24], [0.02, 0.2, 0.22], [0.38, 0.12, 0.17]] as const) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cloudM); c.scale.y = 0.55; c.position.set(x, 0.14, z); cloud.add(c); }
  body.position.y = 0.22;
  // 두루마기 (종 모양)
  const robeM = toon(0xdbe2ec);
  const robePts = [[0.0, 0], [0.46, 0], [0.47, 0.06], [0.4, 0.4], [0.3, 0.75], [0.2, 0.98], [0.12, 1.04], [0, 1.04]].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robePts, 24), robeM); body.add(robe); withOutline(robe, 1.03);
  // 앞섶 (겹친 깃) + 고름
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.02), toon(0xf4f1ea)); collar.position.set(0.02, 0.86, -0.24); collar.rotation.set(-0.35, 0, -0.45); body.add(collar);
  const goreum = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.02), toon(0xc0574a)); goreum.position.set(0.08, 0.66, -0.33); goreum.rotation.set(-0.3, 0, 0.1); body.add(goreum);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), goreum.material); knot.position.set(0.07, 0.78, -0.31); body.add(knot);
  // 소매와 손
  const sleeveM = toon(0xcdd5e2), skinM = toon(0xf2d2b6);
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.24, 0.86, 0); body.add(piv);
    const sl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), sleeveM); sl.scale.set(0.75, 1.25, 0.85); sl.position.set(sx * 0.1, -0.2, -0.08); sl.rotation.z = sx * 0.4; piv.add(sl); withOutline(sl, 1.06);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinM); hand.position.set(sx * 0.17, -0.36, -0.16); piv.add(hand);
    arms.push(piv);
  }
  // 지팡이 + 박 (오른손)
  const staff = new THREE.Group(); staff.position.set(0.41, 0.02, -0.16); body.add(staff);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.55, 6), toon(0x6a4630)); pole.position.y = 0.78; pole.rotation.z = -0.04; staff.add(pole);
  const gourdM = toon(0xd9a64a);
  const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gourdM); g1.position.set(0.05, 1.28, 0); staff.add(g1);
  const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), gourdM); g2.position.set(0.05, 1.39, 0); staff.add(g2);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10), toon(0xc0574a)); tie.rotation.x = Math.PI / 2; tie.position.set(0.05, 1.34, 0); staff.add(tie);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pole.material); knob.position.y = 1.56; staff.add(knob);
  // 얼굴
  const head = new THREE.Group(); head.position.y = 1.27; body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), skinM); face.scale.set(1, 1.05, 0.96); head.add(face); withOutline(face, 1.04);
  // 흰 머리: 이마 위를 덮는 머리칼 + 뒤통수 쪽진 머리 + 비녀
  const hairM = toon(0xf6f4ef);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.262, 20, 12, 0, Math.PI * 2, 0, 1.25), hairM); hair.rotation.x = 0.35; hair.position.set(0, 0.02, 0.02); head.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairM); bun.position.set(0, 0.14, 0.24); head.add(bun); withOutline(bun, 1.08);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), toon(0x7a5a3a)); pin.rotation.z = Math.PI / 2; pin.position.set(0, 0.15, 0.25); head.add(pin);
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), toon(0x5aa86a)); tip.position.set(sx * 0.18, 0.15, 0.25); head.add(tip); }
  // 웃는 눈 (반달), 흰 눈썹, 볼, 입
  const lineM = new THREE.MeshBasicMaterial({ color: 0x4a3020 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 10, Math.PI), lineM); eye.position.set(sx * 0.085, 0.0, -0.235); eye.rotation.set(0, Math.PI, 0); head.add(eye);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), hairM); brow.rotation.z = Math.PI / 2 + sx * 0.25; brow.position.set(sx * 0.09, 0.075, -0.225); head.add(brow);
    const ck = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.55, depthWrite: false })); ck.position.set(sx * 0.13, -0.06, -0.22); ck.rotation.y = Math.PI + sx * 0.5; head.add(ck);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 4, 10, Math.PI), lineM); mouth.position.set(0, -0.085, -0.24); mouth.rotation.set(0, Math.PI, Math.PI); head.add(mouth);
  // 이름표 + 말 걸 수 있다는 표시 (머리 위 말풍선)
  const label = textSprite(name, 0.62); label.position.y = 2.12; root.add(label);
  const hint = textSprite('💬', 0.8); hint.position.y = 2.5; hint.visible = false; root.add(hint);
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
      hint.position.y = 2.5 + Math.sin(t * 3) * 0.05;
      if (faceTo !== null) { let d = faceTo - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * Math.min(1, dt * 4); }
    },
  };
}
