import * as THREE from 'three';
import type { PlaceId } from '../../server/src/protocol';
import type { Place } from './places';
import { sunPos } from './sun';

const rad = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 해 고도별 하늘색 (위, 중간, 지평선) */
const C = (r: number, g: number, b: number) => new THREE.Color(r / 255, g / 255, b / 255);
const SKY: [number, THREE.Color, THREE.Color, THREE.Color][] = [
  [-18, C(4, 6, 26), C(9, 13, 42), C(17, 22, 58)],
  [-10, C(10, 16, 51), C(36, 39, 90), C(74, 58, 110)],
  [-5, C(26, 44, 104), C(92, 86, 146), C(226, 140, 112)],
  [0, C(48, 86, 160), C(150, 132, 170), C(255, 196, 140)],
  [4, C(72, 126, 194), C(170, 178, 205), C(255, 226, 180)],
  [12, C(90, 152, 210), C(152, 196, 232), C(230, 240, 246)],
];

/** 앉을 자리. 방석·데크는 바다(ry 0)를, 통나무는 모닥불을 바라본다.
 *  bench(통나무·데크 끝)면 y가 엉덩이 높이, sx·sz는 일어날 때 내려설 자리 */
export interface Seat { x: number; z: number; occ: string | null; ry: number; y?: number; bench?: boolean; kind?: 'log' | 'pier' | 'bus' | 'rock'; sx?: number; sz?: number; places?: PlaceId[] }

