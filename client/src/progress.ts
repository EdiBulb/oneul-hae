// 봉황이 되는 길: 청학당에서 배우는 스킬 15개 + 전래 동화 퀘스트.
// 저장은 store(이 브라우저)에. 나중에 서버 백업을 붙일 때도 이 모양 그대로 보냄.
import { store, save, dateKey } from './store';

// ---------- 스킬 ----------
export type SkillId =
  | 'stars' | 'birds' | 'clouds' | 'hanja' | 'herbs'
  | 'dokkaebi' | 'fire' | 'paint' | 'song' | 'wind' | 'shift'
  | 'patience' | 'mind' | 'share' | 'fly';
export type Mado = 'read' | 'body' | 'heart';
export interface Skill { id: SkillId; mado: Mado; ko: string; en: string; does: string; needs?: SkillId }
export const SKILLS: Skill[] = [
  { id: 'stars', mado: 'read', ko: '별자리 읽기', en: 'Reading Stars', does: '누우면 별이 이어지고 이름이 떠요' },
  { id: 'birds', mado: 'read', ko: '새소리 듣기', en: 'Bird Talk', does: '새들의 말이 말풍선으로 보여요' },
  { id: 'clouds', mado: 'read', ko: '구름 읽기', en: 'Reading Clouds', does: '내일 아침 운해·구름을 미리 알아요' },
  { id: 'hanja', mado: 'read', ko: '한자 읽기', en: 'Reading Hanja', does: '새김돌의 뜻과 숨은 이야기가 풀려요' },
  { id: 'herbs', mado: 'read', ko: '약초 알기', en: 'Herb Lore', does: '꽃밭·길가에서 약초가 반짝여요' },
  { id: 'dokkaebi', mado: 'body', ko: '도깨비불 보기', en: 'Goblin Fire Sight', does: '밤 숲에 길잡이 불이 보여요' },
  { id: 'fire', mado: 'body', ko: '불 다스리기', en: 'Taming Fire', does: '등불·아궁이·모닥불을 켤 수 있어요' },
  { id: 'paint', mado: 'body', ko: '색칠하기', en: 'Painting', does: '꽃물로 물건에 색을 입혀요' },
  { id: 'song', mado: 'body', ko: '노래하기', en: 'Singing', does: '노래 박자 놀이, 다른 병아리와 합창' },
  { id: 'wind', mado: 'body', ko: '바람 타기', en: 'Riding the Wind', does: '높은 곳에서 뛰면 잠깐 활공해요' },
  { id: 'shift', mado: 'body', ko: '변신술', en: 'Shapeshifting', does: '잠깐 돌멩이·나뭇잎·우렁이로 변해요' },
  { id: 'patience', mado: 'heart', ko: '참을성', en: 'Patience', does: '기다려야 자라는 걸 돌볼 수 있어요' },
  { id: 'mind', mado: 'heart', ko: '마음 읽기', en: 'Reading Hearts', does: '머리 위에 속마음이 한 줄 보여요' },
  { id: 'share', mado: 'heart', ko: '나누기', en: 'Sharing', does: '내 것을 다른 병아리·NPC에게 줘요' },
  { id: 'fly', mado: 'heart', ko: '날기', en: 'Flight', does: '진짜로 날 수 있어요', needs: 'wind' },
];
export const skillById = (id: SkillId) => SKILLS.find(s => s.id === id)!;
/** 0 = 아직, 1 = 한 번 배움(익히는 중), 2 = 익힘 */
export const skillLv = (id: SkillId): 0 | 1 | 2 => (store.skills?.[id] ?? 0) as 0 | 1 | 2;
export const hasSkill = (id: SkillId) => skillLv(id) >= 2;
export const learnCount = () => Object.values(store.skills ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);
export const skillsDone = () => SKILLS.filter(s => hasSkill(s.id)).length;

