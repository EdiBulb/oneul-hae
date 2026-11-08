/**
 * 새 그리기 — 깃털로 만든 날개 (아래에서 올려다본 모습, 머리가 화면 아래 = 나를 향해 날아옴)
 * 단위: 날개 반폭 = 1. 디자인 시안(새 날개 디자인 v2)과 같은 코드
 */
type V = [number, number];
type G = CanvasRenderingContext2D;
export type DrawSp = { name: string; arm: number; chord: number; bend: number; prim: number; sec: number; finger: number; tip: 'round' | 'point'; tail: 'fan' | 'fork' | 'short'; tailN: number; tailL: number; neck: number; head: number; beak: number };
type Skel = ReturnType<typeof skel>;
type Tip = { base: V; d: V; L: number; tip: V; t: number };
type Tips = { prim: Tip[]; sec: Tip[] };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (v: V): V => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const add = (p: V, d: V, k: number): V => [p[0] + d[0] * k, p[1] + d[1] * k];
const rot = (v: V, r: number): V => [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)];
const back = (u: V): V => [u[1], -u[0]]; // 날개 방향 → 꼬리 쪽(뒤)

// arm: 팔(어깨~손목) 비율, chord: 날개 폭, prim/sec: 첫째·둘째 날개깃 수, finger: 날개 끝이 손가락처럼 벌어짐
export const DRAW_SP = {
  goose:   { name: '기러기', arm: 0.44, chord: 0.38, bend: 0.12, prim: 8,  sec: 9,  finger: 0.9, tip: 'round', tail: 'fan',  tailN: 8,  tailL: 0.15,  neck: 0.4,  head: 0.05, beak: 0.07 },
  gull:    { name: '갈매기', arm: 0.48, chord: 0.31, bend: 0.5,  prim: 8,  sec: 9,  finger: 0,   tip: 'point', tail: 'fan',  tailN: 10, tailL: 0.15,  neck: 0.12, head: 0.055, beak: 0.06 },
  swallow: { name: '제비',   arm: 0.34, chord: 0.26, bend: 0.35, prim: 8,  sec: 6,  finger: 0,   tip: 'point', tail: 'fork', tailN: 8,  tailL: 0.22, neck: 0.04, head: 0.06, beak: 0.025 },
  small:   { name: '작은 새', arm: 0.4, chord: 0.36, bend: 0.12, prim: 7,  sec: 6,  finger: 0.3, tip: 'round', tail: 'short',tailN: 8,  tailL: 0.14, neck: 0.05, head: 0.065, beak: 0.04 },
  golden:  { name: '황금 새', arm: 0.43, chord: 0.42, bend: 0.28, prim: 9,  sec: 10, finger: 1,   tip: 'round', tail: 'fan',  tailN: 12, tailL: 0.22,  neck: 0.16, head: 0.055, beak: 0.06 },
} satisfies Record<string, DrawSp>;

function skel(sp: DrawSp, f: number) {
  const a = f * 0.7 + 0.08, b = a * 1.3 - sp.bend;
  const fs = 0.82 + 0.18 * Math.cos(f * 1.1); // 날개를 올리고 내릴 때 살짝 짧아 보임
  const armL = sp.arm * fs, handL = (0.96 - sp.arm) * fs;
  const S: V = [0.06, 0.02], u1: V = [Math.cos(a), -Math.sin(a)], u2: V = [Math.cos(b), -Math.sin(b)];
  const Wr = add(S, u1, armL), T = add(Wr, u2, handL);
  return { S, Wr, T, u1, u2, n1: back(u1), n2: back(u2), armL, handL, c: sp.chord * (0.9 + 0.1 * fs), spread: 0.5 - f * 0.5 };
}

// 날개깃 끝점들: 첫째 날개깃(바깥 → 안), 둘째 날개깃(손목 → 몸)
function featherTips(sp: DrawSp, k: Skel) {
  const prim: Tip[] = [], sec: Tip[] = [];
  for (let j = sp.prim - 1; j >= 0; j--) {
    const t = j / (sp.prim - 1);
    const base = add(k.Wr, k.u2, k.handL * (0.08 + 0.5 * t));
    let d = norm([lerp(k.n2[0], k.u2[0], 0.22 + 0.72 * Math.pow(t, 1.15)), lerp(k.n2[1], k.u2[1], 0.22 + 0.72 * Math.pow(t, 1.15))]);
    if (sp.finger && t > 0.45) d = rot(d, -(t - 0.45) * 0.35 * sp.finger * (0.4 + k.spread)); // 날개 끝 벌어짐
    const L = lerp(k.c * 0.92, k.handL * 0.5, Math.pow(t, 1.3));
    prim.push({ base, d, L, tip: add(base, d, L), t });
  }
  for (let i = 0; i < sp.sec; i++) {
    const t = i / (sp.sec - 1), base = add(k.S, k.u1, k.armL * (1 - t) * 0.98);
    const d = norm(add(k.n1, k.u1, 0.22 - t * 0.3)), L = k.c * (0.95 - 0.12 * t);
    sec.push({ base, d, L, tip: add(base, d, L), t });
  }
  return { prim, sec };
}

