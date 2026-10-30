import { ADJ, BODY_COLORS, HAT_COLORS, NOUN, pick } from './places';
import type { Look } from '../../server/src/protocol';

// 이 브라우저에만 저장되는 개인 기록 (연속 기록, 알람, 내 캐릭터)
const KEY = 'oneul-hae-v2';

interface Saved {
  days: Record<string, 'live' | 'replay'>;
  alarm: { on: boolean };
  hinted?: boolean;
  uid: string;
  nick: string;
  look: Look;
  /** 알람을 끄고 들어온 날짜 */
  wokeOn?: string;
  /** 설치 안내를 '나중에'로 미룬 시각 */
  installSnooze?: number;
  /** 배경 소리 켜짐 (기본 켜짐) */
  soundOn: boolean;
}

function load(): Partial<Saved> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
const raw = load();
export const store: Saved = {
  days: raw.days ?? {},
  alarm: raw.alarm ?? { on: false },
  hinted: raw.hinted,
  uid: raw.uid ?? (crypto.randomUUID?.() ?? String(Math.random()).slice(2)),
  nick: raw.nick ?? `${pick(ADJ)} ${pick(NOUN)}`,
  look: raw.look ?? { body: Math.floor(Math.random() * BODY_COLORS.length), hat: Math.floor(Math.random() * HAT_COLORS.length) },
  wokeOn: raw.wokeOn,
  installSnooze: raw.installSnooze,
  soundOn: raw.soundOn ?? true,
};
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 저장소가 막힌 브라우저 */ }
}
save();

export const dateKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function streakCount() {
  let n = 0, t = Date.now();
  if (!store.days[dateKey(t)]) t -= 86400000;
  while (store.days[dateKey(t)]) { n++; t -= 86400000; }
  return n;
}

/** 오늘 해를 본 것으로 기록. 새로 기록됐으면 true */
export function markSeen(kind: 'live' | 'replay') {
  const k = dateKey(Date.now()), cur = store.days[k];
  if (cur === 'live' || (cur === 'replay' && kind === 'replay')) return false;
  store.days[k] = kind;
  save();
  return true;
}

export const wokeToday = () => store.wokeOn === dateKey(Date.now());
