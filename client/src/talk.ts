// 대화창: 동그란 말풍선 + 이름표 + 한 글자씩 나오는 글씨 + 톡톡 소리.
// 누르면 글씨가 바로 다 나오고, 한 번 더 누르면 다음 줄 / 닫힘.

export type Speaker = 'mago' | 'me' | 'say' | 'crane' | (string & {});
export interface Line { who: Speaker; text: string; choices?: string[] }
const NAME: Record<string, [string, string]> = { mago: ['마고할미', 'Grandma Mago'], me: ['나 (속마음)', 'Me (thinking)'], say: ['나', 'Me'], crane: ['학 훈장님', 'Master Crane'] };
/** 말하는 사람마다 목소리 높이 (톡톡 소리) */
const PITCH: Record<string, number> = { mago: 330, me: 880, say: 880, crane: 520 };

/** 새 NPC가 대화창에 이름과 목소리 높이를 등록 */
export function addSpeaker(id: string, name: [string, string], pitch: number) { NAME[id] = name; PITCH[id] = pitch; }

let box: HTMLElement, nameEl: HTMLElement, textEl: HTMLElement, choiceEl: HTMLElement, cur: Line | null = null, picked: ((i: number) => void) | null = null;
let queue: Line[] = [], typing = 0, full = '', shown = 0, done: (() => void) | null = null, autoT = 0;
let blip: ((pitch: number) => void) | null = null, isKo = true;

export function initTalk(opts: { blip: (pitch: number) => void; ko: boolean }) {
  blip = opts.blip; isKo = opts.ko;
  box = document.getElementById('talk')!; nameEl = document.getElementById('talkName')!; textEl = document.getElementById('talkText')!; choiceEl = document.getElementById('talkChoices')!;
  box.addEventListener('pointerdown', e => { e.stopPropagation(); if ((e.target as HTMLElement).closest('#talkChoices')) return; if ((e.target as HTMLElement).closest('#talkSkip')) { const cb = skipCb; skipAll(); cb?.(); return; } next(); });
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
/** 건너뛰기: 켜 두면 대화창 오른쪽 위에 '건너뛰기'가 보이고, 누르면 지금 대화를 모두 닫고 cb 호출 */
let skipCb: (() => void) | null = null;
export function setSkip(cb: (() => void) | null) { skipCb = cb; const s = document.getElementById('talkSkip'); if (s) s.hidden = !cb; }
export function skipAll() {
  clearInterval(typing); clearTimeout(autoT); queue = []; picked?.(-1); picked = null; cur = null;
  box.hidden = true; const d = done; done = null; d?.();
}
/** 한 줄 말하고 고르게 함 (동물의 숲처럼 말풍선 옆 선택지). 고른 번호를 돌려줌 */
export function ask(who: Speaker, text: string, choices: string[]): Promise<number> {
  return new Promise(res => {
    let choice = -1;
    picked = i => { choice = i; };
    say([{ who, text, choices }]).then(() => res(choice));
  });
}

function show(l: Line) {
  cur = l; choiceEl.hidden = true; choiceEl.innerHTML = '';
  box.hidden = false; box.dataset.who = l.who;
  nameEl.textContent = NAME[l.who]?.[isKo ? 0 : 1] ?? l.who;
  full = l.text; shown = 0; textEl.textContent = ''; box.classList.remove('ready');
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  clearInterval(typing); clearTimeout(autoT);
  typing = window.setInterval(() => {
    shown++; textEl.textContent = full.slice(0, shown);
    const ch = full[shown - 1];
    if (shown % 2 === 1 && ch && ch.trim() && !/[.,!?…"'·]/.test(ch)) blip?.((PITCH[l.who] ?? 600) * (0.92 + Math.random() * 0.16));
    if (shown >= full.length) finishLine();
  }, 42);
}
function finishLine() {
  clearInterval(typing); textEl.textContent = full; shown = full.length; box.classList.add('ready');
  if (cur?.choices) {
    // 고를 때까지 기다림 (저절로 넘어가지 않음)
    box.classList.remove('ready'); choiceEl.hidden = false; choiceEl.innerHTML = '';
    cur.choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c; b.onclick = e => { e.stopPropagation(); picked?.(i); picked = null; if (cur) cur.choices = undefined; choiceEl.hidden = true; next(); }; choiceEl.append(b); });
    return;
  }
  // 손대지 않으면 잠시 뒤 저절로 넘어감 (출근 전 1분: 붙잡아 두지 않게)
  autoT = window.setTimeout(next, Math.max(3500, full.length * 120));
}
function next() {
  if (box.hidden) return;
  if (shown < full.length) { finishLine(); return; }
  if (cur?.choices) return; // 선택지를 골라야 넘어감
  clearTimeout(autoT);
  const l = queue.shift();
  if (l) { show(l); return; }
  box.hidden = true; const d = done; done = null; d?.();
}