/** 오늘 배울 수 있는지: 해를 본 날, 하루 한 번 */
export function canLearnToday(sawSunToday: boolean) {
  return sawSunToday && store.learnDay !== dateKey(Date.now());
}
/** 훈장님이 내미는 셋: 익히는 중인 것이 있으면 그게 먼저(이어서 익히기), 그다음 지금 퀘스트에 필요한 것, 나머지는 순서대로 */
export function lessonChoices(): SkillId[] {
  const half = SKILLS.filter(s => skillLv(s.id) === 1).map(s => s.id);
  if (half.length) return half.slice(0, 1);
  const open = SKILLS.filter(s => skillLv(s.id) === 0 && (!s.needs || hasSkill(s.needs))).map(s => s.id);
  const wanted = neededSkills().filter(id => open.includes(id));
  const rest = open.filter(id => !wanted.includes(id));
  return [...wanted, ...rest].slice(0, 3);
}
export function learn(id: SkillId) {
  store.skills ??= {};
  const lv = Math.min(2, skillLv(id) + 1);
  store.skills[id] = lv; store.learnDay = dateKey(Date.now()); save();
  emit({ kind: 'skill', id, lv });
  return lv;
}

// ---------- 퀘스트 ----------
export type QuestId = 'jara' | 'bangmang' | 'heungbu' | 'ureong' | 'haedal' | 'seonnyeo' | 'kkachi' | 'gyeonu'
  | 'hokburi' | 'patjuk' | 'kongjwi' | 'tteok' | 'bang';
