import * as THREE from 'three';
import { makeChar, animChar, toon, bodySurf, CHICK, setOutfit } from './character';

/** NPC 공통 그림체 규칙
 *  - 플랫 툰(toon) + 외곽선(뒷면 확대) + 볼 홍조 + 동그란 까만 눈과 반짝임 두 점
 *  - 앞은 -z (병아리와 같음). 크기는 병아리(키 약 1.35) 기준
 *  - 대표 물건 하나 + 대표색 하나만 진하게, 나머지는 운해 파스텔 */
export const LINE = 0x3c3530;
const lineM = new THREE.MeshBasicMaterial({ color: LINE, side: THREE.BackSide });
export function lined<T extends THREE.Mesh>(m: T, w = 0.03): T {
  const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const r = g.boundingSphere!.radius;
  const h = new THREE.Mesh(g, lineM); h.scale.setScalar(1 + w / Math.max(0.03, r)); h.userData.noStyle = true; m.add(h); return m;
}
const tn = (c: number, e = 0.25) => { const m = toon(c); m.emissive.setHex(c).multiplyScalar(e); return m; };
const black = new THREE.MeshBasicMaterial({ color: 0x24140c }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
/** 눈 한 쌍 + 볼: 얼굴 중심(앞 -z)에 붙임 */
export function face(parent: THREE.Object3D, y: number, z: number, gap: number, s = 1, cheek = 0xf4a0a0) {
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 12, 10), black); e.scale.set(0.85, 1.15, 0.5); e.position.set(sd * gap, y, z); parent.add(e);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.026 * s, 8, 6), white); h1.position.set(sd * gap + 0.022 * s, y + 0.03 * s, z - 0.035 * s); parent.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 6, 4), white); h2.position.set(sd * gap - 0.02 * s, y - 0.03 * s, z - 0.035 * s); parent.add(h2);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 10, 8), tn(cheek, 0.35)); ch.scale.set(1, 0.6, 0.3); ch.position.set(sd * (gap + 0.07 * s), y - 0.1 * s, z + 0.01); parent.add(ch);
  }
}

/** 도깨비: 지리산 밤 숲에 사는 장난꾸러기. 한국 도깨비답게 뿔 하나, 덥수룩한 머리, 잠방이, 방망이, 메밀묵 좋아함.
 *  일본 오니처럼 무섭지 않게: 둥글둥글, 큰 눈, 뻐드렁니 두 개로 웃음. 둘레에 파란 도깨비불 */
