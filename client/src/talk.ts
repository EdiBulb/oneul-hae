// 대화창: 동그란 말풍선 + 이름표 + 한 글자씩 나오는 글씨 + 톡톡 소리.
// 누르면 글씨가 바로 다 나오고, 한 번 더 누르면 다음 줄 / 닫힘.

export type Speaker = 'mago' | 'me' | 'crane';
export interface Line { who: Speaker; text: string }
const NAME: Record<Speaker, [string, string]> = { mago: ['마고할미', 'Grandma Mago'], me: ['나 (속마음)', 'Me (thinking)'], crane: ['학 훈장님', 'Master Crane'] };
/** 말하는 사람마다 목소리 높이 (톡톡 소리) */
const PITCH: Record<Speaker, number> = { mago: 330, me: 880, crane: 520 };

let box: HTMLElement, nameEl: HTMLElement, textEl: HTMLElement;
let queue: Line[] = [], typing = 0, full = '', shown = 0, done: (() => void) | null = null, autoT = 0;
let blip: ((pitch: number) => void) | null = null, isKo = true;

export function initTalk(opts: { blip: (pitch: number) => void; ko: boolean }) {
  blip = opts.blip; isKo = opts.ko;
  box = document.getElementById('talk')!; nameEl = document.getElementById('talkName')!; textEl = document.getElementById('talkText')!;
  box.addEventListener('pointerdown', e => { e.stopPropagation(); next(); });
}

/** 줄 여러 개를 차례로 보여 주고, 다 닫히면 끝남 */
export function say(lines: Line[]): Promise<void> {
  return new Promise(res => {
    const wasOpen = !box.hidden;
    queue.push(...lines);
    const prev = done; done = () => { prev?.(); res(); };
    if (!wasOpen) show(queue.shift()!);
  });
}
export const talking = () => box && !box.hidden;

function show(l: Line) {
  box.hidden = false; box.dataset.who = l.who;
  nameEl.textContent = NAME[l.who][isKo ? 0 : 1];
  full = l.text; shown = 0; textEl.textContent = ''; box.classList.remove('ready');
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  clearInterval(typing); clearTimeout(autoT);
  typing = window.setInterval(() => {
    shown++; textEl.textContent = full.slice(0, shown);
    const ch = full[shown - 1];
    if (shown % 2 === 1 && ch && ch.trim() && !/[.,!?…"'·]/.test(ch)) blip?.(PITCH[l.who] * (0.92 + Math.random() * 0.16));
    if (shown >= full.length) finishLine();
  }, 42);
}
function finishLine() {
  clearInterval(typing); textEl.textContent = full; shown = full.length; box.classList.add('ready');
  // 손대지 않으면 잠시 뒤 저절로 넘어감 (출근 전 1분: 붙잡아 두지 않게)
  autoT = window.setTimeout(next, Math.max(3500, full.length * 120));
}
function next() {
  if (box.hidden) return;
  if (shown < full.length) { finishLine(); return; }
  clearTimeout(autoT);
  const l = queue.shift();
  if (l) { show(l); return; }
  box.hidden = true; const d = done; done = null; d?.();
}