/** 해안선은 z = -3. 뒤로 갈수록 모래사장이 살짝 높아진다 */
export const groundY = (z: number) => Math.max(0, (z + 3) * 0.05 - 0.06);

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, GLOW: THREE.Texture) {
  scene.fog = new THREE.Fog(0x000000, 50, 560);
  const top = new THREE.Color(), mid = new THREE.Color(), low = new THREE.Color();
  function skyAt(alt: number) {
    if (alt <= SKY[0][0]) { top.copy(SKY[0][1]); mid.copy(SKY[0][2]); low.copy(SKY[0][3]); return; }
    for (let i = 1; i < SKY.length; i++) {
      if (alt <= SKY[i][0]) {
        const a = SKY[i - 1], b = SKY[i], k = (alt - a[0]) / (b[0] - a[0]);
        top.copy(a[1]).lerp(b[1], k); mid.copy(a[2]).lerp(b[2], k); low.copy(a[3]).lerp(b[3], k);
        return;
      }
    }
    const l = SKY[SKY.length - 1]; top.copy(l[1]); mid.copy(l[2]); low.copy(l[3]);
  }

  // ---------- 하늘 ----------
  const skyU = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0, -1) }, glow: { value: 0 }, stars: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform float glow; uniform float stars;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(0.0, 0.16, h));
        c = mix(c, top, smoothstep(0.16, 0.75, h));
        if(h < 0.0) c = low;
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0, 0.55, 0.3) * pow(s, 5.0) * 0.3 * glow;
        c += vec3(1.0, 0.8, 0.55) * pow(s, 60.0) * 0.4 * glow;
        c += vec3(step(0.9965, hash(floor(d * 520.0))) * stars * smoothstep(0.03, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -2; scene.add(sky);

  // ---------- 해 ----------
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffaa66, fog: false }));
  sunMesh.renderOrder = -1; scene.add(sunMesh);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa060, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  sunGlow.renderOrder = -1; scene.add(sunGlow);
  const glareSprite = (color: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true })); s.renderOrder = 5; scene.add(s); return s; };
  // [스프라이트, 크기, 최대 밝기]
  const glare: [THREE.Sprite, number, number][] = [[glareSprite(0xffffff), 70, 1], [glareSprite(0xfff2c8), 170, 0.75], [glareSprite(0xffd890), 420, 0.35]];
  const rays = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d')!; g.translate(256, 256);
    for (let i = 0; i < 18; i++) {
      g.rotate((Math.PI * 2) / 18 + (i % 3) * 0.05);
      const len = 150 + (i % 4) * 40, gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, 'rgba(255,250,230,0.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(len, -9 - (i % 2) * 6); g.lineTo(len, 9 + (i % 2) * 6); g.lineTo(0, 3); g.fill();
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true }));
    s.renderOrder = 5; scene.add(s); return s;
  })();

  // ---------- 바다 (물결 노멀 + 해의 길 반사) ----------
  const seaU = {
    sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, deep: { value: new THREE.Color() },
    skyLow: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() }, sunUp: { value: 0 }, time: { value: 0 },
    shallow: { value: new THREE.Color() }, day: { value: 0 },
  };
  const seaGeo = new THREE.PlaneGeometry(6000, 6000, 1, 1); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 deep; uniform vec3 skyLow; uniform vec3 fogCol; uniform float sunUp; uniform float time; uniform vec3 shallow; uniform float day;
      varying vec3 vW;
      void main(){
        vec3 n = normalize(vec3(
          sin(vW.x*0.9 + time*1.6)*0.05 + sin(vW.z*1.7 + vW.x*0.4 + time*2.1)*0.04 + sin(vW.x*3.1 - time*2.7)*0.02,
          1.0,
          cos(vW.z*1.1 + time*1.3)*0.06 + cos(vW.x*2.3 + vW.z*0.7 - time*1.9)*0.03));
        vec3 v = normalize(vW - cameraPosition);
        vec3 r = reflect(v, n);
        float fres = pow(1.0 - max(dot(-v, n), 0.0), 3.0);
        // 바다 고유의 색: 먼 바다는 짙은 파랑, 해변 가까이는 옥색. 하늘 반사는 비스듬할수록 조금만
        vec3 c = mix(deep, skyLow * 0.8, fres * mix(0.95, 0.45, day));
        float shore = smoothstep(-40.0, -3.0, vW.z) * day;
        c = mix(c, shallow, shore * 0.6);
        // 잔물결 하이라이트 (낮에 반짝임)
        c += vec3(0.9, 0.95, 1.0) * pow(max(n.x * 3.0 + n.z * 2.0, 0.0), 6.0) * 0.12 * day;
        float sd = max(dot(r, sunDir), 0.0);
        c += sunCol * (pow(sd, 140.0) * 2.4 + pow(sd, 14.0) * 0.28) * sunUp;
        c = mix(c, fogCol, smoothstep(120.0, 1100.0, length(vW - cameraPosition)) * mix(1.0, 0.7, day));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  scene.add(sea);

  // ---------- 모래사장 ----------
  const sandGeo = new THREE.PlaneGeometry(400, 90, 60, 18); sandGeo.rotateX(-Math.PI / 2); sandGeo.translate(0, 0, 42);
  const pos = sandGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, (z + 3) * 0.05 - 0.06 + Math.sin(x * 0.15) * Math.max(0, z - 20) * 0.02);
  }
  sandGeo.computeVertexNormals();
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xcdb28a });
  const sandMesh = new THREE.Mesh(sandGeo, sandMat); scene.add(sandMesh);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(400, 1.6), new THREE.MeshLambertMaterial({ color: 0x8f7a5e, transparent: true, opacity: 0.7 }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.012, -2.4); scene.add(wet);
  /** 땅 색 바꾸기: 한강은 잔디와 콘크리트 강변 */
  function setGround(id: string) {
    // 경복궁: 바다 대신 돌 광장, 해변 방석은 치움
    // 산 정상: 바다·모래·방석 대신 산 지형 (mountain-scenery)
    const peak = id === 'jirisan' || id === 'hallasan';
    sea.visible = !peak; wet.visible = !peak; matGroup.visible = !peak; sandMesh.visible = !peak;
    // 섭지코지는 검은 현무암 해안
    sandMat.color.setHex(id === 'hangang' ? 0x6f8b56 : id === 'seopjikoji' ? 0x4a4442 : 0xcdb28a);
    (wet.material as THREE.MeshLambertMaterial).color.setHex(id === 'hangang' ? 0x9a9a94 : 0x8f7a5e);
    (wet.material as THREE.MeshLambertMaterial).opacity = id === 'hangang' ? 1 : 0.7;
  }

  // ---------- 조명 ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a2c24, 0.5); scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8); scene.add(sunLight);
  const moon = new THREE.AmbientLight(0x8a9ad8, 0.35); scene.add(moon);

  // ---------- 방석 (서버와 같은 번호 순서: 22개) ----------
  const seats: Seat[] = [];
  const matColors = [0xc9786a, 0xd8a35b, 0x7f9a7a, 0x8d86b8, 0xb98a9e];
  const matGeo = new THREE.BoxGeometry(1.25, 0.07, 1.0);
  const matGroup = new THREE.Group(); scene.add(matGroup);
  for (const [z, n] of [[2.6, 7], [5.2, 8], [7.8, 7]] as const) {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 2.3;
      const m = new THREE.Mesh(matGeo, new THREE.MeshLambertMaterial({ color: matColors[(i + Math.round(z)) % matColors.length] }));
      m.position.set(x, groundY(z) + 0.035, z); matGroup.add(m);
      seats.push({ x, z, occ: null, ry: 0 });
    }
  }

  // ---------- 장소별 랜드마크 ----------
  const landmark = new THREE.Group(); scene.add(landmark);
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const rock = (x: number, z: number, s: number) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), lam(0x4b4641));
    m.scale.set(s * 1.4, s * 0.8, s); m.position.set(x, s * 0.25, z); m.rotation.y = x; landmark.add(m);
  };
  const dome = (c: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), lam(c));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); landmark.add(m);
  };
  function buildLandmark(place: Place) {
    landmark.clear();
    if (place.id === 'jirisan' || place.id === 'hallasan' || place.id === 'seopjikoji') return;
    if (place.id !== 'hangang') { rock(-15, -1.5, 1.6); rock(-17.5, 0.5, 1.1); rock(16, -1, 1.4); rock(18.5, 2, 0.9); }
    if (place.id === 'seongsan') {
      dome(0x3d5640, 80, 38, 60, -150, -4, -260);
      const crater = new THREE.Mesh(new THREE.CylinderGeometry(42, 52, 4, 24), lam(0x34492f));
      crater.position.set(-150, 32, -260); landmark.add(crater);
    } else if (place.id === 'homigot') {
      const g = new THREE.Group(), m = lam(0x60656c);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.6), m); palm.position.y = 2.6; g.add(palm);
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 8), m); wrist.position.y = 0.8; g.add(wrist);
      [1.3, 1.6, 1.5, 1.1].forEach((len, i) => {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, len, 8), m);
        f.position.set(-0.66 + i * 0.44, 3.8 + len / 2 - 0.1, 0); g.add(f);
      });
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.2, 8), m);
      th.position.set(-1.25, 2.6, 0); th.rotation.z = 0.8; g.add(th);
      g.position.set(9, -0.3, -24); g.rotation.y = -0.3; landmark.add(g);
    } else if (place.id === 'gisborne') {
      dome(0x3b4a37, 180, 26, 50, 190, -3, -280);
    } else {
      dome(0x3a4038, 30, 7, 12, 120, -1, -320);
    }
  }

  // ---------- 매 프레임: 해 위치에 맞춰 하늘·바다·조명 갱신 ----------
  const sunDir = new THREE.Vector3(), sunCol = new THREE.Color(), deep = new THREE.Color(), tmp = new THREE.Color();
  const SEA_DEEP = new THREE.Color(0x13567f), SEA_SHALLOW = new THREE.Color(0x3fb0b8);
  /** wide: 5분 순환처럼 해가 하늘을 한 바퀴 다 돌 때 (해는 앞에서 떠서 뒤쪽으로 짐) */
  function update(now: number, place: Place, refSunrise: number, camera: THREE.Camera, t: number, wide = false) {
    const sp = sunPos(now, place.lat, place.lng);
    const az0 = sunPos(refSunrise, place.lat, place.lng).az; // 일출 방향을 화면 정면(-z)에 맞춤
    const lim = wide ? 180 : 70;
    const alt = sp.alt, daz = clamp(((sp.az - az0 + 540) % 360) - 180, -lim, lim) * rad, ar = alt * rad;
    sunDir.set(Math.sin(daz) * Math.cos(ar), Math.sin(ar), -Math.cos(daz) * Math.cos(ar)).normalize();
    skyAt(alt);
    skyU.top.value.copy(top); skyU.mid.value.copy(mid); skyU.low.value.copy(low); skyU.sunDir.value.copy(sunDir);
    const glow = clamp((alt + 9) / 10, 0, 1);
    skyU.glow.value = glow;
    skyU.stars.value = clamp((-alt - 5) / 9, 0, 1);
    sky.position.copy(camera.position);

    const warm = clamp(alt / 12, 0, 1);
    sunCol.setRGB(1, 0.62 + 0.34 * warm, 0.42 + 0.5 * warm);
    (sunMesh.material as THREE.MeshBasicMaterial).color.copy(sunCol);
    sunMesh.position.copy(camera.position).addScaledVector(sunDir, 850);
    sunMesh.visible = alt > -3;
    sunGlow.position.copy(sunMesh.position);
    sunGlow.material.color.copy(sunCol);
    const gs = 110 + 60 * glow;
    sunGlow.scale.set(gs, gs, 1); sunGlow.material.opacity = glow * 0.38; sunGlow.visible = glow > 0.01;
    // 눈부심: 하얗게 타는 중심 + 넓게 번지는 빛 + 빛줄기 (해가 지평선 근처일 때 가장 강하게)
    const up = clamp((alt + 1.2) / 3, 0, 1), nearH = 1 - clamp((alt - 6) / 20, 0, 0.6);
    for (const [s, sc, op] of glare) {
      s.position.copy(sunMesh.position); s.visible = up > 0.01;
      s.scale.set(sc, sc, 1); s.material.opacity = op * up * nearH;
    }
    rays.position.copy(sunMesh.position); rays.visible = up > 0.01;
    rays.material.opacity = 0.3 * up * nearH; rays.material.rotation = t / 9000;
    rays.scale.set(400, 400, 1);

    // 낮일수록 하늘색 대신 바다 고유의 파란색 (회색 흙탕물처럼 보이지 않게)
    const day = clamp((alt + 2) / 14, 0, 1);
    deep.copy(top).multiplyScalar(0.45).lerp(SEA_DEEP, day * 0.85);
    seaU.shallow.value.copy(SEA_SHALLOW).multiplyScalar(0.55 + 0.45 * day); seaU.day.value = day;
    seaU.sunDir.value.copy(sunDir); seaU.sunCol.value.copy(sunCol); seaU.deep.value.copy(deep);
    seaU.skyLow.value.copy(low); seaU.fogCol.value.copy(low);
    seaU.sunUp.value = clamp((alt + 1.5) / 5, 0, 1); seaU.time.value = t / 1000;
    (scene.fog as THREE.Fog).color.copy(low); renderer.setClearColor(low);

    // three.js 최신 버전은 조명 단위가 물리 기반이라 π를 곱해 예전 밝기에 맞춤
    const dayK = clamp((alt + 6) / 18, 0, 1);
    hemi.color.copy(mid).multiplyScalar(0.6).add(tmp.setRGB(0.24, 0.26, 0.4));
    // 해가 낮게 떠 있을 땐 역광: 주변광을 줄여 앞쪽 바위·사람이 실루엣처럼 어둡게 → 해가 더 빛남
    const backlit = clamp(1 - Math.abs(alt - 1.5) / 7, 0, 1);
    hemi.intensity = (0.75 + 0.3 * dayK) * (1 - 0.45 * backlit) * Math.PI;
    moon.intensity = 0.4 * (1 - dayK) * Math.PI;
    sunLight.color.copy(sunCol);
    sunLight.intensity = clamp((alt + 2) / 8, 0, 1) * 0.95 * Math.PI;
    sunLight.position.copy(sunDir).multiplyScalar(50);
    return alt;
  }

  return { seats, buildLandmark, update, setGround, skyLow: low, sunDir };
}