export interface Step { ko: string; need?: SkillId; when?: 'night' | 'dawn'; where?: string }
export interface Quest { id: QuestId; main: boolean; title: string; tale: string; place: string; icon: string; steps: Step[] }
export const QUESTS: Quest[] = [
  { id: 'jara', main: true, title: '자라 할아범의 물안경', tale: '별주부전', place: '청학지', icon: '🐢', steps: [
    { ko: '자라 할아범의 고민 듣기', where: '청학지 선착장' },
    { ko: '연못가 파란 불똥 자국 살펴보기', where: '청학지 둘레' },
    { ko: '청학당에서 도깨비불 보기 배우기', need: 'dokkaebi', where: '청학당' },
    { ko: '밤에 도깨비불을 따라 도깨비 소굴 찾기', need: 'dokkaebi', when: 'night', where: '청학당 맞은편 숲 (길 왼쪽 아래)' },
    { ko: '마고할미에게 메밀묵 얻기', where: '둥지 옆 마고할미' },
    { ko: '도깨비에게 메밀묵을 주고 물안경 받기', when: 'night', where: '도깨비 소굴' },
    { ko: '자라 할아범에게 물안경 돌려주기', where: '청학지 선착장' },
  ] },
  { id: 'bangmang', main: true, title: '뚝딱이의 잃어버린 방망이', tale: '도깨비 방망이 × 금도끼 은도끼', place: '청학지', icon: '🪵', steps: [
    { ko: '뚝딱이 대장의 고민 듣기', when: 'night', where: '도깨비 소굴' },
    { ko: '자라 할아범이 건져 온 비석 살펴보기', where: '청학지 선착장' },
    { ko: '청학당에서 한자 읽기 배우기', need: 'hanja', where: '청학당' },
    { ko: '비석의 글 읽기', need: 'hanja', where: '청학지 선착장' },
    { ko: '새벽에 연못에 조약돌 셋 던지기', when: 'dawn', where: '청학지 선착장' },
    { ko: '산신령에게 참말로 대답하기', when: 'dawn', where: '청학지 선착장' },
    { ko: '뚝딱이에게 방망이 돌려주기', when: 'night', where: '도깨비 소굴' },
  ] },
  { id: 'heungbu', main: true, title: '윷판의 흥부', tale: '흥부와 놀부', place: '장터목', icon: '🎋', steps: [
    { ko: '놀부의 부탁 듣기', where: '장터목 마당' },
    { ko: '윷판에서 흥부와 한 판 두기', where: '장터목 윷판' },
    { ko: '마음 읽기로 흥부의 속마음 보기', need: 'mind', where: '장터목 윷판' },
    { ko: '새소리 듣기로 제비의 말 알아듣기', need: 'birds', where: '윷판 옆 제비' },
    { ko: '흥부와 박에 물 주기 (1/3)', need: 'patience', where: '윷판 옆 박 넝쿨' },
    { ko: '흥부와 박에 물 주기 (2/3)', need: 'patience', where: '윷판 옆 박 넝쿨' },
    { ko: '흥부와 박에 물 주기 (3/3)', need: 'patience', where: '윷판 옆 박 넝쿨' },
    { ko: '박을 타고, 흥부와 함께 놀부에게', where: '장터목 마당' },
  ] },
  { id: 'ureong', main: true, title: '숨을 곳이 없는 우렁각시', tale: '우렁각시', place: '청학지', icon: '🐚', steps: [
    { ko: '둥지에 차려진 아침상 살펴보기', where: '둥지' },
    { ko: '밤에 연못 쪽으로 사라지는 그림자 따라가기', when: 'night', where: '청학지 둘레' },
    { ko: '연못가에서 우렁각시 만나기', where: '청학지 둘레' },
    { ko: '청학당에서 변신술 배우기', need: 'shift', where: '청학당' },
    { ko: '거울 놀이로 우렁각시 이해하기', need: 'shift', where: '청학지 둘레' },
  ] },
  { id: 'haedal', main: true, title: '해 오라비와 달 누이', tale: '해님 달님', place: '천왕봉', icon: '🌗', steps: [
    { ko: '새벽 정상에서 지는 달의 속마음 듣기', need: 'mind', when: 'dawn', where: '천왕봉 정상' },
    { ko: '청학당에서 구름 읽기 배우기', need: 'clouds', where: '청학당' },
    { ko: '달 누이의 말을 해 오라비에게 (1/3)', need: 'clouds', when: 'dawn', where: '천왕봉 정상' },
    { ko: '달 누이의 말을 해 오라비에게 (2/3)', need: 'clouds', when: 'dawn', where: '천왕봉 정상' },
    { ko: '달 누이의 말을 해 오라비에게 (3/3)', need: 'clouds', when: 'dawn', where: '천왕봉 정상' },
  ] },
  { id: 'seonnyeo', main: true, title: '빛바랜 날개옷', tale: '선녀와 나무꾼', place: '청학지', icon: '🧚', steps: [
    { ko: '밤 연못의 선녀 만나기', when: 'night', where: '청학지 둘레' },
    { ko: '청학당에서 색칠하기 배우기', need: 'paint', where: '청학당' },
    { ko: '꽃밭에서 다섯 빛 꽃물 모으기', need: 'paint', where: '제석봉 아래 꽃밭' },
    { ko: '날개옷을 물들이고 선녀 배웅하기', when: 'night', where: '청학지 둘레' },
  ] },
  { id: 'kkachi', main: true, title: '배탈 난 까치들', tale: '은혜 갚은 까치', place: '모이 마당', icon: '🐦', steps: [
    { ko: '기운 없는 까치의 말 알아듣기', need: 'birds', where: '모이 마당' },
    { ko: '청학당에서 약초 알기 배우기', need: 'herbs', where: '청학당' },
    { ko: '길가에서 약초 세 가지 찾기', need: 'herbs', where: '등산로 길가' },
    { ko: '마고할미 솥에 약초 달이기', where: '둥지 옆 마고할미' },
    { ko: '까치 대장에게 약 먹이기', where: '모이 마당' },
  ] },
  { id: 'gyeonu', main: true, title: '은하수 다리', tale: '견우와 직녀', place: '은하수', icon: '🌌', steps: [
    { ko: '밤에 누워서 견우성과 직녀성 찾기', need: 'stars', when: 'night', where: '어디서나 (누워서 하늘 보기)' },
    { ko: '직녀의 부탁 듣기', when: 'night', where: '천왕봉 정상' },
    { ko: '청학당에서 바람 타기 배우기', need: 'wind', where: '청학당' },
    { ko: '청학당에서 날기 배우기', need: 'fly', where: '청학당' },
    { ko: '밤에 날아올라 은하수에 다리 놓기', need: 'fly', when: 'night', where: '천왕봉 정상' },
  ] },
  { id: 'hokburi', main: false, title: '혹 떼러 온 영감', tale: '혹부리 영감', place: '밤 숲', icon: '🎵', steps: [
    { ko: '도깨비 소굴에서 영감 만나기', when: 'night', where: '도깨비 소굴' },
    { ko: '영감과 함께 노래 박자 맞추기', need: 'song', when: 'night', where: '도깨비 소굴' },
  ] },
  { id: 'tteok', main: false, title: '배고픈 채식 호랑이', tale: '떡 하나 주면 안 잡아먹지', place: '고갯길', icon: '🐯', steps: [
    { ko: '고갯길을 막은 호랑이 만나기', where: '둥지 아래 고갯길' },
    { ko: '마고할미 솥에 놀부 쌀로 떡 찌기', need: 'fire', where: '둥지 옆 마고할미' },
    { ko: '호랑이에게 떡 나눠 주기', need: 'share', where: '둥지 아래 고갯길' },
  ] },
  { id: 'patjuk', main: false, title: '불이 안 붙는 아궁이', tale: '팥죽 할머니와 호랑이', place: '산아랫마을', icon: '🥣', steps: [
    { ko: '팥죽 할머니의 고민 듣기', where: '산아랫마을' },
    { ko: '아궁이 불 살리기', need: 'fire', where: '산아랫마을' },
  ] },
  { id: 'kongjwi', main: false, title: '깨진 독', tale: '콩쥐 팥쥐', place: '산아랫마을', icon: '🏺', steps: [
    { ko: '콩쥐의 고민 듣기', where: '산아랫마을' },
    { ko: '진흙으로 메우고 구워 독 고치기', need: 'fire', where: '산아랫마을' },
    { ko: '은퇴한 두꺼비 허리에 약초 붙여 주기', need: 'herbs', where: '산아랫마을' },
  ] },
  { id: 'bang', main: false, title: '참느라 노래진 며느리', tale: '방귀쟁이 며느리', place: '산아랫마을', icon: '💨', steps: [
    { ko: '얼굴이 노래진 며느리 만나기', where: '산아랫마을' },
    { ko: '바람 타기 연습에 힘을 빌리기', need: 'wind', where: '산아랫마을' },
  ] },
];
export const questById = (id: QuestId) => QUESTS.find(q => q.id === id)!;
/** -1 = 아직 모름, 0..steps.length-1 = 지금 할 단계, steps.length = 끝 */
export const questStep = (id: QuestId) => store.quests?.[id] ?? -1;
export const questDone = (id: QuestId) => questStep(id) >= questById(id).steps.length;
export const questActive = (id: QuestId) => { const s = questStep(id); return s >= 0 && !questDone(id); };
export function startQuest(id: QuestId) {
  if (questStep(id) >= 0) return;
  store.quests ??= {}; store.quests[id] = 0; save(); emit({ kind: 'quest', id, step: 0 });
}
/** 지금 단계를 끝냄 (from을 주면 그 단계일 때만: 두 번 눌러도 한 칸만) */
export function advance(id: QuestId, from?: number) {
  const s = questStep(id); if (s < 0 || questDone(id) || (from !== undefined && s !== from)) return false;
  store.quests![id] = s + 1; save(); emit({ kind: 'quest', id, step: s + 1 });
  return true;
}
/** 지금 진행 중인 퀘스트들이 이번 단계에서 필요로 하는 (아직 없는) 스킬 */
export function neededSkills(): SkillId[] {
  const out: SkillId[] = [];
  for (const q of QUESTS) { const s = questStep(q.id); if (s < 0 || s >= q.steps.length) continue; const need = q.steps[s].need; if (need && !hasSkill(need) && !out.includes(need)) out.push(need); }
  return out;
}
/** 봉황이 될 수 있는지: 스킬 15개 + 메인 퀘스트 8개 */
export const phoenixReady = () => skillsDone() === SKILLS.length && QUESTS.filter(q => q.main).every(q => questDone(q.id));

