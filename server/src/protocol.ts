// 서버와 클라이언트가 함께 쓰는 실시간 이벤트 타입.
// 클라이언트는 `import type`으로만 가져가므로 이 파일에는 타입만 둔다.

export type PlaceId = 'jeongdongjin' | 'seongsan' | 'homigot' | 'gisborne';

/** 캐릭터 겉모습: 색상 팔레트의 인덱스 */
export interface Look { body: number; hat: number }

/** 0 = 서 있음, 1 = 걷는 중, 2 = 방석에 앉음 */
export type St = 0 | 1 | 2;

export type Emote = 'stretch' | 'wave';

/** [id, x, z, ry, st] — 자주 오가므로 객체 대신 배열 */
export type Move = [string, number, number, number, St];

export interface PlayerInfo {
  id: string;
  nick: string;
  look: Look;
  x: number;
  z: number;
  ry: number;
  st: St;
}

export interface JoinPayload {
  place: PlaceId;
  /** 브라우저에 저장된 익명 ID (같은 사람을 하루에 한 번만 세기 위함) */
  uid: string;
  nick: string;
  look: Look;
  /** 오늘 알람을 끄고 들어왔는지 */
  woke: boolean;
}

export interface Welcome {
  id: string;
  place: PlaceId;
  channel: number;
  players: PlayerInfo[];
  /** 방석 번호 → 앉아 있는 플레이어 id */
  seats: Record<number, string>;
}

export interface Stats {
  online: Record<PlaceId, number>;
  /** 오늘(현지 날짜 기준) 알람을 끄고 온 사람 수 */
  woke: Record<PlaceId, number>;
}

export interface ServerToClient {
  welcome: (w: Welcome) => void;
  joined: (p: PlayerInfo) => void;
  left: (id: string) => void;
  /** 0.1초마다 방 안에서 움직인 사람들의 위치를 한 번에 묶어서 보낸다 */
  tick: (batch: Move[]) => void;
  emote: (id: string, e: Emote) => void;
  lantern: (id: string, x: number, z: number) => void;
  seat: (idx: number, id: string | null) => void;
  stats: (s: Stats) => void;
}

export interface ClientToServer {
  join: (p: JoinPayload) => void;
  s: (x: number, z: number, ry: number, st: St) => void;
  emote: (e: Emote) => void;
  /** 소원 문구는 보내지 않는다: 직접 쓴 소원은 본인 화면에만 보인다 */
  lantern: (x: number, z: number) => void;
  sit: (idx: number, ack: (ok: boolean) => void) => void;
  stand: () => void;
  woke: () => void;
}