// 날개 전체 윤곽: 매끈한 앞 가장자리 + 깃털 끝이 만드는 물결 뒷가장자리
function wingPath(g: G, sp: DrawSp, k: Skel, ft: Tips) {
  const c = k.c, front: V = [-k.n1[0], -k.n1[1]], frontH: V = [-k.n2[0], -k.n2[1]];
  const S0 = add(k.S, front, c * 0.06), W0 = add(k.Wr, front, c * 0.05);
  g.beginPath(); g.moveTo(S0[0], S0[1]);
  const mA = add(add(k.S, k.u1, k.armL * 0.5), front, c * 0.12);
  g.quadraticCurveTo(mA[0], mA[1], W0[0], W0[1]);
  const T = ft.prim[0].tip, mH = add(add(k.Wr, k.u2, k.handL * 0.5), frontH, c * 0.05);
  g.quadraticCurveTo(mH[0], mH[1], T[0], T[1]);
  const all = [...ft.prim, ...ft.sec];
  for (let i = 1; i < all.length; i++) {
    const A = all[i - 1], B = all[i], isPrim = i < ft.prim.length;
    const point = isPrim && sp.tip === 'point';
    const deep = isPrim ? (sp.finger ? lerp(0.1, 0.42, A.t) * sp.finger * (0.5 + k.spread) * A.L : c * (point ? 0.05 : 0.08)) : c * 0.08;
    const mid: V = [(A.tip[0] + B.tip[0]) / 2, (A.tip[1] + B.tip[1]) / 2], md = norm([(A.d[0] + B.d[0]) / 2, (A.d[1] + B.d[1]) / 2]);
    const notch = add(mid, md, -deep), bulge = point ? 0 : Math.max(deep, c * 0.06) * 0.7;
    const c1 = add([(A.tip[0] + notch[0]) / 2, (A.tip[1] + notch[1]) / 2] as V, A.d, bulge);
    const c2 = add([(B.tip[0] + notch[0]) / 2, (B.tip[1] + notch[1]) / 2] as V, B.d, bulge);
    g.quadraticCurveTo(c1[0], c1[1], notch[0], notch[1]);
    g.quadraticCurveTo(c2[0], c2[1], B.tip[0], B.tip[1]);
  }
  const end = add(k.S, k.n1, c * 0.75);
  g.quadraticCurveTo(add(k.S, k.n1, c * 0.95)[0], add(k.S, k.n1, c * 0.95)[1], end[0], end[1]);
  g.closePath();
}
function covertsPath(g: G, _sp: DrawSp, k: Skel) { // 덮깃: 앞쪽 띠 (날개깃보다 조금 더 어두움)
  const c = k.c, front: V = [-k.n1[0], -k.n1[1]];
  const S0 = add(k.S, front, c * 0.06), W0 = add(k.Wr, front, c * 0.05), H = add(k.Wr, k.u2, k.handL * 0.55);
  g.beginPath(); g.moveTo(S0[0], S0[1]);
  const mA = add(add(k.S, k.u1, k.armL * 0.5), front, c * 0.12);
  g.quadraticCurveTo(mA[0], mA[1], W0[0], W0[1]);
  g.lineTo(H[0], H[1]);
  const bH = add(H, k.n2, c * 0.18), bW = add(k.Wr, k.n2, c * 0.42), bS = add(k.S, k.n1, c * 0.42);
  g.quadraticCurveTo(add(H, k.n2, c * 0.05)[0] , add(H, k.n2, c * 0.05)[1], bH[0], bH[1]);
  g.quadraticCurveTo(bW[0], bW[1], add(add(k.S, k.u1, k.armL * 0.5), k.n1, c * 0.45)[0], add(add(k.S, k.u1, k.armL * 0.5), k.n1, c * 0.45)[1]);
  g.lineTo(bS[0], bS[1]);
  g.closePath();
}
function tailPath(g: G, sp: DrawSp) {
  const y = -0.16, L = sp.tailL;
  g.beginPath();
  if (sp.tail === 'fork') {
    g.moveTo(-0.035, y); g.quadraticCurveTo(-0.08, y - L * 0.6, -0.11, y - L * 1.6); g.quadraticCurveTo(-0.05, y - L * 0.8, 0, y - L * 0.55);
    g.quadraticCurveTo(0.05, y - L * 0.8, 0.11, y - L * 1.6); g.quadraticCurveTo(0.08, y - L * 0.6, 0.035, y);
  } else {
    const w = sp.tail === 'fan' ? 0.09 : 0.06, n = 5;
    g.moveTo(-0.04, y); g.lineTo(-w, y - L * 0.9);
    for (let i = 0; i < n; i++) { const x0 = lerp(-w, w, i / n), x1 = lerp(-w, w, (i + 1) / n), yy = y - L * (0.92 + 0.08 * Math.cos(((x0 + x1) / 2 / w) * 1.3)); g.quadraticCurveTo((x0 + x1) / 2, yy - L * 0.1, x1, yy + (i === n - 1 ? 0.02 * L : 0)); }
    g.lineTo(0.04, y);
  }
  g.closePath();
}

