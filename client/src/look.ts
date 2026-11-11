import * as THREE from 'three';

/** 맵 미감: A(운해 파스텔)가 기본. ?look=b|c|base 로 다른 시안 비교 */
export type LookId = 'base' | 'a' | 'b' | 'c';
type Stop = [number, number, number, number];
export interface Look {
  name: string;
  sky?: Stop[];
  ground: { grass: number; grass2: number; dry: number; stone: number; path: number; field: number };
  rock: number[]; granite: number[]; pine: [number, number]; dead: number; bush: number[];
  flowers: number[];
  cloudDay: number; cloudNight: number; cloudLine: string;
  ridges: number[]; ridgeNight: number;
  fog: [number, number];
  hemi: number; sun: number; hemiGround: number; nightLift: number;
  line: number; lineW: number; darkLift: number;
}
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** 기본은 A(운해 파스텔). ?look=base 면 예전 모습 */
export const LOOK_ID = (['a', 'b', 'c', 'base'].includes(params.get('look') ?? '') ? params.get('look') : 'a') as LookId;

const LOOKS: Record<Exclude<LookId, 'base'>, Look> = {
  // A. 운해 파스텔: 프사 병아리처럼 크림 종이 위 옅은 수채. 따뜻한 복숭아·연보라 능선
  a: {
    name: '운해 파스텔',
    sky: [
      [-18, 0x2c3566, 0x46508e, 0x6e6aa2],
      [-10, 0x4d4f8e, 0x8a7fb0, 0xd29fae],
      [-5, 0x8c86c4, 0xf0b8b0, 0xffd2b0],
      [-1.5, 0xc8b4dc, 0xffd0b4, 0xffe4c4],
      [1.5, 0xd8c8e8, 0xffe0c4, 0xfff0d8],
      [5, 0xc4d8f0, 0xfdeedc, 0xfff6e6],
      [12, 0x9cc8ec, 0xdcecf4, 0xfbf6ea],
    ],
    ground: { grass: 0xb4cf8e, grass2: 0x9fc184, dry: 0xead9a8, stone: 0xd8c8b2, path: 0xf6ead0, field: 0x8fbb78 },
    rock: [0xcdbcc4, 0xd8c8cc, 0xbcaab6], granite: [0xd6c6c8, 0xe0d2d0, 0xc8b8bc],
    pine: [0x7fb27e, 0x94c28c], dead: 0xf2ebe0, bush: [0xa8c88a, 0xf4b4c8, 0x9cc084],
    flowers: [0xf7a8c8, 0xf28cb4, 0xfbd0e0, 0xffffff, 0xe878a8],
    cloudDay: 0xfffaf2, cloudNight: 0x6a6ea0, cloudLine: 'rgba(200,150,160,0.55)',
    ridges: [0xc8b4d4, 0xd6c4dc, 0xe2d4e6, 0xecdfee, 0xf4ecf4], ridgeNight: 0x2a2c55,
    fog: [80, 620], hemi: 1.0, sun: 1.0, hemiGround: 0x8a6e6a, nightLift: 0.12,
    line: 0x5a4648, lineW: 0.035, darkLift: 0x8a6252,
  },
  // B. 민화 겹능선: 한지 하늘 + 쪽빛·청록 능선이 겹겹이, 먹선 테두리, 오방색 꽃
  b: {
    name: '민화 겹능선',
    sky: [
      [-18, 0x1c2a40, 0x2c4058, 0x46607a],
      [-10, 0x34485e, 0x6a7a88, 0xb0a08c],
      [-5, 0x6a8090, 0xd8b898, 0xf2d2a8],
      [-1.5, 0xa8b8b8, 0xf0d8b4, 0xf8e6c4],
      [1.5, 0xc0ccc4, 0xf6e6c8, 0xfaf0da],
      [5, 0xc8d8d0, 0xf4ecda, 0xfaf4e6],
      [12, 0xa8ccc8, 0xe4eee6, 0xf8f4e8],
    ],
    ground: { grass: 0xa6c49a, grass2: 0x8eb488, dry: 0xd8cfa8, stone: 0xbfc0b4, path: 0xf0e4c6, field: 0x7aa47c },
    rock: [0x8e9aa0, 0x9ea8aa, 0x7e8a92], granite: [0xb0b6b4, 0xbcc2be, 0xa2aaa8],
    pine: [0x3e7a6a, 0x4f8c76], dead: 0xeee8da, bush: [0x8eb488, 0xd8586e, 0x7ea47c],
    flowers: [0xd8465e, 0xf0b836, 0xffffff, 0xe86a8a, 0x3e6eb0],
    cloudDay: 0xfdfbf4, cloudNight: 0x55667a, cloudLine: 'rgba(40,50,60,0.6)',
    ridges: [0x4e7a7c, 0x6a9290, 0x8aaca6, 0xaac4bc, 0xcadcd2], ridgeNight: 0x122030,
    fog: [90, 700], hemi: 0.95, sun: 1.0, hemiGround: 0x5a6a5e, nightLift: 0.1,
    line: 0x23282c, lineW: 0.045, darkLift: 0x6e5240,
  },
  // C. 선명 동화: A Short Hike처럼 채도 높은 초록 + 라벤더 바위, 꽃밭은 유채·핑크·보라 띠
  c: {
    name: '선명 동화',
    sky: [
      [-18, 0x141c48, 0x22307a, 0x3c4a9c],
      [-10, 0x2c3a8a, 0x6a5aa8, 0xe07a8a],
      [-5, 0x5a64c0, 0xff9a86, 0xffbc7a],
      [-1.5, 0x8aa0e0, 0xffc08e, 0xffd89a],
      [1.5, 0x8cb4ee, 0xffd8a8, 0xffeac0],
      [5, 0x78b4f0, 0xcfe6f6, 0xfff2d4],
      [12, 0x5ea8ee, 0xb6dcf6, 0xf0f6f2],
    ],
    ground: { grass: 0x86c66c, grass2: 0x6eb45e, dry: 0xc8d470, stone: 0xb8b2cc, path: 0xf4d8a0, field: 0x5ea452 },
    rock: [0x9a90c0, 0xaaa0cc, 0x8a80b2], granite: [0xb4aed0, 0xc0bad8, 0xa49ec4],
    pine: [0x2f8a6a, 0x3ea078], dead: 0xf4ecdc, bush: [0x6eb45e, 0xff8aa8, 0x5ea452],
    flowers: [0xffd83a, 0xff8ab4, 0xb07ae0, 0xffffff, 0xff6a6a],
    cloudDay: 0xffffff, cloudNight: 0x4a5a9a, cloudLine: 'rgba(120,110,170,0.6)',
    ridges: [0x6a8acc, 0x86a2d6, 0xa2b8e0, 0xbecceb, 0xd8e0f2], ridgeNight: 0x101848,
    fog: [110, 760], hemi: 1.0, sun: 1.15, hemiGround: 0x6a7a5a, nightLift: 0.14,
    line: 0x2c2440, lineW: 0.04, darkLift: 0x7a4a3a,
  },
};
export const LOOK: Look | null = LOOK_ID === 'base' ? null : LOOKS[LOOK_ID];

