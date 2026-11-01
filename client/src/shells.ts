import * as THREE from 'three';
import type { PlaceId } from '../../server/src/protocol';
import { onPier } from './beach-extras';
import { groundY } from './world';

// 조개 줍기: 해변·날짜마다 같은 자리에 같은 조개 5개.
// 사람마다 따로 줍기 때문에, 내가 주워도 다른 사람의 조개는 그대로 있다.

type Shape = 'fan' | 'clam' | 'spiral' | 'star' | 'urchin' | 'abalone' | 'pearl';
export interface ShellKind { id: string; ko: string; en: string; color: number; shape: Shape; weight: number; places?: PlaceId[]; rare?: boolean }

export const SHELLS: ShellKind[] = [
  { id: 'scallop', ko: '가리비', en: 'Scallop', color: 0xf0a58a, shape: 'fan', weight: 18 },
  { id: 'clam', ko: '바지락', en: 'Clam', color: 0xc9b9a3, shape: 'clam', weight: 20 },
  { id: 'mussel', ko: '홍합', en: 'Mussel', color: 0x2f3348, shape: 'clam', weight: 14 },
  { id: 'cockle', ko: '꼬막', en: 'Cockle', color: 0xe8dcc6, shape: 'fan', weight: 14 },
  { id: 'whelk', ko: '고둥', en: 'Whelk', color: 0xb98e6a, shape: 'spiral', weight: 12 },
  { id: 'oyster', ko: '굴 껍데기', en: 'Oyster shell', color: 0x9da39a, shape: 'clam', weight: 10 },
  { id: 'cowrie', ko: '개오지', en: 'Cowrie', color: 0xe6c27a, shape: 'clam', weight: 5 },
  { id: 'starfish', ko: '불가사리', en: 'Starfish', color: 0xff8a4d, shape: 'star', weight: 4 },
  { id: 'urchin', ko: '성게 껍데기', en: 'Urchin shell', color: 0xa77cc4, shape: 'urchin', weight: 4 },
  { id: 'turban', ko: '소라', en: 'Turban shell', color: 0x7a8a6a, shape: 'spiral', weight: 6, places: ['seongsan'], rare: true },
  { id: 'abalone', ko: '전복 껍데기', en: 'Abalone shell', color: 0x7ab0b8, shape: 'abalone', weight: 5, places: ['homigot', 'jeongdongjin', 'jumunjin'], rare: true },
  { id: 'paua', ko: '파우아', en: 'Pāua', color: 0x3fb5a8, shape: 'abalone', weight: 6, places: ['gisborne'], rare: true },
  { id: 'pearl', ko: '진주', en: 'Pearl', color: 0xf6f2ff, shape: 'pearl', weight: 0.6, rare: true },
];
export const PER_DAY = 5;

/** 날짜·장소로 늘 같은 난수 */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function pickKind(place: PlaceId, r: () => number) {
  // 다른 해변의 희귀 조개는 아주 가끔만 (흘러 들어온 것)
  const w = SHELLS.map(k => (k.places && !k.places.includes(place) ? k.weight * 0.08 : k.weight));
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}

const M = (c: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
function shellMesh(k: ShellKind) {
  const g = new THREE.Group();
  if (k.shape === 'fan') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.03, 0.035, 9, 1, false, -Math.PI / 2, Math.PI), M(k.color, { flatShading: true }));
    m.rotation.y = Math.PI / 2; g.add(m);
  } else if (k.shape === 'clam' || k.shape === 'pearl') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), M(k.shape === 'pearl' ? 0xb9a58f : k.color));
    m.scale.set(1.1, 0.4, 0.8); g.add(m);
    if (k.shape === 'pearl') {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: k.color }));
      p.position.y = 0.05; g.add(p);
    }
  } else if (k.shape === 'spiral') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), M(k.color, { flatShading: true }));
    m.rotation.z = Math.PI / 2; m.position.y = 0.05; g.add(m);
  } else if (k.shape === 'star') {
    for (let i = 0; i < 5; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.05), M(k.color));
      arm.geometry.translate(0.085, 0, 0); arm.rotation.y = (i / 5) * Math.PI * 2; g.add(arm);
    }
  } else if (k.shape === 'urchin') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M(k.color, { flatShading: true }));
    m.scale.y = 0.6; g.add(m);
  } else if (k.shape === 'abalone') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 6), new THREE.MeshPhongMaterial({ color: k.color, shininess: 90, specular: 0xd0f0ff }));
    m.scale.set(1.1, 0.3, 0.75); g.add(m);
  }
  return g;
}

interface Placed { i: number; kind: number; g: THREE.Group; spark: THREE.Sprite; x: number; z: number; picked: number }

export function createShells(scene: THREE.Scene, GLOW: THREE.Texture) {
  let list: Placed[] = [];

  function clear() {
    for (const p of list) { scene.remove(p.g); p.g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); p.spark.material.dispose(); }
    list = [];
  }

  /** 오늘 이 해변의 조개 놓기 (이미 주운 번호는 빼고) */
  function set(place: PlaceId, day: string, got: number[]) {
    clear();
    const r = rng(`${place}|${day}`);
    for (let i = 0; i < PER_DAY; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 10; tries++) {
        x = (r() * 2 - 1) * 19; z = -1.7 + r() * 2.6;
        if (!onPier(x, z) && Math.abs(x - 17.5) > 1.5) break; // 데크 밑·낚시꾼 자리 피하기
      }
      const kind = pickKind(place, r), rot = r() * Math.PI * 2;
      if (got.includes(i)) continue;
      const g = shellMesh(SHELLS[kind]);
      g.position.set(x, groundY(z) + 0.02, z); g.rotation.y = rot;
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xfff3c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      spark.position.set(x, groundY(z) + 0.18, z); spark.scale.set(0.5, 0.5, 1);
      scene.add(g, spark);
      list.push({ i, kind, g, spark, x, z, picked: -1 });
    }
  }

  /** 가까이 가면 자동으로 줍는다. 주운 조개를 돌려준다 */
  function update(dt: number, t: number, me: THREE.Vector3): { i: number; kind: number } | null {
    let got: { i: number; kind: number } | null = null;
    for (let n = list.length - 1; n >= 0; n--) {
      const p = list[n];
      if (p.picked >= 0) {
        // 주우면 살짝 떠올랐다가 사라짐
        p.picked += dt;
        const k = p.picked / 0.6;
        p.g.position.y = groundY(p.z) + 0.02 + k * 0.9; p.g.rotation.y += dt * 8;
        p.spark.material.opacity = 1 - k; p.spark.position.y = p.g.position.y + 0.1;
        if (k >= 1) { scene.remove(p.g, p.spark); list.splice(n, 1); }
        continue;
      }
      // 반짝반짝: 1.6초마다 한 번씩 번쩍
      const tw = Math.pow(Math.max(0, Math.sin(t / 260 + p.i * 1.7)), 6);
      p.spark.material.opacity = 0.25 + tw * 0.75;
      p.spark.scale.setScalar(0.35 + tw * 0.45);
      if (!got && Math.hypot(me.x - p.x, me.z - p.z) < 0.9) { p.picked = 0; got = { i: p.i, kind: p.kind }; }
    }
    return got;
  }
  return { set, clear, update, get left() { return list.filter(p => p.picked < 0).length; } };
}