export type DokkaebiKind = 'chief' | 'minion';
export function dokkaebi(kind: DokkaebiKind, skin = 0x9fb0e8, seed = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const big = kind === 'chief', S = big ? 1.35 : 0.85;
  body.scale.setScalar(S);
  const skinM = tn(skin, 0.28), hairM = tn(big ? 0x3a3460 : 0x4a4470, 0.15), hornM = tn(0xf2d27a, 0.35), cloth = tn(0xd8c49a, 0.2), patch = tn(0xb88a6a, 0.2);
  // 몸통: 아래가 넓은 감자 모양
  const torso = lined(new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), skinM)); torso.scale.set(1, 0.95, 0.9); torso.position.y = 0.5; body.add(torso);
  // 머리: 몸보다 크게 (귀여움)
  const head = new THREE.Group(); head.position.y = 1.02; body.add(head);
  const skull = lined(new THREE.Mesh(new THREE.SphereGeometry(0.4, 22, 16), skinM)); skull.scale.set(1.05, 0.92, 0.95); head.add(skull);
  face(head, 0.02, -0.36, 0.14, 1.15);
  // 웃는 입 + 뻐드렁니 두 개
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 16, Math.PI), black); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.13, -0.37); head.add(mouth);
  for (const sd of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.02), white); t.position.set(sd * 0.03, -0.2, -0.375); head.add(t); }
  // 뿔 하나 (금빛) + 덥수룩한 머리 뭉치
  const horn = lined(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 10), hornM), 0.015); horn.position.set(0.04, 0.42, -0.02); horn.rotation.z = -0.15; head.add(horn);
  const rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  for (let i = 0; i < (big ? 9 : 6); i++) { const a = rnd() * Math.PI * 2, h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), hairM); h.position.set(Math.cos(a) * 0.22, 0.3 + rnd() * 0.06, Math.sin(a) * 0.2 + 0.05); h.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); head.add(h); }
  // 귀
  for (const sd of [-1, 1]) { const e = lined(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skinM), 0.015); e.scale.set(0.6, 1, 0.5); e.position.set(sd * 0.41, 0.02, 0); head.add(e); }
  // 잠방이 (기운 반바지) + 기운 천 조각
  const shorts = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.3, 18), cloth), 0.02); shorts.position.y = 0.26; body.add(shorts);
  const pt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), patch); pt.position.set(0.18, 0.28, -0.4); pt.rotation.z = 0.2; body.add(pt);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 24), tn(0xc0574a, 0.3)); belt.rotation.x = Math.PI / 2; belt.position.y = 0.4; body.add(belt);
  // 다리 + 큰 발
  for (const sd of [-1, 1]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), skinM); lg.position.set(sd * 0.16, 0.07, 0); body.add(lg); const ft = lined(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinM), 0.015); ft.scale.set(1, 0.5, 1.3); ft.position.set(sd * 0.17, 0.02, -0.05); body.add(ft); }
  // 팔
  const arms: THREE.Group[] = [];
  for (const sd of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sd * 0.38, 0.62, 0); body.add(piv); const a = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), skinM), 0.015); a.position.set(sd * 0.06, -0.15, 0); a.rotation.z = sd * 0.35; piv.add(a); arms.push(piv); }
  // 대표 물건: 졸개는 징 박힌 나무 방망이, 대장은 방망이를 잃어버려 빈손 + 낡은 갓
  if (!big) {
    const club = new THREE.Group(); club.position.set(0.12, -0.28, -0.05); arms[1].add(club);
    const shaft = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.26, 8), tn(0x9a6a44)), 0.012); club.add(shaft);
    const top = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.3, 10), tn(0xb88452)), 0.015); top.position.y = 0.26; club.add(top);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, st = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), hornM); st.position.set(Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1); club.add(st); }
    club.rotation.z = -0.5;
  } else {
    const brim = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.02, 24), tn(0x2c2836, 0.1)), 0.01); brim.position.set(-0.05, 0.36, 0.02); brim.rotation.z = 0.18; head.add(brim);
    const crown = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.24, 16), tn(0x2c2836, 0.1)), 0.01); crown.position.set(-0.09, 0.48, 0.02); crown.rotation.z = 0.18; head.add(crown);
    horn.position.set(0.14, 0.44, -0.02); horn.rotation.z = -0.5; // 갓 옆으로 삐져나온 뿔
    const tear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), tn(0x8cd8ff, 0.6)); tear.scale.y = 1.5; tear.position.set(-0.2, -0.06, -0.37); head.add(tear); // 방망이 잃어서 울먹
  }
  // 도깨비불: 둘레를 도는 파란 불꽃 (몸과 같이 크기)
  const flames: THREE.Mesh[] = [];
  const fireM = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < (big ? 3 : 1); i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), fireM); f.scale.set(1, 1.5, 1); f.userData.ph = i * 2.1; g.add(f); flames.push(f); }
  const update = (t: number) => {
    body.position.y = Math.abs(Math.sin(t / 380)) * 0.04 * S;
    head.rotation.z = Math.sin(t / 700) * 0.06;
    arms[0].rotation.z = -0.2 + Math.sin(t / 380) * 0.25; arms[1].rotation.z = 0.2 - Math.sin(t / 380) * (big ? 0.25 : 0.4);
    if (big) arms[0].rotation.set(0, 0, -2.4 + Math.sin(t / 500) * 0.1); // 머리 긁적
    flames.forEach(f => { const a = t / 900 + f.userData.ph; f.position.set(Math.cos(a) * 0.8 * S, (1.2 + Math.sin(t / 400 + f.userData.ph) * 0.12) * S, Math.sin(a) * 0.8 * S); });
  };
  update(0);
  return { g, update };
}

