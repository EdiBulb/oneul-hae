import type { PlaceId } from '../../server/src/protocol';
import { lang, T } from './i18n';

export interface Place {
  id: PlaceId;
  name: string;
  region: string;
  nameEn: string;
  regionEn: string;
  lat: number;
  lng: number;
  tz: string;
  /** 장소 고르기 화면의 묶음 */
  group: PlaceGroup;
}
export type PlaceGroup = 'sunrise' | 'kcontent';

// 사람이 적을 땐 장소를 줄여 한곳에 모이게 — 지금은 지리산만 (산 콘셉트에 집중, 정동진도 잠시 내림). 주석 풀면 다시 열림. (기스본·K콘텐츠 촬영지는 잠시 내림, 코드는 그대로)
export const PLACES: Place[] = [
  { id: 'jirisan', name: '지리산 천왕봉', region: '산청', nameEn: 'Jirisan Cheonwangbong', regionEn: 'Sancheong', lat: 35.3369, lng: 127.7306, tz: 'Asia/Seoul', group: 'sunrise' },
  // { id: 'hallasan', name: '한라산 백록담', region: '제주', nameEn: 'Hallasan Baengnokdam', regionEn: 'Jeju', lat: 33.3617, lng: 126.5292, tz: 'Asia/Seoul', group: 'sunrise' },
  // { id: 'jeongdongjin', name: '정동진', region: '강릉', nameEn: 'Jeongdongjin', regionEn: 'Gangneung', lat: 37.6906, lng: 129.0336, tz: 'Asia/Seoul', group: 'sunrise' },
  // { id: 'seongsan', name: '성산일출봉', region: '제주', nameEn: 'Seongsan Ilchulbong', regionEn: 'Jeju', lat: 33.458, lng: 126.9425, tz: 'Asia/Seoul', group: 'sunrise' },
  // { id: 'seopjikoji', name: '섭지코지', region: '제주', nameEn: 'Seopjikoji', regionEn: 'Jeju', lat: 33.4240, lng: 126.9310, tz: 'Asia/Seoul', group: 'sunrise' },
  // { id: 'homigot', name: '호미곶', region: '포항', nameEn: 'Homigot', regionEn: 'Pohang', lat: 36.0767, lng: 129.5689, tz: 'Asia/Seoul', group: 'sunrise' },
];

const WISHES_KO = ['오늘도 무사히', '건강하게', '합격 기원', '월급 들어와라', '좋은 하루', '다 잘 될 거야', '사랑하는 사람들 행복하게', '퇴근 빨리'];
export const ADJ = ['느긋한', '부지런한', '졸린', '따뜻한', '고요한', '설레는', '씩씩한', '말랑한'];
export const NOUN = ['갈매기', '파도', '햇살', '조개', '구름', '등대', '모래', '물결'];

/** 캐릭터 색 팔레트. 서버에는 인덱스만 오간다 */
const WISHES_EN = ['Get through today safely', 'Stay healthy', 'Pass the exam', 'Payday please', 'Have a good day', "It'll all work out", 'Happiness for my loved ones', 'Finish work early'];
export const WISHES = lang === 'ko' ? WISHES_KO : WISHES_EN;
const ADJ_EN = ['Easygoing', 'Early', 'Sleepy', 'Warm', 'Quiet', 'Excited', 'Brave', 'Squishy'];
const NOUN_EN = ['Seagull', 'Wave', 'Sunbeam', 'Shell', 'Cloud', 'Lighthouse', 'Sand', 'Ripple'];

/** 고른 소원(기본 문구)이면 보는 사람 언어로 바꿔 준다. 직접 쓴 소원은 그대로 */
export function localizeWish(text: string): string {
  let i = WISHES_KO.indexOf(text);
  if (i < 0) i = WISHES_EN.indexOf(text);
  return i < 0 ? text : WISHES[i];
}

/** 지금 화면 언어로 된 장소 이름 */
export const placeName = (p: Place) => (lang === 'ko' ? p.name : p.nameEn);
export const placeRegion = (p: Place) => (lang === 'ko' ? p.region : p.regionEn);

