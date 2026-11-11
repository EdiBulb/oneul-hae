// 전래 동화 퀘스트: 이웃(NPC)과 물건 자리를 세계에 놓고, 단계마다 조건(스킬·밤/새벽·하루 한 번)을 보고 대화를 이어 감.
// 줄거리는 세계관 문서 '퀘스트와 스킬' 탭 그대로. 대사는 짧게 (설명은 📜 이야기 보따리가 맡음).
import * as THREE from 'three';
import { trailX, POND, FOREST, VILLAGE, TRAIL } from './beach-extras';
import { NEST } from './mountain-scenery';
import { FEED_AT } from './feed';
import { faceAngle } from './character';
import { store, save, dateKey } from './store';
import { QUESTS, questById, questStep, questDone, startQuest, advance, hasSkill, skillById, onProgress, type QuestId } from './progress';
import { regionOpen } from './regions';
import { dokkaebi, ureongGaksi, folk, tiger, littleBird, toad, spot } from './npcs';
import type { createNpcs } from './npc';
import { addSpeaker } from './talk';

type L = [string, string];
export interface QuestCtx {
  scene: THREE.Scene; npcs: ReturnType<typeof createNpcs>;
  floor: (x: number, z: number) => number; me: () => THREE.Vector3;
  say: (lines: L[]) => Promise<void>; ask: (who: string, text: string, choices: string[]) => Promise<number>;
  toast: (m: string) => void; night: () => boolean; dawn: () => boolean; sawSun: () => boolean; lying: () => boolean;
  /** 화면을 어둡게 했다가 그 자리로 옮김 */
  warp: (x: number, z: number, face: number) => Promise<void>;
  /** 하늘로 떠오르는 장면 (은하수 다리): 높이(m), 그동안 fn 실행 */
  soar: (h: number, fn: () => Promise<void>) => Promise<void>;
  magoTalk: () => Promise<void>; track: (e: string, p?: Record<string, unknown>) => void;
}

// ---------- 자리 ----------
const rim = (a: number, d = 1.16) => ({ x: POND.x + Math.cos(a) * POND.rx * d, z: POND.z + Math.sin(a) * POND.rz * d });
const side = (z: number, dx: number) => ({ x: trailX(z) + dx, z });
const ISLE = { x: POND.x + POND.isle.dx, z: POND.z + POND.isle.dz };
export const SPOTS = {
  jara: { x: POND.x + POND.rx * 0.82, z: POND.z }, dock: { x: POND.x + POND.rx * 1.2, z: POND.z + 1.2 }, isleShore: { x: ISLE.x + 2.2, z: ISLE.z + 1.2 },
  clue: rim(-0.2), bisok: rim(0.16, 1.22), pebble: rim(-0.1, 1.12), sansin: { x: POND.x + POND.rx * 0.8, z: POND.z - 2.6 },
  ureong: rim(0.38), shadow: side(40, -6), seonnyeo: rim(-0.38), sang: { x: NEST.x + 1.7, z: NEST.z + 0.9 },
  den: { x: FOREST.x, z: FOREST.z }, hokburi: { x: FOREST.x + 3.5, z: FOREST.z + 3 },
  nolbu: side(89, 5.2), heungbu: side(94.5, 5.6), jebi: side(96.2, 4.4), bak: side(96.6, 7.2),
  kkachi: { x: FEED_AT.x - 2.4, z: FEED_AT.z + 1.2 }, dal: { x: 1.6, z: 1.3 }, jiknyeo: { x: -2.2, z: 1.4 },
  tiger: side(TRAIL.end - 0.2, 0.3), patjuk: { x: VILLAGE.x - 6, z: VILLAGE.z - 3 }, kongjwi: { x: VILLAGE.x + 6, z: VILLAGE.z - 1 }, dukkeobi: { x: VILLAGE.x + 7.6, z: VILLAGE.z + 1.4 }, bang: { x: VILLAGE.x - 1, z: VILLAGE.z + 6 },
  herbs: [side(58, -5), side(47, -4.6), side(76, 5.4)], flowers: [42, 48, 54, 60, 66].map(z => side(z, 6)),
};

