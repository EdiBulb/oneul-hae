import { dateKey, save, store, streakCount } from './store';

/** 햇살 포인트: 해를 보면 쌓이고, 꾸미기·밤 활동·연속 기록 지키기에 쓴다 (이 브라우저에만 저장) */
export const EARN = { live: 10, cycle: 1, cycleMax: 3, golden: 5, streak3: 10, streak7: 30 } as const;
export const PRICE = { shield: 30, star: 10, fire: 15, lanternColor: 20, lanternGold: 40, lanternPattern: 40, fireColor: 30 } as const;

type Listener = (gain: number, total: number) => void;
const listeners: Listener[] = [];
export const onSun = (f: Listener) => { listeners.push(f); };

export const sunTotal = () => store.sun ?? 0;
const today = () => dateKey(Date.now());

function log(t: string, p: number) {
  const L = store.sunLog ?? (store.sunLog = []);
  L.unshift({ d: today(), t, p });
  if (L.length > 40) L.length = 40;
}

function add(t: string, p: number) {
  store.sun = Math.max(0, sunTotal() + p);
  log(t, p); save();
  for (const f of listeners) f(p, store.sun);
}

/** 그날 한 번(또는 max번)만 주는 적립. 실제로 준 양을 돌려줌 */
function once(kind: string, p: number, max = 1) {
  const got = store.sunGot ?? (store.sunGot = {});
  // 오래된 기록은 정리
  for (const k of Object.keys(got)) if (!k.startsWith(today()) && Object.keys(got).length > 30) delete got[k];
  const key = `${today()}|${kind}`;
  if ((got[key] ?? 0) >= max) return 0;
  got[key] = (got[key] ?? 0) + 1;
  add(kind, p);
  return p;
}

/** 연속 3일·7일 보너스 (그 연속 구간에서 한 번씩) */
function streakBonus() {
  const n = streakCount();
  if (n === 3) once('streak3', EARN.streak3);
  if (n === 7) once('streak7', EARN.streak7);
}

export function earnLive() { const g = once('live', EARN.live); if (g) streakBonus(); return g; }
export function earnCycle() { const g = once('cycle', EARN.cycle, EARN.cycleMax); if (g) streakBonus(); return g; }
export function earnGolden() { return once('golden', EARN.golden); }

/** 개발자 테스트용 (?me=1로 들어온 기기에서만 main이 부름) */
export function grant(p: number) { add('test', p); }

export function spend(t: string, p: number) {
  if (sunTotal() < p) return false;
  add(t, -p);
  return true;
}

export const owns = (id: string) => (store.owned ?? []).includes(id);
export function own(id: string) { (store.owned ?? (store.owned = [])).push(id); save(); }
export function buy(id: string, p: number) {
  if (owns(id)) return true;
  if (!spend(id, p)) return false;
  own(id);
  return true;
}

// ---------- 연속 기록 지키기 ----------
const monthKey = () => today().slice(0, 7);
export const shieldsLeft = () => 2 - (store.shield?.m === monthKey() ? store.shield.n : 0);
/** 어제만 비었고 그 전날까지 2일 이상 이어졌으면, 어제를 지킬 수 있음 → 지켜질 연속 일수를 돌려줌 */
export function shieldOffer() {
  const d = (n: number) => dateKey(Date.now() - n * 86400000);
  if (store.days[d(1)] || !store.days[d(2)]) return 0;
  let n = 0; while (store.days[d(2 + n)]) n++;
  if (n < 2 || shieldsLeft() <= 0 || store.shield?.asked === today()) return 0;
  return n;
}
export function markShieldAsked() { store.shield = { m: store.shield?.m ?? monthKey(), n: store.shield?.n ?? 0, asked: today() }; save(); }
export function useShield() {
  if (!spend('shield', PRICE.shield)) return false;
  const m = monthKey();
  store.shield = { m, n: (store.shield?.m === m ? store.shield.n : 0) + 1, asked: today() };
  store.days[dateKey(Date.now() - 86400000)] = 'shield';
  save();
  return true;
}