/** 자동으로 만든 이름(예: '졸린 갈매기')이면 화면 언어로 바꿔 보여 준다. 직접 지은 이름은 그대로 */
export function localizeNick(nick: string): string {
  if (nick === '해 보러 온 사람') return T.defaultNick;
  const [a, n, ...rest] = nick.split(' ');
  if (rest.length || !n) return nick;
  let i = ADJ.indexOf(a), j = NOUN.indexOf(n);
  if (i < 0 || j < 0) { i = ADJ_EN.indexOf(a); j = NOUN_EN.indexOf(n); }
  if (i < 0 || j < 0) return nick;
  return lang === 'ko' ? `${ADJ[i]} ${NOUN[j]}` : `${ADJ_EN[i]} ${NOUN_EN[j]}`;
}

export const BODY_COLORS = [0x6f86b5, 0x9b7bb0, 0x7da37d, 0xc78f6b, 0xd9c6a5, 0x5f6f80, 0xb86b7a, 0xf3efe6];
export const HAT_COLORS = [0xe8c34d, 0x5bb3a8, 0xe07a6a, 0x8c7ae0, 0xf0f0f0, 0x3f8fd6, 0xd66fa0, 0xff8a3d];

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ---------- 장소 소개와 실제로 가는 법 ----------
interface PlaceInfo { blurb: [string, string]; route?: { title: [string, string]; lead: [string, string]; steps: [string, string][]; map: string } }
const INFO: Partial<Record<PlaceId, PlaceInfo>> = {
  jeongdongjin: { blurb: ['기차역 바로 앞 해돋이 명소', 'Sunrise right by the train station'] },
  hallasan: {
    blurb: ['남한에서 가장 높은 곳, 끝없는 운해 위 해돋이', 'The highest point in South Korea, sunrise over endless clouds'],
    route: {
      title: ['진짜 한라산 백록담 일출 보러 가기', 'See the real sunrise at Hallasan'],
      lead: ['제주 한라산 정상(1,947m)이에요. 정상의 분화구 호수 백록담 옆에서 섬을 덮은 구름 바다 위로 해가 떠요.', "The summit of Hallasan on Jeju (1,947 m). Beside Baengnokdam, the crater lake at the top, the sun rises over a sea of clouds covering the island."],
      steps: [
        ['<b>코스</b> · 정상까지는 성판악(약 9.6km)과 관음사(약 8.7km) 코스만 올라갈 수 있어요', '<b>Trails</b> · Only the Seongpanak (about 9.6 km) and Gwaneumsa (about 8.7 km) trails reach the summit'],
        ['<b>예약</b> · 정상 탐방은 미리 온라인 예약을 해야 해요', '<b>Booking</b> · Summit hikes must be reserved online in advance'],
        ['<b>꼭 확인</b> · 입산 시간과 일출 산행 가능 여부는 한라산국립공원 누리집에서 미리 확인해요', '<b>Check first</b> · Check trail hours and whether sunrise hikes are allowed on the Hallasan National Park site'],
      ],
      map: '한라산 백록담',
    },
  },
  seopjikoji: {
    blurb: ['검은 바위와 촛대바위 사이로 떠오르는 해', 'The sun rises between black lava rocks and a sea stack'],
    route: {
      title: ['진짜 섭지코지에 가 보기', 'Visit the real Seopjikoji'],
      lead: ['제주 동쪽 끝 바다로 튀어나온 곶이에요. 검은 현무암 해안과 바다에 우뚝 선 선돌(촛대바위), 언덕 위 하얀 등대가 있고, 건너편으로 성산일출봉이 보여요.', "A headland on Jeju's east coast. Black lava-rock shores, a tall sea stack called Seondol, a white lighthouse on the hill, and Seongsan Ilchulbong across the bay."],
      steps: [
        ['<b>가는 길</b> · 제주공항에서 차로 약 1시간 10분, 성산일출봉에서 차로 약 10분', '<b>Getting there</b> · About 1 h 10 min by car from Jeju Airport, about 10 min from Seongsan Ilchulbong'],
        ['<b>걷기</b> · 주차장에서 등대 언덕까지 산책로로 20~30분이면 돌아볼 수 있어요', '<b>Walk</b> · A 20–30 minute trail loops from the car park up to the lighthouse hill'],
        ['<b>팁</b> · 바람이 세고 바위가 미끄러우니 물가 바위에는 조심해서 다가가요', '<b>Tip</b> · It gets very windy and the rocks are slippery, so take care near the water'],
      ],
      map: '섭지코지',
    },
  },
  jirisan: {
    blurb: ['정상 끝에 서면 운해 위로 해가 떠요', 'Walk to the summit edge, the sun rises over a sea of clouds'],
    route: {
      title: ['진짜 천왕봉 일출 보러 가기', 'See the real Cheonwangbong sunrise'],
      lead: ['지리산 최고봉(1,915m)이에요. 구름 바다 위로 뜨는 해는 &lsquo;천왕일출&rsquo;이라 불리는 지리산 10경 중 하나인데, 날씨 때문에 &ldquo;삼대가 덕을 쌓아야 볼 수 있다&rdquo;는 말이 있어요.', "The highest peak of Jirisan (1,915 m). The sunrise over a sea of clouds, called Cheonwang-ilchul, is one of Jirisan's ten great sights. Koreans say it takes three generations of good deeds to see it, because the weather rarely allows it."],
      steps: [
        ['<b>당일 산행</b> · 중산리 탐방지원센터에서 천왕봉까지 약 5.4km, 오르는 데 4시간쯤', '<b>Day hike</b> · About 5.4 km from Jungsan-ri Visitor Center to the summit, roughly 4 hours up'],
        ['<b>일출 보기</b> · 많은 사람이 장터목대피소에서 자고, 새벽에 1.7km(약 1시간)를 올라가 해를 봐요', '<b>For sunrise</b> · Most hikers stay at Jangteomok Shelter and climb the last 1.7 km (about an hour) before dawn'],
        ['<b>꼭 확인</b> · 대피소 예약과 입산 가능 시간은 국립공원공단 누리집에서 미리 확인해요. 정상은 한여름에도 추워요', '<b>Check first</b> · Book shelters and check trail opening hours on the Korea National Park Service site. The summit is cold even in summer'],
      ],
      map: '지리산 천왕봉',
    },
  },
  seongsan: { blurb: ['화산 분화구 옆에서 보는 해', 'Sunrise beside a volcanic crater'] },
  homigot: { blurb: ['바다 위 커다란 손 조형물', 'A giant hand rising from the sea'] },
  gisborne: { blurb: ['세계에서 가장 먼저 뜨는 해 중 하나', 'One of the first sunrises on Earth'] },
  jumunjin: {
    blurb: ['드라마 속 그 방파제 · 꽃 건네주기', 'The K-drama breakwater · hand over flowers'],
    route: {
      title: ['진짜 주문진 방파제에 가 보기', 'Visit the real Jumunjin Breakwater'],
      lead: ['강릉 주문진 영진해변의 작은 방사제예요. 드라마 &lsquo;도깨비&rsquo;(2016) 촬영지로 알려져 있어요. 입장료 없이 끝까지 걸어갈 수 있어요.', 'A small breakwater at Yeongjin Beach in Jumunjin, Gangneung, on Korea\'s east coast. It\'s known as a filming spot of the K-drama &lsquo;Goblin&rsquo; (2016). Free to visit and you can walk right out to the end.'],
      steps: [
        ['<b>서울 → 강릉</b> · 서울역이나 청량리역에서 KTX-이음으로 약 2시간', '<b>Seoul → Gangneung</b> · KTX-Eum from Seoul or Cheongnyangni Station, about 2 hours'],
        ['<b>강릉역 → 방사제</b> · 주문진 방면 시내버스 300·302번, 또는 택시로 약 20~25분', '<b>Gangneung Station → breakwater</b> · city bus 300 or 302 toward Jumunjin, or about 20–25 min by taxi'],
        ['<b>팁</b> · 동해를 바라보는 곳이라 해돋이 시간에 가면 이 해변과 같은 풍경을 볼 수 있어요', '<b>Tip</b> · It faces the East Sea, so go at sunrise to see the same view as this beach'],
      ],
      map: '도깨비 촬영지 주문진 방사제',
    },
  },
  hyangho: {
    blurb: ['바다를 등진 앨범 재킷 속 그 정류장', 'The seaside bus stop from a famous K-pop album cover'],
    route: {
      title: ['진짜 향호 버스정류장에 가 보기', 'Visit the real Hyangho bus stop'],
      lead: ['강릉 주문진 향호해변 모래사장 위의 작은 정류장이에요. K-팝 앨범 재킷 촬영지로 알려지면서 강릉시가 다시 만들어 두었어요. 주문진 방파제에서 북쪽으로 약 6km예요.', 'A little bus stop on the sand at Hyangho Beach in Jumunjin, Gangneung. It became famous as a K-pop album cover location, and the city rebuilt it for visitors. About 6 km north of the Jumunjin Breakwater.'],
      steps: [
        ['<b>서울 → 강릉</b> · KTX-이음으로 약 2시간', '<b>Seoul → Gangneung</b> · KTX-Eum, about 2 hours'],
        ['<b>강릉역 → 정류장</b> · 300번 버스로 약 50분, 주문진해변 정류소에서 내려 바다 쪽으로 걸어가요. 택시로는 약 20~25분', '<b>Gangneung Station → bus stop</b> · bus 300 for about 50 min, get off at Jumunjin Beach and walk toward the sea. About 20–25 min by taxi'],
        ['<b>팁</b> · 주문진 방파제와 하루에 같이 돌아보기 좋아요', '<b>Tip</b> · Easy to combine with the Jumunjin Breakwater in one day'],
      ],
      map: '향호해변 BTS 버스정류장',
    },
  },
  hangang: {
    blurb: ['강가 편의점에서 라면 끓여 먹기', 'Make convenience-store ramyeon by the river'],
    route: {
      title: ['진짜 한강공원에서 라면 먹기', 'Have ramyeon at the real Han River Park'],
      lead: ['여의도 한강공원은 서울 사람들이 소풍 오는 강변 공원이에요. 강가 편의점의 즉석 라면 기계로 끓여서 돗자리에 앉아 먹는 게 서울의 흔한 저녁 풍경이에요.', 'Yeouido Hangang Park is where Seoul locals picnic by the river. Cooking instant ramyeon on the convenience-store machine and eating it on a mat by the water is a classic Seoul evening.'],
      steps: [
        ['<b>지하철</b> · 5호선 여의나루역에서 내리면 공원이 바로 앞이에요', '<b>Subway</b> · Get off at Yeouinaru Station (Line 5); the park is right outside'],
        ['<b>라면</b> · 강가 편의점에서 라면을 사서 매장 안 즉석 조리기로 끓여요', '<b>Ramyeon</b> · Buy a pack at a riverside convenience store and cook it on the in-store machine'],
        ['<b>팁</b> · 해 질 무렵부터 밤까지가 가장 예뻐요. 돗자리는 근처에서 빌릴 수 있어요', '<b>Tip</b> · Best from sunset into the night. You can rent picnic mats nearby'],
      ],
      map: '여의도 한강공원',
    },
  },
};
const L = () => (lang === 'ko' ? 0 : 1);
export const placeBlurb = (p: Place) => INFO[p.id]?.blurb[L()] ?? '';
export function placeRoute(p: Place) {
  const r = INFO[p.id]?.route;
  if (!r) return null;
  const i = L();
  return { title: r.title[i], lead: r.lead[i], steps: r.steps.map(s => s[i]), map: r.map };
}