/** 우렁각시
 *  - 'chick': 병아리 모습. 우렁이 껍데기처럼 둥글게 말아 올린 쪽머리, 분홍 행주치마, 두 손에 작은 소반(아침상)
 *  - 'snail': 우렁이 모습. 올리브빛 돌돌 말린 껍데기 + 같은 분홍 리본 (같은 인물이라는 표시) */
export function ureongGaksi(form: 'chick' | 'snail') {
  const g = new THREE.Group();
  const shellM = tn(0xb8a86a, 0.25), shell2 = tn(0x8f8048, 0.2), ribbon = tn(0xf28cb4, 0.35);
  const spiral = (size: number) => {
    // 돌돌 말린 원뿔 나선 껍데기: 겹친 구슬로 굽이 (만화처럼 마디가 보이게), 굽이마다 옅은 띠
    const m = new THREE.Group(), N = 44, turns = 2.6;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1), a = k * turns * Math.PI * 2, hr = 0.17 * (1 - k) * size, r = (0.25 * (1 - k) + 0.035) * size;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), Math.floor(k * turns * 3) % 3 === 2 ? shell2 : shellM);
      sp.position.set(Math.cos(a) * hr, (0.1 + k * 0.55) * size, Math.sin(a) * hr); m.add(sp);
      if (i % 2 === 0) { const h = new THREE.Mesh(sp.geometry, lineM); h.scale.setScalar(1 + 0.025 / r); h.userData.noStyle = true; sp.add(h); }
    }
    return m;
  };
  let update: (t: number, dt?: number) => void;
  if (form === 'chick') {
    const c = makeChar(0, 0xf2c8d8); setOutfit(c, 0);
    for (const n of ['eggshell', 'scarf', 'outfit']) { const o = c.root.getObjectByName(n); if (o) o.visible = false; }
    (c.root.getObjectByName('chickBody') as THREE.Mesh).material = (() => { const m = toon(0xfbe2cc); m.emissive.setHex(0xfbe2cc).multiplyScalar(0.3); return m; })();
    g.add(c.root);
    // 쪽머리: 머리 위 뒤쪽에 작은 나선 껍데기 + 비녀
    const top = bodySurf(0, 1.0); const bun = spiral(0.62); bun.position.set(0, top.y - 0.08, 0.16); bun.rotation.x = 0.2; c.inner.add(bun);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6), tn(0xe8c46a, 0.4)); pin.rotation.z = Math.PI / 2; pin.position.set(0, top.y + 0.1, 0.22); c.inner.add(pin);
    // 행주치마 (앞치마)
    const apron = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 0.4, 20, 1, true, Math.PI * 0.66, Math.PI * 0.68), ((m: THREE.MeshToonMaterial) => { m.side = THREE.DoubleSide; return m; })(tn(0xf7b8cc, 0.3))), 0.012);
    apron.position.y = CHICK.y - 0.3; apron.scale.z = CHICK.sz; c.inner.add(apron);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), ribbon); tie.position.set(0, CHICK.y - 0.0, 0.42); c.inner.add(tie);
    // 소반 + 밥그릇 (두 날개 앞)
    const tray = new THREE.Group(); tray.position.set(0, CHICK.y - 0.08, -0.66); tray.scale.setScalar(0.8); c.inner.add(tray);
    const board = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), tn(0xc0874a, 0.25)), 0.012); tray.add(board);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), tn(0xffffff, 0.3)); bowl.position.set(-0.07, 0.1, 0); bowl.rotation.x = Math.PI; tray.add(bowl);
    const rice = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), tn(0xfffaf0, 0.4)); rice.position.set(-0.07, 0.1, 0); tray.add(rice);
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.04, 10), tn(0x8cc49c, 0.3)); side.position.set(0.1, 0.04, 0.04); tray.add(side);
    c.state = 'idle';
    update = (t: number) => { animChar(c, 1 / 60); tray.position.y = CHICK.y - 0.08 + Math.sin(t / 500) * 0.01; };
  } else {
    // 우렁이: 부드러운 몸(발) + 눈 달린 더듬이 둘 + 등에 껍데기 + 분홍 리본
    const foot = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 12), tn(0xe6dcd0, 0.3)), 0.02); foot.rotation.x = Math.PI / 2; foot.scale.set(1.2, 1, 0.6); foot.position.set(0, 0.1, -0.05); g.add(foot);
    const sh = spiral(1.0); sh.position.set(0, 0.12, 0.1); sh.rotation.set(0.25, 0, 0.1); g.add(sh);
    const rb = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), ribbon); rb.position.set(0.1, 0.42, -0.05); rb.rotation.y = 0.6; g.add(rb);
    const rb2 = rb.clone(); rb2.position.x = 0.24; g.add(rb2);
    const head = new THREE.Group(); head.position.set(0, 0.22, -0.38); g.add(head);
    const hd = lined(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), tn(0xe6dcd0, 0.3)), 0.015); head.add(hd);
    face(head, 0.03, -0.13, 0.065, 0.55);
    const stalks: THREE.Group[] = [];
    for (const sd of [-1, 1]) { const st = new THREE.Group(); st.position.set(sd * 0.07, 0.1, -0.02); head.add(st); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.24, 6), tn(0xe6dcd0, 0.3)); s.position.y = 0.12; st.add(s); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tn(0xe6dcd0, 0.3)); bb.position.y = 0.25; st.add(bb); st.rotation.z = sd * -0.35; stalks.push(st); }
    update = (t: number) => { stalks.forEach((s, i) => { s.rotation.x = Math.sin(t / 600 + i) * 0.2; }); head.position.y = 0.22 + Math.sin(t / 900) * 0.015; };
  }
  update(0);
  return { g, update: (t: number) => update(t) };
}