// ---------- 줄거리 ----------
interface Script {
  npc?: string; lines?: L[];
  /** 저절로 넘어감: skill = 필요한 스킬을 익히면, lie = 밤에 누워 하늘을 보면 */
  auto?: 'skill' | 'lie';
  /** 물건 모으기 (prop id들) */
  collect?: string[];
  /** 하루 한 번 (앞 단계와 다른 날) */
  daily?: boolean;
  /** 대화 대신 놀이: true면 통과 */
  play?: 'yut' | 'mirror' | 'sansin' | 'rhythm' | 'bridge';
}
const SCRIPT: Record<QuestId, Script[]> = {
  jara: [
    { npc: 'jara', lines: [['jara', '에구… 물안경을 잃어버렸다네.\n그게 없으면 오래 잠수를 못 해.'], ['jara', '토끼 녀석 이후로\n두 번째 큰 망신일세.'], ['me', '(연못가에 뭔가 흔적이 있을지도 몰라.)']] },
    { npc: 'clue', lines: [['me', '(돌 위에 파란 불똥 자국이 있다.\n…차갑고, 살짝 반짝인다.)'], ['jara', '파란 불똥? 밤 숲 도깨비들 짓이로구먼!\n그 녀석들은 도깨비불을 볼 줄 알아야 찾는다네.'], ['me', '(청학당 훈장님께 여쭤보자.)']] },
    { auto: 'skill' },
    { npc: 'ttuk', lines: [['dok', '앗, 병아리다! 병아리가 우릴 찾았다!'], ['ttuk', '무, 물안경? …그래, 우리가 빌렸어.\n연못에 빠뜨린 걸 찾으려고.'], ['ttuk', '그냥은 못 줘. 도깨비는 공짜가 없거든.\n메밀묵! 메밀묵을 가져오면 바꿔 주지.'], ['me', '(메밀묵이라면… 마고할미?)']] },
    { npc: 'mago', lines: [['mago', '도깨비 녀석들이 메밀묵을 달래?\n허허, 예나 지금이나.'], ['mago', '자, 어제 쑨 거라네.\n흘리지 말고 가져가게.'], ['me', '(메밀묵을 받았다! 탱글탱글하다.)']] },
    { npc: 'ttuk', lines: [['dok', '메밀묵이다! 메밀묵!'], ['ttuk', '약속은 약속이지. 자, 물안경.\n…자라 영감한테 미안하다고 전해 줘.'], ['me', '(물안경을 받았다!)']] },
    { npc: 'jara', lines: [['jara', '오오, 내 물안경!\n이제야 물속이 훤하겠구먼.'], ['jara', '고맙네. 연못 바닥에서 이상한 돌을 봤는데,\n내 건져다 놓음세.'], ['jara', '자, 이건 내가 쓰던 헌 물안경일세.\n자네 머리에 딱이야.']] },
  ],
  bangmang: [
    { npc: 'ttuk', lines: [['ttuk', '사실은… 내 방망이를 연못에 빠뜨렸어.\n방망이 없으면 금 나와라 뚝딱도 못 해.'], ['dok', '대장은 방망이 없으면 그냥 큰 도깨비야!'], ['ttuk', '…그 말은 하지 말랬지.'], ['me', '(자라 할아범이 건져 놓은 돌에 뭔가 있을지도.)']] },
    { npc: 'bisok', lines: [['me', '(오래된 비석이다. 글자가 빼곡한데…\n하나도 못 읽겠다.)'], ['me', '(한자를 배워야겠어.)']] },
    { auto: 'skill' },
    { npc: 'bisok', lines: [['me', '(이제 읽힌다!)'], ['me', '(“참말하는 자,\n새벽 물에 조약돌 셋을 던지면 나오리라.”)'], ['me', '(새벽에 다시 오자.)']] },
    { npc: 'pebble', lines: [['me', '(퐁. 퐁. …퐁.)'], ['me', '(물이 환해진다…!)'], ['sansin', '어흠. 누가 나를 불렀느냐.']] },
    { npc: 'sansin', play: 'sansin', lines: [['sansin', '허허, 참말하는 병아리로구나.\n옜다, 셋 다 가져가거라.'], ['me', '(금방망이, 은방망이, 낡은 나무 방망이를 받았다!)']] },
    { npc: 'ttuk', lines: [['ttuk', '내, 내 방망이…! 이 손때 묻은 거!'], ['ttuk', '금 나와라 뚝딱! …은 나와라 뚝딱!\n됐다, 된다!'], ['ttuk', '은방망이는 네가 가져. 도깨비는 은혜도 갚아.\n밤에 놀러 와, 잔치할 테니까.']] },
  ],
  heungbu: [
    { npc: 'nolbu', lines: [['nolbu', '아우 흥부가 윷판에서 내기만 한다네.\n돈을 주면 또 윷판에 갖다 바치고.'], ['nolbu', '흥부랑 윷판해서 이기면,\n더 이상 도박을 안 하기로 약속했네.'], ['nolbu', '나는 손이 떨려서 안 돼.\n자네가 나 좀 도와주게.']] },
    { npc: 'heungbu', play: 'yut', lines: [['heungbu', '졌다, 졌어!\n…약속은, 음, 내일부터 지킬게.'], ['me', '(약속을 미룬다. 속으로는 무슨 생각일까?)']] },
    { npc: 'heungbu', lines: [['me', '(흥부의 머리 위에 속마음이 보인다.)'], ['heungbu', '(형한테 미안해서…\n얼굴을 못 보겠어.)'], ['me', '(놀기 좋아서가 아니었구나.)']] },
    { npc: 'jebi', lines: [['jebi', '지지배배! 다리 고쳐 준 사람 찾아왔더니\n윷이나 놀고 있네.'], ['jebi', '박씨를 줄게.\n단, 흥부 제 손으로 키우게 해.'], ['me', '(박씨를 받았다. 흥부와 같이 심자.)']] },
    { npc: 'bak', daily: true, lines: [['heungbu', '이걸… 내가 심으라고?'], ['me', '(흥부가 서툰 손으로 물을 준다.\n작은 싹이 났다.)']] },
    { npc: 'bak', daily: true, lines: [['heungbu', '어, 벌써 넝쿨이!\n…윷판 갈 시간에 여기 오게 되네.'], ['me', '(넝쿨이 담을 타고 올라간다.)']] },
    { npc: 'bak', daily: true, lines: [['heungbu', '박이 열렸어! 이렇게 큰 박이!'], ['me', '(사흘을 기다렸다. 이제 탈 차례다.)']] },
    { npc: 'nolbu', lines: [['me', '(슬근슬근 톱질하세~ 박이 쩍 갈라졌다.)'], ['me', '(보물은 없다.\n낡은 표주박 하나와 편지 한 장.)'], ['heungbu', '이건… 어릴 적 형이랑 같이 쓰던 거야.\n엄마 글씨네. “둘이 나눠 마셔라.”'], ['heungbu', '…형. 미안해.'], ['nolbu', '이 녀석아. 밥은 먹었느냐.\n들어오너라.'], ['nolbu', '고맙네. 곳간 쌀을 좀 가져가게.\n떡이라도 쪄 먹어.']] },
  ],
  ureong: [
    { npc: 'sang', lines: [['me', '(둥지 옆에 아침상이 차려져 있다.\n밥 한 그릇, 나물 한 접시. 아직 따뜻하다.)'], ['me', '(누가 차린 거지…?\n밤에 지켜보면 알 수 있을지도.)']] },
    { npc: 'shadow', lines: [['me', '(작은 그림자가 살금살금 지나간다.\n소반을 들고… 연못 쪽으로!)'], ['me', '(따라가 보자.)']] },
    { npc: 'ureong', lines: [['ureong', '꺅! 들켰다!'], ['ureong', '나, 원래 우렁이야. 몰래 상만 차리고\n우렁이로 돌아가 숨어야 하는데…'], ['ureong', '돌아가지지가 않아!\n어디 숨어야 할지 모르겠어.'], ['ureong', '변신술을 가르쳐 줘!']] },
    { auto: 'skill' },
    { npc: 'ureong', play: 'mirror', lines: [['ureong', '아…! 알 것 같아.\n되려고 애쓰지 않아도 되는 거구나.'], ['me', '(우렁각시가 우렁이로 쏙 들어갔다!)'], ['ureong', '고마워! 이제 매일 아침\n모이 마당에도 상을 차려 둘게.']] },
  ],
  haedal: [
    { npc: 'dal', lines: [['me', '(지는 달의 속마음이 보인다.)'], ['dal', '(오라버니… 오늘도 얼굴만 스치고 가네.\n한 번도 이야기를 못 했어.)'], ['me', '(해와 달은 새벽 이 순간에만 겹친다.\n내가 말을 전해 줄 수 있을까?)'], ['me', '(해가 구름에 가리는 날을 미리 알면\n기다리게 할 수 있을 텐데.)']] },
    { auto: 'skill' },
    { npc: 'dal', daily: true, lines: [['dal', '오라버니께 전해 줘.\n“밤길은 내가 밝힐 테니 걱정 마.”'], ['hae', '…누이가? 허허.\n“낮은 내가 맡으마” 전해 다오.'], ['say', '내일은 구름이 껴서\n조금 늦게 보일 거예요.'], ['hae', '그럼 기다리마.']] },
    { npc: 'dal', daily: true, lines: [['dal', '“호랑이는 이제 안 무서워?” 물어봐 줘.'], ['hae', '하하! “동아줄 잡던 손이 아직 얼얼하다” 해라.'], ['me', '(둘 다 웃는다. 하늘이 조금 더 환하다.)']] },
    { npc: 'dal', daily: true, lines: [['dal', '오늘은 내가 조금만 더 있다 갈게.'], ['me', '(해가 떴는데 달이 지지 않는다.\n…낮달이다!)'], ['hae', '누이야. 오랜만이구나.'], ['dal', '오라버니.'], ['me', '(오누이가 처음으로 같은 하늘에 있다.)']] },
  ],
  seonnyeo: [
    { npc: 'seonnyeo', lines: [['seonnyeo', '어머, 병아리네. 옷 숨기러 온 건 아니지?'], ['seonnyeo', '날개옷 빛이 다 바래서\n하늘로 올라갈 수가 없어.'], ['seonnyeo', '그이는 반성했어.\n이번엔… 빨래 실수야.'], ['me', '(꽃물로 다시 물들일 수 있을까?)']] },
    { auto: 'skill' },
    { collect: ['f0', 'f1', 'f2', 'f3', 'f4'], lines: [['me', '(다섯 빛 꽃물을 다 모았다!\n밤에 선녀에게 가자.)']] },
    { npc: 'seonnyeo', lines: [['me', '(분홍, 노랑, 파랑, 빨강, 하양.\n날개옷에 빛이 스며든다.)'], ['seonnyeo', '예쁘다…! 전보다 더 고와.'], ['seonnyeo', '고마워. 무지개가 뜨면\n내가 인사하는 줄 알아.'], ['me', '(선녀가 무지개를 타고 올라간다.)']] },
  ],
  kkachi: [
    { npc: 'kkachi', lines: [['kkachi', '깍… 깍… 배가…\n상한 열매를 다 같이 먹었어…'], ['kkachi', '곧 다리 놓으러 가야 하는데\n다들 누워만 있어.'], ['me', '(약이 되는 풀이 있을 텐데.)']] },
    { auto: 'skill' },
    { collect: ['h0', 'h1', 'h2'], lines: [['me', '(약초 세 가지를 다 찾았다.\n마고할미 솥에 달이자.)']] },
    { npc: 'mago', lines: [['mago', '오, 약초를 알아보는구먼.\n솥은 내가 봐 줄 테니 저어 보게.'], ['me', '(보글보글. 쓴 냄새가 난다.\n약이 다 됐다!)']] },
    { npc: 'kkachi', lines: [['kkachi', '써! …근데 배가 안 아파!'], ['kkachi', '그래도 아직 날 기운은 없어.\n더 쉬어야 해.'], ['kkachi', '나 대신 그 둘을 만나게 해 줘!\n들은 적이 있어, 하늘을 날 수 있는 닭이 있다고!'], ['kkachi', '은혜는 꼭 갚는다, 까치는.']] },
  ],
  gyeonu: [
    { auto: 'lie' },
    { npc: 'jiknyeo', lines: [['jiknyeo', '까치들이 올해는 못 온대.'], ['jiknyeo', '너도 새 같은데… 혹시\n우리의 다리를 놓아 줄 수 있니?'], ['me', '(흠칫… 나는 날지 못하는데?)'], ['me', '(까치가 그랬지.\n하늘을 나는 닭이 있다고…)'], ['me', '(청학당 훈장님께 여쭤보자.)']] },
    { auto: 'skill' },
    { auto: 'skill' },
    { npc: 'jiknyeo', play: 'bridge', lines: [['jiknyeo', '…고마워. 정말 고마워.'], ['gyeonu', '작은 날개로 큰 다리를 놓았구나.'], ['me', '(은하수 위에서 두 사람이 만났다.)']] },
  ],
  hokburi: [
    { npc: 'hokburi', lines: [['hokburi', '도깨비들이 노래 잘하면 혹을 떼 준다는데,\n나는 음치라네.'], ['hokburi', '같이 불러 줄 이가 있으면 좋으련만.']] },
    { npc: 'hokburi', play: 'rhythm', lines: [['dok', '얼쑤! 좋다!'], ['ttuk', '둘이 부르니 들을 만하네.\n혹은… 정들었을 텐데 그냥 둬.'], ['hokburi', '허허, 그러고 보니 그렇구먼!']] },
  ],
  tteok: [
    { npc: 'tiger', lines: [['tiger', '어흥… 떡 하나 주면 안 잡아먹지.'], ['tiger', '아니, 안 잡아먹어. 나 채식한 지 오래야.\n그냥… 배가 고파서.'], ['tiger', '떡이 생기기 전엔 못 비켜.\n힘이 없어서 못 일어나.'], ['me', '(놀부네 쌀로 떡을 찔 수 있을 텐데.)']] },
    { npc: 'mago', lines: [['mago', '떡을 찌겠다고? 불은 자네가 보게.\n세면 타고 약하면 설익네.'], ['me', '(살살 달래듯 불을 살렸다.\n김이 모락모락. 떡이 됐다!)']] },
    { npc: 'tiger', lines: [['tiger', '떡이다…! 반은 네가 먹어.'], ['me', '(반으로 나눴다. 호랑이가 더 큰 쪽을 준다.)'], ['tiger', '팥죽 할멈한테 혼난 뒤로 조용히 산다.\n길은 비켜 줄게. 아랫마을에 가 봐.']] },
  ],
  patjuk: [
    { npc: 'patjuk', lines: [['patjuk', '팥죽을 쑤어야 하는데\n장작이 젖어서 불이 안 붙네.'], ['patjuk', '호랑이 녀석 줄 것도 쑤어야 하는데.']] },
    { npc: 'patjuk', lines: [['me', '(후우— 꺼져 가던 불씨가 살아난다.)'], ['patjuk', '옳지! 불을 달랠 줄 아는구먼.\n한 그릇 먹고 가게.']] },
  ],
  kongjwi: [
    { npc: 'kongjwi', lines: [['kongjwi', '독에 물을 채워야 하는데 밑이 깨졌어.'], ['kongjwi', '두꺼비 아저씨는 허리가 아파서 은퇴하셨대.']] },
    { npc: 'kongjwi', lines: [['me', '(진흙으로 메우고, 불로 살살 구웠다.)'], ['kongjwi', '물이 안 새! 고마워!']] },
    { npc: 'dukkeobi', lines: [['me', '(두꺼비 허리에 약초를 붙여 주었다.)'], ['dukkeobi', '어이구 시원하다.\n깨진 독이면 나한테 말해. 전문이야.']] },
  ],
  bang: [
    { npc: 'bang', lines: [['bang', '…말 걸지 마. 참는 중이야.'], ['me', '(얼굴이 노랗다.)']] },
    { npc: 'bang', lines: [['say', '바람 타는 연습을 하는데,\n힘 좀 빌려주실래요?'], ['bang', '…정말? 그럼, 뒤로 물러서.'], ['me', '(뿌우우웅—!\n몸이 붕 떴다. 꽤 멀리 날았다!)'], ['bang', '아, 살 것 같다.']] },
  ],
};
const KEEP: Record<QuestId, string> = { jara: '🥽 헌 물안경', bangmang: '🔨 작은 은방망이', heungbu: '🍶 금테 표주박', ureong: '🐚 우렁 껍데기 단추', haedal: '🌙 달 노리개', seonnyeo: '🌈 무지개 날개옷 조각', kkachi: '✨ 까치의 반짝이', gyeonu: '⭐ 은하수 별 조각', hokburi: '🎵 도깨비 잔치 노래', tteok: '🍡 호랑이가 나눠 준 떡 반쪽', patjuk: '🥣 팥죽 한 그릇', kongjwi: '🏺 독 조각 부적', bang: '💨 큰바람 한 줌' };
/** 시작 조건 */
const OPEN: Partial<Record<QuestId, () => boolean>> = {
  bangmang: () => questDone('jara'), gyeonu: () => questDone('kkachi'), tteok: () => questDone('heungbu'), hokburi: () => questDone('bangmang'),
  patjuk: () => regionOpen('village'), kongjwi: () => regionOpen('village'), bang: () => regionOpen('village'),
};

