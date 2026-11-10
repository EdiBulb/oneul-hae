// 오늘의 목표 종이: 한지에 손가락으로 쓰고, 다 쓰면 접어서 품에 넣는다.
// 해가 뜰 때 울면 종이가 빛이 되어 해로 날아간다.

export interface Goal { day: string; img: string; sent?: boolean }
let el: HTMLElement, cv: HTMLCanvasElement, g: CanvasRenderingContext2D, inked = false, readonly = false;
let onDone: ((img: string | null) => void) | null = null;

export function initGoal() {
  el = document.getElementById('goal')!; cv = document.getElementById('goalCv') as HTMLCanvasElement; g = cv.getContext('2d')!;
  let last: { x: number; y: number; t: number; w: number } | null = null;
  const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
  cv.addEventListener('pointerdown', e => { if (readonly) return; cv.setPointerCapture(e.pointerId); const p = pos(e); last = { ...p, t: performance.now(), w: 7 }; dot(p.x, p.y, 3.5); });
  cv.addEventListener('pointermove', e => {
    if (!last || readonly) return;
    const p = pos(e), now = performance.now(), d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 1.5) return;
    // 붓 느낌: 빠르게 그으면 가늘게, 천천히 그으면 굵게
    const v = d / Math.max(1, now - last.t), w = Math.max(3.5, Math.min(11, 11 - v * 3.2)), ww = last.w + (w - last.w) * 0.35;
    g.strokeStyle = '#2a1a12'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = ww;
    g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
    last = { ...p, t: now, w: ww }; inked = true;
  });
  const up = () => { last = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  document.getElementById('goalClear')!.onclick = () => { clear(); };
  document.getElementById('goalDone')!.onclick = () => finish();
  document.getElementById('goalX')!.onclick = () => close(null);
}
function dot(x: number, y: number, r: number) { g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); inked = true; }
function clear() { g.clearRect(0, 0, cv.width, cv.height); inked = false; }
function sizeCanvas() { const r = cv.getBoundingClientRect(), k = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k); }

/** 쓰기 창을 연다. 다 쓰면 그림(dataURL)을, 닫으면 null */
export function writeGoal(): Promise<string | null> {
  readonly = false; el.classList.remove('folding', 'view'); el.hidden = false;
  requestAnimationFrame(() => { sizeCanvas(); clear(); });
  return new Promise(res => { onDone = res; });
}
/** 오늘 쓴 종이 다시 보기 */
export function viewGoal(img: string) {
  readonly = true; el.classList.remove('folding'); el.classList.add('view'); el.hidden = false;
  requestAnimationFrame(() => { sizeCanvas(); clear(); const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, cv.width, cv.height); im.src = img; });
  onDone = null;
}
function finish() {
  if (!inked) { const t = document.getElementById('goalHint')!; t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); return; }
  // 저장은 작게 (반 크기 PNG)
  const s = document.createElement('canvas'); s.width = Math.round(cv.width / 2); s.height = Math.round(cv.height / 2);
  s.getContext('2d')!.drawImage(cv, 0, 0, s.width, s.height);
  const img = s.toDataURL('image/png');
  el.classList.add('folding');
  setTimeout(() => close(img), 1100);
}
function close(img: string | null) { el.hidden = true; el.classList.remove('folding', 'view'); const d = onDone; onDone = null; d?.(img); }

/** 해가 뜰 때: 접은 종이가 아래에서 해 쪽으로 날아가며 빛이 되어 사라짐 */
export function sendToSun(img: string, to: { x: number; y: number } | null) {
  const f = document.createElement('div'); f.className = 'goal-fly';
  f.innerHTML = `<img alt="" src="${img}">`;
  document.body.append(f);
  const tx = (to?.x ?? 0.5) * innerWidth, ty = (to?.y ?? 0.3) * innerHeight;
  f.style.left = `${innerWidth / 2}px`; f.style.top = `${innerHeight * 0.72}px`;
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.left = `${tx}px`; f.style.top = `${ty}px`; f.classList.add('go'); }));
  setTimeout(() => f.remove(), 3200);
}