// ---------- 전래 동화 사람들: 마고할미와 같은 2등신 틀 ----------
export interface FolkOpt { robe: number; sleeve?: number; skin?: number; hair?: number; top?: 'gat' | 'bun' | 'topknot' | 'band' | 'braid' | 'halo' | 'straw'; accent?: number; lump?: boolean; beard?: boolean; faceTint?: number; scale?: number; glow?: number }
export function folk(o: FolkOpt) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.scale.setScalar(o.scale ?? 1);
  const skinM = tn(o.faceTint ?? o.skin ?? 0xfbe4cf, 0.3), robeM = tn(o.robe), hairM = tn(o.hair ?? 0x3a3038, 0.15), acc = tn(o.accent ?? 0xe0606a, 0.3);
  const pts = [[0, 0], [0.42, 0], [0.44, 0.06], [0.4, 0.3], [0.32, 0.52], [0.22, 0.64], [0, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
  body.add(lined(new THREE.Mesh(new THREE.LatheGeometry(pts, 24), robeM), 0.025));
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.03, 6, 22), acc); sash.rotation.x = Math.PI / 2; sash.position.y = 0.4; body.add(sash);
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.3, 0.5, 0); body.add(piv); const sl = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), tn(o.sleeve ?? o.robe)), 0.015); sl.position.set(sx * 0.07, -0.12, -0.06); sl.rotation.set(-0.3, 0, sx * 0.4); piv.add(sl); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinM); hand.position.set(sx * 0.13, -0.25, -0.12); piv.add(hand); arms.push(piv); }
  const head = new THREE.Group(); head.position.y = 0.97; body.add(head);
  const skull = lined(new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), skinM), 0.025); skull.scale.set(1, 0.96, 0.94); head.add(skull);
  face(head, -0.01, -0.33, 0.13, 0.95);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 4, 12, Math.PI), black); mouth.position.set(0, -0.13, -0.335); mouth.rotation.z = Math.PI; head.add(mouth);
  // 머리칼: 뒤통수를 덮는 반구
  if (o.top !== 'halo' || o.hair) { const h = lined(new THREE.Mesh(new THREE.SphereGeometry(0.375, 20, 14, 0, Math.PI * 2, 0, 1.5), hairM), 0.015); h.rotation.x = 0.75; h.position.set(0, 0.03, 0.03); head.add(h); }
  const ink = tn(0x2c2836, 0.1);
  if (o.top === 'gat') { const brim = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 24), ink), 0.01); brim.position.y = 0.3; head.add(brim); const cr = lined(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.26, 16), ink), 0.01); cr.position.y = 0.43; head.add(cr); }
  if (o.top === 'straw') { const cone = lined(new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.3, 20), tn(0xe8d08a)), 0.012); cone.position.y = 0.4; head.add(cone); }
  if (o.top === 'bun' || o.top === 'halo') { const bun = lined(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), hairM), 0.02); bun.position.set(0, o.top === 'halo' ? 0.4 : 0.18, o.top === 'halo' ? 0 : 0.3); head.add(bun); const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 6), tn(0xe6c272, 0.4)); pin.rotation.z = Math.PI / 2; pin.position.copy(bun.position); head.add(pin); }
  if (o.top === 'halo') { for (const sx of [-1, 1]) { const rb = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI * 1.2), acc); rb.position.set(sx * 0.3, 0.5, 0.1); rb.rotation.set(0, 0, sx * 0.6); head.add(rb); } }
  if (o.top === 'topknot') { const tk = lined(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hairM), 0.015); tk.position.y = 0.4; head.add(tk); }
  if (o.top === 'band') { const bd = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.035, 6, 22), tn(0xfffaf2, 0.4)); bd.rotation.x = Math.PI / 2 + 0.15; bd.position.y = 0.12; head.add(bd); const tk = lined(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hairM), 0.015); tk.position.y = 0.4; head.add(tk); }
  if (o.top === 'braid') { const br = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), hairM), 0.012); br.position.set(0, -0.3, 0.36); head.add(br); const rb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), acc); rb.position.set(0, -0.62, 0.36); head.add(rb); }
  if (o.lump) { const l = lined(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinM), 0.02); l.position.set(0.33, -0.16, -0.12); head.add(l); }
  if (o.beard) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), tn(0xfbf8f2, 0.4)); b.rotation.x = Math.PI; b.position.set(0, -0.4, -0.26); head.add(b); }
  if (o.glow) { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshBasicMaterial({ color: o.glow, transparent: true, opacity: 0.16, depthWrite: false })); gl.position.y = 0.6; body.add(gl); }
  const update = (t: number) => { body.position.y = Math.sin(t / 600) * 0.015; head.rotation.z = Math.sin(t / 900) * 0.05; arms[0].rotation.x = Math.sin(t / 700) * 0.08; };
  return { g, update, head, arms };
}
/** 호랑이: 주황 몸에 줄무늬, 둥근 귀. 앉아 있는 모습 (병아리 3배) */
export function tiger() {
  const g = new THREE.Group(), or = tn(0xf2a455), wh = tn(0xfff4e0, 0.35), st = tn(0x4a3830, 0.1);
  const body = lined(new THREE.Mesh(new THREE.SphereGeometry(1.0, 22, 16), or)); body.scale.set(1, 1.05, 1.1); body.position.y = 1.0; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 12), wh); belly.scale.set(0.8, 0.9, 0.5); belly.position.set(0, 0.85, -0.75); g.add(belly);
  const head = new THREE.Group(); head.position.set(0, 2.2, -0.35); g.add(head);
  const sk = lined(new THREE.Mesh(new THREE.SphereGeometry(0.8, 22, 16), or)); sk.scale.set(1.1, 0.9, 0.95); head.add(sk);
  const muz = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), wh); muz.scale.set(1.2, 0.75, 0.6); muz.position.set(0, -0.2, -0.66); head.add(muz);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), tn(0xe0707a, 0.3)); nose.position.set(0, -0.1, -0.86); head.add(nose);
  face(head, 0.12, -0.7, 0.3, 1.9);
  for (const sx of [-1, 1]) { const e = lined(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), or), 0.02); e.position.set(sx * 0.6, 0.6, 0); head.add(e); for (const y of [0.25, 0.0]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), st); s.position.set(sx * 0.72, y, -0.42); s.rotation.z = sx * 0.3; head.add(s); } const paw = lined(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), or), 0.02); paw.scale.y = 0.6; paw.position.set(sx * 0.5, 0.16, -0.9); g.add(paw); }
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), st); s.position.set(0, 0.74 - i * 0.02, -0.62 + i * 0.3); s.rotation.x = -Math.PI / 2; s.position.y = 2.95; head.add(s); s.position.set(0, 0.7, -0.3 + i * 0.25); }
  const tail = lined(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.2, 4, 8), or), 0.02); tail.position.set(0.9, 0.5, 0.8); tail.rotation.set(0.6, 0, -0.9); g.add(tail);
  const update = (t: number) => { head.rotation.z = Math.sin(t / 1100) * 0.06; tail.rotation.z = -0.9 + Math.sin(t / 500) * 0.25; };
  return { g, update };
}
/** 작은 새 (까치·제비): 몸 색 둘 */
export function littleBird(dark: number, light: number, tailLong = false) {
  const g = new THREE.Group(), d = tn(dark, 0.15), l = tn(light, 0.35);
  const body = lined(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), d), 0.02); body.scale.set(0.9, 0.95, 1.15); body.position.y = 0.34; g.add(body);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), l); bel.scale.set(0.8, 0.8, 0.6); bel.position.set(0, 0.28, -0.16); g.add(bel);
  const head = new THREE.Group(); head.position.set(0, 0.62, -0.12); g.add(head);
  head.add(lined(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), d), 0.02)); face(head, 0.02, -0.17, 0.08, 0.55);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), tn(0xe8a45b, 0.3)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, -0.03, -0.24); head.add(beak);
  const tail = lined(new THREE.Mesh(new THREE.ConeGeometry(0.08, tailLong ? 0.7 : 0.45, 5), d), 0.012); tail.rotation.x = Math.PI / 2 + 0.5; tail.position.set(0, 0.36, 0.45); g.add(tail);
  for (const sx of [-1, 1]) { const w = lined(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), d), 0.012); w.scale.set(0.35, 0.8, 1.1); w.position.set(sx * 0.23, 0.36, 0.05); g.add(w); }
  const update = (t: number) => { g.position.y = Math.abs(Math.sin(t / 300)) * 0.03; head.rotation.y = Math.sin(t / 800) * 0.4; };
  return { g, update };
}
/** 두꺼비: 납작한 올리브 몸, 큰 입 */
export function toad() {
  const g = new THREE.Group(), gr = tn(0x9cae6a), be = tn(0xe8e2b8, 0.3);
  const body = lined(new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), gr)); body.scale.set(1.15, 0.7, 1.1); body.position.y = 0.36; g.add(body);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), be); bel.scale.set(1, 0.55, 0.6); bel.position.set(0, 0.26, -0.3); g.add(bel);
  for (const sx of [-1, 1]) { const e = lined(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), gr), 0.015); e.position.set(sx * 0.24, 0.72, -0.25); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black); p.position.set(sx * 0.24, 0.74, -0.36); g.add(p); const lg = lined(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), gr), 0.015); lg.scale.set(1, 0.5, 1.2); lg.position.set(sx * 0.5, 0.1, 0.1); g.add(lg); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 4, 14, Math.PI), black); mouth.rotation.z = Math.PI; mouth.position.set(0, 0.5, -0.5); g.add(mouth);
  const update = (t: number) => { body.scale.y = 0.7 + Math.sin(t / 700) * 0.03; };
  return { g, update };
}
/** 말 걸 수 있는 물건 자리: 반짝이는 표시 (아이콘 스프라이트는 npc 틀이 붙임) */
export function spot(color = 0xffe08a) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color })); gem.position.y = 0.55; g.add(gem);
  const update = (t: number) => { gem.position.y = 0.55 + Math.sin(t / 400) * 0.06; gem.rotation.y = t / 600; ring.scale.setScalar(1 + Math.sin(t / 500) * 0.08); };
  return { g, update };
}