export function createQuests(c: QuestCtx) {
  const today = () => dateKey(Date.now());
  const cur = (q: QuestId) => { const s = questStep(q); return s >= 0 && !questDone(q) ? { def: questById(q).steps[s], sc: SCRIPT[q][s], s } : null; };
  /** 지금 이 npc에게 볼일이 있는 퀘스트 */
  function jobFor(npc: string): { q: QuestId; start: boolean } | null {
    for (const q of QUESTS) { const k = cur(q.id); if (k && k.sc.npc === npc) return { q: q.id, start: false }; }
    for (const q of QUESTS) if (questStep(q.id) < 0 && SCRIPT[q.id][0].npc === npc && (OPEN[q.id]?.() ?? true)) return { q: q.id, start: true };
    return null;
  }
  const timeOk = (w?: 'night' | 'dawn') => !w || (w === 'night' ? c.night() : c.dawn());

  async function runStep(q: QuestId) {
    const k = cur(q); if (!k) return;
    const { def, sc, s } = k;
    if (!timeOk(def.when)) { await c.say([['me', def.when === 'night' ? '(밤에 다시 와 보자.)' : '(새벽, 해 뜰 무렵에 다시 와 보자.)']]); return; }
    if (def.need && !hasSkill(def.need)) { await c.say([['me', `(${skillById(def.need).ko}… 그걸 할 줄 알아야 해.\n청학당에서 배우자.)`]]); return; }
    if (sc.daily && store.qday?.[q] === today()) { await c.say([['me', '(오늘은 여기까지. 내일 다시 오자.)']]); return; }
    if (sc.play && !(await PLAY[sc.play](q))) return;
    if (sc.lines) await c.say(sc.lines);
    if (sc.daily) { store.qday ??= {}; store.qday[q] = today(); save(); }
    finish(q, s);
  }
  function finish(q: QuestId, s: number) {
    if (!advance(q, s)) return;
    c.track('quest_step', { q, step: s + 1 });
    if (questDone(q)) { store.keeps ??= []; if (!store.keeps.includes(KEEP[q])) store.keeps.push(KEEP[q]); save(); c.toast(`📜 ${questById(q).title} · 끝! ${KEEP[q]}`); }
    else c.toast(`📜 ${questById(q).steps[s + 1].ko}`);
  }

  // ---------- 놀이 ----------
  const PLAY: Record<NonNullable<Script['play']>, (q: QuestId) => Promise<boolean>> = {
    async yut() {
      const NAME = ['도', '개', '걸', '윷', '모'];
      for (;;) {
        let mine = 0, his = 0;
        await c.say([['heungbu', '윷이라면 내가 장터목 제일이지!\n세 번 던져서 많이 가는 쪽이 이기는 거야.']]);
        for (let r = 0; r < 3; r++) {
          const pick = await c.ask('heungbu', `${r + 1}번째! 어떻게 던질래?`, ['살살 굴리기', '힘껏 던지기', '높이 띄우기']);
          if (pick < 0) return false;
          // 살살: 안정적(개~걸), 힘껏: 들쭉날쭉(도~모), 높이: 조금 높게(개~윷)
          const m = pick === 0 ? 1 + Math.floor(Math.random() * 2) : pick === 1 ? Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 3), h = Math.floor(Math.random() * 4);
          mine += m + 1; his += h + 1;
          await c.say([['me', `(나는 ${NAME[m]}! 흥부는 ${NAME[h]}.)`]]);
        }
        if (mine >= his) return true;
        if (await c.ask('heungbu', `하하, 내가 이겼다! (${his} 대 ${mine})\n한 판 더 할 텐가?`, ['한 판 더!', '다음에']) !== 0) return false;
      }
    },
    async mirror() {
      await c.say([['say', '훈장님이 그러셨어.\n“되고자 한다는 것은 잊게. 그저 그들을 이해하게.”'], ['say', '나를 따라 해 봐. 나도 너를 따라 할게.']]);
      const R: [string, string[], number][] = [['(우렁각시가 몸을 동그랗게 웅크린다.)', ['날개를 활짝 편다', '나도 동그랗게 웅크린다', '폴짝 뛴다'], 1], ['(우렁각시가 아주 천천히 한 걸음 뗀다.)', ['나도 아주 천천히 한 걸음', '빨리 달려간다', '제자리에서 돈다'], 0], ['(우렁각시가 가만히 물소리를 듣는다.)', ['크게 운다', '물을 찬다', '나도 가만히 귀 기울인다'], 2]];
      for (const [text, ch, ok] of R) for (;;) { const a = await c.ask('me', text, ch); if (a < 0) return false; if (a === ok) break; await c.say([['ureong', '음… 그건 내 마음이랑 조금 달라.']]); }
      return true;
    },
    async sansin(q) {
      const a = await c.ask('sansin', '이 금방망이가 네 방망이냐,\n이 은방망이가 네 방망이냐?', ['금방망이요!', '은방망이요!', '아니요, 낡은 나무 방망이예요']);
      if (a === 2) return true;
      if (a >= 0) { await c.say([['sansin', '어흠… 욕심이 눈을 가렸구나.'], ['me', '(산신령이 사라졌다.\n조약돌을 다시 던져 보자.)']]); store.quests![q] = 4; save(); }
      return false;
    },
    async rhythm() {
      await c.say([['hokburi', '자, 내가 먼저 하네.\n덩— 기덕— 쿵— 더러러러…']]);
      for (const [t, ch, ok] of [['덩— 기덕— 쿵— 다음은?', ['쿵!', '더러러러!', '얼쑤!'], 1], ['쿵— 기덕— 쿵— 다음은?', ['더러러러!', '덩!', '쿵!'], 0]] as [string, string[], number][]) for (;;) { const a = await c.ask('hokburi', t, ch); if (a < 0) return false; if (a === ok) break; await c.say([['dok', '에이, 박자가 틀렸어! 다시!']]); }
      return true;
    },
    async bridge() {
      await c.say([['say', '제가… 날아 볼게요.'], ['me', '(날개를 편다. 바람이 받쳐 준다.)']]);
      await c.soar(26, async () => {
        const birds: THREE.Object3D[] = [], p = c.me();
        for (let i = 0; i < 14; i++) { const b = littleBird(i % 3 === 0 ? 0xf8e7a0 : 0x2c2c38, 0xfffaf0); const a = (i / 13 - 0.5) * 2.2; b.g.position.set(p.x + Math.sin(a) * 9, p.y + 1.5 + Math.cos(a) * 3.2, p.z - 6 - Math.cos(a) * 3); b.g.rotation.y = a; b.g.scale.setScalar(1.6); c.scene.add(b.g); birds.push(b.g); await new Promise(r => setTimeout(r, 260)); }
        await c.say([['me', '(다른 병아리들도, 아직 다 낫지 않은 까치들도\n하나둘 날아올라 내 옆에 선다.)'], ['kkachi', '은혜는 꼭 갚는다 했지!'], ['me', '(은하수에 다리가 놓였다.)']]);
        await new Promise(r => setTimeout(r, 1500));
        for (const b of birds) c.scene.remove(b);
      });
      return true;
    },
  };

  for (const [id, n, pch] of [['dok', ['도깨비', 'Dokkaebi'], 620], ['hae', ['해 오라비', 'Brother Sun'], 300], ['gyeonu', ['견우', 'Gyeonu'], 380]] as [string, [string, string], number][]) addSpeaker(id, n, pch);
  /** 나룻배: 자라 할아범에게 볼일(퀘스트)이 없을 때 */
  async function ferry(toIsle: boolean) {
      if (toIsle && !c.sawSun()) { await c.say([['jara', '해 보고 오너라.\n토끼 녀석 이후로 나는 빈 눈은 안 태운다네.']]); return; }
      if (await c.ask('jara', toIsle ? '흠… 눈에 아침 해가 담겨 있구먼.\n섬에 건너가려나?' : '돌아가려나?', ['태워 주세요', '아니요']) !== 0) return;
      await c.say([['jara', toIsle ? '타거라, 꼭 잡고.' : '또 오게.']]);
      const to = toIsle ? SPOTS.isleShore : SPOTS.dock; await c.warp(to.x - (toIsle ? 0.8 : 0), to.z, toIsle ? Math.PI / 2 : -Math.PI / 2);
      if (toIsle) await c.say([['jara', '청학님은 조용한 걸 좋아하시네.\n발소리 죽이고.']]);
      c.track('ferry', { toIsle });
    }
  // ---------- 이웃과 물건 자리 ----------
  type Made = { g: THREE.Object3D; update: (t: number) => void };
  const turn: { root: THREE.Object3D; home: number }[] = [];
  function place(id: string, name: [string, string], pitch: number, m: Made, at: { x: number; z: number }, o: { other?: () => Promise<void>; head?: number; r?: number; vis?: () => boolean; chat?: () => L[]; idle?: () => string[]; yOff?: number; face?: number; noTurn?: boolean } = {}) {
    const root = new THREE.Group(); root.add(m.g); root.position.set(at.x, c.floor(at.x, at.z) + (o.yOff ?? 0), at.z);
    const home = o.face ?? faceAngle(trailX(at.z) - at.x, 0.001); root.rotation.y = home; c.scene.add(root);
    if (!o.noTurn) turn.push({ root, home });
    c.npcs.add({
      id, name, pitch, root, head: o.head ?? 1.7, place: 'jirisan', talkR: o.r ?? 3,
      visible: o.vis, idle: o.idle,
      hasNews: () => { const j = jobFor(id); if (!j) return false; if (j.start) return true; const k = cur(j.q)!; return timeOk(k.def.when) && (!k.def.need || hasSkill(k.def.need)) && !(k.sc.daily && store.qday?.[j.q] === today()); },
      talk: async () => {
        const j = jobFor(id);
        if (j) { if (j.start) { startQuest(j.q); c.track('quest_start', { q: j.q }); } await runStep(j.q); return; }
        if (o.other) { await o.other(); return; }
        const lines = o.chat?.(); if (lines?.length) await c.say([lines[Math.floor(Math.random() * lines.length)]]);
      },
      update: (_dt, t) => m.update(t * 1000),
    });
    return root;
  }
  const anchor = (): Made => ({ g: new THREE.Group(), update: () => {} });
  const stepIs = (q: QuestId, ...s: number[]) => s.includes(questStep(q));
  const want = (id: string) => !!jobFor(id);
  const mind = (plain: string[], thought: string[]) => () => hasSkill('mind') ? [...plain, ...thought.map(t => `(${t})`)] : plain;

  // 자라 할아범 (연못 위 모델은 landmarks가 그림: 여기선 말 걸 자리만) + 나룻배 노릇
  place('jara', ['자라 할아범', 'Old Turtle'], 240, anchor(), SPOTS.jara, { head: 1.5, r: 4.6, noTurn: true, vis: () => Math.hypot(c.me().x - ISLE.x, c.me().z - ISLE.z) > 4,
    idle: mind(['토끼 녀석 간 얘기만 나오면\n아직도 얼굴이 화끈하다네.', '내 사촌 거북이는 그 토끼를\n달리기로 이겼다네.'], ['나도 언젠간 토끼를 이길 수 있을 텐데.']),
    other: () => ferry(true) });
  place('jaraIsle', ['자라 할아범', 'Old Turtle'], 240, anchor(), SPOTS.isleShore, { head: 1.2, r: 2.6, noTurn: true, vis: () => Math.hypot(c.me().x - ISLE.x, c.me().z - ISLE.z) < 4, other: () => ferry(false) });
  place('clue', ['파란 불똥 자국', 'Blue sparks'], 700, spot(0x7fd8ff), SPOTS.clue, { head: 0.9, r: 2.2, noTurn: true, vis: () => stepIs('jara', 1) });
  place('bisok', ['오래된 비석', 'Old stele'], 500, (() => { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.25), new THREE.MeshToonMaterial({ color: 0xbfb6b8 })); st.position.y = 0.5; st.rotation.z = 0.08; g.add(st); const s = spot(0xffe08a); s.g.position.z = -0.5; g.add(s.g); return { g, update: s.update }; })(), SPOTS.bisok, { head: 1.3, r: 2.4, noTurn: true, vis: () => questDone('jara'),
    chat: () => [['me', hasSkill('hanja') ? '(“참말하는 자, 새벽 물에 조약돌 셋을 던지면 나오리라.”)' : '(글자가 빼곡하다. 못 읽겠다.)']] });
  place('pebble', ['조약돌', 'Pebbles'], 700, spot(0xcfe8ff), SPOTS.pebble, { head: 0.9, r: 2.2, noTurn: true, vis: () => stepIs('bangmang', 4) && c.dawn() });
  place('sansin', ['산신령', 'Mountain Spirit'], 200, folk({ robe: 0xfaf6ee, hair: 0xfbf8f2, top: 'topknot', beard: true, glow: 0xbff4ff, scale: 1.5 }), SPOTS.sansin, { head: 2.7, r: 5.5, yOff: 0.9, vis: () => stepIs('bangmang', 5) && c.dawn() });
  // 도깨비 소굴 (밤 숲)
  const denOn = () => regionOpen('nightForest') && c.night();
  place('ttuk', ['뚝딱이 대장', 'Chief Ttukttak'], 260, dokkaebi('chief', 0x8f9ce0, 4), SPOTS.den, { head: 2.5, r: 3.6, vis: denOn,
    idle: mind(['금 나와라 뚝… 아, 방망이가 없지.', '메밀묵은 간장에 찍어야 제맛이야.'], ['방망이 없으면 난 그냥 큰 도깨비인데…']),
    chat: () => [['ttuk', questDone('bangmang') ? '금 나와라 뚝딱! 은 나와라 뚝딱!\n…모이 나와라 뚝딱! 어, 이건 안 나오네.' : '도깨비는 공짜가 없어.\n그래도 약속은 지키지.']] });
  [[2.2, 1.4, 0x9fdcc8, 2], [-2.3, 1.0, 0xf4b8a0, 3], [0.6, 2.8, 0x9fb0e8, 1]].forEach(([dx, dz, col, seed], i) => place('dok' + i, ['도깨비', 'Dokkaebi'], 620, dokkaebi('minion', col, seed), { x: SPOTS.den.x + dx, z: SPOTS.den.z + dz }, { head: 1.5, r: 2, vis: denOn, idle: () => ['메밀묵! 메밀묵!', '씨름 한 판 할래?', '노래 잘하는 놈은 혹 하나 떼 준다!'], chat: () => [['dok', '대장한테 말해! 우린 졸개야!']] }));
  place('hokburi', ['혹부리 영감', 'Old Man Lump'], 300, folk({ robe: 0xd8c8a0, top: 'gat', lump: true, hair: 0xd8d2cc }), SPOTS.hokburi, { vis: () => denOn() && (questDone('bangmang')), idle: () => ['아아— 음음— 영 안 되네.'], chat: () => [['hokburi', '혹도 오래 달고 있으니 정이 들었네.']] });
  // 장터목: 놀부, 흥부, 제비, 박 넝쿨
  place('nolbu', ['놀부', 'Nolbu'], 280, folk({ robe: 0x6fa08a, top: 'gat', accent: 0xe6c272 }), SPOTS.nolbu, { idle: mind(['부지런히 살면 복이 온다네.', '아우 녀석 때문에 잠이 안 와.'], ['어릴 땐 내가 업어 키웠는데.']), chat: () => [['nolbu', questDone('heungbu') ? '아우가 요즘은 박 농사를 짓는다네. 허허.' : '부지런한 게 제일이야.']] });
  place('heungbu', ['흥부', 'Heungbu'], 420, folk({ robe: 0xe2d2b0, top: 'band', accent: 0xb88a6a }), SPOTS.heungbu, { idle: mind(['모야! …아니 도네.', '한 판만 더, 딱 한 판만!'], ['형한테 미안한데…']), chat: () => [['heungbu', questDone('heungbu') ? '박 속이 이렇게 달 줄 몰랐어.' : '윷은 손목이야, 손목.']] });
  place('jebi', ['제비', 'Swallow'], 900, littleBird(0x2a3c7a, 0xfffaf0, true), SPOTS.jebi, { head: 1.1, r: 2.2, yOff: 0.9, vis: () => questStep('heungbu') >= 3, idle: () => hasSkill('birds') ? ['박씨 줄까? 다리 다친 적은 없지만.', '강남은 따뜻하고 좋아.'] : ['지지배배!'], chat: () => [['jebi', hasSkill('birds') ? '박은 기다려야 열려.' : '지지배배! 지지배배!']] });
  place('bak', ['박 넝쿨', 'Gourd vine'], 500, spot(0x9fd49a), SPOTS.bak, { head: 1.0, r: 2.4, noTurn: true, vis: () => questStep('heungbu') >= 4 && !questDone('heungbu') && questStep('heungbu') <= 6 });
  // 우렁각시
  place('sang', ['아침상', 'Breakfast tray'], 600, spot(0xf7b8cc), SPOTS.sang, { head: 0.9, r: 2.2, noTurn: true, vis: () => questStep('ureong') <= 0 });
  place('shadow', ['작은 그림자', 'Small shadow'], 600, spot(0x8a8ab8), SPOTS.shadow, { head: 0.9, r: 2.4, noTurn: true, vis: () => stepIs('ureong', 1) && c.night() });
  place('ureong', ['우렁각시', 'Snail Bride'], 760, ureongGaksi('chick'), SPOTS.ureong, { vis: () => questStep('ureong') >= 2 && !questDone('ureong'), idle: () => ['어디 숨지, 어디 숨지…'] });
  place('ureongS', ['우렁각시', 'Snail Bride'], 760, ureongGaksi('snail'), SPOTS.ureong, { head: 1.0, vis: () => questDone('ureong'), idle: () => ['(쏙)'], chat: () => [['ureong', '내일 아침상도 기대해!']] });
  // 해님 달님, 선녀, 까치, 직녀
  place('dal', ['달 누이', 'Sister Moon'], 820, spot(0xdfe6ff), SPOTS.dal, { head: 1.0, r: 2.6, noTurn: true, vis: () => c.dawn() && (want('dal')), });
  place('seonnyeo', ['선녀', 'Fairy'], 720, folk({ robe: 0xfde2ec, sleeve: 0xfff4f8, top: 'halo', accent: 0xf28cb4, glow: 0xffd8ec }), SPOTS.seonnyeo, { vis: () => c.night() && !questDone('seonnyeo'), idle: () => ['선녀 목욕 중, 옷 숨기지 마시오.'] });
  place('kkachi', ['까치 대장', 'Chief Magpie'], 880, littleBird(0x2c2c38, 0xfffaf0), SPOTS.kkachi, { head: 1.1, r: 2.4, idle: () => hasSkill('birds') ? (questStep('kkachi') >= 4 ? ['모이 준 건 꼭 갚는다, 까치는.', '다리 놓는 날엔 바빠.'] : ['깍… 배가…']) : ['깍깍!'], chat: () => [['kkachi', hasSkill('birds') ? '은혜는 꼭 갚는다, 까치는.' : '깍깍! 깍!']] });
  place('jiknyeo', ['직녀', 'Jiknyeo'], 700, folk({ robe: 0xc8b8ec, sleeve: 0xe2d8f8, top: 'bun', accent: 0xf6d26a, glow: 0xd8d0ff }), SPOTS.jiknyeo, { vis: () => c.night() && questStep('gyeonu') >= 1 && !questDone('gyeonu'), idle: () => ['저 강 건너에 그이가 있어.'] });
  // 고갯길 호랑이, 산아랫마을
  place('tiger', ['호랑이', 'Tiger'], 180, tiger(), SPOTS.tiger, { head: 3.6, r: 4.2, vis: () => !questDone('tteok'), idle: mind(['떡… 떡 하나만…', '김밥 냄새가 난다…'], ['채식은 힘들어.']) });
  place('tigerV', ['호랑이', 'Tiger'], 180, tiger(), { x: VILLAGE.x - 8.5, z: VILLAGE.z - 1 }, { head: 3.6, r: 4.2, vis: () => questDone('tteok'), idle: () => ['팥죽은 채식이라 괜찮아.'], chat: () => [['tiger', '팥죽 할멈한테 혼난 뒤로 조용히 산다.']] });
  const vOn = () => regionOpen('village');
  place('patjuk', ['팥죽 할머니', 'Granny Patjuk'], 300, folk({ robe: 0xb89a8a, hair: 0xd8d2cc, top: 'bun', accent: 0x9a4a4a }), SPOTS.patjuk, { vis: vOn, idle: () => ['동지엔 팥죽이지.'], chat: () => [['patjuk', '한 그릇 더 먹고 가게.']] });
  place('kongjwi', ['콩쥐', 'Kongjwi'], 800, folk({ robe: 0xf6e0a0, top: 'braid', accent: 0xe0606a, scale: 0.85 }), SPOTS.kongjwi, { head: 1.5, vis: vOn, idle: () => ['물 길러 가야 하는데.'], chat: () => [['kongjwi', '독이 튼튼해졌어!']] });
  place('dukkeobi', ['두꺼비 아저씨', 'Mr. Toad'], 220, toad(), SPOTS.dukkeobi, { head: 1.1, r: 2.4, vis: vOn, idle: () => ['아이고 허리야.'], chat: () => [['dukkeobi', questDone('kongjwi') ? '깨진 독이면 나한테 말해. 전문이야.' : '아이고 허리야… 은퇴했다니까.']] });
  place('bang', ['며느리', 'Daughter-in-law'], 640, folk({ robe: 0xa8d0b0, top: 'bun', accent: 0xf28cb4, faceTint: 0xf6e08a }), SPOTS.bang, { vis: vOn, idle: () => ['…흡.'], chat: () => [['bang', '속이 다 시원해.']] });
  // 모으는 것: 약초(약초 알기를 익혀야 반짝임), 꽃물
  const bagHas = (q: QuestId, i: number) => ((store.qbag?.[q] ?? 0) >> i) & 1;
  function prop(q: QuestId, step: number, i: number, id: string, name: string, color: number, at: { x: number; z: number }, line: string) {
    const m = spot(color);
    const root = new THREE.Group(); root.add(m.g); root.position.set(at.x, c.floor(at.x, at.z), at.z); c.scene.add(root);
    c.npcs.add({ id, name: [name, name], pitch: 700, root, head: 0.9, place: 'jirisan', talkR: 2.2,
      visible: () => stepIs(q, step) && !bagHas(q, i) && hasSkill(questById(q).steps[step].need!), hasNews: () => true,
      talk: async () => {
        store.qbag ??= {}; store.qbag[q] = (store.qbag[q] ?? 0) | (1 << i); save();
        const n = SCRIPT[q][step].collect!.length, got = SCRIPT[q][step].collect!.filter((_, k) => bagHas(q, k)).length;
        await c.say([['me', `(${line} ${got} / ${n})`]]);
        if (got >= n) { await c.say(SCRIPT[q][step].lines ?? []); finish(q, step); }
      },
      update: (_dt, t) => m.update(t * 1000) });
  }
  ['쑥을 뜯었다.', '질경이를 캤다.', '민들레를 뜯었다.'].forEach((l, i) => prop('kkachi', 2, i, 'h' + i, '반짝이는 풀', 0x9fd49a, SPOTS.herbs[i], l));
  [['분홍 철쭉 꽃물', 0xf7a8c8], ['노랑 유채 꽃물', 0xffd83a], ['파랑 쪽 꽃물', 0x4a86c8], ['빨강 봉숭아 꽃물', 0xe0606a], ['하양 들꽃 꽃물', 0xffffff]].forEach(([n, col], i) => prop('seonnyeo', 2, i, 'f' + i, n as string, col as number, SPOTS.flowers[i], `${n}을 모았다.`));

  // 도깨비불 길잡이: 도깨비불 보기를 익히면 밤에 길에서 소굴까지 파란 불이 이어짐
  const wisps: THREE.Mesh[] = [];
  { const wm = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) { const k = i / 8, x = trailX(FOREST.z + 6) - 2 + (FOREST.x - trailX(FOREST.z + 6) + 4) * k, z = FOREST.z + 6 - 5 * k; const w = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), wm); w.scale.y = 1.5; w.position.set(x, c.floor(x, z) + 1.1, z); w.userData = { y: w.position.y, ph: i }; c.scene.add(w); wisps.push(w); } }

  let tick = 0, lieT = 0;
  onProgress(() => { tick = 0; });
  return {
    spots: SPOTS,
    jobFor,
    /** 다른 곳(마고할미 등)에서: 이 이웃에게 퀘스트 볼일이 있으면 그걸 하고 true */
    async tryTalk(npc: string) { const j = jobFor(npc); if (!j) return false; if (j.start) startQuest(j.q); await runStep(j.q); return true; },
    update(dt: number, t: number) {
      const p = c.me();
      // 이웃들은 가까이 온 병아리를 바라봄
      for (const n of turn) { if (!n.root.visible) continue; const d = Math.hypot(p.x - n.root.position.x, p.z - n.root.position.z); const want2 = d < 6 ? faceAngle(p.x - n.root.position.x, p.z - n.root.position.z) : n.home; let dd = want2 - n.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); n.root.rotation.y += dd * Math.min(1, dt * 4); }
      const ws = hasSkill('dokkaebi') && c.night() && regionOpen('nightForest');
      for (const w of wisps) { w.visible = ws; if (ws) w.position.y = w.userData.y + Math.sin(t * 2 + w.userData.ph) * 0.15; }
      tick -= dt; if (tick > 0) return; tick = 1;
      // 저절로 넘어가는 단계
      for (const q of QUESTS) {
        const k = cur(q.id); if (!k) continue;
        if (k.sc.auto === 'skill' && k.def.need && hasSkill(k.def.need)) finish(q.id, k.s);
      }
      // 견우와 직녀: 까치 이야기를 끝내고, 별자리 읽기를 익히고, 밤에 누워 있으면 시작
      if (c.lying() && c.night() && hasSkill('stars') && questDone('kkachi') && questStep('gyeonu') <= 0) {
        lieT += 1;
        if (lieT >= 4) { lieT = 0; if (questStep('gyeonu') < 0) startQuest('gyeonu'); void c.say([['me', '(은하수 양쪽에 유난히 밝은 별 둘.\n…견우성과 직녀성이다.)'], ['me', '(직녀성 쪽에서 누가 부르는 것 같다.\n정상에 가 보자.)']]).then(() => finish('gyeonu', 0)); }
      } else lieT = 0;
    },
  };
}
