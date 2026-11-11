// 움직이지 않는 장식을 재질별로 하나로 합쳐 그리기 횟수(draw call)를 줄임.
// 폰에서 수천 번이던 그리기를 수백 번으로. 움직이는 것(userData.dynamic)과 투명한 것, 스프라이트는 그대로 둠.
// 땅을 30m 칸으로 나눠 칸마다 따로 합침 (화면 밖 칸은 여전히 안 그림).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CELL = 30;
export function bakeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), tmpM = new THREE.Matrix4(), wp = new THREE.Vector3();
  const cand: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.dynamic || !o.visible)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(m.material)) {
      const mat = m.material as THREE.Material;
      if (!mat.transparent && !(mat as THREE.ShaderMaterial).isShaderMaterial && !(m as unknown as { isReflector?: boolean }).isReflector && m.geometry.attributes.position) cand.push(m);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; order: number }>();
  for (const m of cand) {
    const mat = m.material as THREE.Material & { map?: THREE.Texture | null; vertexColors?: boolean };
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const keep = ['position', 'normal', ...(mat.map ? ['uv'] : []), ...(mat.vertexColors ? ['color'] : [])];
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (keep.some(k => !g.attributes[k])) { g.dispose(); continue; }
    g.morphAttributes = {};
    tmpM.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(tmpM);
    m.getWorldPosition(wp);
    const key = `${mat.uuid}|${keep.join(',')}|${Math.floor(wp.x / CELL)},${Math.floor(wp.z / CELL)}`;
    let b = buckets.get(key); if (!b) { b = { mat, geos: [], order: m.renderOrder }; buckets.set(key, b); }
    b.geos.push(g);
    m.userData.baked = true;
  }
  // 합친 메시를 붙이고, 원래 메시는 떼어 냄 (안 합친 자식은 같은 자리에 남김)
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat); mesh.renderOrder = b.order; mesh.name = 'baked'; mesh.userData.noStyle = true; root.add(mesh);
    if (b.geos.length > 1) for (const g of b.geos) g.dispose();
  }
  for (let i = cand.length - 1; i >= 0; i--) {
    const m = cand[i]; if (!m.userData.baked || !m.parent) continue;
    for (const c of [...m.children]) if (!c.userData.baked) m.parent.attach(c);
    m.parent.remove(m);
  }
  return { meshes: cand.length, draws: buckets.size };
}
