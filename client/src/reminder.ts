// 나가기 전에 "다음 해돋이 5분 전에 알려 주세요" — 웹 푸시가 되면 푸시로, 안 되면 캘린더 파일로
import { SERVER_URL } from './net';

/** 서버의 푸시 공개키. 서버에 키가 설정돼 있지 않으면 null → 캘린더만 보여 줌 */
let serverKey: string | null = null;

/** 이 브라우저가 웹 푸시를 받을 수 있는지 (아이폰은 홈 화면에 설치한 앱에서만 가능) */
export const canPush = () =>
  !!serverKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Notification.permission !== 'denied';

export function initPush() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* 무시 */ }); });
  fetch(`${SERVER_URL}/push/key`).then(r => r.json()).then(j => { serverKey = j.key ?? null; }).catch(() => { /* 서버가 아직 깨는 중 */ });
}

/** base64url 공개키 → 브라우저가 원하는 바이트 배열 */
function keyBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

export type PushResult = 'ok' | 'denied' | 'unavailable';

export async function schedulePush(place: string, sunrise: number, lang: string): Promise<PushResult> {
  const key = serverKey;
  if (!key || !canPush()) return 'unavailable';
  // 권한 요청은 꼭 버튼을 누른 직후에 (그래야 브라우저가 막지 않음)
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const r = await fetch(`${SERVER_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: sub.toJSON(), place, at: sunrise, lang }),
  });
  return r.ok ? 'ok' : 'unavailable';
}

export const calendarUrl = (place: string, sunrise: number, lang: string) =>
  `${SERVER_URL}/calendar.ics?place=${place}&at=${sunrise}&lang=${lang}`;
