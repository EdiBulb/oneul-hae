import { JWIBUL, OUTFIT, SHOP_ITEM_SHIFT, wearGet, wearSet, type WearSlot } from './character';
import { lang } from './i18n';
import { store, save } from './store';

/** 옷장: 사는 게 아니라 모으는 것. 해를 맞고, 다짐을 쓰고, 할미 이야기를 들으며 하나씩 받는다.
 *  어떤 것은 떠난 어미가 할미에게 맡겨 둔 물건 (giver: 'mother') */
export type Giver = 'start' | 'mother' | 'mago' | 'crane' | 'mountain' | 'feed';
export interface Item { slot: WearSlot; val: number; id: string; icon: string; ko: string; en: string; giver: Giver; season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'seollal'; howKo: string; howEn: string; descKo: string; descEn: string }

export const ITEMS: Item[] = [
  { slot: 'head', val: 1, id: 'daenggi', icon: '🎀', ko: '해 무늬 댕기', en: 'Sun ribbon', giver: 'mother', howKo: '해를 3번 맞으면', howEn: 'Greet the sun 3 times', descKo: '어미가 알을 품을 때 늘 매고 있던 붉은 댕기', descEn: 'The red ribbon your mother wore while keeping you warm' },
  { slot: 'head', val: 2, id: 'band', icon: '🌞', ko: '햇살 머리띠', en: 'Sunbeam pin', giver: 'mago', howKo: '해를 7번 맞으면', howEn: 'Greet the sun 7 times', descKo: '일곱 번 해를 맞은 병아리에게 할미가 꽂아 주는 햇살', descEn: 'A little sun Grandma pins on chicks who greet seven sunrises' },
  { slot: 'head', val: 3, id: 'feather', icon: '🪶', ko: '봉황 깃털', en: 'Phoenix feather', giver: 'mother', howKo: '해를 25번 맞으면', howEn: 'Greet the sun 25 times', descKo: '어미가 봉황이 되던 날 아침 떨어뜨리고 간 깃털', descEn: 'The feather your mother dropped the morning she became a phoenix' },
  { slot: 'head', val: 4, id: 'azalea', icon: '🌸', ko: '철쭉 꽃', en: 'Azalea', giver: 'mountain', season: 'spring', howKo: '봄에 정상에 오르면', howEn: 'Climb to the summit in spring', descKo: '봄 지리산 능선에 피는 분홍 철쭉', descEn: 'Pink azaleas that bloom on the spring ridge' },
  { slot: 'head', val: 5, id: 'maple', icon: '🍁', ko: '단풍잎', en: 'Maple leaf', giver: 'mountain', season: 'autumn', howKo: '가을에 제석봉을 지나면', howEn: 'Pass Jeseokbong in autumn', descKo: '제석봉 고사목 숲에서 날아온 붉은 잎', descEn: 'A red leaf blown from the Jeseokbong forest' },
  { slot: 'neck', val: 1, id: 'scarf', icon: '🧣', ko: '털목도리', en: 'Wool scarf', giver: 'start', howKo: '처음부터', howEn: 'From the start', descKo: '새벽 산은 추우니까', descEn: 'Mountain dawns are cold' },
  { slot: 'neck', val: 2, id: 'norigae', icon: '🪢', ko: '노리개', en: 'Norigae charm', giver: 'mother', howKo: '할미 옛날이야기를 다 들으면', howEn: "Hear all of Grandma's stories", descKo: '어미가 제일 아끼던 옥 노리개', descEn: "Your mother's most treasured jade charm" },
  { slot: 'neck', val: 3, id: 'bobae', icon: '🎒', ko: '책보', en: 'Book bundle', giver: 'crane', howKo: '다짐을 5번 쓰면', howEn: 'Write 5 promises', descKo: '학 훈장님이 주는 남색 책보따리', descEn: 'A blue book bundle from Teacher Crane' },
  { slot: 'neck', val: 4, id: 'bok', icon: '👛', ko: '복주머니', en: 'Lucky pouch', giver: 'mountain', season: 'seollal', howKo: '설날 아침에', howEn: 'On Lunar New Year morning', descKo: '설날 아침, 복을 담는 붉은 주머니', descEn: 'A red pouch for New Year luck' },
  { slot: 'wing', val: 1, id: 'stick', icon: '🌿', ko: '나뭇가지 지팡이', en: 'Twig staff', giver: 'start', howKo: '처음부터', howEn: 'From the start', descKo: '산길에 든든한 작은 지팡이', descEn: 'A small staff for the trail' },
  { slot: 'wing', val: 2, id: 'gourd', icon: '🏺', ko: '표주박', en: 'Gourd flask', giver: 'mago', howKo: '모이 마당에서 처음 같이 먹으면', howEn: 'Eat with someone at the yard', descKo: '같이 먹을 줄 아는 병아리에게 주는 할미의 표주박', descEn: "Grandma's gourd, for chicks who share a meal" },
  { slot: 'wing', val: 3, id: 'brush', icon: '🖌️', ko: '붓', en: 'Brush', giver: 'crane', howKo: '다짐을 10번 쓰면', howEn: 'Write 10 promises', descKo: '열 번 다짐을 쓴 제자에게 주는 훈장님의 붓', descEn: "Teacher Crane's brush, for ten promises written" },
  { slot: 'wing', val: 4, id: 'lotus', icon: '🍃', ko: '연잎 우산', en: 'Lotus umbrella', giver: 'mountain', season: 'summer', howKo: '여름에', howEn: 'In summer', descKo: '여름 소나기를 막아 주는 커다란 연잎', descEn: 'A big lotus leaf for summer showers' },
  { slot: 'foot', val: 1, id: 'jipsin', icon: '🥿', ko: '짚신', en: 'Straw shoes', giver: 'start', howKo: '처음부터', howEn: 'From the start', descKo: '산길용 짚신 한 켤레', descEn: 'A pair of straw shoes for the trail' },
  { slot: 'foot', val: 2, id: 'beoseon', icon: '🧦', ko: '버선', en: 'Beoseon socks', giver: 'mountain', season: 'winter', howKo: '겨울에', howEn: 'In winter', descKo: '겨울 새벽 발을 감싸는 흰 버선', descEn: 'White socks for winter dawns' },
];
export const SLOTS: WearSlot[] = ['head', 'neck', 'wing', 'foot'];
export const SLOT_NAME: Record<WearSlot, [string, string]> = { head: ['머리', 'Head'], neck: ['목', 'Neck'], wing: ['날개', 'Wing'], foot: ['발', 'Feet'] };
export const itemName = (it: Item) => (lang === 'ko' ? it.ko : it.en);
export const itemHow = (it: Item) => (lang === 'ko' ? it.howKo : it.howEn);
export const itemDesc = (it: Item) => (lang === 'ko' ? it.descKo : it.descEn);
export const has = (id: string) => (store.got ?? []).includes(id);
export const isOn = (it: Item, mask: number) => wearGet(mask, it.slot) === it.val;
/** 칸에서 이걸 입기 (같은 걸 다시 누르면 벗기) */
export const toggleWear = (it: Item, mask: number) => wearSet(mask, it.slot, isOn(it, mask) ? 0 : it.val);

