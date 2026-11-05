import * as THREE from 'three';
import type { PlaceId } from '../../server/src/protocol';
import { BUS_STOP, PALACE, PORTAL, RAMEN_MACHINE, STORE } from './beach-extras';
import { textSprite } from './character';
import { groundY } from './world';

// 장소마다 다른 풍경
// - 향호: 모래사장 위 작은 버스정류장(보라색 벤치), 뒤쪽 길로 가끔 지나가는 시골 버스
// - 한강: 건너편 도시 야경, 불 켜진 다리, 강가 편의점과 즉석 라면 기계

const M = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b;
};

// ---------- 향호 버스정류장 ----------
function busStop(scene: THREE.Scene) {
  const g = new THREE.Group(); scene.add(g);
  const y0 = groundY(BUS_STOP.z), frame = M(0xe9e6df), roofM = M(0x3e6fa8), bench = M(0x8b6cc4);
  const s = new THREE.Group(); s.position.set(BUS_STOP.x, y0, BUS_STOP.z); g.add(s);
  // 지붕과 기둥 (바다 쪽이 뒤)
  box(2.7, 0.12, 1.2, roofM, 0, 2.25, -0.2, s);
  for (const x of [-1.25, 1.25]) box(0.1, 2.2, 0.1, frame, x, 1.1, -0.72, s);
  for (const x of [-1.25, 1.25]) box(0.08, 2.2, 0.08, frame, x, 1.1, 0.3, s);
  // 뒷벽: 위는 비워 두고 아래쪽 판만 (뒤로 바다가 보이게)
  box(2.5, 0.5, 0.05, frame, 0, 0.75, -0.72, s);
  box(2.5, 0.06, 0.05, frame, 0, 2.1, -0.72, s);
  // 벤치
  box(2.0, 0.08, 0.42, bench, 0, 0.42, -0.42, s);
  box(2.0, 0.36, 0.06, bench, 0, 0.62, -0.62, s);
  for (const x of [-0.85, 0.85]) box(0.08, 0.42, 0.36, M(0x5e4a86), x, 0.21, -0.42, s);
  // 정류장 표지판
  const pole = box(0.06, 2.4, 0.06, M(0x9aa0a6), 1.8, 1.2, 0.1, s);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), M(0x2d6cdf, { side: THREE.DoubleSide }));
  sign.position.set(1.8, 2.25, 0.14); s.add(sign);
  const label = textSprite('향호 · Hyangho', 0.45); label.position.set(1.8, 2.75, 0.1); s.add(label);
  void pole;
  // 뒤쪽(육지 쪽) 길
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 4), M(0x55565c));
  road.rotation.x = -Math.PI / 2; road.position.set(0, groundY(19) + 0.03, 19); g.add(road);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.12), M(0xf2d35b));
  line.rotation.x = -Math.PI / 2; line.position.set(0, groundY(19) + 0.04, 19); g.add(line);
  // 시골 버스: 1~2분마다 지나가며 정류장 앞에서 잠깐 섬
  const bus = new THREE.Group(); g.add(bus);
  box(7, 2.2, 2.3, M(0x4f8fd6), 0, 1.45, 0, bus);
  box(7.02, 0.7, 2.32, M(0xf2f0ea), 0, 1.05, 0, bus);
  const glass = M(0x2a3440, { emissive: 0x111820 });
  for (let i = 0; i < 6; i++) box(0.9, 0.7, 2.34, glass, -2.6 + i * 1.05, 2.0, 0, bus);
  box(0.05, 1.0, 2.0, glass, 3.52, 1.9, 0, bus);
  for (const [x, z] of [[-2.3, 1.1], [2.3, 1.1], [-2.3, -1.1], [2.3, -1.1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), M(0x222222)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); bus.add(w);
  }
  bus.position.set(-200, groundY(19), 20);
  let busT = -40; // 첫 버스는 조금 있다가
  return {
    group: g,
    update(dt: number) {
      busT += dt;
      // 0~12초: 들어오기, 12~18초: 정차, 18~30초: 떠나기, 그 뒤 쉬기
      const stopX = BUS_STOP.x;
      let x: number;
      if (busT < 0) x = -200;
      else if (busT < 12) { const k = busT / 12; x = -120 + (stopX + 120) * (1 - (1 - k) * (1 - k)); }
      else if (busT < 18) x = stopX;
      else if (busT < 30) { const k = (busT - 18) / 12; x = stopX + 140 * k * k; }
      else { x = 200; if (busT > 30 + 70 + Math.random() * 40) busT = 0; }
      bus.position.x = x; bus.visible = Math.abs(x) < 180;
    },
  };
}