// ---------- 바뀜 알림 (화면의 📜 점, 스킬북 다시 그리기 등) ----------
export type ProgEvent = { kind: 'skill'; id: SkillId; lv: number } | { kind: 'quest'; id: QuestId; step: number } | { kind: 'reset' };
const subs: ((e: ProgEvent) => void)[] = [];
export const onProgress = (f: (e: ProgEvent) => void) => { subs.push(f); };
function emit(e: ProgEvent) { for (const f of subs) f(e); }

// ---------- 테스트용 (window.__hae.prog) ----------
export const progDebug = {
  skill(id: SkillId, lv: 0 | 1 | 2) { store.skills ??= {}; store.skills[id] = lv; save(); emit({ kind: 'skill', id, lv }); },
  allSkills(lv: 0 | 1 | 2 = 2) { store.skills = Object.fromEntries(SKILLS.map(s => [s.id, lv])); save(); emit({ kind: 'reset' }); },
  quest(id: QuestId, step: number) { store.quests ??= {}; store.quests[id] = step; save(); emit({ kind: 'quest', id, step }); },
  learnAgain() { store.learnDay = undefined; save(); },
  reset() { store.skills = {}; store.quests = {}; store.learnDay = undefined; store.qday = {}; store.qbag = {}; store.keeps = []; store.phoenix = undefined; save(); emit({ kind: 'reset' }); },
  /** 하루 제한(매일 한 번 단계) 풀기 */
  newDay() { store.qday = {}; store.learnDay = undefined; save(); },
  allQuests() { store.quests = Object.fromEntries(QUESTS.map(q => [q.id, q.steps.length])); save(); emit({ kind: 'reset' }); },
  dump: () => ({ skills: store.skills, quests: store.quests, learnDay: store.learnDay, learnCount: learnCount(), phoenix: phoenixReady() }),
};

