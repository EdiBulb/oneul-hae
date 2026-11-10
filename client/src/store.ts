import { ADJ, BODY_COLORS, HAT_COLORS, NOUN, pick } from './places';
import type { Look } from '../../server/src/protocol';

// 이 브라우저에만 저장되는 개인 기록 (연속 기록, 알람, 내 캐릭터)
const KEY = 'oneul-hae-v2';

interface Saved {
  days: Record<string, 'live' | 'replay' | 'shield'>;
  alarm: { on: boolean };
  hinted?: boolean;
  uid: string;
  nick: string;
  look: Look;
  /** 알람을 끄고 들어온 날짜 */
  wokeOn?: string;
  /** 설치 안내를 '나중에'로 미룬 시각 */
  installSnooze?: number;
  /** 물수제비 최고 기록 */
  skipBest?: number;
  /** 소품 비트마스크 (1 코트, 2 빨간 목도리, 4 꽃다발) */
  outfit?: number;
  /** 금빛 해돋이를 만든 적이 있는지 (보온병 열림) */
  golden?: boolean;
  /** 해 뜬 뒤 편지 쓰기를 물어본 날 (하루 한 번) */
  letterAskDay?: string;
  afterSunDay?: string;
  /** 마지막으로 알려 준 성장 단계 (단계가 오르면 한 번 '몸이 커진 것 같은데?') */
  growthSeen?: number;
  /** 마고할미: 처음 이야기를 들었는지, 오늘 인사했는지 */
  magoMet?: boolean;
  magoDay?: string;
  /** 오늘의 목표 종이 (청학당에서 쓴 그림), 학 훈장님과 인사한 날, 마고할미가 앱 설치를 물어본 때 */
  goal?: { day: string; img: string; sent?: boolean };
  craneDay?: string;
  /** 봉황을 처음 본 적 있는지 (처음엔 '…엄마?') */
  phoenixSeen?: boolean;
  /** 들고 있는 먹을거리가 몇 입 남았는지 (0이 되면 다 먹고 내려놓음) */
  itemBites?: number;
  /** 처음 해가 떴을 때 '울어 보기'를 배웠는지 */
  crowTaught?: boolean;
  /** 통천문 '곧 정상' 혼잣말을 이미 했는지 (한 번만) */
  gateSaid?: boolean;
  installAskAt?: number;
  /** 가게에서 들고 나온 날 (다음 날이 되면 내려놓음) */
  itemDay?: string;
  /** 햇살 포인트 */
  sun?: number;
  /** 햇살 내역 (최근 40개): d 날짜키, t 사유 키, p 증감 */
  sunLog?: { d: string; t: string; p: number }[];
  /** 그날 이미 받은 것: key = 날짜|종류 */
  sunGot?: Record<string, number>;
  /** 햇살로 산 것 (옷 id, 'lc:색', 'lp:무늬', 'jf:불색') */
  owned?: string[];
  /** 풍등 모양: c 색 번호, p 무늬 번호 */
  lantern?: { c: number; p: number };
  /** 쥐불놀이 불 색 */
  fireColor?: number;
  /** 연속 기록 지키기: 쓴 달(YYYY-MM)과 횟수, 마지막으로 물어본 날 */
  shield?: { m: string; n: number; asked?: string };
  /** 오늘 주운 조개: key = 장소|현지날짜, got = 그날 조개 번호 */
  shells?: { key: string; got: number[] };
  /** 조개 도감: 종류 → 주운 개수 */
  dex?: Record<string, number>;
  /** 다시보기 버튼을 닫은 날 */
  replayPillOff?: string;
  /** 5분 순환 대신 실제 하늘 보기 */
  realSky?: boolean;
  /** 내일의 해에게 보내는 편지: 아직 안 받은 편지 하나 + 편지를 쓴 날들 */
  letter?: { day: string; text: string; at: number };
  letterDays?: string[];
  /** 오늘 강아지 쓰다듬은 횟수: key = 장소|현지날짜 */
  pets?: { key: string; n: number };
  /** 직접 쓴 소원을 다른 사람에게도 보여줄지 (기본: 보여줌) */
  shareWish: boolean;
  /** '내 소원 나만 보기'를 직접 눌러 본 적이 있는지 (없으면 기본값을 따름) */
  privacyChosen?: boolean;
  /** 내가 모래 게시판에 쓴 글 id (신고 버튼 대신 '내가 남긴 글') */
  mySand: string[];
  /** 내가 신고해서 숨긴 모래 게시판 글 id */
  hiddenSand: string[];
  /** 소원 창에서 고르는 문구 목록을 펼쳐 둘지 (기본: 펼침) */
  showPresets: boolean;
  /** 다른 사람의 소원 글자를 볼지 (기본: 봄) */
  seeWishes: boolean;
  /** 푸시 알림을 예약해 둔 일출 시각 */
  remindAt?: number;
  /** 배경 소리 켜짐 (기본 켜짐) */
  soundOn: boolean;
}

function load(): Partial<Saved> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
const raw = load();
// 저장된 값은 모두 그대로 살리고(...raw), 없는 것만 기본값으로 채움
export const store: Saved = {
  ...raw,
  days: raw.days ?? {},
  alarm: raw.alarm ?? { on: false },
  hinted: raw.hinted,
  uid: raw.uid ?? (crypto.randomUUID?.() ?? String(Math.random()).slice(2)),
  nick: raw.nick ?? `${pick(ADJ)} ${pick(NOUN)}`,
  look: raw.look ?? { body: Math.floor(Math.random() * BODY_COLORS.length), hat: Math.floor(Math.random() * HAT_COLORS.length) },
  wokeOn: raw.wokeOn,
  installSnooze: raw.installSnooze,
  remindAt: raw.remindAt,
  // 직접 고른 적이 없으면 기본은 공개
  shareWish: raw.privacyChosen ? raw.shareWish ?? true : true,
  privacyChosen: raw.privacyChosen,
  showPresets: raw.showPresets ?? true,
  mySand: raw.mySand ?? [],
  hiddenSand: raw.hiddenSand ?? [],
  seeWishes: raw.seeWishes ?? true,
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