function bodyPath(g: G, sp: DrawSp) { // 몸: 가슴이 넓고 꼬리로 갈수록 좁아짐 + 목·머리·부리 (머리가 아래)
  const nk = sp.neck, h = sp.head;
  g.beginPath();
  g.moveTo(0, -0.22);
  g.bezierCurveTo(0.045, -0.2, 0.07, -0.05, 0.062, 0.06);
  g.bezierCurveTo(0.055, 0.13, 0.032, 0.16, 0.026, 0.17 + nk * 0.3);
  g.lineTo(0.02, 0.15 + nk); g.lineTo(-0.02, 0.15 + nk); g.lineTo(-0.026, 0.17 + nk * 0.3);
  g.bezierCurveTo(-0.032, 0.16, -0.055, 0.13, -0.062, 0.06);
  g.bezierCurveTo(-0.07, -0.05, -0.045, -0.2, 0, -0.22);
  g.closePath();
  const hy = 0.15 + nk + h * 0.6;
  g.moveTo(h, hy); g.ellipse(0, hy, h, h * 1.15, 0, 0, Math.PI * 2);
  g.moveTo(-0.014, hy + h * 0.9); g.lineTo(0, hy + h * 0.9 + sp.beak); g.lineTo(0.014, hy + h * 0.9); g.closePath();
}

/**
 * mode: 'base' 실루엣 · 'rim' 역광 빛 (흰색 마스크) · 'gold' 황금 새
 * 그리기 전에 g는 새 중심으로 옮겨지고 날개 반폭 = 1로 확대돼 있어야 함
 */
export function drawBird(g: G, sp: DrawSp, f: number, mode: 'base' | 'rim' | 'gold') {
  const k = skel(sp, f), ft = featherTips(sp, k);
  const gold = mode === 'gold', rim = mode === 'rim';
  const INK = '#120a07', COV = '#0b0604';
  // 꼬리
  tailPath(g, sp);
  g.fillStyle = gold ? '#c27a34' : rim ? 'rgba(255,255,255,.55)' : INK; g.fill();
  for (const m of [1, -1]) {
    g.save(); g.scale(m, 1);
    wingPath(g, sp, k, ft);
    if (gold) { const gr = g.createRadialGradient(0, 0, 0.1, 0, 0, 1.05); gr.addColorStop(0, '#7a3c14'); gr.addColorStop(0.45, '#d7904a'); gr.addColorStop(0.85, '#ffe0a6'); gr.addColorStop(1, '#fff6dc'); g.fillStyle = gr; }
    else g.fillStyle = rim ? 'rgba(255,255,255,0)' : INK;
    g.fill();
    // 날개깃: 윤곽 안에서만 (깃대와 깃 끝 빛)
    g.save(); wingPath(g, sp, k, ft); g.clip();
    for (const q of [...ft.sec, ...ft.prim]) {
      const from = add(q.base, q.d, q.L * 0.18);
      if (rim) { // 역광: 깃 끝 쪽일수록 빛이 비침
        const gr = g.createLinearGradient(q.base[0], q.base[1], q.tip[0], q.tip[1]);
        gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.55)');
        g.strokeStyle = gr; g.lineWidth = q.L * 0.32; g.lineCap = 'round';
        g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(q.tip[0], q.tip[1]); g.stroke();
      } else { // 깃 사이 결
        g.strokeStyle = gold ? 'rgba(255,244,214,.5)' : 'rgba(255,214,160,.07)'; g.lineWidth = gold ? 0.007 : 0.006;
        g.beginPath(); g.moveTo(from[0], from[1]); const e = add(q.tip, q.d, -q.L * 0.04); g.lineTo(e[0], e[1]); g.stroke();
      }
    }
    g.restore();
    // 덮깃
    covertsPath(g, sp, k);
    g.fillStyle = gold ? 'rgba(90,40,12,.75)' : rim ? 'rgba(255,255,255,0)' : COV; g.fill();
    // 윤곽선
    wingPath(g, sp, k, ft);
    if (rim) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.016; g.lineJoin = 'round'; g.stroke(); }
    else if (gold) { g.strokeStyle = 'rgba(255,248,226,.9)'; g.lineWidth = 0.012; g.stroke(); }
    g.restore();
  }
  if (rim) { bodyPath(g, sp); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(); g.globalCompositeOperation = 'source-over'; }
  bodyPath(g, sp);
  if (gold) { const gr = g.createLinearGradient(0, -0.2, 0, 0.3); gr.addColorStop(0, '#6a3412'); gr.addColorStop(1, '#2a140a'); g.fillStyle = gr; }
  else g.fillStyle = rim ? 'rgba(255,255,255,.18)' : INK;
  g.fill();
}

