import { OUTFIT, wearGet, wearSet, type WearSlot } from './character';
import { lang } from './i18n';
import { store, streakCount, save } from './store';
import { owns } from './sunpoints';

/** 옷장: 겉옷·모자·목도리·손 네 칸에서 하나씩. 기본 몇 개는 바로, 나머지는 해돋이를 보러 올수록 열림 */
type Need = { kind: 'days'; n: number } | { kind: 'streak'; n: number } | { kind: 'live' } | { kind: 'golden' };
export interface Item { slot: WearSlot; id: string; icon: string; color?: string; ko: string; en: string; need?: Need; price?: number; get: (m: number) => boolean; set: (m: number) => number }

const v = (slot: WearSlot, val: number, extraClear = 0) => ({
  get: (m: number) => wearGet(m, slot) === val && !(m & extraClear),
  set: (m: number) => wearSet(m & ~extraClear, slot, val),
});
// 예전 소품 비트(맨투맨·빨간 목도리·꽃다발)도 같은 칸 안에서 하나만 고르도록
const bit = (slot: WearSlot, b: number) => ({ get: (m: number) => !!(m & b), set: (m: number) => wearSet(m, slot, 0) | b });

export const ITEMS: Item[] = [
  { slot: 'outer', id: 'none', icon: '🙂', ko: '기본', en: 'Default', ...v('outer', 0, OUTFIT.sweat) },
  { slot: 'outer', id: 'longBlack', icon: '🧥', color: '#1d1e24', ko: '롱패딩 검정', en: 'Long puffer · black', ...v('outer', 1, OUTFIT.sweat) },
  { slot: 'outer', id: 'longWhite', icon: '🧥', color: '#ece8e0', ko: '롱패딩 흰색', en: 'Long puffer · white', price: 40, ...v('outer', 2, OUTFIT.sweat) },
  { slot: 'outer', id: 'longNavy', icon: '🧥', color: '#26304f', ko: '롱패딩 네이비', en: 'Long puffer · navy', price: 60, ...v('outer', 3, OUTFIT.sweat) },
  { slot: 'outer', id: 'short', icon: '🧥', color: '#d2a03c', ko: '숏패딩', en: 'Short puffer', ...v('outer', 4, OUTFIT.sweat) },
  { slot: 'outer', id: 'sweat', icon: '👕', ko: '회색 맨투맨', en: 'Grey sweatshirt', ...bit('outer', OUTFIT.sweat) },
  { slot: 'hat', id: 'beanie', icon: '🧢', ko: '비니', en: 'Beanie', ...v('hat', 0) },
  { slot: 'hat', id: 'ear', icon: '🪖', ko: '귀마개 모자', en: 'Trapper hat', price: 50, ...v('hat', 1) },
  { slot: 'hat', id: 'fur', icon: '🎿', ko: '방울 털모자', en: 'Bobble hat', price: 30, ...v('hat', 2) },
  { slot: 'scarf', id: 'knit', icon: '〰️', ko: '기본', en: 'Default', ...v('scarf', 0, OUTFIT.scarf) },
  { slot: 'scarf', id: 'red', icon: '🧣', ko: '빨간 목도리', en: 'Red scarf', ...bit('scarf', OUTFIT.scarf) },
  { slot: 'scarf', id: 'check', icon: '🧣', color: '#b8322c', ko: '체크 목도리', en: 'Tartan scarf', price: 30, ...v('scarf', 1, OUTFIT.scarf) },
  { slot: 'hand', id: 'empty', icon: '✋', ko: '빈손', en: 'Nothing', ...v('hand', 0, OUTFIT.flowers) },
  { slot: 'hand', id: 'hotpack', icon: '🔥', ko: '핫팩', en: 'Hand warmer', ...v('hand', 1, OUTFIT.flowers) },
  { slot: 'hand', id: 'thermos', icon: '♨️', ko: '보온병', en: 'Thermos', price: 80, ...v('hand', 2, OUTFIT.flowers) },
  { slot: 'hand', id: 'flowers', icon: '💐', ko: '메밀꽃 다발', en: 'Buckwheat flowers', ...bit('hand', OUTFIT.flowers) },
];

export const SLOT_NAME: Record<WearSlot, [string, string]> = { outer: ['겉옷', 'Outerwear'], hat: ['모자', 'Hat'], scarf: ['목도리', 'Scarf'], hand: ['손', 'In hand'] };

/** 가격이 없으면 기본 옷, 있으면 햇살로 산 것만 */
export function unlocked(it: Item) { return !it.price || owns(it.id); }
/** 처음 상점이 생겼을 때: 그때 입고 있던 옷은 이미 가진 것으로 */
export function migrateOwned() {
  if (store.owned) return;
  const cur = store.outfit ?? 0;
  store.owned = ITEMS.filter(it => it.price && it.get(cur)).map(it => it.id);
  save();
}
void streakCount;
export function needText(it: Item) {
  const n = it.need; if (!n) return '';
  const ko = lang === 'ko';
  if (n.kind === 'days') { const left = n.n - Object.keys(store.days).length; return ko ? `해돋이 ${n.n}일 보면 (${left}일 남음)` : `See ${n.n} sunrises (${left} to go)`; }
  if (n.kind === 'streak') return ko ? `${n.n}일 연속으로 보면` : `${n.n}-day streak`;
  if (n.kind === 'live') return ko ? '진짜 해돋이(LIVE)를 한 번 보면' : 'Watch one LIVE sunrise';
  return ko ? '금빛 해돋이를 만들면' : 'Make a golden sunrise';
}
export const itemName = (it: Item) => (lang === 'ko' ? it.ko : it.en);