// ---------- 한강공원 ----------
function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a1f2c'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) {
    if (Math.random() < 0.55) { g.fillStyle = Math.random() < 0.8 ? '#ffd99a' : '#cfe6ff'; g.fillRect(x, y, 4, 4); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function hangang(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g);
  // 건너편 강둑과 도시
  const bank = new THREE.Mesh(new THREE.BoxGeometry(1400, 3, 60), M(0x2f3a2e)); bank.position.set(0, 0, -300); g.add(bank);
  const win = windowTexture();
  const lit = new THREE.MeshLambertMaterial({ color: 0x59606e, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0 });
  const city = new THREE.Group(); g.add(city);
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const w = 14 + r() * 22, h = 22 + r() * 80 * (1 - Math.abs(i - 45) / 60), d = 14 + r() * 18;
    const x = -700 + i * 15.5 + r() * 6, z = -330 - r() * 120;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 12, uv.getY(k) * h / 18);
    const b = new THREE.Mesh(geo, lit); b.position.set(x, h / 2, z); city.add(b);
  }
  // 아주 높은 타워 하나 (특정 건물이 아닌 평범한 초고층)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 15, 210, 8), lit); tower.position.set(260, 105, -420); city.add(tower);
  // 다리: 강을 가로질러 오른쪽에
  const bridge = new THREE.Group(); g.add(bridge);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 300), M(0x6d7078)); deck.position.set(90, 9, -150); bridge.add(deck);
  for (let z = -290; z <= 0; z += 30) { const p = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.6, 10, 8), M(0x5b5e65)); p.position.set(90, 3.5, z); bridge.add(p); }
  const lamps: THREE.Sprite[] = [];
  for (let z = -296; z <= 6; z += 10) for (const dx of [-6, 6]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(90 + dx, 11, z); s.scale.set(4, 4, 1); bridge.add(s); lamps.push(s);
  }
  // 이쪽 강변: 콘크리트 계단식 둑과 산책로 가로등
  const steps = new THREE.Group(); g.add(steps);
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 0.6), M(0xa3a39c)); st.position.set(0, -0.2 - i * 0.3, -1.9 - i * 0.6); steps.add(st); }
  const path = new THREE.Mesh(new THREE.PlaneGeometry(400, 2.2), M(0xb8b2a6)); path.rotation.x = -Math.PI / 2; path.position.set(0, groundY(15) + 0.03, 15.5); g.add(path);
  const parkLamps: THREE.Sprite[] = [];
  for (let x = -20; x <= 20; x += 10) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), M(0x3b3f45)); pole.position.set(x, groundY(16.8) + 1.6, 16.8); g.add(pole);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffe2a8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x, groundY(16.8) + 3.3, 16.8); s.scale.set(3, 3, 1); g.add(s); parkLamps.push(s);
  }
  // 강가 편의점
  const y0 = groundY(STORE.z);
  const store = new THREE.Group(); store.position.set(STORE.x, y0, STORE.z); g.add(store);
  box(STORE.w, 2.8, STORE.d, M(0xf3f1ec), 0, 1.4, 0, store);
  const glassM = new THREE.MeshLambertMaterial({ color: 0x9fc3d6, emissive: 0xfff4d8, emissiveIntensity: 0.2, transparent: true, opacity: 0.85 });
  const front = box(STORE.w - 0.6, 1.9, 0.05, glassM, 0, 1.15, -STORE.d / 2 - 0.01, store); void front;
  const signM = new THREE.MeshLambertMaterial({ color: 0x2f9e6a, emissive: 0x2f9e6a, emissiveIntensity: 0.3 });
  box(STORE.w + 0.2, 0.55, 0.3, signM, 0, 2.95, -STORE.d / 2 + 0.05, store);
  const storeLabel = textSprite('편의점 24 · MART', 0.6); storeLabel.position.set(0, 3.5, -STORE.d / 2); store.add(storeLabel);
  // 파라솔 테이블 두 개
  for (const [x, z] of [[-1.4, -3.2], [1.6, -3.4]]) {
    box(0.9, 0.06, 0.9, M(0xffffff), x, 0.72, z, store);
    box(0.06, 0.72, 0.06, M(0x888888), x, 0.36, z, store);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 10), M(0x2f9e6a)); um.position.set(x, 2.1, z); store.add(um);
    box(0.04, 1.4, 0.04, M(0x888888), x, 1.4, z, store);
  }
  // 즉석 라면 기계 (가게 앞, 화면이 빛남)
  const mach = new THREE.Group(); mach.position.set(RAMEN_MACHINE.x, groundY(RAMEN_MACHINE.z), RAMEN_MACHINE.z); mach.rotation.y = Math.PI / 2; g.add(mach);
  box(0.9, 1.35, 0.7, M(0xd8302f), 0, 0.68, 0, mach);
  const screen = box(0.6, 0.3, 0.02, new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0x6fe3ff, emissiveIntensity: 0.6 }), 0, 1.12, -0.36, mach); void screen;
  box(0.5, 0.12, 0.4, M(0x333333), 0, 0.72, -0.28, mach);
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  steam.position.set(0, 0.95, -0.35); mach.add(steam);
  const machLabel = textSprite('🍜 라면 · Ramyeon', 0.42); machLabel.position.set(0, 1.75, 0); mach.add(machLabel);
  let cooking = 0;
  return {
    group: g,
    cook() { cooking = 4; },
    update(dt: number, t: number, night: number) {
      lit.emissiveIntensity = 0.08 + night * 0.62;
      lamps.forEach((s, i) => (s.material.opacity = night * (0.75 + 0.25 * Math.sin(t / 900 + i))));
      parkLamps.forEach(s => (s.material.opacity = night * 0.9));
      glassM.emissiveIntensity = 0.2 + night * 0.7;
      signM.emissiveIntensity = 0.3 + night * 0.7;
      if (cooking > 0) {
        cooking -= dt;
        const k = (t / 600) % 1;
        steam.position.y = 0.95 + k * 0.5; steam.scale.setScalar(0.6 + k * 1.2);
        (steam.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
      } else (steam.material as THREE.MeshBasicMaterial).opacity = 0;
    },
  };
}

