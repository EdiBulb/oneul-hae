import type { PlaceId } from '../../server/src/protocol';

export interface Place {
  id: PlaceId;
  name: string;
  region: string;
  lat: number;
  lng: number;
  tz: string;
}

export const PLACES: Place[] = [
  { id: 'jeongdongjin', name: '정동진', region: '강릉', lat: 37.6906, lng: 129.0336, tz: 'Asia/Seoul' },
  { id: 'seongsan', name: '성산일출봉', region: '제주', lat: 33.458, lng: 126.9425, tz: 'Asia/Seoul' },
  { id: 'homigot', name: '호미곶', region: '포항', lat: 36.0767, lng: 129.5689, tz: 'Asia/Seoul' },
  { id: 'gisborne', name: '기스본', region: '뉴질랜드', lat: -38.6623, lng: 178.0176, tz: 'Pacific/Auckland' },
];

export const WISHES = ['오늘도 무사히', '건강하게', '합격 기원', '월급 들어와라', '좋은 하루', '다 잘 될 거야', '사랑하는 사람들 행복하게', '퇴근 빨리'];
export const ADJ = ['느긋한', '부지런한', '졸린', '따뜻한', '고요한', '설레는', '씩씩한', '말랑한'];
export const NOUN = ['갈매기', '파도', '햇살', '조개', '구름', '등대', '모래', '물결'];

/** 캐릭터 색 팔레트. 서버에는 인덱스만 오간다 */
export const BODY_COLORS = [0x6f86b5, 0x9b7bb0, 0x7da37d, 0xc78f6b, 0xd9c6a5, 0x5f6f80, 0xb86b7a, 0xf3efe6];
export const HAT_COLORS = [0xe8c34d, 0x5bb3a8, 0xe07a6a, 0x8c7ae0, 0xf0f0f0, 0x3f8fd6, 0xd66fa0, 0xff8a3d];

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
