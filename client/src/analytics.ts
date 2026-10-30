import { inject } from '@vercel/analytics';
import type { PostHog } from 'posthog-js';

// 분석 도구 두 가지
// 1) Vercel Web Analytics: 방문자 수, 유입 경로, 국가, 기기 (Vercel 대시보드에서 Enable 해야 수집 시작)
// 2) PostHog: 사람들이 들어와서 무엇을 했는지 (해돋이 완주, 풍등, 알람, 재방문)
//    VITE_POSTHOG_KEY가 있을 때만 켜짐. 키(phc_...)는 원래 브라우저에 공개되는 값이라 코드에 있어도 괜찮음.

const POSTHOG_KEY: string | undefined = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST: string = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let ph: PostHog | null = null;
const queue: [string, Record<string, unknown> | undefined][] = [];

/** uid: 브라우저에 저장된 익명 ID. 같은 사람의 재방문을 이어서 보기 위해 사용 (이름·연락처는 보내지 않음) */
export function initAnalytics(uid: string) {
  try { inject(); } catch { /* 광고 차단기 등 */ }
  if (!POSTHOG_KEY) return;
  // 첫 화면을 빨리 띄우려고, PostHog는 페이지가 뜬 뒤에 따로 불러옴
  const load = () => import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      bootstrap: { distinctID: uid },
      autocapture: false,            // 클릭 하나하나 대신 의미 있는 행동만 기록
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      persistence: 'localStorage',
    });
    ph = posthog;
    for (const [e, p] of queue.splice(0)) ph.capture(e, p);
  }).catch(() => { /* 분석 실패가 서비스를 막으면 안 됨 */ });
  if (document.readyState === 'complete') setTimeout(load, 1500);
  else addEventListener('load', () => setTimeout(load, 1500), { once: true });
}

/** 행동 기록. 분석 도구가 꺼져 있거나 막혀 있어도 아무 일도 일어나지 않음 */
export function track(event: string, props?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  try {
    if (ph) ph.capture(event, props);
    else if (queue.length < 50) queue.push([event, props]);
  } catch { /* 무시 */ }
}
