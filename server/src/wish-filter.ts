// 다른 사람에게 보여 줄 소원 문구 거르기.
// 걸리면 글자 없이 풍등 불빛만 보낸다 (쓴 사람 화면에는 원래 글이 그대로 보임).
// 완벽한 필터는 없으므로 "명백한 것"만 막고, 보는 사람이 끌 수 있게 하는 것이 기본 방어선.

const MAX = 24;

/** 붙여 쓰기·특수문자로 피하지 못하도록 공백·기호를 지우고 소문자로 비교 */
const BANNED = [
  // 한국어 욕설·비하·성적 표현 (초성 줄임말 포함)
  '씨발', '시발', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', 'ㅈㄴ', '개새', '새끼', 'ㅅㄲ',
  '지랄', 'ㅈㄹ', '미친놈', '미친년', '닥쳐', '꺼져', '엠창', '느금', '니애미', '니미', '애미', '애비', '한남', '김치녀',
  '틀딱', '섹스', '야동', '보지', '자지', '딸딸', '창녀', '걸레', '자살', '죽어',
  // 영어
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'retard', 'slut', 'whore',
  'porn', 'sex', 'nude', 'kys', 'killyourself',
];
/** 광고·연락처·개인정보 */
const PATTERNS = [
  /https?:|www\.|\.(com|net|org|kr|nz|io|me|co|ly|gg)\b/i, // 링크
  /\S+@\S+/,                                                // 이메일, @아이디
  /(\d[\s.-]?){6,}/,                                        // 전화번호·계좌번호 같은 긴 숫자
  /카톡|오픈채팅|텔레그램|텔레|라인아이디|kakao|telegram|insta|인스타|dm/i,
];

export function cleanWish(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined;
  const t = text.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX);
  if (!t) return undefined;
  const flat = t.toLowerCase().replace(/[\s.,·_\-~!?*^'"`()[\]{}/\\|+=:;0-9]/g, '');
  if (BANNED.some(w => flat.includes(w))) return undefined;
  if (PATTERNS.some(p => p.test(t))) return undefined;
  return t;
}
