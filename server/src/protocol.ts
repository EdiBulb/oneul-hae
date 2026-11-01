// 서버와 클라이언트가 함께 쓰는 실시간 이벤트 타입.
// 클라이언트는 `import type`으로만 가져가므로 이 파일에는 타입만 둔다.

export type PlaceId = 'jeongdongjin' | 'seongsan' | 'homigot' | 'gisborne' | 'jumunjin' | 'hyangho' | 'hangang';

/** 캐릭터 겉모습: 색상 팔레트의 인덱스 */
export interface Look { body: number; hat: number }

/** 0 = 서 있음, 1 = 걷는 중, 2 = 방석에 앉음, 3 = 모래에 누워 하늘 보기 */
export type St = 0 | 1 | 2 | 3;

/** cheers = 모닝커피 짠. 혼자면 한 모금 마시고, 가까운 사람과 3초 안에 같이 누르면 컵을 부딪친다 */
export type Emote = 'stretch' | 'wave' | 'cheers' | 'clap' | 'dig' | 'eat';

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
  /** 담요를 두르고 있는지 (켜 두는 상태라 나중에 들어온 사람도 볼 수 있게 서버가 기억) */
  blanket?: boolean;
  /** 소품 비트마스크: 1 회색 맨투맨·검은 슬랙스, 2 빨간 목도리, 4 꽃다발 */
  outfit?: number;
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

/** 오늘 다녀간 진짜 사람이 마지막으로 머문 자리 (이름·소원 없이 위치와 색만) */
export interface Ghost { x: number; z: number; ry: number; sit: boolean; look: Look }

/** 오늘(현지 날짜) 이 해변에 남은 흔적. 모두 실제 접속 기록에서 나온다 */
export interface Traces {
  /** 오늘 다녀간 서로 다른 사람 수 (지금 있는 사람 포함) */
  visitors: number;
  /** 지금은 떠난 사람들의 마지막 자리 */
  ghosts: Ghost[];
  /** 오늘 올라간 풍등 위치 [x, z] (문구 없음) */
  lanterns: [number, number][];
}

/** 모래 게시판의 글 하나. 이름·쓴 사람 정보는 없음 */
export interface SandPost { id: string; text: string; at: number }
export type SandWriteResult = { ok: true; post: SandPost } | { ok: false; reason: 'cooldown' | 'filtered'; wait?: number };

/** 모래성: level 1 모래 더미 → 2 성벽 → 3 탑과 깃발, towers는 다른 사람들이 얹은 작은 탑 */
export interface Castle { id: string; x: number; z: number; level: number; towers: number }
export type CastleResult = { ok: true; castle: Castle; kind: 'new' | 'grow' | 'tower' } | { ok: false; reason: 'cooldown' | 'place' | 'full' | 'done' };

export interface Welcome {
  id: string;
  place: PlaceId;
  channel: number;
  players: PlayerInfo[];
  /** 방석 번호 → 앉아 있는 플레이어 id */
  seats: Record<number, string>;
  traces: Traces;
  /** 이 해변의 모래 게시판 (지금 남아 있는 글) */
  board: SandPost[];
  /** 이 해변의 모래성 */
  castles: Castle[];
}

export interface Stats {
  online: Record<PlaceId, number>;
  /** 오늘(현지 날짜 기준) 알람을 끄고 온 사람 수 */
  woke: Record<PlaceId, number>;
  /** 오늘(현지 날짜 기준) 다녀간 서로 다른 사람 수 */
  today: Record<PlaceId, number>;
}

export interface ServerToClient {
  welcome: (w: Welcome) => void;
  joined: (p: PlayerInfo) => void;
  left: (id: string) => void;
  /** 0.1초마다 방 안에서 움직인 사람들의 위치를 한 번에 묶어서 보낸다 */
  tick: (batch: Move[]) => void;
  emote: (id: string, e: Emote) => void;
  /** 물수제비: 던진 사람이 정한 튀는 횟수를 모두가 똑같이 본다 */
  skip: (id: string, n: number) => void;
  /** 두 사람이 커피잔을 부딪쳤다 (a가 먼저 누른 사람) */
  clink: (a: string, b: string) => void;
  blanket: (id: string, on: boolean) => void;
  outfit: (id: string, mask: number) => void;
  /** 꽃다발 건네주기: from의 꽃이 to에게 간다 (모두가 같은 순간에 봄) */
  give: (from: string, to: string) => void;
  sandPost: (p: SandPost) => void;
  sandRemove: (id: string) => void;
  castle: (c: Castle) => void;
  /** text: 쓴 사람이 공개를 고르고, 서버 필터를 통과한 소원만. 없으면 불빛만 */
  lantern: (id: string, x: number, z: number, text?: string) => void;
  seat: (idx: number, id: string | null) => void;
  stats: (s: Stats) => void;
}

export interface ClientToServer {
  join: (p: JoinPayload) => void;
  s: (x: number, z: number, ry: number, st: St) => void;
  emote: (e: Emote) => void;
  skip: (n: number) => void;
  /** 소원 문구는 고른 소원이거나, 직접 쓴 소원 중 "다른 사람에게도 보여주기"를 체크한 것만 보낸다 */
  lantern: (x: number, z: number, text?: string) => void;
  sit: (idx: number, ack: (ok: boolean) => void) => void;
  stand: () => void;
  blanket: (on: boolean) => void;
  outfit: (mask: number) => void;
  give: (to: string) => void;
  sandWrite: (text: string, ack: (r: SandWriteResult) => void) => void;
  sandReport: (id: string) => void;
  castle: (x: number, z: number, ack: (r: CastleResult) => void) => void;
  woke: () => void;
}