// ---------- 경복궁 ----------
// 돌 광장, 궁궐 정문(돌 기단에 문 세 개 + 두 겹 기와지붕), 양옆 담장, 뒤로 북쪽 산, 문 앞 수문장
function palace(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); scene.add(g);
  // 바다를 덮는 넓은 땅 (광장 바깥)
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), M(0xb9b2a4)); far.rotation.x = -Math.PI / 2; far.position.set(0, 0.005, -450); g.add(far);
  // 박석 줄무늬
  for (let z = -10; z < 16; z += 1.6) { const l = new THREE.Mesh(new THREE.PlaneGeometry(44, 0.04), M(0xa79f90)); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.02, z); g.add(l); }
  const z0 = PALACE.gateZ;
  const stone = M(0xd6d0c2), stoneDark = M(0x9e978a), wood = M(0x9b3a2c), green = M(0x3f7a6a), roofM = M(0x3a3d42), wallM = M(0xcfc6b3), wallRoof = M(0x4a4d52);
  // 돌 기단과 세 개의 홍예문
  const base = new THREE.Group(); base.position.set(PALACE.x, 0, z0); g.add(base);
  box(16, 5.2, 4.5, stone, 0, 2.6, 0, base);
  for (const [x, w] of [[-4.2, 2.2], [0, 2.8], [4.2, 2.2]] as const) {
    box(w, 3.2, 4.6, M(0x2b2620), x, 1.6, 0, base);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 4.6, 16, 1, false, 0, Math.PI), M(0x2b2620));
    arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(x, 3.2, 0); base.add(arch);
  }
  // 문루: 붉은 기둥, 초록 단청 띠, 두 겹 지붕
  const hall = new THREE.Group(); hall.position.y = 5.2; base.add(hall);
  for (let i = 0; i < 6; i++) for (const z of [-1.6, 1.6]) box(0.35, 3, 0.35, wood, -6 + i * 2.4, 1.5, z, hall);
  box(14, 0.5, 4, green, 0, 3.1, 0, hall);
  const roof = (w: number, d: number, y: number) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), roofM);
    r.rotation.y = Math.PI / 4; r.scale.set(w * 0.72, 1.6, d * 0.72); r.position.y = y; hall.add(r);
    // 처마 끝을 살짝 들어 올린 느낌
    for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 4), roofM); tip.rotation.z = sx * 1.2; tip.position.set(sx * w / 2, y - 0.5, 0); hall.add(tip); }
  };
  roof(18, 7.5, 4.3); box(12, 1.6, 3.6, wood, 0, 5.6, 0, hall); box(12.2, 0.4, 3.6, green, 0, 6.4, 0, hall); roof(15, 6, 7.4);
  // 현판
  const plate = textSprite('광화문 · Gwanghwamun', 0.9); plate.position.set(0, 4.3, 2.3); hall.add(plate);
  // 양옆 담장
  for (const sx of [-1, 1]) {
    box(60, 3.2, 1, wallM, sx * 38, 1.6, z0 + 0.5, g);
    box(60, 0.5, 1.6, wallRoof, sx * 38, 3.4, z0 + 0.5, g);
  }
  // 뒤로 보이는 근정전 지붕과 북쪽 산
  const hall2 = new THREE.Group(); hall2.position.set(0, 0, z0 - 60); g.add(hall2);
  box(26, 7, 12, wood, 0, 3.5, 0, hall2);
  const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), roofM); r2.rotation.y = Math.PI / 4; r2.scale.set(24, 6, 12); r2.position.y = 9.5; hall2.add(r2);
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(120, 70, 7), M(0x5d6e55, { flatShading: true })); mountain.position.set(-20, 30, z0 - 260); g.add(mountain);
  const m2 = new THREE.Mesh(new THREE.ConeGeometry(90, 50, 6), M(0x6a7a5f, { flatShading: true })); m2.position.set(110, 22, z0 - 230); g.add(m2);
  // 수문장: 붉은 옷에 검은 갓, 깃발을 든 채 문 앞에 서 있다가 가끔 교대 행진
  const guards: { c: THREE.Group; x: number; ph: number }[] = [];
  for (const x of [-2.2, 2.2, -6.5, 6.5]) {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.1, 10), M(0xb0302a)); body.position.y = 0.75; c.add(body);
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 6, 14), M(0x2c5fa8)); sash.rotation.x = Math.PI / 2; sash.position.y = 0.7; c.add(sash);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), M(0xf0d2b6)); head.position.y = 1.5; c.add(head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 16), M(0x1c1c1c)); brim.position.y = 1.72; c.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.22, 12), M(0x1c1c1c)); crown.position.y = 1.84; c.add(crown);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), M(0x6b4a2e)); pole.position.set(0.38, 1.3, 0); c.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), M(x < 0 ? 0xe8c14a : 0x3d78c8, { side: THREE.DoubleSide })); flag.position.set(0.68, 2.2, 0); c.add(flag);
    c.position.set(x, 0, z0 + 3); g.add(c); guards.push({ c, x, ph: Math.random() * 6 });
  }
  const guardTag = textSprite('수문장 · Gate guards', 0.5); guardTag.position.set(0, 2.6, z0 + 3); g.add(guardTag);
  // 한복 대여소 (역 출구 옆)
  const shop = new THREE.Group(); shop.position.set(HANBOK_SHOP.x, 0, HANBOK_SHOP.z); g.add(shop);
  box(3.2, 2.4, 2, M(0xf2ece0), 0, 1.2, 0, shop);
  box(3.6, 0.3, 2.4, roofM, 0, 2.55, 0, shop);
  const rack = [0xe85d75, 0x4f8fd6, 0xf2c14e, 0x7cc47a, 0xb48cff];
  rack.forEach((c, i) => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), M(c)); h.position.set(-1.2 + i * 0.6, 0.9, -1.05); h.rotation.x = Math.PI; shop.add(h); });
  const shopTag = textSprite('👘 한복 대여 · Hanbok rental', 0.5); shopTag.position.set(0, 3.1, 0); shop.add(shopTag);
  let t0 = 0;
  return {
    group: g,
    update(dt: number, t: number) {
      t0 += dt;
      // 1분마다 15초 동안 교대식: 수문장들이 제자리에서 발을 맞춰 걷고 깃발이 흔들림
      const ceremony = (t0 % 60) < 15;
      for (const q of guards) {
        const step = ceremony ? Math.sin(t / 220 + q.ph) : 0;
        q.c.position.y = Math.abs(step) * 0.06;
        q.c.position.x = q.x + (ceremony ? Math.sin(t / 2000 + q.ph) * 0.4 : 0);
        (q.c.children[6] as THREE.Mesh).rotation.y = Math.sin(t / 400 + q.ph) * (ceremony ? 0.5 : 0.15);
      }
      void GLOW;
    },
  };
}
export const HANBOK_SHOP = { x: 12.5, z: 9 };

