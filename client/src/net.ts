import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '../../server/src/protocol';

export type Net = Socket<ServerToClient, ClientToServer>;

/** 배포할 때는 VITE_SERVER_URL 환경 변수에 실시간 서버 주소를 넣는다 */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export function connect(): Net {
  return io(SERVER_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
}
