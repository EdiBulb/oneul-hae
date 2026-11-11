// 스킬북(📖) · 이야기 보따리(📜) · 청학당 '오늘은 무엇을 배울 테냐?'
import { SKILLS, skillLv, skillsDone, skillById, QUESTS, questStep, questDone, hasSkill, type SkillId, type Mado } from './progress';
import { skillIcon } from './skill-icons';
import { store } from './store';

const MADO: Record<Mado, string> = { read: '세상을 읽는 법', body: '몸과 손을 쓰는 법', heart: '마음을 다스리는 법' };
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const usedBy = (id: SkillId) => QUESTS.filter(q => q.steps.some(s => s.need === id)).map(q => q.tale);

/** 스킬북 그리기 (sel = 아래에 설명을 띄울 스킬) */
export function renderBook(el: HTMLElement, sel?: SkillId) {
  const n = skillsDone();
  let h = `<div class="bk-prog">익힌 스킬 ${n} / ${SKILLS.length}<div class="bk-bar"><i style="width:${n / SKILLS.length * 100}%"></i></div></div>`;
  for (const m of ['read', 'body', 'heart'] as Mado[]) {
    h += `<div class="bk-mado">${MADO[m]}</div><div class="bk-grid">`;
    for (const s of SKILLS.filter(x => x.mado === m)) {
      const lv = skillLv(s.id);
      h += `<button class="bk-sk${lv === 0 ? ' off' : ''}${lv === 1 ? ' half' : ''}${s.id === sel ? ' sel' : ''}" data-sk="${s.id}">${skillIcon(s.id)}<span>${esc(s.ko)}</span></button>`;
    }
    h += `</div>`;
  }
  const d = skillById(sel ?? SKILLS.find(s => skillLv(s.id) > 0)?.id ?? 'stars'), lv = skillLv(d.id);
  const state = lv === 2 ? '<span class="bk-chip g">익힘</span>' : lv === 1 ? '<span class="bk-chip">익히는 중 · 1 / 2</span>' : '<span class="bk-chip grey">아직 못 배움</span>';
  const used = usedBy(d.id);
  h += `<div class="bk-detail">${skillIcon(d.id)}<div><b>${esc(d.ko)}</b> ${state}<p>${esc(d.does)}.</p>${used.length ? `<span class="bk-chip g">쓰이는 이야기: ${esc(used.join(' · '))}</span>` : ''}${d.needs && !hasSkill(d.needs) ? `<span class="bk-chip grey">먼저: ${esc(skillById(d.needs).ko)}</span>` : ''}</div></div>`;
  el.innerHTML = h;
  el.querySelectorAll<HTMLButtonElement>('[data-sk]').forEach(b => b.onclick = () => renderBook(el, b.dataset.sk as SkillId));
}

/** 이야기 보따리 그리기 */
export function renderQuests(el: HTMLElement, tab: 'now' | 'done' | 'unknown' = 'now') {
  const now = QUESTS.filter(q => questStep(q.id) >= 0 && !questDone(q.id)), done = QUESTS.filter(q => questDone(q.id)), unknown = QUESTS.filter(q => questStep(q.id) < 0);
  let h = `<div class="bk-tabs">${([['now', `진행 중 ${now.length}`], ['done', `끝낸 이야기 ${done.length}`], ['unknown', `아직 모름 ${unknown.length}`]] as const).map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const list = tab === 'now' ? now : tab === 'done' ? done : unknown;
  const mom = QUESTS.filter(q => q.main && questDone(q.id)).length;
  h += `<div class="bk-mom">🪶 엄마의 발자취 <b>${mom} / 8</b><span>${mom ? '엄마가 도왔던 이웃들을 따라가고 있어요' : '이 산의 이웃들은 모두 엄마에게 도움을 받았대요'}</span></div>`;
  if (tab === 'done' && store.keeps?.length) h += `<div class="bk-need" style="margin:0 0 10px">받은 기념품<br>${store.keeps.map(esc).join(' · ')}</div>`;
  if (!list.length) h += `<p class="bk-empty">${tab === 'now' ? '아직 받은 이야기가 없어요.<br>산 곳곳의 이웃들에게 말을 걸어 보세요.' : tab === 'done' ? '아직 끝낸 이야기가 없어요.' : '모든 이야기를 만났어요!'}</p>`;
  for (const q of list) {
    const s = questStep(q.id);
    if (tab === 'unknown') { h += `<div class="bk-q dim"><div class="bk-qh"><i>❔</i><div><b>${q.main ? '어떤 이야기' : '작은 이야기'}</b><small>${esc(q.place)} 어딘가</small></div></div></div>`; continue; }
    h += `<div class="bk-q"><div class="bk-qh"><i>${q.icon}</i><div><b>${esc(q.title)}</b><small>${esc(q.tale)} · ${esc(q.place)}</small></div><em>${Math.min(s, q.steps.length)} / ${q.steps.length}</em></div>`;
    if (tab === 'now') {
      h += `<ul class="bk-steps">` + q.steps.map((st, i) => `<li class="${i < s ? 'done' : i === s ? 'now' : 'lock'}">${i <= s ? esc(st.ko) : '…'}</li>`).join('') + `</ul>`;
      const cur = q.steps[s];
      if (cur?.need && !hasSkill(cur.need)) h += `<div class="bk-need">필요한 스킬 <span class="bk-chip grey">${esc(skillById(cur.need).ko)} · ${skillLv(cur.need) ? '익히는 중' : '아직 못 배움'}</span><br>해가 뜬 뒤 청학당에서 고를 수 있어요.</div>`;
      if (cur?.when || cur?.where) h += `<div class="bk-where">${cur.when === 'night' ? '🌙 밤에만 · ' : cur.when === 'dawn' ? '🌅 새벽에만 · ' : '📍 '}${esc(cur.where ?? '')}</div>`;
    }
    h += `</div>`;
  }
  el.innerHTML = h;
  el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => renderQuests(el, b.dataset.tab as 'now'));
}

/** 오늘의 배움 고르기: 고른 스킬 (닫으면 null) */
export function pickLesson(el: HTMLElement, choices: SkillId[], wanted: SkillId[]): Promise<SkillId | null> {
  return new Promise(res => {
    el.innerHTML = choices.map(id => { const s = skillById(id), lv = skillLv(id); return `<button class="bk-pick${wanted.includes(id) ? ' rec' : ''}" data-pick="${id}">${skillIcon(id)}<div><b>${esc(s.ko)}${lv === 1 ? ' <small>(이어서 익히기)</small>' : ''}</b><small>${esc(s.does)}</small></div>${wanted.includes(id) ? '<span class="bk-tag">📜 이야기에 필요</span>' : ''}</button>`; }).join('');
    el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.onclick = () => res(b.dataset.pick as SkillId));
    (el as HTMLElement & { cancel?: () => void }).cancel = () => res(null);
  });
}