// ---------- 훈장님의 가르침 (첫 배움 / 익힘) ----------
export const LESSON: Record<SkillId, [string, string]> = {
  stars: ['별은 따로 떠 있는 게 아니라네.\n이어 보는 눈이 있으면 이야기가 되지.', '이제 누워서 하늘을 보게.\n별들이 자네에게 이름을 말해 줄 게다.'],
  birds: ['새는 늘 말하고 있었네.\n우리가 안 들었을 뿐이지.', '이제 들리겠지.\n참새는 수다쟁이고, 까치는 소식꾼이라네.'],
  clouds: ['구름은 내일을 먼저 아는 녀석들이야.\n바람의 결을 보게.', '이제 저녁 하늘을 보면\n내일 아침이 보일 게야.'],
  hanja: ['글자 하나에 그림 하나.\n天은 사람 위에 큰 하늘이라네.', '이제 돌에 새긴 글들이\n자네에게 말을 걸 게다.'],
  herbs: ['꽃밭의 풀은 다 같아 보여도\n저마다 하는 일이 있네.', '이제 약이 되는 풀은\n자네 눈에 반짝일 게야.'],
  dokkaebi: ['밤 숲의 파란 불은 무서운 게 아니라네.\n길을 아는 녀석들이지.', '이제 밤에 숲에 가 보게.\n도깨비불이 길을 일러 줄 게다.'],
  fire: ['불은 세게 부는 게 아니라\n살살 달래는 거라네.', '이제 꺼져 가는 불씨도\n자네 숨결이면 살아날 게야.'],
  paint: ['색은 꽃이 빌려주는 거라네.\n고맙다고 하고 받게.', '이제 꽃물로\n바랜 것에 다시 빛을 입힐 수 있네.'],
  song: ['노래는 잘하는 게 아니라\n같이 하는 거라네.', '이제 박자를 타 보게.\n도깨비들도 따라 부를 게다.'],
  wind: ['날개는 힘으로 퍼덕이는 게 아니라네.\n바람에 몸을 맡기게.', '이제 높은 데서 뛰어 보게.\n바람이 자네를 잠깐 들어 줄 게야.'],
  shift: ['되고자 한다는 것은 잊게.\n그저 그들을 이해하게.', '상대를 이해하고 나면\n그들과 같아질 수 있네.'],
  patience: ['박도, 사람도\n하루아침에 여물지 않네.', '이제 기다림이 무엇을 키우는지\n보게 될 게다.'],
  mind: ['말보다 먼저 마음이 있네.\n얼굴 너머를 보게.', '이제 누군가의 머리 위에\n속마음이 한 줄 보일 게야.'],
  share: ['손에 쥔 것은 하나지만\n나누면 둘이 기뻐지네.', '이제 자네 것을\n누구에게든 건넬 수 있네.'],
  fly: ['자네도 들었겠지.\n하늘을 나는 닭이 있다는 소문을.', '이제 자네가 그 닭일세.\n…날아 보게.'],
};
