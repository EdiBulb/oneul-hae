import { lang } from './i18n';
import { track } from './analytics';

/** 인스타·쓰레드·페이스북 안 브라우저: 화면이 좁고 아래로 당기면 창이 닫혀서, 크롬/사파리로 열도록 위에 안내 띠를 띄움 */
export function inAppHint() {
  const ua = navigator.userAgent;
  const app = /Barcelona|Threads/i.test(ua) ? 'threads' : /Instagram/i.test(ua) ? 'instagram' : /FBAN|FBAV/i.test(ua) ? 'facebook' : /Line\//i.test(ua) ? 'line' : '';
  if (!app) return;
  try { if (sessionStorage.getItem('inappX')) return; } catch { /* 무시 */ }
  const ko = lang === 'ko', android = /Android/i.test(ua);
  const el = document.getElementById('inapp')!, go = document.getElementById('inappGo') as HTMLAnchorElement;
  if (android) {
    // 안드로이드: intent 주소로 크롬에서 열기 (안 깔려 있으면 기본 브라우저)
    const url = location.href.replace(/^https?:\/\//, '');
    go.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
    go.textContent = ko ? '크롬으로 열기' : 'Open in Chrome';
    go.hidden = false;
    document.getElementById('inappText')!.textContent = ko ? '크롬에서 열면 더 부드럽고, 알람도 받을 수 있어요' : 'Smoother in Chrome, with sunrise alarms';
    go.onclick = () => track('inapp_open_chrome', { app });
  } else {
    document.getElementById('inappText')!.textContent = ko ? '오른쪽 위 ⋯ 를 누르고 "외부 브라우저로 열기"를 고르면 더 부드러워요' : 'Tap ⋯ at the top right and choose "Open in browser" for a smoother view';
  }
  el.hidden = false;
  document.getElementById('inappX')!.onclick = () => { el.hidden = true; try { sessionStorage.setItem('inappX', '1'); } catch { /* 무시 */ } };
  track('inapp_seen', { app, os: android ? 'android' : 'ios' });
}
