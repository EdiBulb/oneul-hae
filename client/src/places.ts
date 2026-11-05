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
export type PlaceGroup = 'sunrise' | 'kcontent' | 'seoul';

export const PLACES: Place[] = [
  { id: 'jeongdongjin', name: '정동진', region: '강릉', nameEn: 'Jeongdongjin', regionEn: 'Gangneung', lat: 37.6906, lng: 129.0336, tz: 'Asia/Seoul', group: 'sunrise' },
  { id: 'seongsan', name: '성산일출봉', region: '제주', nameEn: 'Seongsan Ilchulbong', regionEn: 'Jeju', lat: 33.458, lng: 126.9425, tz: 'Asia/Seoul', group: 'sunrise' },
  { id: 'homigot', name: '호미곶', region: '포항', nameEn: 'Homigot', regionEn: 'Pohang', lat: 36.0767, lng: 129.5689, tz: 'Asia/Seoul', group: 'sunrise' },
  { id: 'gisborne', name: '기스본', region: '뉴질랜드', nameEn: 'Gisborne', regionEn: 'New Zealand', lat: -38.6623, lng: 178.0176, tz: 'Pacific/Auckland', group: 'sunrise' },
  { id: 'jumunjin', name: '주문진 방파제', region: '강릉', nameEn: 'Jumunjin Breakwater', regionEn: 'Gangneung', lat: 37.885, lng: 128.831, tz: 'Asia/Seoul', group: 'kcontent' },
  { id: 'hyangho', name: '향호 버스정류장', region: '강릉', nameEn: 'Hyangho Bus Stop', regionEn: 'Gangneung', lat: 37.92, lng: 128.80, tz: 'Asia/Seoul', group: 'kcontent' },
  { id: 'gyeongbokgung', name: '경복궁', region: '서울 종로', nameEn: 'Gyeongbokgung Palace', regionEn: 'Jongno, Seoul', lat: 37.5796, lng: 126.977, tz: 'Asia/Seoul', group: 'seoul' },
  { id: 'gwangjang', name: '광장시장', region: '서울 종로', nameEn: 'Gwangjang Market', regionEn: 'Jongno, Seoul', lat: 37.5701, lng: 126.9996, tz: 'Asia/Seoul', group: 'seoul' },
  { id: 'myeongdong', name: '명동', region: '서울 중구', nameEn: 'Myeongdong', regionEn: 'Jung-gu, Seoul', lat: 37.5636, lng: 126.9850, tz: 'Asia/Seoul', group: 'seoul' },
  { id: 'hongdae', name: '홍대', region: '서울 마포', nameEn: 'Hongdae', regionEn: 'Mapo, Seoul', lat: 37.5540, lng: 126.9222, tz: 'Asia/Seoul', group: 'seoul' },
  { id: 'hangang', name: '한강공원', region: '서울 여의도', nameEn: 'Han River Park', regionEn: 'Yeouido, Seoul', lat: 37.5284, lng: 126.934, tz: 'Asia/Seoul', group: 'seoul' },
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
  gyeongbokgung: {
    blurb: ['한복 입고 궁궐 앞에서 사진 찍기', 'Wear hanbok and take photos at the palace'],
    route: {
      title: ['진짜 경복궁에 가 보기', 'Visit the real Gyeongbokgung'],
      lead: ['조선의 으뜸 궁궐이에요. 근처 한복 대여점에서 한복을 빌려 입고 들어가면 입장료가 무료예요. 정문 앞에서는 수문장 교대식도 볼 수 있어요.', "Joseon's main royal palace. Rent a hanbok at a shop nearby and entry is free while you wear it. You can also watch the gate guard ceremony at the main gate."],
      steps: [
        ['<b>지하철</b> · 3호선 경복궁역에서 내려 궁 쪽 출구로 나오면 바로 앞이에요', '<b>Subway</b> · Gyeongbokgung Station (Line 3); take the palace-side exit and it\'s right there'],
        ['<b>한복</b> · 역 주변과 서촌에 한복 대여점이 많아요. 한복을 입으면 궁궐 입장이 무료예요', '<b>Hanbok</b> · Plenty of rental shops around the station and Seochon. Palace entry is free in hanbok'],
        ['<b>팁</b> · 화요일은 쉬는 날이에요. 교대식 시간은 방문 전에 확인하세요', '<b>Tip</b> · Closed on Tuesdays. Check the guard ceremony times before you go'],
      ],
      map: '경복궁',
    },
  },
  gwangjang: {
    blurb: ['시장 골목에서 빈대떡 먹기', 'Eat bindaetteok in a market alley'],
    route: {
      title: ['진짜 광장시장에 가 보기', 'Visit the real Gwangjang Market'],
      lead: ['100년이 넘은 서울의 전통시장이에요. 지붕 덮인 먹자골목에서 빈대떡, 마약김밥, 육회를 노점 의자에 앉아 바로 먹을 수 있어요.', "One of Seoul's oldest traditional markets, over 100 years old. In the covered food alley you sit on a stool at a stall and eat bindaetteok, mini gimbap and yukhoe right there."],
      steps: [
        ['<b>지하철</b> · 1호선 종로5가역 7·8번 출구, 또는 2·5호선 을지로4가역에서 걸어서 5분', '<b>Subway</b> · Jongno 5-ga Station (Line 1), exit 7 or 8, or a 5-min walk from Euljiro 4-ga (Lines 2 & 5)'],
        ['<b>먹기</b> · 빈대떡은 즉석에서 갈아 부쳐 줘요. 현금과 카드 모두 받는 곳이 많아요', '<b>Eat</b> · Bindaetteok is ground and fried to order. Most stalls take both cash and card'],
        ['<b>팁</b> · 저녁이 가장 붐벼요. 가게마다 쉬는 날이 달라요', '<b>Tip</b> · Busiest in the evening. Closing days vary by stall'],
      ],
      map: '광장시장',
    },
  },
  myeongdong: {
    blurb: ['쇼핑 거리에서 길거리 떡볶이', 'Street-food tteokbokki on the shopping street'],
    route: {
      title: ['진짜 명동에 가 보기', 'Visit the real Myeongdong'],
      lead: ['화장품 가게와 옷 가게가 빽빽한 서울의 대표 쇼핑 거리예요. 오후부터 길 가운데에 노점이 줄지어 서서 떡볶이, 계란빵, 호떡을 팔아요.', "Seoul's best-known shopping street, packed with cosmetics and fashion shops. From the afternoon, food carts line the middle of the street selling tteokbokki, egg bread and hotteok."],
      steps: [
        ['<b>지하철</b> · 4호선 명동역 6번 출구, 또는 2호선 을지로입구역 5·6번 출구', '<b>Subway</b> · Myeongdong Station (Line 4) exit 6, or Euljiro 1-ga Station (Line 2) exits 5 & 6'],
        ['<b>노점</b> · 보통 오후 4시쯤부터 밤까지 열어요', '<b>Food carts</b> · Usually open from around 4 pm into the night'],
        ['<b>팁</b> · 남산서울타워까지 걸어서 또는 케이블카로 갈 수 있어요', '<b>Tip</b> · N Seoul Tower on Namsan is a walk or a cable-car ride away'],
      ],
      map: '명동거리',
    },
  },
  hongdae: {
    blurb: ['버스킹 무대 앞에서 같이 춤추기', 'Dance along at a street busking stage'],
    route: {
      title: ['진짜 홍대 거리에 가 보기', 'Visit the real Hongdae'],
      lead: ['홍익대학교 앞 젊음의 거리예요. 저녁마다 걷고싶은거리 버스킹 존에서 노래하고 춤추는 공연이 열리고, 벽화와 작은 가게, 카페가 많아요.', 'The lively streets around Hongik University. Every evening musicians and dancers perform in the busking zone on the main street, surrounded by murals, small shops and cafes.'],
      steps: [
        ['<b>지하철</b> · 2호선·공항철도 홍대입구역 9번 출구에서 걸어서 5분', '<b>Subway</b> · Hongik Univ. Station (Line 2 & Airport Railroad), exit 9, then a 5-min walk'],
        ['<b>버스킹</b> · 주말 저녁에 특히 많아요. 공연자에게 팁을 줘도 좋아요', '<b>Busking</b> · Busiest on weekend evenings. Tipping performers is welcome'],
        ['<b>팁</b> · 인천공항에서 공항철도로 바로 올 수 있어요', '<b>Tip</b> · The Airport Railroad runs straight here from Incheon Airport'],
      ],
      map: '홍대 걷고싶은거리',
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