const hex = (c: number) => new THREE.Color(c);
/** 하늘 정지점 (world.ts의 SKY 형식) */
export function lookSky(): [number, THREE.Color, THREE.Color, THREE.Color][] | null {
  return LOOK?.sky ? LOOK.sky.map(([a, t, m, l]) => [a, hex(t), hex(m), hex(l)]) : null;
}

/** 병아리와 같은 그림체로: 플랫 툰 재질 + 먹선 테두리. 너무 어두운 색(검은 지붕 등)은 따뜻한 갈색 쪽으로 끌어올림 */
const grad = (() => { const d = new Uint8Array([200, 236, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const cache = new Map<THREE.Material, THREE.Material>();
export function stylize(root: THREE.Object3D, opt: { outline?: boolean; minSize?: number } = {}) {
  const L = LOOK; if (!L) return;
  root.updateMatrixWorld(true);
  const lineM = new THREE.MeshBasicMaterial({ color: L.line, side: THREE.BackSide });
  const lift = hex(L.darkLift), hsl = { h: 0, s: 0, l: 0 };
  const toon = (m: THREE.Material) => {
    if (cache.has(m)) return cache.get(m)!;
    const lm = m as THREE.MeshLambertMaterial;
    if ((m as any).isMeshToonMaterial) { const tm = m as THREE.MeshToonMaterial, l2 = tm.color.getHSL(hsl).l; if (l2 < 0.32 && !tm.map) { const t2 = tm.clone(); t2.color.lerp(lift, 0.6); cache.set(m, t2); return t2; } cache.set(m, m); return m; }
    if (!(lm as any).isMeshLambertMaterial && !(lm as any).isMeshStandardMaterial && !(lm as any).isMeshPhongMaterial) { cache.set(m, m); return m; }
    const c = lm.color.clone(); c.getHSL(hsl);
    if (hsl.l < 0.32 && !lm.map) c.lerp(lift, 0.6);
    const t = new THREE.MeshToonMaterial({ color: c, map: lm.map ?? null, gradientMap: grad, transparent: lm.transparent, opacity: lm.opacity, vertexColors: lm.vertexColors, side: lm.side });
    t.emissive.copy(c).multiplyScalar(lm.vertexColors || lm.map ? 0 : 0.18);
    if ((lm as any).emissive && (lm as any).emissive.getHex() !== 0) t.emissive.copy((lm as any).emissive);
    t.userData = { ...lm.userData };
    cache.set(m, t); return t;
  };
  const hulls: [THREE.Mesh, THREE.Mesh][] = [];
  root.traverse(o => {
    const me = o as THREE.Mesh;
    if (!me.isMesh || (me as any).isInstancedMesh || o.userData.noStyle) return;
    me.material = Array.isArray(me.material) ? me.material.map(toon) : toon(me.material);
    if (opt.outline === false || o.userData.noLine) return;
    const g = me.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    const ws = new THREE.Vector3(); me.getWorldScale(ws);
    const r = g.boundingSphere!.radius * Math.max(ws.x, ws.y, ws.z);
    if (r < (opt.minSize ?? 0.12) || r > 40) return;
    const mats = Array.isArray(me.material) ? me.material : [me.material];
    if (mats.some(m => m.transparent)) return;
    hulls.push([me, new THREE.Mesh(g, lineM)]);
  });
  for (const [me, h] of hulls) {
    const ws = new THREE.Vector3(); me.getWorldScale(ws);
    const k = L.lineW;
    h.scale.set(1 + k / Math.max(0.05, ws.x * (me.geometry.boundingSphere!.radius)), 1 + k / Math.max(0.05, ws.y * (me.geometry.boundingSphere!.radius)), 1 + k / Math.max(0.05, ws.z * (me.geometry.boundingSphere!.radius)));
    h.userData.noStyle = true; h.raycast = () => {};
    me.add(h);
  }
}