/** 지금 계절 (한국 기준) / 설날 아침 */
const SEOLLAL = ['2027-02-07', '2028-01-27', '2029-02-13', '2030-02-03', '2031-01-23'];
export function seasonNow(d = new Date()): Item['season'] | null {
  const k = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  if (SEOLLAL.includes(k)) return 'seollal';
  const m = Number(k.slice(5, 7));
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

/** 처음 한 번: 예전 옷(패딩·모자·맨투맨·핫팩)을 벗기고, 처음부터 주는 것들을 줌 */
export function migrateWardrobe() {
  if (store.got) return;
  const keep = OUTFIT.flowers | OUTFIT.ramen | JWIBUL | (3 << 14) | (3 << SHOP_ITEM_SHIFT);
  store.outfit = (store.outfit ?? 0) & keep;
  store.got = ITEMS.filter(it => it.giver === 'start').map(it => it.id);
  store.gotNew = [];
  save();
}
/** 조건을 채운 것 중 아직 안 받은 것 (주는 사람별로 건네는 때가 다름) */
export function earnable(ctx: { days: number; tales: number; goals: number; fedTogether: boolean; season: Item['season'] | null; atSummit: boolean; atJeseok: boolean }) {
  return ITEMS.filter(it => {
    if (has(it.id)) return false;
    switch (it.id) {
      case 'daenggi': return ctx.days >= 3;
      case 'band': return ctx.days >= 7;
      case 'feather': return ctx.days >= 25;
      case 'norigae': return ctx.tales >= 5;
      case 'bobae': return ctx.goals >= 5;
      case 'brush': return ctx.goals >= 10;
      case 'gourd': return ctx.fedTogether;
      case 'azalea': return ctx.season === 'spring' && ctx.atSummit;
      case 'maple': return ctx.season === 'autumn' && ctx.atJeseok;
      case 'lotus': return ctx.season === 'summer';
      case 'beoseon': return ctx.season === 'winter';
      case 'bok': return ctx.season === 'seollal';
      default: return false;
    }
  });
}
export function grant(it: Item) {
  store.got = [...new Set([...(store.got ?? []), it.id])];
  store.gotNew = [...new Set([...(store.gotNew ?? []), it.id])];
  save();
}
