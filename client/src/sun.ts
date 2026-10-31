import { locale, T } from './i18n';
import type { Place } from './places';

// 태양 고도·방위각 계산 (SunCalc와 같은 공식). 서버 없이 각자 기기에서 계산하므로
// 모든 사람이 같은 시각에 같은 하늘을 본다.
const rad = Math.PI / 180;
const obl = rad * 23.4397;

export function sunPos(ms: number, lat: number, lng: number) {
  const d = ms / 86400000 - 0.5 + 2440588 - 2451545;
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(obl) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(obl), Math.cos(L));
  const H = rad * (280.16 + 360.9856235 * d) + rad * lng - ra;
  const phi = rad * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / rad, az: az / rad };
}

/** from~to 사이에서 해가 지평선(-0.833°)을 넘어 올라오는 시각들 */
export function findSunrises(p: Place, from: number, to: number): number[] {
  const out: number[] = [];
  let prev = sunPos(from, p.lat, p.lng).alt;
  for (let t = from + 60000; t <= to; t += 60000) {
    const a = sunPos(t, p.lat, p.lng).alt;
    if (prev < -0.833 && a >= -0.833) out.push(t);
    prev = a;
  }
  return out;
}

/** 일출 전 45분 ~ 일출 후 35분을 "LIVE" 구간으로 본다 */
export const PRE = 45 * 60000;
export const POST = 35 * 60000;

let cache = { key: '', list: [] as number[] };
export function sunrises(p: Place, now: number) {
  const key = p.id + Math.floor(now / 3600000);
  if (cache.key !== key) cache = { key, list: findSunrises(p, now - 30 * 3600000, now + 30 * 3600000) };
  return cache.list;
}

export function sunriseInfo(p: Place, now: number) {
  const list = sunrises(p, now);
  return {
    windowSR: list.find(s => now >= s - PRE && now <= s + POST),
    next: list.find(s => s > now),
    last: [...list].reverse().find(s => s <= now),
  };
}

// ---------- 시간 표시 ----------
const fmtCache: Record<string, Intl.DateTimeFormat> = {};
function fmt(ms: number, tz: string, opts: Intl.DateTimeFormatOptions) {
  const k = tz + JSON.stringify(opts);
  fmtCache[k] ??= new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts });
  return fmtCache[k].format(new Date(ms));
}
export const hm = (ms: number, tz: string) => fmt(ms, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const dayName = (ms: number, tz: string) => fmt(ms, tz, { month: 'long', day: 'numeric', weekday: 'short' });
export const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
  return T.dur(h, m % 60);
};
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
