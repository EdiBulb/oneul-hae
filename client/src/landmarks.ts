import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { trailX } from './beach-extras';
import { koreanPine } from './place-scenery';
import { stable } from './stable-tex';
import { stylize } from './look';

/** 새 장소 시안 (주소에 ?spots=1): 천왕샘 · 당산나무 · 운해 그네 · 봉황바위 */
export const SPOTS_ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('spots') === '1';

/** 천왕샘: 정상 바로 아래, 매일 시작하는 곳 왼쪽 바위틈 */
export const SPRING = { x: -6.4, z: 11.2, r: 0.8 };
/** 당산나무: 장터목 마당 왼쪽 위 */
export const DANGSAN = { x: trailX(91) - 7.2, z: 91 };
/** 운해 그네: 꽃밭 끝 바위 턱, 바깥(+x) 구름바다를 봄 */
export const SWING = { x: trailX(62) + 27.5, z: 62 };
/** 봉황바위: 정상에서 왼쪽 앞 구름바다 위로 솟은 바위 봉우리 (못 가는 곳) */
export const PHOENIX_ROCK = new THREE.Vector3(-46, 26, -128);

const toon = (c: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, ...extra });
const rand = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

function carved(lines: string[], w = 256, h = 512, color = 'rgba(90,70,70,.85)', vertical = true, bg = '') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (vertical) { x.font = `900 ${Math.floor(w * 0.62)}px "Noto Serif KR", serif`; const ch = [...lines[0]]; ch.forEach((t, i) => x.fillText(t, w / 2, (i + 0.5) * h / ch.length)); }
  else lines.forEach((l, i) => { x.font = `${i ? 700 : 900} ${i ? 34 : 56}px "Noto Sans KR", sans-serif`; x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 64); });
  const t = stable(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createSpots(parent: THREE.Group, mY: (x: number, z: number) => number, GLOW: THREE.Texture) {
  const g = new THREE.Group(); parent.add(g);
  const rnd = rand(11);
  const stone = [toon(0xcdbcc4), toon(0xd8c8cc), toon(0xbcaab6)];
  const rock = (parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, m = stone[Math.floor(rnd() * 3)]) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), m); r.scale.set(sx, sy, sz); r.position.set(x, y, z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); parent.add(r); return r;
  };
  const anim: ((t: number, night: number) => void)[] = [];

  // ---------- 천왕샘 ----------
  {
    const s = new THREE.Group(), y = mY(SPRING.x, SPRING.z); s.position.set(SPRING.x, y, SPRING.z); g.add(s);
    // 뒤쪽 바위벽 (물이 나오는 곳)
    rock(s, -1.5, 0.7, -0.3, 1.2, 1.3, 1.0); rock(s, -1.3, 0.4, 0.9, 0.9, 0.8, 0.8); rock(s, -1.0, 1.6, 0.2, 0.7, 0.6, 0.7);
    // 돌 대롱 + 졸졸 떨어지는 물줄기
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8), toon(0x9a8a7e)); spout.rotation.z = Math.PI / 2 - 0.15; spout.position.set(-0.55, 0.62, 0.15); s.add(spout);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 6), new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.75 }));
    stream.position.set(-0.27, 0.36, 0.15); s.add(stream);
    // 둥근 돌 웅덩이 + 하늘·병아리가 비치는 물
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; rock(s, Math.cos(a) * SPRING.r * 1.08 + 0.3, 0.06, Math.sin(a) * SPRING.r * 1.08 + 0.15, 0.24 + rnd() * 0.08, 0.16, 0.2); }
    const water = new Reflector(new THREE.CircleGeometry(SPRING.r, 32), { textureWidth: 512, textureHeight: 512, color: 0xb8d8e8, clipBias: 0.003 });
    water.rotation.x = -Math.PI / 2; water.position.set(0.3, 0.09, 0.15); water.userData.noStyle = true; s.add(water);
    const rim = new THREE.Mesh(new THREE.RingGeometry(SPRING.r * 0.82, SPRING.r, 32), new THREE.MeshBasicMaterial({ color: 0xa8d4e8, transparent: true, opacity: 0.45, depthWrite: false }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(0.3, 0.1, 0.15); rim.userData.noStyle = true; s.add(rim);
    // 물결: 물줄기 떨어지는 자리에서 동그랗게 퍼짐
    const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(-0.22, 0.11, 0.15); m.userData.noStyle = true; s.add(m); return m; });
    anim.push(t => rings.forEach((m, i) => { const k = ((t / 1600 + i / 3) % 1); m.scale.setScalar(0.05 + k * 0.5); (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k); }));
    // 표주박
    const gourd = new THREE.Group(); gourd.position.set(1.05, 0.2, 0.75); gourd.rotation.set(0, 0.6, 0.2); s.add(gourd);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0xe8c878, { side: THREE.DoubleSide })); gourd.add(bowl);
    const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), toon(0xd8b468)); hdl.rotation.z = Math.PI / 2; hdl.position.set(0.3, 0.02, 0); gourd.add(hdl);
    // 새김돌: 天王泉
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.0, 0.28), [toon(0xc8b8b8), toon(0xc8b8b8), toon(0xc8b8b8), toon(0xc8b8b8), new THREE.MeshToonMaterial({ color: 0xd8cccc, map: carved(['天王泉'], 256, 512, 'rgba(110,80,80,.9)', true, '#d8cccc') }), toon(0xc8b8b8)]);
    mk.position.set(1.4, 0.5, -0.55); mk.rotation.y = -0.5; s.add(mk);
    // 옆에 작은 구상나무와 풀
    const p = koreanPine(1.8, 0.2, 7); p.position.set(-2.2, 0, -1.2); s.add(p);
  }

  // ---------- 당산나무 + 오색 소원 리본 ----------
  {
    const d = new THREE.Group(), y = mY(DANGSAN.x, DANGSAN.z); d.position.set(DANGSAN.x, y, DANGSAN.z); g.add(d);
    // 돌담 둘레 (낮은 단)
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; rock(d, Math.cos(a) * 2.5, 0.2, Math.sin(a) * 2.5, 0.38, 0.28, 0.3); }
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.5, 0.32, 28), toon(0xb8cf8e)); bed.position.y = 0.16; d.add(bed);
    // 굵고 비틀린 줄기 + 큰 가지 넷
    const bark = toon(0x9a7a62), trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 3.4, 9), bark); trunk.position.y = 1.9; trunk.rotation.z = 0.08; d.add(trunk);
    const tips: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3, L = 2.6 + rnd() * 0.8, up = 0.75 + rnd() * 0.25;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, L, 7), bark);
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(up), Math.cos(up), Math.sin(a) * Math.sin(up)).normalize();
      br.position.set(dir.x * L / 2, 3.3 + dir.y * L / 2, dir.z * L / 2); br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); d.add(br);
      tips.push(new THREE.Vector3(dir.x * L, 3.3 + dir.y * L, dir.z * L));
    }
    // 수관: 몽글몽글 큰 잎 덩어리
    const leafM = [toon(0xa8d494, { emissive: 0x24381c }), toon(0xbcdfa2, { emissive: 0x24381c }), toon(0x9ccb8a, { emissive: 0x24381c })];
    for (const tp of tips) for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + rnd() * 0.6, 1), leafM[(k + tips.indexOf(tp)) % 3]); b.position.copy(tp).add(new THREE.Vector3((rnd() - 0.5) * 1.6, 0.4 + rnd() * 0.8, (rnd() - 0.5) * 1.6)); b.scale.y = 0.75; d.add(b); }
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), leafM[1]); top.position.set(0, 6.6, 0); top.scale.y = 0.7; d.add(top);
    // 금줄: 새끼줄 + 하얀 종이
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.05, 6, 28), toon(0xd8c08a)); rope.rotation.x = Math.PI / 2; rope.position.y = 1.5; d.add(rope);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, pp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), toon(0xffffff, { side: THREE.DoubleSide })); pp.position.set(Math.cos(a) * 0.84, 1.33, Math.sin(a) * 0.84); pp.rotation.y = -a + Math.PI / 2; d.add(pp); }
    // 오색 리본: 낮은 가지에서 늘어져 바람에 살랑 (나중엔 모두의 '오늘의 다짐'이 리본 하나씩)
    const COLS = [0xf28c8c, 0xf6d26a, 0x8cc4f0, 0xffffff, 0x9fd49a, 0xf7a8c8];
    const ribbons: THREE.Mesh[] = [];
    for (let i = 0; i < 90; i++) {
      const tp = tips[i % tips.length], k = 0.3 + rnd() * 0.6;
      const at = new THREE.Vector3(0, 3.3, 0).lerp(tp, k); at.y -= 0.1;
      const L = 0.5 + rnd() * 0.5, geo = new THREE.PlaneGeometry(0.07, L, 1, 4); geo.translate(0, -L / 2, 0);
      const r = new THREE.Mesh(geo, toon(COLS[i % COLS.length], { side: THREE.DoubleSide })); r.position.copy(at); r.rotation.y = rnd() * 6; r.userData.ph = rnd() * 6; r.userData.noLine = true; d.add(r); ribbons.push(r);
    }
    anim.push(t => { for (const r of ribbons) { r.rotation.z = Math.sin(t / 700 + r.userData.ph) * 0.18; r.rotation.x = Math.sin(t / 900 + r.userData.ph * 1.3) * 0.12; } });
    // 안내 돌: 소원을 묶는 나무
    const sg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.12), [toon(0xb08a66), toon(0xb08a66), toon(0xb08a66), toon(0xb08a66), new THREE.MeshToonMaterial({ color: 0xffffff, map: carved(['당산나무', '오늘의 다짐을 묶어요'], 512, 256, '#5a4030', false, '#f3e4c8') }), toon(0xb08a66)]);
    sg.position.set(2.0, 0.75, 2.6); sg.rotation.y = 0.6; d.add(sg);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), toon(0x8a6a4e)); sp.position.set(2.0, 0.3, 2.6); d.add(sp);
  }

  // ---------- 운해 그네 ----------
  {
    const w = new THREE.Group(), y = mY(SWING.x, SWING.z); w.position.set(SWING.x, y, SWING.z); w.rotation.y = -Math.PI / 2; g.add(w); // 앞(-z)이 바깥(+x)
    // 바위 턱: 구름 쪽으로 툭 튀어나옴
    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 1.4, 9), stone[1]); ledge.position.set(0, -0.6, -1.0); ledge.scale.z = 1.25; w.add(ledge);
    rock(w, -2.2, -0.3, -0.4, 0.8, 0.6, 0.7); rock(w, 2.1, -0.2, -0.2, 0.7, 0.5, 0.6);
    const wood = toon(0xc08e5e);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 7), wood); leg.position.set(sx * 1.25, 1.55, -1.0 + sz * 0.55); leg.rotation.x = -sz * 0.17; w.add(leg); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 8), wood); beam.rotation.z = Math.PI / 2; beam.position.set(0, 3.2, -1.0); w.add(beam);
    const swing = new THREE.Group(); swing.position.set(0, 3.15, -1.0); w.add(swing);
    const ropeM = toon(0xe8d4a8);
    for (const sx of [-0.42, 0.42]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 5), ropeM); r.position.set(sx, -1.25, 0); r.userData.noLine = true; swing.add(r); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.38), toon(0xd8a26e)); seat.position.y = -2.5; swing.add(seat);
    // 꽃 덩굴: 기둥에 감긴 분홍 꽃
    const fl = [toon(0xf7a8c8), toon(0xffffff), toon(0xf28cb4)];
    for (let i = 0; i < 40; i++) { const sx = i % 2 ? -1 : 1, hh = rnd() * 3.1, f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), fl[i % 3]); f.position.set(sx * (1.25 - hh * 0.0) + (rnd() - 0.5) * 0.15, 0.05 + hh, -1.0 + (rnd() - 0.5) * 0.4); f.userData.noLine = true; w.add(f); }
    for (let i = 0; i < 16; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), fl[i % 3]); f.position.set(-1.3 + i * 0.17, 3.3 + Math.sin(i) * 0.05, -1.0); f.userData.noLine = true; w.add(f); }
    anim.push(t => { swing.rotation.x = Math.sin(t / 1300) * 0.28; });
  }

  // ---------- 봉황바위 (못 가는 곳: 구름바다 위로 솟은 바위 봉우리, 봉황이 여기서 날아옴) ----------
  {
    const pr = new THREE.Group(); pr.position.copy(PHOENIX_ROCK); g.add(pr);
    const pm = [toon(0xd6c6d0), toon(0xe2d4da), toon(0xc8b6c4)];
    // 아래가 굵고 위로 갈수록 가늘게 쌓인 바위 기둥 (구름 아래까지)
    for (let i = 0; i < 18; i++) { const k = i / 17, s = 22 - k * 15; rock(pr, (rnd() - 0.5) * 5 * (1 - k), -60 + i * 3.6, (rnd() - 0.5) * 5 * (1 - k), s * (0.9 + rnd() * 0.2), 4.2, s * (0.8 + rnd() * 0.25), pm[i % 3]); }
    // 옆의 작은 봉우리 둘
    for (const [ox, oz, h] of [[-26, 10, 0.55], [24, 14, 0.42]] as const) for (let i = 0; i < 10; i++) { const k = i / 9, s = 14 - k * 9; rock(pr, ox + (rnd() - 0.5) * 3, -60 + i * 3.6 * h * 2, oz, s, 4, s * 0.9, pm[(i + 1) % 3]); }
    // 꼭대기: 비스듬한 소나무 + 금빛 둥지 (봉황 자리)
    const pine = koreanPine(4.2, -0.5, 4); pine.scale.setScalar(3.2); pine.position.set(-2.5, 3.2, 0.4); pr.add(pine);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 6, 16), toon(0xe6b85a, { emissive: 0x6a4410 })); nest.rotation.x = Math.PI / 2; nest.scale.setScalar(1.6); nest.position.set(2.5, 4.8, 0); pr.add(nest);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffd28a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    halo.scale.set(26, 26, 1); halo.position.set(1, 5, 0); halo.userData.noStyle = true; pr.add(halo);
    // 새긴 글씨 鳳凰臺 (정상에서 보이게 앞면에)
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.6), new THREE.MeshBasicMaterial({ map: carved(['鳳凰臺'], 256, 768, 'rgba(150,90,80,.8)'), transparent: true, depthWrite: false, fog: false }));
    tag.scale.setScalar(1.6); tag.position.set(3.0, -12, 15); tag.lookAt(0, -12, 200); tag.userData.noStyle = true; pr.add(tag);
    anim.push((t, night) => { (halo.material as THREE.SpriteMaterial).opacity = (0.35 + 0.15 * Math.sin(t / 1500)) * (1 - night * 0.6); });
  }

  stylize(g);
  return { update(t: number, night: number) { for (const a of anim) a(t, night); } };
}