// ---------- 서울로 가는 문 (해변) / 지하철 역 출구 (서울) ----------
function portal(scene: THREE.Scene, GLOW: THREE.Texture) {
  const g = new THREE.Group(); g.position.set(PORTAL.x, 0, PORTAL.z); g.rotation.y = 0; scene.add(g);
  // 해변: 모래 위에 혼자 서 있는 나무 문틀, 안쪽은 소용돌이치는 푸른 빛
  const door = new THREE.Group(); g.add(door);
  const frame = M(0x7a5a3c);
  box(0.16, 2.3, 0.2, frame, -0.62, 1.15, 0, door); box(0.16, 2.3, 0.2, frame, 0.62, 1.15, 0, door); box(1.4, 0.16, 0.2, frame, 0, 2.32, 0, door);
  const swirlTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(0.35, '#6fd3ff'); gr.addColorStop(1, '#2a4bb8');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
    for (let a = 0; a < 12; a += 0.35) { const r = a * 5; x.beginPath(); x.arc(64, 64, r, a, a + 0.9); x.stroke(); }
    return new THREE.CanvasTexture(c);
  })();
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 2.15), new THREE.MeshBasicMaterial({ map: swirlTex, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  inner.position.y = 1.15; door.add(inner);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x7fd8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.scale.set(3.4, 3.8, 1); halo.position.y = 1.2; door.add(halo);
  const sign = textSprite('🚇 서울로 가는 문 · To Seoul', 0.55); sign.position.y = 2.85; door.add(sign);
  // 서울: 지하철 역 출구 (계단이 내려가는 입구 + 초록 지붕 + 역 이름판)
  const exit = new THREE.Group(); g.add(exit);
  const metal = M(0x4f5560), glass = new THREE.MeshLambertMaterial({ color: 0xa9d3e0, transparent: true, opacity: 0.5 });
  box(2.2, 0.12, 2.6, M(0x2f8f5b), 0, 2.4, 0, exit);
  for (const x of [-1, 1]) { box(0.08, 2.4, 0.08, metal, x, 1.2, -1.2, exit); box(0.08, 2.4, 0.08, metal, x, 1.2, 1.2, exit); box(0.04, 1.6, 2.4, glass, x, 1.4, 0, exit); }
  box(2, 0.9, 0.05, glass, 0, 1.0, -1.25, exit);
  for (let i = 0; i < 5; i++) box(1.8, 0.12, 0.45, M(0x777b80), 0, -0.1 - i * 0.18, 0.9 - i * 0.45, exit);
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), M(0x1a1c20)); pit.rotation.x = -Math.PI / 2; pit.position.set(0, -0.95, 0); exit.add(pit);
  let exitSign = textSprite('🚇', 0.6); exitSign.position.y = 3.0; exit.add(exitSign);
  return {
    setPlace(station: boolean, stationName: string) {
      door.visible = !station; exit.visible = station;
      exit.remove(exitSign); exitSign = textSprite(`🚇 ${stationName}`, 0.6); exitSign.position.y = 3.0; exit.add(exitSign);
    },
    update(dt: number, t: number) {
      inner.rotation.z = 0; (inner.material as THREE.MeshBasicMaterial).map!.rotation = t / 900; (inner.material as THREE.MeshBasicMaterial).map!.center.set(0.5, 0.5);
      halo.material.opacity = 0.45 + Math.sin(t / 500) * 0.15;
      void dt;
    },
  };
}

export function createPlaceScenery(scene: THREE.Scene, GLOW: THREE.Texture) {
  const bus = busStop(scene), han = hangang(scene, GLOW), pal = palace(scene, GLOW), gate = portal(scene, GLOW);
  let id: PlaceId = 'jeongdongjin';
  return {
    setPlace(p: PlaceId, station: boolean, stationName: string) {
      id = p; bus.group.visible = p === 'hyangho'; han.group.visible = p === 'hangang'; pal.group.visible = p === 'gyeongbokgung';
      gate.setPlace(station, stationName);
    },
    cook: () => han.cook(),
    update(dt: number, t: number, night: number) {
      if (id === 'hyangho') bus.update(dt);
      if (id === 'hangang') han.update(dt, t, night);
      if (id === 'gyeongbokgung') pal.update(dt, t);
      gate.update(dt, t);
    },
  };
}
