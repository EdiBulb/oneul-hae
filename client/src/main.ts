import * as THREE from 'three';
import './style.css';
import type { PlayerInfo, SandPost, St, Stats } from '../../server/src/protocol';
import { createSandBoard } from './sand-board';
import { animChar, disposeChar, faceAngle, makeChar, textSprite, turnTo, type Char, OUTFIT, HELD, OUTFIT_MAX, JWIBUL, jwColor, setOutfit, outfitOf, showLeftFlowers, wearSet, itemOf, withItem, setGrowth, growthOf, growthStage, GROWTH_DAYS, PHOENIX_AT, setGoalPaper } from './character';
import { createAmbience, fetchWeather, windLabel, type Weather } from './ambience';
import { initAnalytics, track } from './analytics';
import { createBeachLife } from './beach-life';
import { createTraces } from './traces';
import { GATE, TRAIL, INDOOR, isIndoor, mountainY, trailX, benchAt, benchSeats, canStand, createBonfire, createFootprints, createPier, floorY, nightness, BONFIRE, createStones, onPier, surfaceAt, createJetties, hasPhotoSpots, PHOTO_SPOTS, setTerrain, has, RAMEN_MACHINE, camOpen, SUMMIT, SHOPS, shopDoor, type Shop } from './beach-extras';
import { grab, compose } from './photo';
import { initTalk, say as talk, talking, ask, setSkip, skipAll } from './talk';
import { createMago } from './mago';
import { hatch, openEyes, fade } from './intro';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
import { NEST } from './mountain-scenery';
import { createHall, HALL } from './hall';
import { initGoal, writeGoal, sendToSun } from './goal';
import { createCastles } from './castles';
import { createShells, PER_DAY, SHELLS } from './shells';
import { createSkyLife } from './skylife';
import { createPlaceScenery } from './place-scenery';
import { createBots } from './bots';
import { createFireflies, createLeaves } from './sky-extras';
import { createBirds } from './birds';
import { createLegends } from './legend';
import { createFeed, FEED_AT, FEED_R } from './feed';
import { createNightFx, FIRE_COLORS } from './night-fx';
import { inAppHint } from './inapp';
import { LANTERN_COLORS, LANTERN_PATTERNS, createLanterns } from './lanterns';
import { createEcho, createLateSleeper, say } from './gags';
import { connect } from './net';
import { calendarUrl, canPush, initPush, schedulePush } from './reminder';
import { BODY_COLORS, HAT_COLORS, PLACES, WISHES, localizeNick, localizeWish, placeName, placeRegion, type Place, placeBlurb, placeRoute, type PlaceGroup } from './places';
import { T, applyHtml, lang, locale, num, setLang } from './i18n';
import { dateKey, markSeen, save, store, streakCount, wokeToday } from './store';
import { ITEMS, SLOTS, SLOT_NAME, earnable, grant as grantItem, has as hasItem, isOn, itemDesc, itemHow, itemName, migrateWardrobe, seasonNow, toggleWear, type Item } from './wardrobe';
import { EARN, PRICE, buy, grant, earnCycle, earnGolden, earnLive, onSun, owns, shieldOffer, shieldsLeft, spend, sunTotal, useShield, markShieldAsked } from './sunpoints';
import { dayName, dur, hm, mmss, sunPos, sunriseInfo, sunrises } from './sun';
import { createWorld, glowTexture, groundY } from './world';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
applyHtml();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ================= 3D 기본 =================
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch {
  $('fail').style.display = 'flex';
  throw new Error('WebGL을 쓸 수 없는 브라우저');
}
// 직접 고른 색이 그대로 보이도록 색 관리 끔 (프로토타입과 같은 색감)
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
$('scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3000);
function onResize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  // 가로 화면은 픽셀이 많아 메모리가 부족해질 수 있어서 선명도를 조금 낮춤
  renderer.setPixelRatio(Math.min(w > h ? 1.25 : 1.75, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 64 : 50; camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); onResize();
// 인앱 브라우저 시트 닫힘 방지: 스크롤 위치를 30px에 고정 (0이면 시트가 아래로 끌려 내려감)
const PIN = 30;
const pin = () => { if (Math.abs(scrollY - PIN) > 1) scrollTo(0, PIN); };
addEventListener('scroll', pin, { passive: true });
addEventListener('load', pin); pin(); setTimeout(pin, 300);
// 화면(3D·조이스틱) 위의 세로 드래그를 페이지가 소비해서 바깥 앱으로 넘어가지 않게
document.addEventListener('touchmove', e => {
  const t = e.target as HTMLElement;
  if (t.closest('.sheet, .sand-area, .chips, textarea, input, [data-scroll]')) return;
  e.preventDefault();
}, { passive: false });
// 폰을 돌린 직후에는 화면 크기가 늦게 바뀌는 브라우저가 있어서 조금 뒤에 다시 맞춤
const resizeSoon = () => { onResize(); setTimeout(onResize, 150); setTimeout(onResize, 600); };
addEventListener('orientationchange', resizeSoon);
window.visualViewport?.addEventListener('resize', resizeSoon);
// 메모리가 모자라 브라우저가 3D 화면을 꺼 버리면(회전·다른 앱 다녀오기) 까맣게 멈추지 않고 다시 불러옴
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault(); $('glLost').hidden = false; track('gl_context_lost');
  setTimeout(() => location.reload(), 2500);
});
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

const GLOW = glowTexture();
const world = createWorld(scene, renderer, GLOW);
const lanterns = createLanterns(scene, GLOW);
// 해변 풍경(갈매기·강아지·동네 주민)은 인원수에 넣지 않는다
const life = createBeachLife(scene);
const fireflies = createFireflies(scene, GLOW), birds = createBirds(scene), leaves = createLeaves(scene), legends = createLegends(scene, GLOW);
const echo = createEcho(scene), late = createLateSleeper(scene, floorY);
/** 가을(한국 9~11월)에 나무가 있는 곳(산·한강공원)에만 낙엽 */
// 낙엽은 사용자 피드백으로 잠시 끔 (모델 품질이 받쳐줄 때 다시)
const leavesHere = (_id: string) => false;
// 해변 강아지 이름 (해변마다 한 마리)
const DOG_NAMES: Record<string, [string, string]> = {
  jeongdongjin: ['해피', 'Happy'], seongsan: ['감귤', 'Gamgyul'], homigot: ['호두', 'Hodu'], gisborne: ['키위', 'Kiwi'],
  jumunjin: ['메밀', 'Memil'], hyangho: ['보리', 'Bori'], hangang: ['라면', 'Ramyeon'], jirisan: ['반달', 'Bandal'], hallasan: ['노루', 'Noru'], seopjikoji: ['유채', 'Yuchae'],
};
let lastDogMode = 'wander';
const dogName = () => (DOG_NAMES[place?.id] ?? ['댕댕이', 'Pup'])[lang === 'ko' ? 0 : 1];

const traces = createTraces(scene, GLOW);
const pier = createPier(scene, GLOW);
const jetties = createJetties(scene, GLOW);
const prints = createFootprints(scene);
const stones = createStones(scene, (x, z, last, mine) => {
  prints.ripple(x, z, last ? 1.5 : 0.7);
  const d = Math.hypot(me.root.position.x - x, me.root.position.z - z);
  amb.plop((mine ? 1 : 0.7) * clamp(1.2 - d / 25, 0, 1), last);
});
/** lying: 몸이 누워 있는지 / eyeView: 누운 채 눈으로 보는 시점인지 (카메라 버튼은 시점만 바꾸고 몸은 그대로) */
let lying = false, lieSince = 0, eyeView = false, photoSpotHinted = false;
/** 홍보 이미지 찍을 때 이름표·발밑 고리 숨기기 (테스트용) */
let shotMode = false;
const castles = createCastles(scene);
const shells = createShells(scene, GLOW);
const sky = createSkyLife(scene, GLOW);
const bonfire = createBonfire(scene, GLOW);
const scenery = createPlaceScenery(scene, GLOW);
const sandBoard = createSandBoard(scene);
// 방석 22개 뒤에 모닥불 통나무 8자리, 데크 끝 3자리를 붙임 (서버 번호와 같은 순서)
const seats = world.seats;
for (const b of benchSeats()) seats.push({ ...b, occ: null });

// ================= 상태 =================
// 푸시·캘린더 알림에서 들어오면 ?place=로 그 해변을 바로 연다
const query = new URLSearchParams(location.search);
// 해변별 주소: hae.abracadelulu.com/gisborne 처럼 경로로 들어오면 그 해변에서 시작 (예전 ?place= 도 지원)
const pathPlace = location.pathname.split('/').filter(Boolean)[0];
let place: Place = PLACES.find(p => p.id === pathPlace) ?? PLACES.find(p => p.id === query.get('place')) ?? PLACES[0];
let replay: { sr: number; start: number; duration: number; from: number; span: number } | null = null;
let watchStart = 0, seenFlag = false;
/** 산 정상: 절벽 끝에 닿았는지 (장소를 옮기면 초기화) */
let summitReached = false;
// ================= 5분 순환 하늘 =================
// 진짜 해돋이 시간(LIVE)이 아니면 하루를 5분으로 줄여 계속 돌린다: 해 뜸 → 낮 → 뒤쪽으로 해 짐 → 밤(반딧불) → 다시 해 뜸.
// 시계 기준이라 같은 장소에 있는 사람은 모두 같은 하늘을 본다. 기록(해 본 날)은 진짜 해돋이만 인정.
const CYCLE = 5 * 60000;
// 한 바퀴 안에서 각 구간이 차지하는 비율과, 그 구간에 해당하는 실제 시각 범위 (일출 SR·일몰 SS 기준, 분)
const SEG: [number, 'sr' | 'ss' | 'sr2', number, 'sr' | 'ss' | 'sr2', number][] = [
  [0.30, 'sr', -25, 'sr', 20],   // 새벽·해돋이 (가장 길게)
  [0.15, 'sr', 20, 'ss', -20],   // 낮은 빨리
  [0.17, 'ss', -20, 'ss', 30],   // 해넘이
  [0.38, 'ss', 30, 'sr2', -25],  // 밤 (반딧불)
];
const SR_PHASE = 0.30 * (25 / 45); // 해가 지평선을 넘는 순간
let cycleDay = { key: '', sr: 0, ss: 0 };
function cycleRefs() {
  const key = place.id + dateKey(Date.now());
  if (cycleDay.key !== key) {
    const info = sunriseInfo(place, Date.now());
    const sr = info.last ?? info.next ?? Date.now();
    let ss = sr + 12 * 3600000, prev = sunPos(sr + 3 * 3600000, place.lat, place.lng).alt;
    for (let t = sr + 3 * 3600000 + 60000; t < sr + 20 * 3600000; t += 60000) {
      const a = sunPos(t, place.lat, place.lng).alt;
      if (prev >= -0.833 && a < -0.833) { ss = t; break; }
      prev = a;
    }
    cycleDay = { key, sr, ss };
  }
  return cycleDay;
}
const cyclePhase = () => (Date.now() % CYCLE) / CYCLE;
/** 다음 순환 해돋이까지 남은 밀리초 */
const cycleToSunrise = () => (((SR_PHASE - cyclePhase()) % 1 + 1) % 1) * CYCLE;
function cycleTime() {
  const { sr, ss } = cycleRefs(), at = { sr, ss, sr2: sr + 86400000 };
  let p = cyclePhase();
  for (const [w, a, da, b, db] of SEG) {
    if (p <= w) { const t0 = at[a] + da * 60000, t1 = at[b] + db * 60000; return t0 + (t1 - t0) * (p / w); }
    p -= w;
  }
  return sr;
}
/** 지금 순환 중인지 (LIVE·다시보기·'실제 하늘 보기'가 아니면) */
const cycling = () => !replay && !store.realSky && !sunriseInfo(place, Date.now()).windowSR;

/** 인트로 동안: 모두에게 똑같은 아침 (실제 시각과 상관없이). base = 그날 해돋이 기준 몇 ms, rate = 흐르는 빠르기 */
let introSky: { at: number; base: number; rate: number } | null = null;
function setIntroSky(offsetMs: number | null, rate = 0) { introSky = offsetMs === null ? null : { at: Date.now(), base: cycleRefs().sr + offsetMs, rate }; }
const virtualNow = () => {
  if (introSky) return introSky.base + (Date.now() - introSky.at) * introSky.rate;
  if (!replay) return cycling() ? cycleTime() : Date.now();
  const k = Math.min(1, (Date.now() - replay.start) / replay.duration);
  return replay.sr + replay.from + k * replay.span;
};

// 예전 서울 투어에서 입은 한복 표시(16)는 지움
/** 저장하지 않는 잠깐짜리 비트: 손에 든 음식, 쥐불놀이 */
const TEMP = HELD | JWIBUL | (3 << 14);
if (store.outfit) store.outfit &= OUTFIT_MAX & ~TEMP;
// 가게에서 들고 나온 건 그날까지만 (예전 한복 비트 16이 남아 있던 경우도 여기서 지워짐)
if (store.outfit && itemOf(store.outfit) && store.itemDay !== dateKey(Date.now())) store.outfit = withItem(store.outfit, 0);
// ================= 나 =================
const me = makeChar(BODY_COLORS[store.look.body], HAT_COLORS[store.look.hat]);
// 병아리 성장: 해를 본 날 수 (연속 기록 지키기로 채운 날은 빼고)
const seenDays = () => Object.values(store.days).filter(v => v !== 'shield').length;
store.look.g = growthOf(seenDays()); store.growthSeen ??= store.look.g;
setGrowth(me, store.look.g);
// 지리산은 언제나 장터목 둥지에서 깨어남 (바쁘면 옆의 '정상 가기' 버튼으로 바로)
const spawn = () => {
  if (place.id === 'jirisan') { const x = NEST.x + (Math.random() - 0.5) * 0.6, z = NEST.z + (Math.random() - 0.5) * 0.6; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = 0; return; }
  const z = 11 + Math.random() * 3; me.root.position.set((Math.random() * 2 - 1) * 7, groundY(z), z);
};
spawn();
scene.add(me.root);
const meLabel = textSprite(T.me, 0.75); meLabel.position.y = 1.62; me.root.add(meLabel);
const meLabelBase = meLabel.scale.clone();
const meRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32),
  new THREE.MeshBasicMaterial({ color: 0xffa14d, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
meRing.rotation.x = -Math.PI / 2; meRing.position.y = 0.03; me.root.add(meRing);
let mySeat: number | null = null;
$('myNick').textContent = localizeNick(store.nick);

// ================= 다른 사람들 (실시간) =================
interface Remote { info: PlayerInfo; c: Char; label: THREE.Sprite; tx: number; tz: number; ry: number; st: St }
const remotes = new Map<string, Remote>();
let myId = '';

function addRemote(p: PlayerInfo) {
  if (remotes.has(p.id)) return;
  const c = makeChar(BODY_COLORS[p.look.body % BODY_COLORS.length], HAT_COLORS[p.look.hat % HAT_COLORS.length]);
  c.root.position.set(p.x, floorY(p.x, p.z), p.z);
  c.root.rotation.y = p.ry;
  const label = textSprite(localizeNick(p.nick), 0.6); label.position.y = 1.58; c.root.add(label);
  c.blanket.visible = !!p.blanket;
  if (p.outfit) setOutfit(c, p.outfit);
  setGrowth(c, p.look.g ?? 2);
  scene.add(c.root);
  remotes.set(p.id, { info: p, c, label, tx: p.x, tz: p.z, ry: p.ry, st: p.st });
}
function removeRemote(id: string) {
  prints.forget(id);
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.c.root); disposeChar(r.c);
  remotes.delete(id);
}
function clearRemotes() { [...remotes.keys()].forEach(removeRemote); }

function updateRemotes(dt: number) {
  const e = 1 - Math.pow(0.002, dt);
  for (const r of remotes.values()) {
    r.c.root.visible = !introSolo; // 인트로(다시 보기 포함) 동안엔 아무도 안 보임
    const p = r.c.root.position;
    const dx = r.tx - p.x, dz = r.tz - p.z, d = Math.hypot(dx, dz);
    // 서버에서 초당 8번 정도 오는 위치 사이를 부드럽게 채움
    if (d > 6) { p.x = r.tx; p.z = r.tz; } else { p.x += dx * e; p.z += dz * e; }
    const bench = r.st === 2 ? benchAt(p.x, p.z) : null;
    r.c.bench = !!bench;
    p.y = bench ? bench.y : floorY(p.x, p.z) + (r.st === 2 ? 0.07 : 0);
    if (r.st < 2) prints.step(r.info.id, p.x, p.z, r.c.root.rotation.y);
    r.c.state = r.st === 2 ? 'sit' : r.st === 3 ? 'lie' : (r.st === 1 || d > 0.05) ? 'walk' : 'idle';
    turnTo(r.c, r.ry, dt);
    animChar(r.c, dt);
    r.label.visible = !shotMode && camera.position.distanceTo(p) < 18;
  }
}

// ================= 서버 연결 =================
const net = connect();
let connected = false;
let stats: Stats | null = null;
let todayVisitors = 0;
/** 지금은 혼자여도, 오늘 다녀간 진짜 사람이 있으면 그걸 알려 준다 */
function aloneMsg() {
  const n = (stats?.today[place.id] ?? todayVisitors) - 1;
  if (bots.count) return n > 0 ? T.aloneVisited(n) : '';
  return n > 0 ? T.aloneVisited(n) : T.alone;
}

/** 처음 온 사람: 인트로(부화 → 할미 → 정상 봉황 → 둥지)가 끝날 때까지 혼자. 다른 사람·봇·흔적 없음 */
let introSolo = !store.hinted && place.id === 'jirisan';
/** 다시 보기 동안엔 서버에서 잠깐 나가 있음 (다른 사람 화면에서 내가 사라짐) */
let introOffline = false;
function join() {
  if (introSolo) return; // 인트로 동안엔 혼자 (끝나면 들어감)
  net.emit('join', { place: place.id, uid: store.uid, nick: store.nick, look: store.look, woke: wokeToday() });
}
net.on('connect', () => { connected = true; $('conn').classList.remove('show'); join(); renderCounts(); });
net.on('disconnect', () => {
  life.setDog(null); connected = false; clearRemotes(); renderCounts(); });
// 연결 상태는 위쪽 접속자 칸에 '연결 중…'으로 보임 (따로 띄우면 버튼과 겹쳐서)

net.on('welcome', w => {
  if (w.place !== place.id) return;
  myId = w.id;
  clearRemotes();
  castles.setAll(w.castles ?? []);
  if (w.dog) { life.setDog(w.dog); lastDogMode = w.dog.mode; }
  w.players.forEach(addRemote);
  seats.forEach(s => (s.occ = null));
  for (const [idx, id] of Object.entries(w.seats)) if (seats[+idx]) seats[+idx].occ = id;
  if (mySeat !== null) { leaveSeat(); me.state = 'idle'; }
  if (outfitOf(me)) net.emit('outfit', outfitOf(me));
  if (me.blanket.visible) net.emit('blanket', true); // 다시 접속·채널 이동 때 담요 상태 알려 주기
  // 유령 같은 흔적(오늘 다녀간 자리)은 피드백으로 숨김 — 방문자 수만 씀
  void traces;
  sandPosts = w.board ?? []; renderSandLabel(); if (sandOpen) renderSand();
  todayVisitors = w.traces.visitors;
  bots.fill();
  if (w.players.length > 0) ticker(T.alreadyHere(w.players.length));
  else ticker(aloneMsg());
});
net.on('joined', p => { addRemote(p); ticker(T.joined(localizeNick(p.nick))); });
net.on('left', id => { if (holdTo === id) letGo(false); holds.delete(id); removeRemote(id); });
net.on('hold', (id, to) => {
  if (to === null) holds.delete(id); else holds.set(id, to);
  if (to === myId) toast(T.heldBy);
});
net.on('tick', batch => {
  for (const [id, x, z, ry, st] of batch) {
    const r = remotes.get(id); // 내 위치도 묶음에 들어 있지만 remotes에 없으니 건너뜀
    if (!r) continue;
    r.tx = x; r.tz = z; r.ry = ry; r.st = st;
  }
});
net.on('emote', (id, e) => {
  const r = remotes.get(id);
  if (!r) return;
  r.c.emote = e; r.c.emoteT = 0;
  const near = r.c.root.position.distanceTo(me.root.position);
  if (e === 'yaho') yahoFrom(r.c);
  if (e === 'peck') remotePecked(id, r.c.root.position.x, r.c.root.position.z);
  if (e === 'crow') { amb.crow(growthStage(r.c), clamp(0.4 - near / 40, 0, 0.35)); voiceBubble(r.c, 0.75); }
  if (e === 'clap') { amb.clap(clamp(1.1 - near / 18, 0, 0.8)); if (near < 12) ticker(T.clapBy(localizeNick(r.info.nick))); }
  // 가까운 사람이 커피를 들면 같이 누르라고 알려 줌
  if (e === 'cheers' && r.c.root.position.distanceTo(me.root.position) < 3) toast(T.cheersNearby(localizeNick(r.info.nick)));
});
net.on('skip', (id, n) => {
  const r = remotes.get(id);
  if (!r) return;
  r.c.emote = 'skip'; r.c.emoteT = 0;
  const who = r.c.root.position.clone(), ry = r.c.root.rotation.y, nick = localizeNick(r.info.nick);
  const near = who.distanceTo(me.root.position);
  setTimeout(() => {
    const got = stones.toss(who, ry, false, Math.max(0, n));
    if (got > 0 && near < 25) setTimeout(() => ticker(T.skipBy(nick, got)), 900 + got * 280);
  }, 450);
});
// 짠: 서버가 가까이 있는 두 사람을 짝지어 줌 → 서로 마주 보고 컵을 부딪침
let clinkFace: { ang: number; until: number } | null = null;
const charOf = (id: string) => (id === myId ? me : remotes.get(id)?.c);
const nickOf = (id: string) => (id === myId ? localizeNick(store.nick) : localizeNick(remotes.get(id)?.info.nick ?? ''));
net.on('clink', (a, b) => {
  const ca = charOf(a), cb = charOf(b);
  if (!ca || !cb) return;
  for (const [x, y] of [[ca, cb], [cb, ca]] as const) {
    x.emote = 'clink'; x.emoteT = 0;
    const ang = faceAngle(y.root.position.x - x.root.position.x, y.root.position.z - x.root.position.z);
    if (x === me) clinkFace = { ang, until: performance.now() + 2600 };
    else { const r = [...remotes.values()].find(r => r.c === x); if (r) r.ry = ang; }
  }
  if (a === myId || b === myId) {
    ticker(T.clinkMe(nickOf(a === myId ? b : a)));
    track('cheers_clink', { place: place.id });
  } else if (ca.root.position.distanceTo(me.root.position) < 12) ticker(T.clinkOthers(nickOf(a), nickOf(b)));
});
net.on('outfit', (id, mask) => { const r = remotes.get(id); if (r) setOutfit(r.c, mask); });
net.on('blanket', (id, on) => { const r = remotes.get(id); if (r) r.c.blanket.visible = on; });
net.on('lantern', (id, x, z, text, style) => {
  if (!LANTERN_ON) return;
  const r = remotes.get(id);
  // 공개된 소원이고, 내가 '다른 사람 소원 보기'를 켜 두었을 때만 글자를 띄움
  const wish = text && store.seeWishes ? localizeWish(text) : undefined;
  lanterns.launch(new THREE.Vector3(x, groundY(z), z), wish, true, style ?? 0);
  if (r) ticker(wish ? T.lanternByWish(localizeNick(r.info.nick), wish) : T.lanternBy(localizeNick(r.info.nick)));
});
net.on('seat', (idx, id) => {
  if (!seats[idx]) return;
  seats[idx].occ = id === myId ? 'me' : id;
});
net.on('stats', s => { stats = s; renderCounts(); });

// 내 위치 보내기: 바뀌었을 때만, 최대 초당 8번 (+1초마다 한 번은 꼭)
let lastSent = 0, lastSentKey = '';
function sendState(t: number) {
  if (!connected) return;
  const p = me.root.position;
  const st: St = mySeat !== null ? 2 : lying ? 3 : me.state === 'walk' ? 1 : 0;
  const key = `${p.x.toFixed(2)},${p.z.toFixed(2)},${me.root.rotation.y.toFixed(2)},${st}`;
  if (t - lastSent < 125 || (key === lastSentKey && t - lastSent < 1000)) return;
  lastSent = t; lastSentKey = key;
  net.volatile.emit('s', +p.x.toFixed(2), +p.z.toFixed(2), +me.root.rotation.y.toFixed(2), st);
}

function renderCounts() {
  const online = stats?.online[place.id] ?? (connected ? remotes.size + 1 : 0);
  $('viewerCount').textContent = connected ? num(online) : T.connecting;
  $('viewerUnit').textContent = connected ? T.unitPeople : '';
  $('placeBtnName').textContent = `📍 ${placeName(place)}`;
  if (openSheet?.id === 'placeSheet') renderPlaceList();
}

// ================= 입력 =================
const input = { x: 0, y: 0 };
const keys: Record<string, boolean> = {};
const isTyping = () => document.activeElement instanceof HTMLInputElement;
addEventListener('keydown', e => { if (!isTyping()) keys[e.key.toLowerCase()] = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
const joy = $('joy'), knob = $('knob');
let joyId: number | null = null, joyVec = { x: 0, y: 0 };
function joyMove(e: PointerEvent) {
  const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const max = r.width / 2 - 18, d = Math.hypot(dx, dy);
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  joyVec = { x: dx / max, y: -dy / max };
}
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e: PointerEvent) => { if (e.pointerId !== joyId) return; joyId = null; joyVec = { x: 0, y: 0 }; knob.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

function readInput() {
  if (sandOpen) { input.x = input.y = 0; return; } // 게시판을 보는 동안은 제자리
  let { x, y } = joyVec;
  // '앉을 곳 찾기': 손대지 않는 동안 가장 가까운 빈자리로 걸어가서 앉음
  const touched = x || y || keys['a'] || keys['d'] || keys['w'] || keys['s'] || keys['arrowleft'] || keys['arrowright'] || keys['arrowup'] || keys['arrowdown'];
  if (seekSeat !== null) {
    const s = seats[seekSeat];
    if (touched || s.occ || mySeat !== null || performance.now() > seekUntil) seekSeat = null;
    else {
      const dx = s.x - me.root.position.x, dz = s.z - me.root.position.z, d = Math.hypot(dx, dz);
      if (d < 1.6) { seekSeat = null; $('sitBtn').click(); }
      else {
        const ux = dx / d, uz = dz / d, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        x = ux * rx + uz * rz; y = ux * fx + uz * fz;
      }
    }
  }
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) y += 1;
  if (keys['s'] || keys['arrowdown']) y -= 1;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.x = x; input.y = y;
}

// ================= 카메라: 내 캐릭터 주위를 도는 궤도 카메라 =================
const cam = { yaw: 0, pitch: 0.3, dist: 6.4, tYaw: 0, tPitch: 0.3, tDist: 6.4 };
let seekSeat: number | null = null, seekUntil = 0;
const DIST_MIN = 3, DIST_MAX = 46;
function setView(d: number, pitch?: number, yaw?: number) {
  cam.tDist = clamp(d, DIST_MIN, DIST_MAX);
  if (pitch !== undefined) cam.tPitch = pitch;
  if (yaw !== undefined) cam.tYaw = yaw;
}
const camLook = new THREE.Vector3(0, 1.5, 0), target = new THREE.Vector3(), want = new THREE.Vector3();
const eye = { yaw: 0, pitch: 0.95, tYaw: 0, tPitch: 0.95 };
let eyeK = 0, camPull = 1, dressK = 0;
const dressPos = new THREE.Vector3(), dressLook = new THREE.Vector3();
const eyePos = new THREE.Vector3(), eyeLook = new THREE.Vector3(), lookTmp = new THREE.Vector3();
let meFade = 1;
/** 내 캐릭터 반투명 (1 = 그대로) */
function fadeMe(k: number) {
  k = Math.round(k * 20) / 20;
  if (k === meFade) return;
  meFade = k;
  me.root.traverse(o => {
    const mm = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mm || (o as THREE.Sprite).isSprite) return;
    for (const m of Array.isArray(mm) ? mm : [mm]) { // 면마다 재질이 다른 것(김밥 단면)도
      if (m.userData.op0 === undefined) { m.userData.op0 = m.opacity; m.userData.tr0 = m.transparent; }
      m.transparent = k < 1 || m.userData.tr0; m.opacity = m.userData.op0 * k; m.needsUpdate = true;
    }
  });
}
/** 카메라가 내려갈 수 있는 가장 낮은 각도. 그보다 더 밀면 하늘을 올려다봄 */
const LOOK_MIN = 0.04;
/** 걸어갈 수 있는 곳: 땅 + 청학당 외관 벽은 못 뚫음 (계단은 들어가는 입구) */
const canGo = (x: number, z: number) => canStand(x, z) && !(place.id === 'jirisan' && !isIndoor(x, z) && hall.blocks(x, z) && !hall.atStairs(x, z));
const inCamPos = new THREE.Vector3(), inLook = new THREE.Vector3();
function updateCamera(dt: number) {
  const e = 1 - Math.pow(0.004, dt);
  // 청학당 실내: 앞벽·천장을 잘라 둔 방을 문 쪽 위에서 들여다봄 (동물의 숲 실내처럼)
  if (place.id === 'jirisan' && indoorNow()) {
    const p = me.root.position;
    inLook.set(INDOOR.x + (p.x - INDOOR.x) * 0.35, INDOOR.y + 0.8, INDOOR.z + 0.2 + (p.z - INDOOR.z) * 0.3);
    inCamPos.set(inLook.x - 1.2, INDOOR.y + 7.4, inLook.z - 7.6);
    if (camera.position.distanceTo(inCamPos) > 20) camera.position.copy(inCamPos); else camera.position.lerp(inCamPos, 1 - Math.pow(0.02, dt));
    camera.lookAt(inLook); fadeMe(1);
    cam.yaw = cam.tYaw = Math.PI; // 조이스틱 '위'가 훈장님 쪽이 되게
    return;
  }
  cam.yaw += (cam.tYaw - cam.yaw) * e; cam.pitch += (cam.tPitch - cam.pitch) * e; cam.dist += (cam.tDist - cam.dist) * e;
  const p = me.root.position;
  target.set(p.x, p.y + (mySeat !== null ? 1.0 : 1.3), p.z);
  // 화면을 위로 밀어 낮은 각도 아래로 내려가면: 카메라는 낮게 두고 시선만 하늘로 (하늘 올려다보기)
  const pitch = Math.max(LOOK_MIN, cam.pitch), lookUp = Math.max(0, LOOK_MIN - cam.pitch);
  const cp = Math.cos(pitch);
  camera.position.set(
    target.x + Math.sin(cam.yaw) * cp * cam.dist,
    Math.max(target.y - 0.7, target.y + Math.sin(pitch) * cam.dist), // 바닥 높이 기준 (지리산 둥지는 해수면보다 낮아서 예전 0.6 고정이면 카메라가 공중에 뜸)
    target.z + Math.cos(cam.yaw) * cp * cam.dist);
  // 카메라 충돌: 등 뒤에 가게·벽이 있으면 카메라를 내 쪽으로 당겨서 늘 열린 곳에 둠
  let open = 1;
  if (!camOpen(camera.position.x, camera.position.y, camera.position.z)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 7; i++) {
      const m = (lo + hi) / 2;
      if (camOpen(target.x + (camera.position.x - target.x) * m, target.y + (camera.position.y - target.y) * m, target.z + (camera.position.z - target.z) * m)) lo = m; else hi = m;
    }
    open = Math.max(0.12, lo - 0.25 / Math.max(1, cam.dist));
  }
  // 당길 때는 빠르게, 다시 물러날 때는 천천히 (덜컹거림 방지)
  camPull += (open - camPull) * (open < camPull ? 1 - Math.pow(0.0001, dt) : 1 - Math.pow(0.05, dt));
  if (camPull < 0.999) camera.position.lerpVectors(target, camera.position, camPull);
  // 바짝 당겨졌을 때: 카메라를 살짝 올려 어깨너머로 보고, 내 캐릭터는 반투명하게 (앞이 가리지 않게)
  // 실제로 벽 때문에 당겨졌을 때만 (해변에서 그냥 가까이 줌한 건 그대로)
  const near = camPull > 0.97 ? 0 : Math.max(clamp((3.2 - cam.dist * camPull) / 2.4, 0, 1), clamp((0.85 - camPull) / 0.45, 0, 1));
  if (near > 0) camera.position.y = Math.min(4.4, camera.position.y + near * 1.4);
  fadeMe(eyeK > 0.5 ? 1 : 1 - near * 0.7);
  // 가까이에선 수평선을, 멀리선 앞쪽 해변 전체를 바라봄
  const close = clamp((12 - cam.dist) / 9, 0, 1), far = clamp((cam.dist - 9) / 18, 0, 1);
  const ahead = 9 * close + cam.dist * 0.75 * far;
  want.set(target.x - Math.sin(cam.yaw) * ahead, target.y + 0.3 * close, target.z - Math.cos(cam.yaw) * ahead);
  // 가까이 볼 때: 병아리가 늘 화면 세로 58% 지점(조이스틱·버튼 위)에 오도록 시선 각도를 맞춤
  // (카메라가 벽·언덕에 밀려 높아져도 병아리가 화면 아래로 내려가지 않게)
  const aimK = clamp((14 - cam.dist) / 5, 0, 1);
  if (aimK > 0 && lookUp <= 0) {
    const dx = target.x - camera.position.x, dy = target.y - 0.6 - camera.position.y, dz = target.z - camera.position.z, hd = Math.hypot(dx, dz) || 1e-3;
    const fovV = (camera as THREE.PerspectiveCamera).fov * Math.PI / 180, aspectK = 0.14; // 몸 가운데가 화면 중심보다 10% 아래
    const lp = Math.atan2(dy, hd) + Math.atan(aspectK * 2 * Math.tan(fovV / 2)), L = Math.hypot(hd, dy);
    lookTmp.set(camera.position.x + dx / hd * Math.cos(lp) * L, camera.position.y + Math.sin(lp) * L, camera.position.z + dz / hd * Math.cos(lp) * L);
    want.lerp(lookTmp, aimK);
  }
  if (lookUp > 0) want.y += (ahead + cam.dist * cp) * Math.tan(Math.min(1.3, lookUp * 1.5));
  camLook.lerp(want, 1 - Math.pow(0.02, dt));
  camera.lookAt(camLook);
  // 옷 입기: 화면 아래 절반은 옷장, 위 절반엔 내 캐릭터를 정면에서 (dressK 0 → 1)
  dressK += ((openSheet?.id === 'outfitSheet' ? 1 : 0) - dressK) * (1 - Math.pow(0.01, dt));
  if (dressK > 0.001) {
    const k = dressK * dressK * (3 - 2 * dressK), ry = me.root.rotation.y, q = me.root.position;
    dressPos.set(q.x - Math.sin(ry) * 4.6, q.y + 1.5, q.z - Math.cos(ry) * 4.6);
    dressLook.set(q.x, q.y - 0.75, q.z);
    camera.position.lerp(dressPos, k);
    camera.lookAt(lookTmp.copy(camLook).lerp(dressLook, k));
    fadeMe(1);
  }
  // 모래 게시판: 카메라가 판 앞 위쪽으로 다가가 내려다봄 (sandK 0 → 1)
  if (sandK > 0.001) {
    const k = sandK * sandK * (3 - 2 * sandK);
    camera.position.lerp(sandBoard.viewPos, k);
    sandLook.copy(camLook).lerp(sandBoard.center, k);
    camera.lookAt(sandLook);
  }
  // 누워서 별 보기: 3인칭으로 눕는 모습을 잠깐 보여 준 뒤, 카메라가 눈 위치로 들어가 하늘을 올려다봄
  const eyeWant = lying && eyeView && performance.now() - lieSince > 1300 ? 1 : 0;
  eyeK = clamp(eyeK + clamp(eyeWant - eyeK, -dt * 1.4, dt * 0.7), 0, 1);
  eye.yaw += (eye.tYaw - eye.yaw) * e; eye.pitch += (eye.tPitch - eye.pitch) * e;
  if (eyeK > 0.001) {
    const k = eyeK * eyeK * (3 - 2 * eyeK);
    me.root.updateMatrixWorld(true);
    me.inner.localToWorld(eyePos.set(0, 0.82, -0.62));
    const yaw = me.root.rotation.y + eye.yaw, cp = Math.cos(eye.pitch);
    eyeLook.set(eyePos.x - Math.sin(yaw) * cp * 10, eyePos.y + Math.sin(eye.pitch) * 10, eyePos.z - Math.cos(yaw) * cp * 10);
    camera.position.lerp(eyePos, k);
    lookTmp.copy(camLook).lerp(eyeLook, k);
    camera.lookAt(lookTmp);
  }
  meLabel.visible = meRing.visible = eyeK < 0.4 && !shotMode && meFade > 0.6;
  const k = clamp(cam.dist / 10, 1, 2.2);
  meLabel.scale.set(meLabelBase.x * k, meLabelBase.y * k, 1);
  meLabel.position.y = 1.62 + (k - 1) * 0.12;
  meRing.scale.setScalar(Math.min(3, 0.8 + cam.dist / 14));
  { const far = cam.tDist > 15, ov = $('overview'), rv = $('resetView'); if (ov.hidden !== far) { ov.hidden = far; rv.hidden = !far; } }
  $('viewName').textContent = lying && eyeView ? T.viewMine : cam.tDist > 20 ? T.viewAll : cam.tDist > 9 ? T.view3rd : T.viewMine;
}

// 화면 드래그 = 둘러보기, 두 손가락/휠 = 줌
const cvs = renderer.domElement, ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, dist0 = 0;
cvs.addEventListener('pointerdown', e => {
  cvs.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.tDist; }
});
cvs.addEventListener('pointermove', e => {
  const prev = ptrs.get(e.pointerId);
  if (!prev) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1 && eyeK > 0.5) { eye.tYaw = clamp(eye.tYaw - dx * 0.006, -1.7, 1.7); eye.tPitch = clamp(eye.tPitch + dy * 0.005, 0.12, 1.5); }
  else if (ptrs.size === 1) { cam.tYaw -= dx * 0.007; cam.tPitch = clamp(cam.tPitch + dy * 0.005, LOOK_MIN - 0.85, 1.35); }
  else if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()];
    setView(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)));
  }
});
const ptrEnd = (e: PointerEvent) => {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0;
};
cvs.addEventListener('pointerup', ptrEnd); cvs.addEventListener('pointercancel', ptrEnd);
cvs.addEventListener('wheel', e => { e.preventDefault(); setView(cam.tDist * (1 + e.deltaY * 0.0012)); }, { passive: false });

// ================= 내 캐릭터 이동 =================
function nearestFreeSeat(): number | null {
  let best: number | null = null, bd = 2.6;
  seats.forEach((s, i) => {
    if (s.occ || (s.places && !s.places.includes(place.id)) || (!s.kind && !has.mats(place.id))) return;
    const d = Math.hypot(s.x - me.root.position.x, s.z - me.root.position.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
/** 자리에서 내려오기: 통나무였으면 모닥불 쪽으로 한 걸음 내려와 바닥에 선다 */
function leaveSeat() {
  if (mySeat === null) return;
  const st = seats[mySeat], p = me.root.position;
  if (st.sx !== undefined && st.sz !== undefined) { p.x = st.sx; p.z = st.sz; }
  p.y = floorY(p.x, p.z);
  st.occ = null; mySeat = null; me.bench = false;
}
function standUp() {
  if (mySeat !== null) { leaveSeat(); net.emit('stand'); }
  me.state = 'idle';
}
function updateMe(dt: number) {
  readInput();
  const p = me.root.position, moving = Math.hypot(input.x, input.y) > 0.12;
  if (moving) {
    if (mySeat !== null) standUp();
    lying = false; onCushion = false;
    // 조이스틱 위쪽 = 카메라가 바라보는 방향
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = rx * input.x + fx * input.y, mz = rz * input.x + fz * input.y;
    // 등산로 오르막에서는 걸음이 살짝 느려짐
    let sp = 3.2 * dt;
    if (place.id === 'jirisan' && p.z > 14) { const up = floorY(p.x + mx * 0.5, p.z + mz * 0.5) - floorY(p.x, p.z); if (up > 0.03) sp *= Math.max(0.72, 1 - up * 2.2); }
    // 갈 수 있는 곳만: 막히면 벽을 따라 미끄러지듯
    const nx = p.x + mx * sp, nz = p.z + mz * sp;
    if (canGo(nx, nz)) { p.x = nx; p.z = nz; }
    else if (canGo(nx, p.z)) p.x = nx;
    else if (canGo(p.x, nz)) p.z = nz;
    p.y = floorY(p.x, p.z); me.state = 'walk'; turnTo(me, faceAngle(mx, mz), dt);
    const surf = prints.step('me', p.x, p.z, me.root.rotation.y);
    if (surf) amb.step(surf === 'grass' ? 'sand' : surf);
  } else if (mySeat === null) {
    me.state = lying ? 'lie' : onCushion ? 'sit' : 'idle';
    // 사진 자리: 동그라미에 서면 맞은편 자리를 바라봄
    if (!lying && hasPhotoSpots()) {
      const p0 = me.root.position, i = PHOTO_SPOTS.findIndex(sp => Math.hypot(sp.x - p0.x, sp.z - p0.z) < 0.42);
      if (i >= 0) {
        const o = PHOTO_SPOTS[1 - i];
        turnTo(me, Math.atan2(-(o.x - p0.x), -(o.z - p0.z)), dt);
        if (!photoSpotHinted) { photoSpotHinted = true; toast(T.photoSpot); track('photo_spot', { place: place.id }); }
      }
    }
    if (clinkFace && performance.now() < clinkFace.until) turnTo(me, clinkFace.ang, dt);
  } else turnTo(me, seats[mySeat].ry, dt);
  animChar(me, dt);
  const near = mySeat === null ? nearestFreeSeat() : null;
  const sb = $('sandBtn'), showSb = !sandOpen && sandBoard.distance(me.root.position) < 3.4;
  if (sb.hidden === showSb) sb.hidden = !showSb;
  // 담요 버튼은 앉아 있거나 이미 두르고 있을 때만 (버튼이 너무 많아지지 않게)
  const bl = $('blanketBtn'), showBl = mySeat !== null || me.blanket.visible;
  if (bl.hidden === showBl) bl.hidden = !showBl;
  bl.textContent = me.blanket.visible ? T.blanketOff : T.blanketOn;
  updateGiveBtn();
  updatePetBtn();
  // 앉기 버튼은 앉아 있거나 빈자리 가까이 있을 때만 (평소엔 '행동' 안의 '앉을 곳 찾기')
  { const sbn = $('sitBtn'), show = mySeat !== null || lying || near !== null; if (sbn.hidden === show) sbn.hidden = !show; }
  $('sitBtn').textContent = mySeat !== null || lying ? T.standUp : near !== null ? (seats[near].kind === 'log' ? T.sitLog : seats[near].kind === 'pier' ? T.sitPier : seats[near].kind === 'bus' ? T.sitBench : seats[near].kind === 'rock' ? T.sitRock : seats[near].kind === 'chair' ? T.sitChair : seats[near].kind === 'floor' ? T.sitFloor : T.sitDown) : T.findSeat;
}

// ================= 상단 문구 =================
let lastTickerAt = 0, lastWokeNote = 0;
/** 해변 소식: 잠깐 떴다가 4초 뒤 스르르 사라짐 (화면을 가리지 않도록) */
let tickerTimer = 0;
function ticker(msg: string) {
  if (introSolo) return;
  const el = $('ticker');
  el.textContent = msg; el.classList.add('show');
  lastTickerAt = performance.now();
  clearTimeout(tickerTimer);
  tickerTimer = window.setTimeout(() => el.classList.remove('show'), 4000);
}

// 상단 안내: 처음과 중요한 순간에만 크게 보여주고, 나머지는 작은 알약으로 접어 둠
let expandedUntil = 0, lastAltForBanner = -90, minuteWarned = 0;
function expandBanner(ms = 7000) { expandedUntil = Math.max(expandedUntil, Date.now() + ms); }
function toggleBanner() {
  if (Date.now() < expandedUntil) expandedUntil = 0; else expandBanner();
  lastUI = 0; // 바로 다시 그리기
}

function updateUI(vnow: number, alt: number, t: number) {
  const cyc = cycling(), now = cyc ? Date.now() : vnow;
  const info = sunriseInfo(place, now), tz = place.tz, live = !replay && !!info.windowSR, pn = placeName(place);
  const wx = weatherNow ? ` · ${windLabel(weatherNow)}` : '';
  $('liveDot').className = 'dot' + (live || replay ? '' : ' off');
  $('progress').style.display = replay ? 'block' : 'none';
  // 해가 지평선을 넘는 순간, 해 뜨기 1분 전에는 자동으로 펼침
  // 첫 프레임(-90)은 '해가 막 뜬 것'으로 치지 않음 (낮에 들어오자마자 박수·햇살이 나오지 않게)
  const crossed = lastAltForBanner > -89 && lastAltForBanner < 0 && alt >= 0;
  if (crossed && (live || replay) && !introSky) { expandBanner(10000); bots.clap(); }
  else if (crossed && cyc) { bots.clap(); }
  // 가게에서 들고 나온 게 있으면 해 뜨는 순간 하늘로 번쩍
  if (crossed && itemOf(outfitOf(me)) && !lying) { me.emote = 'raise'; me.emoteT = 0; if (connected) net.emit('emote', 'raise'); }
  else if (crossed && !lying && !store.crowTaught) { $('crowHint').hidden = false; setTimeout(() => { $('crowHint').hidden = true; }, 25000); }
  else if (crossed && !lying) setTimeout(() => crow('sunrise'), 700); // 해 뜨는 순간 다 같이 울기
  if (crossed && !introSky) { sunriseLegends(); setTimeout(() => void morningFeed(), 6000); } // 해가 뜨는 순간 봉황 (아주 가끔은 푸른 학도)
  if (crossed && (live || cyc) && !introSky) { sunRoseNow(); setTimeout(showDayTitle, 1400); }
  maybeDeliverOnLoad(alt, live, cyc);
  nightCheck(alt);
  lastAltForBanner = alt;
  if (live && info.windowSR && info.windowSR - now < 60000 && info.windowSR > now && minuteWarned !== info.windowSR) {
    minuteWarned = info.windowSR; expandBanner(65000);
  }
  let full: string, compact: string;
  if (replay) {
    const k = Math.min(1, (Date.now() - replay.start) / replay.duration);
    $('progressBar').style.width = `${k * 100}%`;
    full = T.replayOf(dayName(replay.sr, tz));
    compact = T.replaySoonOrRisen(pn, alt >= -0.8);
    $('headline').textContent = alt < -0.8 ? T.soon : T.risen;
    $('sub').textContent = T.sunriseAt(pn, hm(replay.sr, tz));
    if (k >= 1) {
      replay = null; track('replay_finished', { place: place.id });
      earnCycle();
      if (markSeen('replay')) { toast(T.replaySeen); track('sunrise_seen', { place: place.id, kind: 'replay', streak: streakCount() }); }
      // 다 본 뒤: 진짜 해돋이는 언제인지, 그리고 이때 처음으로 홈 화면 추가를 권함
      const nx = sunriseInfo(place, Date.now()).next;
      if (nx) setTimeout(() => toast(T.realNext(hm(nx, place.tz))), 3200);
      askInstallAfterSun();
    }
  } else if (live) {
    const sr = info.windowSR!;
    full = `<span class="dot"></span>LIVE · ${pn}${wx}`;
    if (now < sr) {
      $('headline').textContent = T.soon;
      $('sub').textContent = T.sunriseLeft(hm(sr, tz), mmss(sr - now));
      compact = `<span class="dot"></span>${T.liveCountdown(mmss(sr - now))}`;
    } else {
      $('headline').textContent = T.risen;
      $('sub').textContent = T.sunriseAt(pn, hm(sr, tz));
      compact = `<span class="dot"></span>${T.liveRisen(pn)}`;
    }
  } else if (cyc) {
    // 순환: 다음 해까지 남은 시간 + 진짜 해돋이(LIVE) 안내
    const left = cycleToSunrise(), ph = cyclePhase();
    const rising = ph < 0.30, setting = ph >= 0.45 && ph < 0.62, nightTime = ph >= 0.62;
    $('headline').textContent = rising ? (alt < -0.8 ? T.cycSoon(mmss(left)) : T.risen) : setting ? T.cycSet : nightTime ? T.cycNight(mmss(left)) : T.cycDay;
    $('sub').textContent = info.next ? T.cycLive(dayName(info.next, tz), hm(info.next, tz), dur(info.next - now)) : '';
    full = T.cycFull(pn);
    compact = T.cycCompact(mmss(left));
  } else {
    full = `${T.localTime(pn, hm(now, tz))}${wx}`;
    compact = info.next ? T.nextCompact(pn, hm(info.next, tz), dur(info.next - now)) : pn;
    if (info.next) {
      $('headline').textContent = alt < -6 ? T.night : info.last ? T.roseAt(hm(info.last, tz)) : T.sunUp;
      $('sub').textContent = T.nextSunrise(dayName(info.next, tz), hm(info.next, tz), dur(info.next - now));
    }
  }
  // 해가 안 떠 있는 시간에는 '오늘 해돋이 20초 만에 보기'를 늘 보여 줌 (해돋이 앱인데 해가 없으면 안 되니까)
  // ✕로 닫으면 오늘은 다시 안 보임 (메뉴의 '오늘 해돋이 다시보기'는 그대로)
  // 순환 중엔 해가 계속 뜨니 다시보기 버튼은 '실제 하늘 보기'를 켠 사람에게만
  const pill = !cyc && !live && !replay && !!info.next && store.replayPillOff !== dateKey(Date.now()) && (!has.peak(place.id) || summitReached);
  if ($('replayWrap').hidden === pill) $('replayWrap').hidden = !pill;
  // 해가 수평선 근처에 있는 동안(뜨기 직전~막 뜬 뒤)은 큰 안내 글씨를 접어 둠: 해를 가리지 않게.
  // 남은 시간은 위쪽 작은 알약에 그대로 보임
  const sunMoment = alt > -2.5 && alt < 4;
  const expanded = Date.now() < expandedUntil && !sunMoment;
  $('center').classList.toggle('collapsed', !expanded);
  $('status').innerHTML = expanded ? full : `${compact}<span class="chev">▾</span>`;
  // 해가 떠오르는 장면을 5초 이상 보면 오늘 기록
  if ((live || replay) && alt > 0.3) {
    if (!watchStart) watchStart = Date.now();
    if (live && !seenFlag && Date.now() - watchStart > 5000) {
      seenFlag = true;
      earnLive();
      if (markSeen('live')) { toast(T.liveSeen(streakCount())); track('sunrise_seen', { place: place.id, kind: 'live', streak: streakCount(), others: remotes.size }); askInstallAfterSun(); }
    }
  }
  // 진짜 숫자만: 오늘 알람 끄고 온 사람
  const woke = stats?.woke[place.id] ?? 0;
  if (live && woke > 0 && t - lastWokeNote > 60000 && t - lastTickerAt > 5000) {
    lastWokeNote = t; ticker(T.wokeCount(woke));
  }
  // 혼자일 때 안내는 가끔만 (1분 30초마다)
  if (connected && remotes.size === 0 && t - lastTickerAt > 90000) ticker(aloneMsg());
}

// ================= 루프 =================
let lastT = performance.now(), lastUI = 0;
// ================= 마고할미 (지리산 산신령) =================
const MAGO_AT = { x: NEST.x - 1.9, z: NEST.z - 0.6 }; // 장터목 둥지 옆
const mago = createMago(T.magoName);
mago.root.position.set(MAGO_AT.x, mountainY(MAGO_AT.x, MAGO_AT.z, 'jirisan'), MAGO_AT.z);
const magoHome = faceAngle(NEST.x - MAGO_AT.x, NEST.z - 1.5 - MAGO_AT.z); mago.root.rotation.y = magoHome; mago.look(magoHome);
scene.add(mago.root);
($('magoBtn') as HTMLButtonElement).textContent = T.magoBtn;
let magoMore = Math.floor(Math.random() * 7), magoBusy = false;
/** 내 기록에 따라 할 말을 고름. again = 오늘 이미 인사한 뒤 또 말을 걸 때 */
function magoLines(again: boolean): string[] {
  if (!store.magoMet) return T.magoFirst;
  if (again) return [T.magoMore[magoMore++ % T.magoMore.length]];
  const today = dateKey(Date.now()), yest = dateKey(Date.now() - 86400000), n = streakCount();
  if (store.days[today]) return [T.magoSeen];
  if (n >= 2) return [T.magoStreak(n + (store.days[yest] && !store.days[today] ? 1 : 0))];
  if (Object.keys(store.days).length && !store.days[yest]) return [T.magoMissed];
  return [T.magoHello];
}
async function magoTalk(auto: boolean, forceFirst = false) {
  if (magoBusy) return;
  // 처음 이야기는 다른 대화(속마음 등)가 끝나기를 기다렸다가 꼭 함
  if (forceFirst) { magoBusy = true; while (talking()) await new Promise(r => setTimeout(r, 300)); }
  else if (talking()) return;
  magoBusy = true;
  const today = dateKey(Date.now()), again = store.magoDay === today && !!store.magoMet;
  const lines = forceFirst ? T.magoFirst : magoLines(again);
  store.magoDay = today; save();
  // 서로 마주 보기
  const p = me.root.position, m = mago.root.position;
  mago.look(faceAngle(p.x - m.x, p.z - m.z));
  if (!auto) { if (mySeat !== null) standUp(); turnTo(me, faceAngle(m.x - p.x, m.z - p.z), 1); }
  track('mago_talk', { auto, first: !store.magoMet, again });
  // 지난번 다짐이 있으면 그날 첫 인사 대신 그걸 물어봄 (새 아침의 시작)
  const reflect = !forceFirst && !again && !!store.magoMet && !!store.goal && !store.goal.reflected && store.goal.day < today;
  if (reflect) await reflectGoal();
  else for (const text of lines) { mago.talk(Math.min(6, text.length * 0.09)); await talk([{ who: 'mago', text }]); }
  store.magoMet = true; save();
  if (!forceFirst) await magoGifts();
  // 앱 설치는 처음에 묻지 않고, 해를 본 적 있는 사람에게 할미가 일주일에 한 번까지만 물어봄
  if (!reflect && !isStandalone && installReady() && (installEvent || isIOS || isKakao) && Date.now() - (store.installAskAt ?? 0) > 7 * 86400000) {
    store.installAskAt = Date.now(); save();
    mago.talk(4);
    const yes = await ask('mago', T.magoInstall, [T.magoInstallYes, T.magoInstallNo]) === 0;
    track('mago_install_ask', { yes });
    if (yes) showInstall(true); else { mago.talk(1.5); await talk([{ who: 'mago', text: T.magoInstallLater }]); }
  }
  mago.look(magoHome); magoBusy = false;
  if (!auto && isNight() && store.taleDay !== dateKey(Date.now())) await tellTale(false);
}

// ================= 새 아침 =================
/** 해가 지평선을 넘는 순간 (하루 한 번): '11월 12일 · 서른한 번째 아침' — 하루는 자정이 아니라 해돋이에 바뀜 */
function showDayTitle() {
  const today = dateKey(Date.now());
  if (store.titleDay === today || place.id !== 'jirisan') return;
  store.titleDay = today; save();
  const n = Math.max(1, seenDays() + (store.days[today] ? 0 : 1));
  $('dtDate').textContent = T.dayDate(new Date()); $('dtNth').textContent = T.dayNth(n);
  const el = $('dayTitle'); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 4200);
  track('day_title', { n });
}
/** 지난번에 쓴 다짐을 할미가 물어봄. 답은 기록하지 않음 (털어 내는 게 목적) */
async function reflectGoal() {
  const gl = store.goal, today = dateKey(Date.now());
  if (!gl || gl.reflected || gl.day >= today) return;
  gl.reflected = true; save();
  const yest = gl.day === dateKey(Date.now() - 86400000), [, mm, dd] = gl.day.split('-').map(Number);
  mago.talk(3); await talk([{ who: 'mago', text: T.reflectHi }]);
  ($('goalPeekImg') as HTMLImageElement).src = gl.img; $('goalPeekWhen').textContent = T.reflectWhen(yest, T.dayDate(new Date(2000, mm - 1, dd)));
  $('goalPeek').hidden = false;
  mago.talk(4);
  const pick = await ask('mago', T.reflectAsk(yest), T.reflectPick);
  $('goalPeek').hidden = true;
  track('goal_reflect'); // 무엇을 골랐는지는 남기지 않음
  mago.talk(5); await talk([{ who: 'mago', text: T.reflectReply[Math.max(0, pick)] }]);
  await talk([{ who: 'me', text: T.reflectMe }]);
}

// ================= 밤: 해를 기다리며 할 것 =================
let nightBusy = false, introEndAt = -1e9;
/** 밤이 되면 하루 한 번 '밤이 되었네…' 하고 뭘 할지 고름 */
function nightCheck(alt: number) {
  if (alt >= -6 || introSky || introRunning || introSolo || nightBusy || magoBusy || lying || talking() || place.id !== 'jirisan') return;
  if (store.nightDay === dateKey(Date.now()) || performance.now() - introEndAt < 20000 || document.querySelector('.sheet.open')) return;
  store.nightDay = dateKey(Date.now()); save();
  nightBusy = true;
  void (async () => {
    const pick = await ask('me', T.nightAsk, T.nightPick);
    track('night_pick', { pick });
    if (pick === 0) $('lieBtn').click();
    else if (pick === 1) await goHearTale();
    else await talk([{ who: 'me', text: T.nightWait }]);
    nightBusy = false;
  })();
}
/** 할미 곁으로 가서 옛날이야기 듣기 (멀리 있으면 암전 뒤 둥지로) */
async function goHearTale() {
  const p = me.root.position, m = mago.root.position;
  if (Math.hypot(p.x - m.x, p.z - m.z) > 6) {
    await fade(true);
    if (mySeat !== null) standUp(); onCushion = false; lying = false;
    const x = MAGO_AT.x + 1.4, z = MAGO_AT.z - 0.8; me.root.position.set(x, floorY(x, z), z);
    setView(4.2, 0.2, Math.atan2(-(MAGO_AT.x - x), -(MAGO_AT.z - z)) + 0.5); // 내 등 뒤에서 할미를 비스듬히
    await sleep(300); await fade(false);
  }
  await tellTale(true);
}
/** 옛날이야기 한 편 (순서대로, 하루 한 편). asked: 내가 먼저 청했는지 */
async function tellTale(asked: boolean) {
  if (magoBusy) return;
  magoBusy = true;
  const p = me.root.position, m = mago.root.position;
  mago.look(faceAngle(p.x - m.x, p.z - m.z)); turnTo(me, faceAngle(m.x - p.x, m.z - p.z), 1);
  if (!asked && await ask('mago', T.taleAsk, [T.taleYes, T.taleNo]) !== 0) { mago.look(magoHome); magoBusy = false; return; }
  const i = (store.taleNext ?? 0) % T.tales.length;
  track('tale', { i });
  for (const text of T.tales[i]) { mago.talk(Math.min(6, text.length * 0.09)); await talk([{ who: 'mago', text }]); }
  await talk([{ who: 'mago', text: T.taleEnd }]);
  store.taleNext = i + 1; store.taleDay = dateKey(Date.now()); save();
  await magoGifts(); // 다섯 편을 다 들었으면 어미의 노리개
  mago.look(magoHome); magoBusy = false;
}

// ================= 병아리 청학당 (오늘의 목표 쓰기) =================
// 땅 높이는 지리산 지형으로 직접 계산 (시작할 때는 아직 지형이 바뀌기 전이라 floorY를 쓰면 공중에 뜸)
const hall = createHall((x, z) => mountainY(x, z, 'jirisan')); scene.add(hall.root, hall.inner);
let hallMoving = false;
/** 지금 청학당 안(실내)인지 */
const indoorNow = () => isIndoor(me.root.position.x, me.root.position.z);
/** 계단 ↔ 실내 문턱: 어두워졌다가 이름이 뜨고 다른 공간으로 */
async function hallDoor(goIn: boolean) {
  if (hallMoving) return;
  hallMoving = true;
  if (mySeat !== null) standUp(); onCushion = false; lying = false; letGo(false);
  if (talking()) skipAll(); // 하던 말은 접고 넘어감
  $('fade').classList.toggle('named', goIn);
  await fade(true);
  const s = goIn ? hall.inSpot() : hall.outSpot();
  me.root.position.set(s.x, floorY(s.x, s.z), s.z); me.root.rotation.y = s.face;
  if (goIn) { savedView = { d: cam.tDist, p: cam.tPitch, y: cam.tYaw }; cam.yaw = cam.tYaw = Math.PI; }
  else { cam.tYaw = cam.yaw = s.face; if (savedView) setView(savedView.d, savedView.p); camLook.set(s.x - Math.sin(s.face) * 6, me.root.position.y + 1.3, s.z - Math.cos(s.face) * 6); }
  hallGreeted = false;
  track(goIn ? 'hall_enter' : 'hall_exit');
  await sleep(goIn ? 700 : 250);
  await fade(false);
  $('fade').classList.remove('named');
  hallMoving = false;
}
let savedView: { d: number; p: number; y: number } | null = null;
initGoal();
let onCushion = false, hallBusy = false, inHall = false, hallGreeted = false, hallSaidAt = -1e9;
const goalToday = () => store.goal?.day === dateKey(Date.now()) ? store.goal : undefined;
/** 오늘 쓴 종이는 해에게 보내기 전까지 오른쪽 날개에 계속 쥐고 있음 (화면에 따로 띄우지 않음) */
function renderGoalUi() { const gl = goalToday(); $('goalChip').hidden = true; setGoalPaper(me, !!gl && !gl.sent); setOutfit(me, outfitOf(me)); }
renderGoalUi();
($('goalBtn') as HTMLButtonElement).textContent = T.sitCushion;
/** 방석에 앉기: 아직 목표를 안 썼으면 훈장님이 한마디 하고 종이가 펼쳐짐 */
async function hallWrite() {
  if (hallBusy) return;
  hallBusy = true;
  if (mySeat !== null) standUp();
  // 가장 가까운 방석에 앉아 학 훈장님을 바라봄
  const c = hall.cushionNear(me.root.position.x, me.root.position.z);
  me.root.position.set(c.x, c.y, c.z); me.root.rotation.y = c.face; me.state = 'sit'; onCushion = true; lying = false;
  track('cushion_sit', { written: !!goalToday() });
  if (goalToday()) { hall.talk(2.5); await talk([{ who: 'crane', text: T.craneAgain }]); hallBusy = false; return; }
  hall.talk(4); await talk([{ who: 'crane', text: T.craneHow }]);
  const img = await writeGoal();
  if (img) {
    store.goal = { day: dateKey(Date.now()), img }; store.goalCount = (store.goalCount ?? 0) + 1; save(); renderGoalUi();
    track('goal_written');
    await talk([{ who: 'me', text: T.goalHold }]);
    hall.talk(3); await talk([{ who: 'crane', text: T.craneDone }]);
    await craneGifts();
  }
  hallBusy = false;
}
$('goalBtn').onclick = () => hallWrite();
/** 해가 떠 있을 때 울면: 품에 있던 오늘의 목표를 해에게 보냄 */
function deliverGoal() {
  const gl = goalToday();
  if (!gl || gl.sent || lastAltForBanner < -1.5) return;
  gl.sent = true; save(); renderGoalUi();
  sendToSun(gl.img, sunOnScreen());
  track('goal_sent');
  setTimeout(() => talk([{ who: 'me', text: T.goalSent }]), 2600);
}
function updateHall(dt: number, t: number) {
  const here = place.id === 'jirisan';
  hall.root.visible = hall.inner.visible = here; if (!here) { $('goalBtn').hidden = true; return; }
  hall.update(dt, t);
  const p = me.root.position, inside = indoorNow();
  world.setIndoor(inside);
  // 계단 앞을 밟으면 들어가고, 실내 문턱을 밟으면 나감
  if (!hallMoving && !introSolo) {
    if (!inside && hall.atStairs(p.x, p.z)) void hallDoor(true);
    else if (inside && hall.atDoor(p.x, p.z)) void hallDoor(false);
  }
  // 안에 들어와 있으면 어디서든 방석에 앉을 수 있음
  const near = inside && !hallMoving;
  const b = $('goalBtn'), show = near && !lying && !hallBusy && !onCushion;
  if (b.hidden === show) b.hidden = !show;
  hall.showHint(!goalToday());
  // 다가가면 바로 학 훈장님이 말을 검 (들어올 때마다, 너무 자주는 말고)
  // 다른 대화가 끝나기를 기다렸다가라도, 들어온 뒤 한 번은 꼭 말함
  if (near && !hallGreeted && !hallBusy && !talking() && !openSheet && performance.now() - hallSaidAt > 15000) {
    hallSaidAt = performance.now(); hallGreeted = true; hall.talk(3);
    talk([{ who: 'crane', text: goalToday() ? T.craneAgain : T.craneHello }]);
  }
  if (!near) hallGreeted = false;
  inHall = near;
}
$('magoBtn').onclick = () => magoTalk(false);
function updateMago(dt: number, t: number) {
  const here = place.id === 'jirisan';
  mago.root.visible = here; if (!here) { $('magoBtn').hidden = true; return; }
  mago.update(dt, t);
  const d = Math.hypot(me.root.position.x - MAGO_AT.x, me.root.position.z - MAGO_AT.z);
  const b = $('magoBtn'), show = !lying && !magoBusy && d < (b.hidden ? 2.6 : 3.2);
  if (b.hidden === show) b.hidden = !show;
  mago.showHint(!magoBusy && store.magoDay !== dateKey(Date.now()));
  // 하루 한 번: 가까이 오면 먼저 말을 걸어 줌 (첫 방문 안내 카드가 닫힌 뒤에만)
  if (d < 3.4 && !magoBusy && !introRunning && store.hinted && !openSheet && store.magoDay !== dateKey(Date.now()) && !$('hint').classList.contains('open')) magoTalk(true);
}

// ================= 등산로: 높이·남은 거리, 통천문 속마음, 정상으로 바로 =================
let gateSaid = !!store.gateSaid, trailShown = ''; // 통천문 혼잣말은 평생 한 번만
function updateTrail() {
  const on = place.id === 'jirisan', p = me.root.position;
  const show = on && p.z > 15;
  if (show) {
    const m = Math.round(1750 + (floorY(p.x, p.z) + 5.3) / 6.9 * 165), km = Math.max(0.1, p.z * 0.0175).toFixed(1);
    const txt = T.trailChip(m, km); if (txt !== trailShown) { $('trailChip').textContent = txt; trailShown = txt; }
  }
  if ($('trailChip').hidden === show) $('trailChip').hidden = !show;
  // 행동 메뉴의 순간이동: 아래쪽(둥지 가까이)이면 '정상으로 바로', 위쪽(정상 가까이)이면 '둥지로 바로'
  const up = p.z > TRAIL.jeseok, want = up ? 'top' : 'nest';
  $('warpBtn').hidden = !on;
  if ($('warpBtn').dataset.to !== want) { $('warpBtn').dataset.to = want; $('warpIc').textContent = up ? '⛰️' : '🪺'; $('warpLabel').textContent = up ? T.toTop : T.toNest; }
  // 통천문 바위 틈을 지날 때 한 번 속마음
  if (on && !gateSaid && Math.abs(p.z - GATE.z) < 0.8 && Math.abs(p.x - GATE.x) < 1 && !talking()) { gateSaid = true; store.gateSaid = true; save(); talk([{ who: 'me', text: T.gateThought }]); track('gate_passed'); }
}
$('warpBtn').onclick = () => {
  if (mySeat !== null) standUp(); onCushion = false; lying = false; letGo(false);
  const toTop = $('warpBtn').dataset.to !== 'nest';
  if (toTop) { const z = 11 + Math.random() * 2, x = (Math.random() - 0.5) * 3; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = 0; } // 정상 바로 아래
  else { const x = NEST.x + (Math.random() - 0.5) * 0.6, z = NEST.z - 1.2; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = Math.PI; } // 둥지 앞
  track(toTop ? 'to_top' : 'to_nest');
};

// ================= 전설의 새: 봉황 · 푸른 학 =================
/** 오늘이 푸른 학이 오는 날인지 (날짜로 정해서 모두에게 같은 날, 대략 일주일에 한 번) */
function craneToday() { const k = dateKey(Date.now()); let h = 7; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 7 === 3; }
let legendDay = '';
function sunriseLegends() {
  const day = dateKey(Date.now()) + (cycling() ? ':' + Math.floor(Date.now() / 300000) : '');
  if (legendDay === day) return; legendDay = day;
  setTimeout(() => legends.fly('phoenix', camera, world.sunDir, () => {
    track('phoenix_seen', { first: !store.phoenixSeen });
    if (!store.phoenixSeen) { store.phoenixSeen = true; save(); talk(T.phoenixFirst.map(text => ({ who: 'me' as const, text }))); }
    else if (Math.random() < 0.5) talk([{ who: 'me', text: T.phoenixAgain[Math.floor(Math.random() * T.phoenixAgain.length)] }]);
    if (craneToday()) setTimeout(() => legends.fly('crane', camera, world.sunDir, () => {
      track('crane_seen');
      const gl = goalToday();
      talk([{ who: 'me', text: T.craneSeen }, { who: 'me', text: gl?.sent ? T.craneGoal : T.craneNoGoal }]);
    }), 5000);
  }), 1800);
}

// ================= 같이 하기: 헤드랜턴 · 손잡기 · 모이 쪼기 =================
/** 손잡기: 누가 누구 손을 잡았는지 (잡은 사람 id → 상대 id). 잡은 사람이 상대를 따라감 */
const holds = new Map<string, string>();
let holdTo: string | null = null;
function letGo(tell = true) {
  if (!holdTo) return;
  holdTo = null; me.inner.userData.hold = 0; if (connected) net.emit('hold', null);
  if (tell) toast(T.holdOff);
}
function nearestRemote(max: number) {
  let best: Remote | null = null, bd = max, bid = '';
  for (const [id, r] of remotes) { const d = Math.hypot(r.c.root.position.x - me.root.position.x, r.c.root.position.z - me.root.position.z); if (d < bd) { bd = d; best = r; bid = id; } }
  return best ? { r: best, id: bid } : null;
}
$('holdBtn').onclick = () => {
  if (holdTo) { letGo(); return; }
  const n = nearestRemote(1.8); if (!n) return;
  if (mySeat !== null) standUp(); onCushion = false; lying = false;
  holdTo = n.id; if (connected) net.emit('hold', n.id);
  toast(T.holding); track('hold_hands');
};
/** 상대의 어느 쪽에 서 있는지 (-1 왼쪽 / 1 오른쪽, 상대가 보는 방향 기준) */
function sideOf(of: THREE.Object3D, p: THREE.Vector3) { const ry = of.rotation.y, fx = -Math.sin(ry), fz = -Math.cos(ry), dx = p.x - of.position.x, dz = p.z - of.position.z; return fx * dz - fz * dx > 0 ? 1 : -1; }
function updateHold(dt: number, moving: boolean) {
  if (holdTo) {
    const r = remotes.get(holdTo);
    if (!r || moving) letGo(!!r);
    else {
      // 상대 옆(0.9m)으로 따라감
      const L = r.c.root, side = sideOf(L, me.root.position), ry = L.rotation.y;
      const tx = L.position.x + Math.cos(ry) * 0.9 * -side, tz = L.position.z - Math.sin(ry) * 0.9 * -side;
      const p = me.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.08) { const st = Math.min(d, 3.6 * dt); p.x += dx / d * st; p.z += dz / d * st; p.y = floorY(p.x, p.z); me.state = 'walk'; me.root.rotation.y = faceAngle(dx, dz); }
      else { me.state = 'idle'; me.root.rotation.y += (ry - me.root.rotation.y) * Math.min(1, dt * 6); }
      if (d > 6) letGo(); // 너무 멀어지면 (순간이동 등) 놓음
      me.inner.userData.hold = -side; // 상대 쪽 날개
    }
  }
  // 다른 사람들 손잡은 모습: 잡은 사람과 잡힌 사람 모두 서로 쪽 날개를 뻗음
  for (const r of remotes.values()) r.c.inner.userData.hold = 0;
  if (!holdTo) me.inner.userData.hold = 0;
  for (const [a, b] of holds) {
    const A = a === myId ? me : remotes.get(a)?.c, B = b === myId ? me : remotes.get(b)?.c;
    if (!A || !B) continue;
    A.inner.userData.hold = sideOf(A.root, B.root.position); B.inner.userData.hold = sideOf(B.root, A.root.position);
  }
  const n = !holdTo && !lying ? nearestRemote(1.8) : null, b = $('holdBtn'), show = !!holdTo || !!n;
  if (b.hidden === show) b.hidden = !show;
  const label = holdTo ? T.holdLet : T.holdBtn; if (b.textContent !== label) b.textContent = label;
}
// ================= 멍석 모이 마당 (장터목) =================
// 평소엔 참새가 쪼고, 해가 뜨면 마고할미가 와서 모이를 뿌림. 같이 쪼면 더 고소함.
const CAFE = FEED_AT;
const feed = createFeed(scene, CAFE.x, CAFE.z, mountainY(CAFE.x, CAFE.z, 'jirisan'), T.feedSign);
let peckN = 0, myPeckAt = -1e9, feedTrip = false, magoAtFeedUntil = 0, feedSaidToday = false;
const remotePeck = new Map<string, number>();
const nearFeed = (x: number, z: number, m = 1.1) => Math.hypot(x - CAFE.x, z - CAFE.z) < FEED_R + m;
$('peckBtn').onclick = () => {
  if (me.state === 'lie') return;
  const p = me.root.position;
  me.root.rotation.y = faceAngle(CAFE.x - p.x, CAFE.z - p.z);
  doEmote('peck'); [0, 200, 400, 600].forEach(ms => setTimeout(() => amb.blip(260 + Math.random() * 60), ms));
  setTimeout(() => feed.peck(p.x, p.z), 500);
  myPeckAt = performance.now();
  // 다른 병아리가 3초 안에 같이 쪼았으면: 반짝 + 속마음 (하루 한 번)
  const together = [...remotePeck.entries()].some(([id, at]) => performance.now() - at < 3000 && remotes.has(id));
  if (together) { feed.shine(); if (store.feedTogetherDay !== dateKey(Date.now())) { store.feedTogetherDay = dateKey(Date.now()); save(); setTimeout(() => talk([{ who: 'me', text: T.feedTogether }]), 1600); track('feed_together'); return; } }
  if (++peckN % 3 === 1) setTimeout(() => talk([{ who: 'me', text: T.peckThought[Math.floor(Math.random() * T.peckThought.length)] }]), 1800);
};
/** 다른 사람이 쪼면: 그 자리 모이가 줄고, 내가 3초 안에 쪼았으면 반짝 */
function remotePecked(id: string, x: number, z: number) {
  if (!nearFeed(x, z, 1.4)) return;
  remotePeck.set(id, performance.now());
  setTimeout(() => feed.peck(x, z), 500);
  if (performance.now() - myPeckAt < 3000) feed.shine();
}
/** 해가 뜨면: 할미가 둥지에서 모이 마당으로 날아와 뿌리고, 한동안 곁에 있다가 돌아감 */
async function morningFeed() {
  if (place.id !== 'jirisan' || feedTrip) return;
  if (magoBusy || introSolo) { feed.scatter(CAFE.x + FEED_R, CAFE.z, 380); return; }
  feedTrip = true; magoBusy = true;
  const from = mago.root.position.clone(), side = new THREE.Vector3(CAFE.x + FEED_R + 0.8, 0, CAFE.z + 0.4);
  side.y = mountainY(side.x, side.z, 'jirisan');
  const glide = async (a: THREE.Vector3, b: THREE.Vector3, ms: number) => { const t0 = performance.now(); mago.look(faceAngle(b.x - a.x, b.z - a.z)); while (performance.now() - t0 < ms) { const k = (performance.now() - t0) / ms, e = k * k * (3 - 2 * k); mago.root.position.lerpVectors(a, b, e); mago.root.position.y += Math.sin(k * Math.PI) * 0.8; await sleep(16); } mago.root.position.copy(b); };
  await glide(from, side, 4000);
  mago.look(faceAngle(CAFE.x - side.x, CAFE.z - side.z));
  for (let w = 0; w < 4; w++) { mago.talk(0.6); feed.scatter(side.x - 0.3, side.z, 110); await sleep(420); }
  // 한동안 곁에 머묾: 그사이 다가오면 한마디 (하루 한 번)
  magoAtFeedUntil = performance.now() + 75000;
  while (performance.now() < magoAtFeedUntil) {
    const p = me.root.position;
    if (!feedSaidToday && store.feedLineDay !== dateKey(Date.now()) && nearFeed(p.x, p.z, 1.6) && !talking() && !hallMoving) {
      store.feedLineDay = dateKey(Date.now()); save(); feedSaidToday = true;
      mago.look(faceAngle(p.x - side.x, p.z - side.z));
      const others = [...remotes.values()].some(r => nearFeed(r.c.root.position.x, r.c.root.position.z, 2));
      const line = others ? T.feedLineTogether : T.feedLine;
      mago.talk(5); await talk([{ who: 'mago', text: line }]);
      mago.look(faceAngle(CAFE.x - side.x, CAFE.z - side.z));
      track('feed_line', { others });
    }
    await sleep(400);
  }
  await glide(side, new THREE.Vector3(MAGO_AT.x, mountainY(MAGO_AT.x, MAGO_AT.z, 'jirisan'), MAGO_AT.z), 4000);
  mago.look(magoHome); magoBusy = false; feedTrip = false;
}
const feedChicks: THREE.Vector3[] = [];
function updateCafe(dt: number, t: number) {
  const here = place.id === 'jirisan'; feed.root.visible = here;
  if (here) {
    feedChicks.length = 0; feedChicks.push(me.root.position);
    for (const r of remotes.values()) feedChicks.push(r.c.root.position);
    feed.update(dt, t, feedChicks);
  }
  const show = here && !lying && nearFeed(me.root.position.x, me.root.position.z, 0.9);
  const b = $('peckBtn'); if (b.hidden === show) b.hidden = !show;
}

function loop(t: number) {
  const realDt = Math.min(0.5, (t - lastT) / 1000), dt = Math.min(0.05, realDt); lastT = t;
  const now = virtualNow();
  updateMe(dt);
  updateHold(dt, Math.hypot(input.x, input.y) > 0.12);
  updateCamera(dt);
  updateMago(dt, t / 1000);
  updateHall(dt, t / 1000);
  updateTrail();
  updateCafe(dt, t / 1000);
  if (place.id === 'jirisan') mountainGifts();
  const cyc = cycling();
  const info = cyc ? null : sunriseInfo(place, now);
  const ref = cyc || introSky ? cycleRefs().sr : replay ? replay.sr : (info!.windowSR ?? info!.next ?? info!.last ?? now);
  const alt = world.update(now, place, ref, camera, t, cyc);
  amb.setAlt(alt);
  updateRemotes(dt);
  lanterns.update(dt);
  bots.update(dt, t, camera);
  life.update(dt, t, me.root.position, camera);
  const people = [me.root.position];
  for (const r of remotes.values()) people.push(r.c.root.position);
  traces.update(t, camera, people);
  const night = nightness(alt);
  pier.update(night);
  bonfire.update(dt, t, night);
  const fireDist = Math.hypot(me.root.position.x - BONFIRE.x, me.root.position.z - BONFIRE.z);
  amb.setFire(bonfire.level * clamp(1.15 - fireDist / 14, 0, 1));
  prints.update(dt);
  stones.update(dt);
  castles.update(dt, t);
  jetties.update(t, night);
  updateHandoff(dt);
  scenery.update(dt, t, night, world.skyLow);
  updateSummit();
  updateShops(dt);
  fireflies.update(t, night, me.root.position, floorY);
  leaves.update(dt, t, me.root.position, floorY);
  echo.update(dt); late.update(dt); updateYaho(t); updateCheer(t, dt);
  birds.update(dt, camera, world.sunDir, alt, innerHeight);
  legends.update(dt, performance.now() / 1000);
  updateNight(dt);
  updateRamen(t);
  updateSparkles(dt);
  sky.update(dt, t, alt, camera, lying); // 별똥별은 풍경으로만 (소원 빌기 버튼은 뺌)
  const shell = shells.update(dt, t, me.root.position);
  if (shell) gotShell(shell.i, shell.kind);
  if (t - lastShellCheck > 60000) { lastShellCheck = t; if (shellKey() !== store.shells?.key) placeShells(); }
  sandBoard.update(camera);
  // 실제 시간 기준이라 느린 폰에서도 0.6초 안에 게시판이 열림
  sandK = clamp(sandK + (sandOpen ? realDt : -realDt) * 1.6, 0, 1);
  if (sandOpen && sandK > 0.92 && $('sand').hidden) showSandScreen();
  sendState(t);
  if (t - lastUI > 250) { updateUI(now, alt, t); lastUI = t; }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ================= 장소 고르기 =================
// 상단에는 지금 장소 하나만 두고, 누르면 묶음별 목록이 열린다 (장소가 늘어도 화면이 지저분해지지 않게)
const GROUPS: [PlaceGroup, () => string][] = [['sunrise', () => T.groupSunrise], ['kcontent', () => T.groupKcontent]];
const ICON: Record<string, string> = { jeongdongjin: '🚉', jirisan: '⛰️', hallasan: '🏔️', seongsan: '🌋', seopjikoji: '🗿', homigot: '✋', gisborne: '🌏', jumunjin: '💐', hyangho: '🚏', hangang: '🍜' };
function renderPlaceList() {
  $('placeList').innerHTML = GROUPS.map(([g, label]) => {
    const rows = PLACES.filter(p => p.group === g).map(p => {
      // 인원수는 보여 주지 않음 (사람이 적을 때 '텅 빈 곳'처럼 보여서). 숫자는 서버 /stats 와 PostHog에서 확인
      return `<button class="place-row" data-id="${p.id}" aria-current="${p === place}"><i class="pi">${ICON[p.id] ?? '📍'}</i><span class="pt"><b>${placeName(p)}<small>${placeRegion(p)}</small></b><span>${placeBlurb(p)}</span></span></button>`;
    }).join('');
    return rows ? `<div class="place-group"><h3>${label()}</h3>${rows}</div>` : '';
  }).join('');
}
$('placeBtn').onclick = () => {
  const pr = $('placeRoute'); pr.hidden = true; /* 실제로 가 보기는 꺼 둠 */ pr.textContent = lang === 'ko' ? `📍 ${placeName(place)} 실제로 가 보기` : `📍 How to get to ${placeName(place)}`;
  renderPlaceList(); open('placeSheet'); track('place_picker_opened', { place: place.id }); };
$('placeList').addEventListener('click', e => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.place-row');
  const p = row && PLACES.find(x => x.id === row.dataset.id);
  if (!p) return;
  close();
  switchPlace(p);
});
function switchPlace(p: Place) {
  if (place === p) return;
  place = p; replay = null; seenFlag = false; watchStart = 0;
  track('channel_changed', { place: p.id });
  if (mySeat !== null) { leaveSeat(); me.state = 'idle'; }
  lying = false;
  seats.forEach(s => (s.occ = null));
  closeSand(); sandPosts = []; renderSandLabel();
  clearRemotes(); bots.clear(); lanterns.clear(); traces.clear(); prints.clear(); castles.clear(); world.buildLandmark(p); applyTerrain(p); bots.fill();
  history.replaceState(history.state, '', `/${p.id}${location.search}`); placeShells(); renderAlarm(); renderCounts(); refreshWeather();
  spawn();
  if (connected) join();
  expandBanner();
  toast(T.arrived(placeName(p), p.id === 'gisborne'));
  if (has.peak(p.id)) setTimeout(() => toast(T.summitWalk), 2600);
  applyDogName(); life.setDog(null);
}

// ================= 버튼 =================
$('sitBtn').onclick = () => {
  if (lying) { lying = false; eyeView = false; me.state = 'idle'; return; } // 누워 있다가 일어나기
  if (mySeat !== null) { standUp(); return; }
  const idx = nearestFreeSeat();
  if (idx === null) { toast(T.seatHint); return; }
  const sitHere = () => {
    const s = seats[idx];
    s.occ = 'me'; mySeat = idx; me.state = 'sit'; me.bench = !!s.bench;
    // 의자·통나무는 그 높이에, 평상은 평상 위에, 해변 방석은 모래 위에
    me.root.position.set(s.x, s.bench ? s.y! : s.y !== undefined ? s.y + 0.04 : groundY(s.z) + 0.07, s.z);
    // 가게 의자·평상: 카메라를 옆에서 (등 뒤 건물·맞은편 의자에 가리지 않게)
    if (s.kind === 'chair' || s.kind === 'floor') { const want = s.ry + Math.PI * 0.5, d = Math.atan2(Math.sin(want - cam.tYaw), Math.cos(want - cam.tYaw)); setView(Math.min(cam.tDist, 5.5), 0.4, cam.tYaw + d); }
  };
  if (!connected) { sitHere(); return; }
  // 서버가 먼저 온 사람에게 방석을 준다
  net.emit('sit', idx, ok => { if (ok) { sitHere(); track('sat_down', { place: place.id, spot: seats[idx].kind ?? 'cushion' }); } else toast(T.seatTaken); });
};
// ================= 울기 (병아리 → 닭) =================
/** 머리 위에 잠깐 뜨는 울음소리 글자 */
function voiceBubble(c: Char, scale = 1) {
  const old = c.root.getObjectByName('voice'); if (old) c.root.remove(old);
  const sp = textSprite(T.voices[growthStage(c)], 0.7 * scale); sp.name = 'voice'; sp.position.set(0.35, 1.25 + growthStage(c) * 0.04, 0); c.root.add(sp);
  setTimeout(() => { if (sp.parent) sp.parent.remove(sp); (sp.material as THREE.SpriteMaterial).map?.dispose(); sp.material.dispose(); }, 1700);
}
let lastCrow = 0;
function crow(from: string) {
  if (performance.now() - lastCrow < 1500 || me.state === 'lie') return;
  lastCrow = performance.now();
  me.emote = 'crow'; me.emoteT = 0; if (connected) net.emit('emote', 'crow');
  amb.unlock(); amb.crow(growthStage(me), 1); voiceBubble(me);
  setTimeout(deliverGoal, 500);
  track('crow', { stage: growthStage(me), from });
}
$('crowBtn').onclick = () => crow('button');
$('hopBtn').onclick = () => { if (me.state === 'lie' || onCushion) return; doEmote('hop'); amb.blip(700); setTimeout(() => amb.blip(820), 120); };
/** 해를 본 날이 쌓여 단계가 오르면: 몸이 바뀌고 속마음 한 줄 */
initTalk({ blip: p => amb.blip(p), ko: lang === 'ko' });
let growLock = false; // 테스트용: 단계를 손으로 고정
setInterval(() => {
  const g = growthOf(seenDays());
  if (growLock || g === growthStage(me)) return;
  store.look.g = g; setGrowth(me, g);
  if (g > (store.growthSeen ?? 0)) { store.growthSeen = g; setTimeout(() => talk(T.growUp[g].map(([who, text]) => ({ who, text }))), 6000); track('grew', { stage: g }); }
  save();
}, 3000);
const doEmote = (e: 'stretch' | 'wave' | 'cheers' | 'clap' | 'hop' | 'peck') => { me.emote = e; me.emoteT = 0; if (connected) net.emit('emote', e); track('emote', { type: e }); };
$('stretchBtn').onclick = () => doEmote('stretch');
$('seatFindBtn').onclick = () => {
  setTray(false);
  if (mySeat !== null) return;
  let best: number | null = null, bd = Infinity;
  seats.forEach((s, i) => {
    if (s.occ || (s.places && !s.places.includes(place.id)) || (!s.kind && !has.mats(place.id))) return;
    const d = Math.hypot(s.x - me.root.position.x, s.z - me.root.position.z);
    if (d < bd) { bd = d; best = i; }
  });
  if (best === null) { toast(T.seatHint); return; }
  seekSeat = best; seekUntil = performance.now() + 15000; track('seat_find', { place: place.id });
};
$('waveBtn').onclick = () => doEmote('wave');
$('cheersBtn').onclick = () => doEmote('cheers');

// ================= 행동 모음 (✨ 행동) =================
const tray = $('actTray'), moreBtn = $('actMore');
function setTray(open: boolean) {
  tray.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
}
moreBtn.onclick = () => { setTray(tray.hidden); if (!tray.hidden) track('actions_opened'); };
// 타일을 누르면 그 행동을 하고 닫힘
tray.addEventListener('click', e => { if ((e.target as HTMLElement).closest('.tile')) setTray(false); });
// 바깥(해변 화면)을 누르면 닫힘
addEventListener('pointerdown', e => {
  if (!tray.hidden && !(e.target as HTMLElement).closest('#actTray, #actMore')) setTray(false);
});

$('clapBtn').onclick = () => { doEmote('clap'); amb.clap(1); };

$('skipBtn').onclick = () => {
  if (!has.water(place.id)) { toast(T.noWater); return; }
  const p = me.root.position;
  if (!(p.z < 1.5 || onPier(p.x, p.z))) { toast(T.skipFar); return; }
  lying = false;
  me.emote = 'skip'; me.emoteT = 0;
  const from = p.clone(), ry = me.root.rotation.y, roll = stones.roll();
  if (connected) net.emit('skip', roll);
  setTimeout(() => {
    const n = stones.toss(from, ry, true, roll);
    track('stone_skipped', { place: place.id, skips: n });
    if (n < 0) { setTimeout(() => toast(T.skipLand), 700); return; }
    const best = Math.max(store.skipBest ?? 0, n);
    if (best !== store.skipBest) { store.skipBest = best; save(); }
    setTimeout(() => toast(n === 0 ? T.skipZero : T.skipResult(n, best)), 900 + n * 280);
  }, 450);
};

$('lieBtn').onclick = () => {
  if (mySeat !== null) standUp();
  const p = me.root.position;
  const peak = has.peak(place.id); // 산 정상은 어디서나 누울 수 있음
  if (!peak && (surfaceAt(p.x, p.z) !== 'sand' || onPier(p.x, p.z))) { toast(T.lieNo); return; }
  lying = true; eyeView = true; lieSince = performance.now(); me.state = 'lie'; me.emote = null;
  eye.yaw = eye.tYaw = 0; eye.pitch = eye.tPitch = 0.95;
  // 누우면 카메라를 낮춰 하늘이 화면 가득 들어오게
  setView(5.5, 0.12, me.root.rotation.y + 1.1); // 비스듬히 옆에서: 누운 모습과 하늘·바다가 같이 보이게
  toast(peak ? T.lieHintPeak : T.lieHint);
  track('lie_down', { place: place.id });
};
$('blanketBtn').onclick = () => {
  const on = !me.blanket.visible;
  me.blanket.visible = on;
  if (connected) net.emit('blanket', on);
  track('blanket', { on, place: place.id, seated: mySeat !== null });
};

$('zoomIn').onclick = () => { eyeView = false; setView(cam.tDist / 1.5); };
$('zoomOut').onclick = () => { eyeView = false; setView(cam.tDist * 1.5, Math.max(cam.tPitch, 0.45)); };
$('overview').onclick = () => { eyeView = false; setView(26, 0.5, 0); };
// 내 시점: 내 캐릭터 등 뒤에서, 캐릭터가 바라보는 방향을 같이 본다
$('resetView').onclick = () => {
  // 누워 있으면 '내 시점' = 누운 채 눈으로 하늘 보기
  if (lying) { eyeView = true; lieSince = 0; eye.tYaw = 0; eye.tPitch = 0.95; return; }
  let d = me.root.rotation.y - cam.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d)); // 가장 가까운 쪽으로 돌기
  setView(5.6, 0.24, cam.yaw + d);
};

let openSheet: HTMLElement | null = null;
const back = $('sheetBack');
function open(id: string) { $('inapp').hidden = true; openSheet = $(id); openSheet.classList.add('open'); back.classList.add('open'); back.classList.toggle('clear', id === 'outfitSheet'); document.body.classList.toggle('dressing', id === 'outfitSheet'); }
function close() {
  // 모래에 쓰다가 닫으면 모래 위 미리보기도 지움
  if (openSheet?.id === 'sandSheet') { $('sandPreview').hidden = true; $('sand').classList.remove('previewing'); }
  if (openSheet?.id === 'outfitSheet') endTryOn();
  openSheet?.classList.remove('open'); back.classList.remove('open', 'over-sand'); openSheet = null; document.body.classList.remove('dressing');
}
back.onclick = close;
// 풍등은 피드백으로 잠시 내림 (코드는 그대로, 다시 켜려면 true)
const LANTERN_ON = false;
$('lanternBtn').hidden = !LANTERN_ON; $('seeWishesBlock').hidden = !LANTERN_ON;
$('lanternBtn').onclick = () => open('wishSheet');

// ================= 사진 =================
let photoUrl = '', photoBlob: Blob | null = null, photoBase: HTMLCanvasElement | null = null, photoSun: { x: number; y: number } | null = null;
let photoMode: 'sq' | 'full' = 'sq';
/** 해가 화면 어디에 있는지 (0~1). 화면 밖이면 null */
function sunOnScreen() {
  const v = camera.position.clone().addScaledVector(world.sunDir, 500).project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}
async function renderPhoto() {
  if (!photoBase) return;
  const blob = await compose(photoBase, photoMode, photoSun, placeName(place), place.tz, T.photoSeen(streakCount()));
  if (!blob) { toast(T.photoFail); return; }
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = blob; photoUrl = URL.createObjectURL(blob);
  ($('photoImg') as HTMLImageElement).src = photoUrl;
  const name = `${T.photoFile}-${placeName(place)}-${new Date().toISOString().slice(0, 10)}.jpg`;
  const save = $('photoSave') as HTMLAnchorElement; save.href = photoUrl; save.download = name;
  const file = new File([blob], name, { type: 'image/jpeg' });
  $('photoShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  document.querySelectorAll<HTMLButtonElement>('#photoMode button').forEach(b => b.classList.toggle('on', b.dataset.m === photoMode));
}
async function snapPhoto(from: string) {
  const was = meRing.visible; meRing.visible = meLabel.visible = false;
  photoBase = grab(renderer.domElement, () => renderer.render(scene, camera));
  meRing.visible = meLabel.visible = was;
  photoSun = sunOnScreen();
  // 해가 화면에 보이면 프사용 정사각형부터, 아니면 화면 그대로
  photoMode = photoSun ? 'sq' : 'full';
  const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  await renderPhoto();
  open('photoSheet');
  track('photo_taken', { place: place.id, from, mode: photoMode });
}
$('photoBtn').onclick = () => snapPhoto('button');
document.querySelectorAll<HTMLButtonElement>('#photoMode button').forEach(b => b.onclick = () => { photoMode = b.dataset.m as 'sq' | 'full'; renderPhoto(); track('photo_mode', { mode: photoMode }); });
$('photoShare').onclick = async () => {
  if (!photoBlob) return;
  const file = new File([photoBlob], 'oneul-hae.jpg', { type: 'image/jpeg' });
  try {
    await navigator.share({ files: [file], text: `${T.shareText(placeName(place))}\nhttps://hae.abracadelulu.com` });
    track('photo_shared', { place: place.id });
  } catch { /* 사용자가 취소 */ }
};
$('photoSave').addEventListener('click', () => track('photo_saved', { place: place.id }));
$('menuBtn').onclick = () => { renderStreak(); renderAlarm(); open('menuSheet'); };

let lastMyLantern = 0;
function releaseLantern(text: string, custom = false) {
  if (performance.now() - lastMyLantern < 3000) { toast(T.lanternWait); return; }
  lastMyLantern = performance.now();
  close();
  const lst = (store.lantern?.c ?? 0) + (store.lantern?.p ?? 0) * 8;
  lanterns.launch(me.root.position, text, false, lst);
  // 고른 소원은 함께 보여 주고, 직접 쓴 소원은 '다른 사람에게도 보여주기'를 체크했을 때만 서버로 보낸다
  const shared = !custom || store.shareWish;
  if (connected) net.emit('lantern', +me.root.position.x.toFixed(2), +me.root.position.z.toFixed(2), shared ? text : undefined, lst);
  track('lantern_released', { place: place.id, custom, shared });
  toast(custom && shared ? T.lanternUpShared(text) : T.lanternUp(text));
}
WISHES.forEach(w => {
  const b = document.createElement('button');
  b.className = 'wish'; b.textContent = w;
  b.onclick = () => releaseLantern(w);
  $('wishes').appendChild(b);
});
// 추천 소원: 접혀 있으면 '펴기', 펼쳐져 있으면 '접기' (누를 때마다 바뀜)
const presetBtn = $('showPresets');
const renderPresets = () => {
  presetBtn.textContent = store.showPresets ? T.presetsClose : T.presetsOpen;
  presetBtn.setAttribute('aria-expanded', String(store.showPresets));
  $('wishSheet').classList.toggle('no-presets', !store.showPresets);
};
presetBtn.onclick = () => { store.showPresets = !store.showPresets; save(); renderPresets(); track('presets_toggled', { on: store.showPresets }); };
renderPresets();
// '내 소원 나만 보기': 기본은 꺼짐(공개). 체크하면 직접 쓴 소원은 나만 봄
const privateBox = $('privateWish') as HTMLInputElement;
privateBox.checked = !store.shareWish;
privateBox.onchange = () => { store.shareWish = !privateBox.checked; store.privacyChosen = true; save(); track('wish_privacy', { private: privateBox.checked }); };
function renderSeeWishes() {
  const b = $('seeWishesBtn');
  b.setAttribute('aria-pressed', String(store.seeWishes));
  b.textContent = store.seeWishes ? T.seeWishesOn : T.seeWishesOff;
}
$('seeWishesBtn').onclick = () => {
  store.seeWishes = !store.seeWishes; save(); renderSeeWishes();
  toast(T.seeWishesToast(store.seeWishes));
  track('see_wishes_toggled', { on: store.seeWishes });
};
renderSeeWishes();
const wishInput = $('wishInput') as HTMLInputElement;
// ---------- 타이핑 모드: 키보드가 올라오면 소원 창을 입력칸만 남기고 줄임 ----------
const wishSheet = $('wishSheet');
let typingOff = 0;
function liftAboveKeyboard() {
  // 아이폰은 키보드가 화면을 덮기만 해서, 보이는 영역 바로 위로 창을 올려 줌 (안드로이드는 0)
  const vv = window.visualViewport;
  const kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
  wishSheet.style.bottom = wishSheet.classList.contains('typing') && kb > 0 ? `${kb}px` : '';
}
wishInput.addEventListener('focus', () => { clearTimeout(typingOff); wishSheet.classList.add('typing'); liftAboveKeyboard(); });
wishInput.addEventListener('blur', () => {
  // 바로 펼치면 손가락 밑 화면이 밀리므로 잠깐 기다렸다가, 다시 입력칸으로 돌아오지 않았을 때만 펼침
  typingOff = window.setTimeout(() => { wishSheet.classList.remove('typing'); liftAboveKeyboard(); }, 150);
});
window.visualViewport?.addEventListener('resize', liftAboveKeyboard);
// 타이핑 중에 체크박스를 눌러도 키보드(입력칸 포커스)가 유지되게
const shareLabel = document.querySelector('label.share')!;
shareLabel.addEventListener('touchstart', e => {
  if (document.activeElement !== wishInput) return;
  e.preventDefault(); // 터치: 포커스 이동과 클릭을 막고 직접 체크
  privateBox.checked = !privateBox.checked;
  privateBox.dispatchEvent(new Event("change"));
}, { passive: false });
shareLabel.addEventListener('mousedown', e => { if (document.activeElement === wishInput) e.preventDefault(); }); // 마우스: 포커스 이동만 막음
wishInput.addEventListener('input', () => { $('wishCount').textContent = `${wishInput.value.length} / 24`; });
$('wishForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = wishInput.value.trim().replace(/\s+/g, ' ');
  if (!text) { toast(T.wishEmpty); return; }
  wishInput.value = ''; $('wishCount').textContent = '0 / 24'; wishInput.blur();
  // 직접 쓴 소원은 서버로 보내지 않으므로 다른 사람에게 노출되지 않는다 (분석에도 글 내용은 보내지 않음)
  releaseLantern(text, true);
});

/** 오늘(또는 다음) 해돋이를 빨리 감아 보여 줌. quick이면 20초 (해 뜨기 6분 전 → 10분 뒤) */
function startReplay(quick: boolean) {
  const now = Date.now(), info = sunriseInfo(place, now);
  const sr = info.last ?? info.next; if (!sr) return;
  replay = quick ? { sr, start: now, duration: 20000, from: -6 * 60000, span: 16 * 60000 } : { sr, start: now, duration: 45000, from: -30 * 60000, span: 55 * 60000 };
  watchStart = 0; expandBanner(quick ? 22000 : 4000);
  // 바다(해 뜨는 쪽)를 바라보게
  if (!lying) setView(Math.max(cam.tDist, 6.4), has.peak(place.id) ? 0.46 : 0.22, 0);
  track('replay_started', { place: place.id, quick });
}
$('replayPill').onclick = () => startReplay(true);
$('replayX').onclick = () => { store.replayPillOff = dateKey(Date.now()); save(); $('replayWrap').hidden = true; track('replay_pill_closed'); };
async function copy(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast(text); }
}
$('inviteBtn').onclick = () => { track('invite_copied'); }; $('inviteBtn').addEventListener('click', () => copy(`${T.invite} ${location.origin}`, T.inviteCopied));

let toastTimer = 0;
function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

// ================= 연속 기록 =================
function renderStreak() {
  renderDogLine();
  const week = $('week'); week.innerHTML = '';
  const names = T.weekdays;
  for (let i = 6; i >= 0; i--) {
    const t = Date.now() - i * 86400000, v = store.days[dateKey(t)];
    const el = document.createElement('div');
    el.className = 'day' + (i === 0 ? ' today' : '');
    el.innerHTML = `<i class="${v ?? ''}"></i>${i === 0 ? T.today : names[new Date(t).getDay()]}`;
    week.appendChild(el);
  }
  renderGrowth();
}
/** 둥지 일기: 지금 단계, 해를 맞은 횟수, 다음 변화까지 */
function renderGrowth() {
  const steps = [...GROWTH_DAYS, PHOENIX_AT], n = seenDays();
  const g = steps.reduce((s, d, i) => (n >= d ? i : s), 0), next = steps[g + 1];
  $('growIc').textContent = T.stageIcon[g]; $('growName').textContent = T.stageName[g];
  $('growCount').innerHTML = T.growCount(n);
  if (next === undefined) { $('growBar').style.width = '100%'; $('growNext').innerHTML = T.growDone; return; }
  const from = steps[g];
  $('growBar').style.width = `${Math.round((n - from) / (next - from) * 100)}%`;
  $('growNext').innerHTML = T.growNext(next - n, g + 1);
}

// ================= 알람 =================
let audioCtx: AudioContext | null = null, ringTimer = 0, alarmFiredFor = 0;
function nextAlarm() {
  const sr = sunrises(place, Date.now()).find(s => s - 5 * 60000 > Date.now())!;
  return { sr, at: sr - 5 * 60000 };
}
function renderAlarm() {
  const on = store.alarm.on, a = nextAlarm(), tz = place.tz;
  $('alarmBtn').setAttribute('aria-pressed', String(on));
  $('alarmBtn').textContent = on ? T.alarmOn : T.alarmOff;
  $('alarmText').innerHTML = on
    ? T.alarmOnText(dayName(a.at, tz), hm(a.at, tz), placeName(place), hm(a.sr, tz))
    : T.alarmOffText(hm(a.at, tz), placeName(place));
}
function chime() {
  try {
    audioCtx ??= new AudioContext();
    const t0 = audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = audioCtx!.createOscillator(), g = audioCtx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.35);
      g.gain.linearRampToValueAtTime(0.18, t0 + i * 0.35 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.35 + 1.6);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t0 + i * 0.35); o.stop(t0 + i * 0.35 + 1.7);
    });
  } catch { /* 소리를 낼 수 없는 환경 */ }
}
function openWake(atMs: number, demo: boolean) {
  const waiting = stats?.online[place.id] ?? 0;
  $('wakeClock').textContent = hm(atMs, place.tz);
  $('wakeText').innerHTML = waiting > 0 ? T.wakeWaiting(placeName(place), waiting) : T.wakeFirst(placeName(place));
  $('wake').dataset.demo = demo ? '1' : '0';
  $('wake').classList.add('open');
  chime(); clearInterval(ringTimer); ringTimer = window.setInterval(chime, 3200);
}
$('alarmBtn').onclick = () => {
  store.alarm.on = !store.alarm.on; save();
  track('alarm_toggled', { on: store.alarm.on, place: place.id });
  if (store.alarm.on) { chime(); toast(T.alarmToggledOn); }
  renderAlarm();
};
$('wakeBtn').onclick = () => {
  const demo = $('wake').dataset.demo === '1';
  $('wake').classList.remove('open'); clearInterval(ringTimer);
  if (demo) {
    const info = sunriseInfo(place, Date.now());
    replay = { sr: info.last ?? info.next!, start: Date.now(), duration: 40000, from: -5 * 60000, span: 30 * 60000 };
    watchStart = 0;
  } else {
    // 진짜 알람으로 깼을 때만 "알람 끄고 온 사람"에 집계
    store.wokeOn = dateKey(Date.now()); save();
    track('woke_by_alarm', { place: place.id });
    if (connected) net.emit('woke');
  }
  toast(T.goodMorning);
};
setInterval(() => {
  if (!store.alarm.on) return;
  const now = Date.now();
  const due = sunrises(place, now).map(s => s - 5 * 60000).find(x => x <= now && now - x < 60000);
  if (due && alarmFiredFor !== due) { alarmFiredFor = due; openWake(due, false); }
}, 5000);

// ================= 앱으로 설치 (PWA) =================
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallPromptEvent | null = null;
const ua = navigator.userAgent;
const isStandalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isKakao = /KAKAOTALK/i.test(ua);
const SNOOZE = 3 * 86400000;

function showInstall(force: boolean) {
  if (isStandalone) { if (force) toast(T.alreadyApp); return; }
  if (!force && store.installSnooze && Date.now() - store.installSnooze < SNOOZE) return;
  if (!force && !installEvent && !isIOS && !isKakao) return; // 설치를 지원하지 않는 브라우저면 조용히 넘어감
  const ios = $('installIos'), go = $('installGo');
  ios.hidden = true;
  if (isKakao) {
    // 카카오톡 안의 브라우저는 설치가 안 돼서, 기본 브라우저로 열어 줌
    $('installTitle').textContent = T.installKakaoTitle;
    go.textContent = T.installKakaoGo;
  } else if (installEvent) {
    $('installTitle').textContent = T.installTitle;
    go.textContent = T.installGo;
  } else if (isIOS) {
    $('installTitle').textContent = T.installIosTitle;
    ios.hidden = false;
    go.textContent = T.ok;
  } else {
    $('installTitle').textContent = T.installManualTitle;
    go.textContent = T.ok;
    toast(T.installManualToast);
  }
  open('installSheet');
  track('install_prompt_shown', { native: !!installEvent, ios: isIOS, kakao: isKakao, manual: force });
}
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e as InstallPromptEvent;
  // 설치는 마고할미가 대화로 물어봄 (처음부터 창을 띄우지 않음)
});
addEventListener('appinstalled', () => { track('app_installed'); installEvent = null; close(); toast(T.installed); });
$('installGo').onclick = async () => {
  if (isKakao) { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`; return; }
  if (installEvent) {
    const ev = installEvent; installEvent = null;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    track('install_choice', { outcome });
    if (outcome !== 'accepted') { store.installSnooze = Date.now(); save(); }
  }
  close();
};
$('installLater').onclick = () => { store.installSnooze = Date.now(); save(); close(); };

// ================= 후원 =================
// Vercel 환경 변수 VITE_SUPPORT_URL에 후원 페이지 주소를 넣으면 메뉴에 버튼이 나타남
const SUPPORT_URL: string | undefined = import.meta.env.VITE_SUPPORT_URL;
// 카카오페이 송금코드 (한국 사용자용). 바꾸면 public/kakaopay-qr.png도 다시 만들어야 함
const KAKAOPAY_URL: string = import.meta.env.VITE_KAKAOPAY_URL ?? 'https://qr.kakaopay.com/FT8ClKPN7';
// 후원은 사람이 모일 때까지 잠시 꺼 둠 (다시 켜려면 true)
const SUPPORT_ON = false;
if (SUPPORT_ON && KAKAOPAY_URL) {
  $('supportBlock').hidden = false;
  const k = $('kakaoBtn') as HTMLAnchorElement;
  k.href = KAKAOPAY_URL; k.hidden = false;
  // 마우스로 보는 컴퓨터에서만 QR 표시 (폰에서는 버튼을 누르면 바로 카카오페이가 열림)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) $('kakaoQr').hidden = false;
}
if (SUPPORT_ON && SUPPORT_URL) {
  $('supportBlock').hidden = false;
  const b = $('supportBtn') as HTMLAnchorElement;
  b.href = SUPPORT_URL; b.hidden = false;
}

// ================= 배경 소리 =================
const amb = createAmbience();
amb.setOn(store.soundOn);
let weatherNow: Weather | null = null;
function renderSoundBtn() {
  const b = $('soundBtn');
  b.textContent = store.soundOn ? '🔊' : '🔇';
  b.setAttribute('aria-label', store.soundOn ? T.soundOff : T.soundOn);
}
$('soundBtn').onclick = () => {
  store.soundOn = !store.soundOn; save();
  track('sound_toggled', { on: store.soundOn });
  amb.setOn(store.soundOn); renderSoundBtn();
  toast(store.soundOn ? T.soundOnToast(placeName(place)) : T.soundOffToast);
};
renderSoundBtn();
// 브라우저는 사용자가 화면을 한 번 눌러야 소리를 낼 수 있어서, 첫 터치 때 시작
const firstTouch = () => { if (store.soundOn && !amb.started) amb.unlock(); };
addEventListener('pointerdown', firstTouch);
addEventListener('keydown', firstTouch);
document.addEventListener('visibilitychange', () => { if (document.hidden) amb.pause(); else amb.resume(); });

async function refreshWeather() {
  const p = place;
  const w = await fetchWeather(p.lat, p.lng);
  if (p !== place) return; // 그 사이 채널을 바꿨으면 무시
  weatherNow = w;
  amb.setWeather(w ?? { windKmh: 10, precipMm: 0 });
}
refreshWeather();
setInterval(refreshWeather, 15 * 60000);

// ================= 나가기 (버튼 + 폰 뒤로가기) =================
let leaving = false;
function openBye() {
  if (openSheet) close();
  const live = !replay && !!sunriseInfo(place, Date.now()).windowSR;
  const seenToday = !!store.days[dateKey(Date.now())];
  const others = remotes.size;
  const n = streakCount();
  const info = sunriseInfo(place, Date.now());
  let title: string, text: string;
  if (seenToday) {
    title = others > 0 ? T.byeThanksTogether : T.byeThanks;
    text = (others > 0 ? T.byeSawWith(placeName(place), others) : T.byeSaw(placeName(place)))
      + (n > 1 ? T.byeStreak(n) : T.byeWarm);
  } else if (live && info.windowSR && Date.now() < info.windowSR) {
    title = T.byeSoonTitle;
    text = T.byeSoon(hm(info.windowSR, place.tz));
  } else {
    title = T.byeTitle;
    text = T.byeNextGeneric; // 다음 해돋이 시각은 바로 아래 알림 상자에 나옴
  }
  $('byeTitle').textContent = title;
  $('byeText').innerHTML = text;
  $('byeStay').textContent = live && !seenToday ? T.byeStayLive : T.byeStay;
  renderRemind();
  open('byeSheet');
}
function leave() {
  leaving = true;
  close();
  net.disconnect();
  amb.pause();
  $('goodbyeText').innerHTML = store.days[dateKey(Date.now())] ? T.goodbyeSeen : T.goodbye;
  $('goodbye').classList.add('open');
  // 이 사이트로 들어오기 전 페이지가 있으면 그쪽으로 돌아감 (없으면 작별 화면이 남아 있음)
  setTimeout(() => history.go(-2), 900);
}
// ---------- 다음 해돋이 알림 (푸시, 안 되면 캘린더) ----------
const nextSunrise = () => sunrises(place, Date.now()).find(s => s - 5 * 60000 > Date.now())!;
const pushLabel = $('remindPush').textContent ?? '';
function renderRemind() {
  const sr = nextSunrise(), tz = place.tz, push = canPush();
  const push$ = $('remindPush') as HTMLButtonElement, done = store.remindAt === sr;
  $('remindBox').hidden = false;
  $('remindText').innerHTML = T.remindNext(dayName(sr, tz), hm(sr, tz));
  // 푸시를 못 받는 환경(아이폰 Safari 등)이면 캘린더가 주 버튼
  push$.hidden = !push; $('remindCal').hidden = !push; $('remindCalMain').hidden = push;
  push$.disabled = done;
  push$.textContent = done ? T.remindSet(hm(sr - 5 * 60000, tz)) : pushLabel;
}
function addToCalendar(via: string) {
  const sr = nextSunrise();
  track('reminder_calendar', { place: place.id, via });
  toast(T.remindCalToast);
  location.href = calendarUrl(place.id, sr, lang);
}
$('remindCal').onclick = () => addToCalendar('link');
$('remindCalMain').onclick = () => addToCalendar('main');
$('remindPush').onclick = async () => {
  const sr = nextSunrise(), btn = $('remindPush') as HTMLButtonElement;
  btn.disabled = true;
  const r = await schedulePush(place.id, sr, lang).catch(() => 'unavailable' as const);
  track('reminder_push', { place: place.id, result: r });
  if (r === 'ok') {
    store.remindAt = sr; save();
    toast(T.remindSetToast(hm(sr - 5 * 60000, place.tz)));
  } else toast(r === 'denied' ? T.remindDenied : T.remindFail);
  renderRemind();
  if (r !== 'ok') btn.disabled = false;
};
initPush();

// ================= 모래 게시판 =================
let sandPosts: SandPost[] = [];
let sandOpen = false, sandK = 0, sandSel: string | null = null;
const sandLook = new THREE.Vector3();
const SAND_TTL = 3 * 3600000;
const visiblePosts = () => sandPosts.filter(p => !store.hiddenSand.includes(p.id) && Date.now() - p.at < SAND_TTL);
function renderSandLabel() { sandBoard.setLabel(T.sandLabel(visiblePosts().length)); }
/** 글 id로 정해지는 자리·기울기 (모두에게 같은 배치) */
function hashOf(id: string) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
function renderSand() {
  const area = $('sandArea'), list = visiblePosts().sort((a, b) => b.at - a.at);
  $('sandTitle').textContent = T.sandTitle(placeName(place));
  $('sandSub').textContent = T.sandSub(list.length);
  area.replaceChildren();
  let selEl: HTMLElement | null = null, selPost: SandPost | null = null;
  if (!list.length) {
    const e = document.createElement('div'); e.className = 'sand-empty'; e.textContent = T.sandEmpty; area.appendChild(e);
  }
  list.forEach((p, i) => {
    const h = hashOf(p.id), age = Date.now() - p.at;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sand-note' + (p.id === sandSel ? ' sel' : '');
    b.style.top = `${18 + i * 66}px`;
    const left = 4 + (h % 34);
    b.style.left = `${left}%`;
    b.style.maxWidth = `${96 - left}%`; // 긴 글도 화면 오른쪽 밖으로 나가지 않게
    b.style.transform = `rotate(${(h % 9) - 4}deg)`;
    b.style.opacity = String(Math.max(0.15, 1 - (age / SAND_TTL) * 0.85)); // 오래될수록 흐려짐
    const t = document.createElement('b'); t.textContent = p.text; // 남이 쓴 글: 반드시 textContent
    const m = document.createElement('small'); m.textContent = T.sandAgo(Math.floor(age / 60000));
    b.append(t, m);
    b.onclick = ev => { ev.stopPropagation(); showSandPop(p, b); };
    if (p.id === sandSel) { selEl = b; selPost = p; }
    area.appendChild(b);
  });
  const spacer = document.createElement('div'); spacer.style.height = `${40 + list.length * 66}px`; area.appendChild(spacer);
  // 다시 그려도 열어 둔 신고 창은 유지 (글이 지워졌으면 닫음)
  if (selEl && selPost) showSandPop(selPost, selEl); else { sandSel = null; $('sandPop').hidden = true; }
}
function showSandPop(p: SandPost, el: HTMLElement) {
  sandSel = p.id;
  [...$('sandArea').querySelectorAll('.sand-note')].forEach(n => n.classList.toggle('sel', n === el));
  const pop = $('sandPop'), r = el.getBoundingClientRect(), mine = store.mySand.includes(p.id);
  $('sandPopWhen').textContent = mine ? T.sandMine : T.sandWhen(Math.floor((Date.now() - p.at) / 60000));
  $('sandReportBtn').hidden = mine; $('sandPopNote').hidden = mine;
  pop.style.left = `${Math.min(r.left, innerWidth - 256)}px`;
  pop.style.top = `${Math.min(r.bottom + 6, innerHeight - 220)}px`;
  pop.hidden = false;
}
$('sandArea').addEventListener('click', () => { sandSel = null; $('sandPop').hidden = true; [...$('sandArea').querySelectorAll('.sel')].forEach(n => n.classList.remove('sel')); });
$('sandReportBtn').onclick = () => {
  if (!sandSel) return;
  if (connected) net.emit('sandReport', sandSel);
  store.hiddenSand = [...store.hiddenSand, sandSel].slice(-100); save();
  track('sand_reported', { place: place.id });
  sandSel = null; renderSand(); renderSandLabel(); toast(T.sandReported);
};
function openSand() {
  if (sandOpen) return;
  sandOpen = true; sandSel = null;
  track('sand_opened', { place: place.id, posts: visiblePosts().length });
}
function showSandScreen() {
  renderSand();
  const el = $('sand'); el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
}
function closeSand() {
  if (!sandOpen) return;
  if (openSheet?.id === 'sandSheet') close();
  sandOpen = false;
  const el = $('sand'); el.classList.remove('show'); el.hidden = true;
  $('sandPreview').hidden = true; el.classList.remove('previewing');
}
$('sandBtn').onclick = openSand;
$('sandClose').onclick = closeSand;
$('sandWriteBtn').onclick = () => {
  open('sandSheet'); back.classList.add('over-sand');
  $('sandPop').hidden = true;
  setTimeout(() => ($('sandInput') as HTMLInputElement).focus(), 300);
};
const sandInput = $('sandInput') as HTMLInputElement;
sandInput.addEventListener('input', () => {
  $('sandCount').textContent = `${sandInput.value.length} / 24`;
  const pv = $('sandPreview'); pv.textContent = sandInput.value; pv.hidden = !sandInput.value.trim(); // 모래 위 미리보기
  $('sand').classList.toggle('previewing', !pv.hidden);
});
$('sandForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = sandInput.value.trim().replace(/\s+/g, ' ');
  if (!text) { toast(T.sandWriteEmpty); return; }
  if (!connected) { toast(T.sandOffline); return; }
  net.emit('sandWrite', text, r => {
    if (r.ok) {
      sandPosts.push(r.post);
      store.mySand = [...store.mySand, r.post.id].slice(-30); save();
      sandInput.value = ''; $('sandCount').textContent = '0 / 24'; $('sandPreview').hidden = true; $('sand').classList.remove('previewing');
      sandInput.blur(); close();
      renderSand(); renderSandLabel(); toast(T.sandPosted);
      track('sand_posted', { place: place.id, len: text.length });
    } else if (r.reason === 'cooldown') toast(T.sandCooldown(Math.max(1, Math.ceil((r.wait ?? 60000) / 60000))));
    else toast(T.sandFiltered);
  });
});
net.on('sandPost', p => {
  sandPosts.push(p); renderSandLabel();
  if (sandOpen && !$('sand').hidden) renderSand();
  else if (sandBoard.distance(me.root.position) < 30) ticker(T.sandNew);
});
net.on('castle', c => castles.upsert(c));
net.on('dog', d => {
  if (d.mode === 'belly' && lastDogMode !== 'belly') { life.heartBurst(6); ticker(T.belly(dogName())); }
  if (d.mode === 'follow' && lastDogMode !== 'follow' && d.by === myId) toast(T.following(dogName()));
  lastDogMode = d.mode;
  life.setDog(d);
});
net.on('pet', id => {
  const c = charOf(id);
  if (c) { c.emote = 'pet'; c.emoteT = 0; }
  life.heartBurst(3);
  const near = Math.hypot(life.dogPos.x - me.root.position.x, life.dogPos.z - me.root.position.z);
  amb.bark(clamp(1.1 - near / 16, 0, 0.9));
  if (id === myId) {
    const key = shellKey();
    if (store.pets?.key !== key) store.pets = { key, n: 0 };
    store.pets.n++; save();
    toast(T.petted(dogName(), store.pets.n));
    track('dog_pet', { place: place.id, n: store.pets.n });
  } else if (near < 12) ticker(T.pettedBy(nickOf(id), dogName()));
});
net.on('sandRemove', id => { sandPosts = sandPosts.filter(p => p.id !== id); renderSandLabel(); if (sandOpen) renderSand(); });
// 글이 흐려지고 사라지는 건 시간에 따라: 1분마다 다시 그림
setInterval(() => { renderSandLabel(); if (sandOpen && !$('sand').hidden && openSheet?.id !== 'sandSheet') renderSand(); }, 60000);
renderSandLabel();

$('exitBtn').onclick = openBye;
$('langBtn').textContent = lang === 'ko' ? 'EN' : '한';
$('langBtn').onclick = () => { track('lang_changed', { to: lang === 'ko' ? 'en' : 'ko' }); setLang(lang === 'ko' ? 'en' : 'ko'); };
$('status').addEventListener('click', toggleBanner);
$('byeStay').onclick = close;
$('byeLeave').onclick = () => { track('left_beach', { seenToday: !!store.days[dateKey(Date.now())], others: remotes.size }); leave(); };
$('comeBack').onclick = () => {
  leaving = false;
  $('goodbye').classList.remove('open');
  history.pushState({ hae: true }, '');
  net.connect();
  amb.resume();
};

// 폰의 뒤로가기: 열린 창이 있으면 그 창만 닫고, 없으면 작별 인사를 띄움
history.pushState({ hae: true }, '');
addEventListener('popstate', () => {
  if (leaving) return;
  history.pushState({ hae: true }, '');
  if ($('wake').classList.contains('open')) return;
  if ($('hint').classList.contains('open')) { $('hint').classList.remove('open'); store.hinted = true; save(); return; }
  if (openSheet && openSheet.id !== 'byeSheet') { close(); return; }
  if (sandOpen) { closeSand(); return; }
  if (openSheet?.id === 'byeSheet') { close(); return; }
  openBye();
});

// ================= 분석 =================
initAnalytics(store.uid);
setTimeout(inAppHint, 1200);
// 기기별 화면 문제를 찾기 위해: 그래픽 칩 이름·정밀도·화면 배율을 한 번 기록
setTimeout(() => {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    track('gl_info', {
      gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      highp: !!hp && hp.precision > 0, dpr: window.devicePixelRatio, w: innerWidth, h: innerHeight,
      inapp: /Barcelona|Threads|Instagram|KAKAOTALK|FBAN|FBAV/i.test(navigator.userAgent),
    });
  } catch { /* 무시 */ }
}, 3000);
track('session_start', {
  place: place.id,
  lang,
  source: query.get('source') ?? 'direct',
  returning: Object.keys(store.days).length > 0,
  streak: streakCount(),
  standalone: isStandalone,
  alarmOn: store.alarm.on,
});
$('kakaoBtn').addEventListener('click', () => track('support_clicked', { method: 'kakaopay' }));
$('supportBtn').addEventListener('click', () => track('support_clicked', { method: 'bmc' }));

// ================= 시작 =================
// 처음 보는 사이트에서 바로 '홈 화면에 추가'를 묻지 않음: 해를 한 번이라도 본 사람에게만
// 진짜 해돋이를 함께 봤거나, 다른 날 다시 찾아온 사람 (다시보기 한 번으로는 묻지 않음)
function installReady() { return Object.values(store.days).includes('live') || Object.keys(store.days).length >= 2; }
function askInstallAfterSun() { /* 설치는 마고할미가 대화로 물어봄 */ }
/** 첫 안내 카드: 산 정상이면 '걸어가 보세요'로 */
function openHint() {
  const peak = has.peak(place.id), nest = place.id === 'jirisan';
  $('hintTitle').textContent = nest ? T.hintNestTitle : peak ? T.hintPeakTitle : (lang === 'ko' ? '해변에 도착했어요' : "You've arrived at the beach");
  if (peak) $('how3').innerHTML = nest ? T.hintNestHow : T.hintPeakHow; else applyHtml();
  $('hint').classList.add('open');
}
// ================= 인트로: 알이 깨지고 → (처음이면) 어둠 속 '여기는… 어디지?' → 눈을 뜨면 마고할미 =================
let introRunning = false;
$('intro').addEventListener('pointerdown', () => amb.unlock());
async function runIntro(first: boolean) {
  introRunning = true;
  if (introSolo) magoBusy = true; // 눈 뜨는 사이에 할미가 다른 인사를 먼저 하지 않게
  if (introSolo) { document.body.classList.add('in-intro'); setIntroSky(-8 * 60000); } // 누구에게나 같은 '해 뜨기 직전 새벽'
  track('intro', { first });
  await hatch(first, T.introTap);
  if (first) await talk(T.wake.map(text => ({ who: 'me' as const, text })));
  await openEyes(first);
  introRunning = false;
  if (introSolo) setTimeout(storyIntro, 400); // 눈을 뜨자마자 할미와 첫 이야기
  else if (!store.hinted) openHint();
  else expandBanner();
}
/** 첫날 이야기: 병아리가 묻고 할미가 답함 (선택지). 건너뛰면 꼭 필요한 것(해의 규칙·걷기·길 고르기)만 */
async function storyIntro() {
  const S = T.story;
  magoBusy = true; let skipped = false;
  while (talking()) await new Promise(r => setTimeout(r, 300));
  setSkip(() => { skipped = true; });
  const p = me.root.position, m = mago.root.position;
  mago.look(faceAngle(p.x - m.x, p.z - m.z)); turnTo(me, faceAngle(m.x - p.x, m.z - p.z), 1);
  const say = async (who: 'mago' | 'say', text: string) => { if (skipped) return; if (who === 'mago') mago.talk(Math.min(6, text.length * 0.09)); await talk([{ who, text }]); };
  const pick = async (text: string, ch: string[]) => { if (skipped) return -1; mago.talk(3); return ask('mago', text, ch); };
  track('story', { step: 'start' });
  const a1 = await pick(S.hello, S.ask1);
  await say('mago', a1 === 1 ? S.who : S.where);
  await say('say', S.mom);
  await say('mago', S.momGone);
  const a2 = await pick(S.momVoice, S.ask2);
  await say('mago', a2 === 1 ? S.again : S.phoenix);
  await say('mago', S.crane);
  // 청학당 쪽을 잠깐 비춤
  const saved = { d: cam.tDist, p: cam.tPitch, y: cam.tYaw };
  if (!skipped) setView(11, 0.42, Math.atan2(-(HALL.x - me.root.position.x), -(HALL.z - me.root.position.z)));
  await say('mago', S.hall);
  await say('mago', S.send);
  setView(saved.d, saved.p, saved.y);
  await say('mago', S.grow);
  // ---- 여기부터는 건너뛰어도 꼭 ----
  if (skipped) track('story', { step: 'skipped' });
  setSkip(null); skipped = false;
  await say('mago', S.walk);
  // 걷기 연습: 조금 걸을 때까지 손가락 안내
  $('walkHintText').textContent = S.walkHint; $('walkHint').hidden = false;
  const from = me.root.position.clone(), t0 = performance.now();
  while (me.root.position.distanceTo(from) < 1.2 && performance.now() - t0 < 12000) await sleep(200);
  $('walkHint').hidden = true;
  await say('mago', S.good);
  await say('mago', S.together);
  // ---- 정상: 할미와 함께 해돋이와 봉황을 봄 (모두에게 똑같은 장면) ----
  track('story', { step: 'summit' });
  await fade(true);
  if (mySeat !== null) standUp(); onCushion = false; lying = false;
  { const z = 12, x = 0; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = 0;
    const mx = x + 1.3, mz = z + 0.5; mago.root.position.set(mx, mountainY(mx, mz, 'jirisan'), mz); mago.look(0); }
  setIntroSky(-20000, 1); // 20초 뒤 해가 지평선을 넘음
  const sd = world.sunDir, yaw = Math.atan2(-sd.x, -sd.z);
  turnTo(me, faceAngle(sd.x, sd.z), 1); mago.look(faceAngle(sd.x, sd.z));
  setView(6, 0.12, yaw);
  await sleep(300); await fade(false);
  await say('mago', S.watch);
  const sr = cycleRefs().sr;
  while (virtualNow() < sr + 2500) await sleep(200);
  await sleep(1500);
  await new Promise<void>(res => legends.fly('phoenix', camera, world.sunDir, () => res()));
  store.phoenixSeen = true; save(); track('phoenix_seen', { first: true, intro: true });
  await talk(T.phoenixFirst.map(text => ({ who: 'me' as const, text })));
  { const p = me.root.position, m = mago.root.position; mago.look(faceAngle(p.x - m.x, p.z - m.z)); turnTo(me, faceAngle(m.x - p.x, m.z - p.z), 1); }
  await say('mago', S.saw);
  await say('mago', S.saw2);
  const nx = sunriseInfo(place, Date.now()).next;
  if (nx) await say('mago', S.sun(dayName(nx, place.tz), hm(nx, place.tz)));
  await say('mago', S.home);
  // ---- 둥지로: 여기서부터 진짜 (실제 시각, 다른 사람들) ----
  await fade(true);
  setIntroSky(null); lastAltForBanner = -90; $('crowHint').hidden = true; // 실제 시각으로 돌아온 첫 순간은 '해가 막 뜸'으로 치지 않음
  { const x = NEST.x, z = NEST.z - 1.2; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = Math.PI; }
  mago.root.position.set(MAGO_AT.x, mountainY(MAGO_AT.x, MAGO_AT.z, 'jirisan'), MAGO_AT.z); mago.look(magoHome);
  setView(saved.d, saved.p, saved.y);
  store.magoMet = true; store.hinted = true; store.magoDay = dateKey(Date.now()); save();
  introSolo = false; document.body.classList.remove('in-intro'); introEndAt = performance.now();
  if (introOffline) { introOffline = false; net.sendBuffer = []; net.connect(); } // 다시 보기 끝: 다시 들어감 (그사이 쌓인 신호는 버림)
  else if (connected && !myId) join(); // 처음 온 사람: 이제 들어감
  bots.fill();
  lastUI = 0;
  await sleep(400); await fade(false);
  await talk([{ who: 'me', text: S.real }]);
  magoBusy = false;
  track('story', { step: 'done' });
  expandBanner();
}
runIntro(!store.hinted);
// 처음 해가 떴을 때는 저절로 울지 않고 '울어 보기'를 가르쳐 줌
$('crowHintText').textContent = T.crowHint;
$('crowHint').onclick = () => { $('crowHint').hidden = true; store.crowTaught = true; save(); crow('first'); };
$('hintBtn').onclick = () => {
  $('hint').classList.remove('open'); store.hinted = true; save(); amb.unlock(); expandBanner();
  // 해가 안 떠 있으면 오늘 아침 해돋이부터 보여 줌
  const live = !!sunriseInfo(place, Date.now()).windowSR;
  if (has.peak(place.id) && place.id !== 'jirisan') setTimeout(() => toast(T.summitWalk), 700);
  else if (!live && !cycling()) setTimeout(() => startReplay(true), 700);
};
// 메뉴에서 처음 화면 다시 보기 (시작하기를 누르면 첫 방문처럼 해돋이 다시보기까지)
function renderRealSky() { $('realSkyLabel').textContent = store.realSky ? T.realSkyOn : T.realSkyOff; }
renderRealSky();
$('realSkyBtn').onclick = () => { store.realSky = !store.realSky; save(); renderRealSky(); close(); toast(store.realSky ? T.realSkyToastOn : T.realSkyToastOff); track('real_sky', { on: !!store.realSky }); };
$('langLabel').textContent = T.langLink;
$('langLink').onclick = () => $('langBtn').click();
// 처음 이야기 다시 보기: 처음 온 사람과 똑같이 (둥지에서 혼자, 새벽 → 정상 봉황 → 둥지)
$('introBtn').onclick = async () => {
  if (introRunning || introSolo) return;
  close(); track('intro_reopened');
  // 할미가 다른 말을 하던 중이면 끝내고 시작
  for (let i = 0; i < 40 && (magoBusy || talking()); i++) { skipAll(); await sleep(150); }
  if (place.id === 'jirisan') {
    if (mySeat !== null) standUp(); onCushion = false; lying = false; letGo(false);
    const x = NEST.x, z = NEST.z - 1.2; me.root.position.set(x, floorY(x, z), z); me.root.rotation.y = Math.PI;
    introSolo = true; bots.clear();
    if (net.connected) { introOffline = true; net.disconnect(); } // 튜토리얼 동안 다른 사람에게 안 보이게
  }
  setTimeout(() => runIntro(true), 250);
};
world.buildLandmark(place);
applyTerrain(place);
// 지형이 정해진 뒤 내 발 높이를 다시 맞춤 (둥지에서 시작할 때 공중에 뜨지 않게)
me.root.position.y = floorY(me.root.position.x, me.root.position.z);
renderStreak(); renderAlarm(); renderCounts();
requestAnimationFrame(loop);

// 테스트용 (브라우저 콘솔에서 확인)
// ================= 조개 · 모래성 =================

// 조개: 장소의 현지 날짜마다 새로 깔림
let lastShellCheck = 0;
const shellKey = () => `${place.id}|${new Intl.DateTimeFormat('en-CA', { timeZone: place.tz }).format(new Date())}`;
function placeShells() {
  if (!has.shells(place.id)) { shells.clear(); return; }
  const key = shellKey();
  if (store.shells?.key !== key) { store.shells = { key, got: [] }; save(); }
  shells.set(place.id, key.split('|')[1], store.shells.got);
}
placeShells();
const shellName = (i: number) => (lang === 'ko' ? SHELLS[i].ko : SHELLS[i].en);
function gotShell(i: number, kind: number) {
  const st = store.shells!; st.got.push(i);
  const dex = (store.dex ??= {});
  const isNew = !dex[SHELLS[kind].id];
  dex[SHELLS[kind].id] = (dex[SHELLS[kind].id] ?? 0) + 1;
  save();
  const found = SHELLS.filter(k => dex[k.id]).length;
  toast(isNew ? T.shellNew(shellName(kind), found, SHELLS.length) : T.shellGot(shellName(kind), st.got.length, PER_DAY));
  amb.plop(0.5);
  track('shell_found', { place: place.id, kind: SHELLS[kind].id, new: isNew, today: st.got.length });
}
function renderDex() {
  const dex = store.dex ?? {}, found = SHELLS.filter(k => dex[k.id]).length;
  $('dexTitle').textContent = T.dexTitle(found, SHELLS.length);
  $('dexLead').textContent = T.dexLead(store.shells?.got.length ?? 0, PER_DAY);
  $('dexGrid').innerHTML = SHELLS.map((k, i) => {
    const n = dex[k.id] ?? 0, c = `#${k.color.toString(16).padStart(6, '0')}`;
    return `<div class="dex${n ? '' : ' unknown'}${k.rare ? ' rare' : ''}"><i style="--c:${n ? c : '#3a3b55'}"></i><b>${n ? shellName(i) : '???'}</b><small>${n ? `×${n}` : k.rare ? T.dexRare : ''}</small></div>`;
  }).join('');
}
$('dexBtn').onclick = () => { renderDex(); open('dexSheet'); track('dex_opened', { found: Object.keys(store.dex ?? {}).length }); };

// 모래성: 앞에 있는 성을 키우거나, 없으면 새로 짓기 (다 같이 쌓는다)
$('castleBtn').onclick = () => {
  if (!has.castles(place.id)) { toast(T.castleNoGrass); return; }
  if (!connected) { toast(T.castleOffline); return; }
  if (mySeat !== null) standUp();
  lying = false;
  const p = me.root.position, ry = me.root.rotation.y;
  const near = castles.near(p.x, p.z, 1.9);
  const x = near ? near.x : p.x - Math.sin(ry) * 1.1, z = near ? near.z : p.z - Math.cos(ry) * 1.1;
  if (!near && (surfaceAt(x, z) !== 'sand' || onPier(x, z) || z < -1.4)) { toast(T.castleNoSand); return; }
  if (near) turnTo(me, Math.atan2(-(near.x - p.x), -(near.z - p.z)), 1);
  me.emote = 'dig'; me.emoteT = 0; net.emit('emote', 'dig');
  net.emit('castle', x, z, r => {
    if (!r.ok) { toast(r.reason === 'cooldown' ? T.castleSlow : r.reason === 'full' ? T.castleFull : r.reason === 'done' ? T.castleDone : T.castleNoSand); return; }
    setTimeout(() => castles.upsert(r.castle), 500);
    toast(r.kind === 'new' ? T.castleNew : r.kind === 'grow' ? T.castleGrow(r.castle.level) : T.castleTower(r.castle.towers));
    track('castle', { place: place.id, kind: r.kind, level: r.castle.level });
  });
};

// ================= 해변별 지형 · 소품 · 실제로 가 보기 =================
function applyTerrain(p: Place) {
  setTerrain(p.id); pier.setPlace(p.id); jetties.setPlace(p.id); bonfire.setPlace(p.id); scenery.setPlace(p.id); world.setGround(p.id);
  life.setFisher(has.water(p.id)); life.setGulls(!has.peak(p.id)); amb.setSea(has.water(p.id));
  sandBoard.setShown(!has.peak(p.id));
  leaves.setOn(leavesHere(p.id), me.root.position, floorY);
  summitReached = false;
  $('routeBtn').hidden = true; // 실제로 가 보기는 장소 목록 안으로 옮김
  // 바다·모래가 없는 곳(산 정상)에선 해변 행동을 숨김
  $('skipBtn').hidden = !has.water(p.id); $('castleBtn').hidden = !has.castles(p.id); $('dexBtn').hidden = !has.shells(p.id);
  // 라면은 그 장소에서만: 다른 곳으로 가면 내려놓음
  if (outfitOf(me) & OUTFIT.ramen) setRamen(false);
}
// ================= 지리산 능선길 가게: 문 앞에 서면 들어갔다가 들고 나옴 =================
const ITEM_TOAST: Record<number, [string, string]> = {
  1: ['🍙 김밥 한 줄 들고 나왔어요', 'Got a roll of kimbap'],
  2: ['☕ 따뜻한 커피 한 잔 들고 나왔어요', 'Got a hot coffee'],
  3: ['🍶 막걸리 한 주전자 들고 나왔어요', 'Got a kettle of makgeolli'],
};
let shopVisit: { item: number; t: number } | null = null, shopAt: string | null = null, nextNibble = 8;
/** 다 먹고(마시고) 내려놓기: 속마음 한 줄 */
function finishItem() {
  const it = itemOf(outfitOf(me)); if (!it) return;
  setShopItem(0); talk([{ who: 'me', text: T.finished[it] }]); track('item_finished', { item: it });
}
$('finishBtn').onclick = () => {
  if (!itemOf(outfitOf(me)) || lying) return;
  // 남은 걸 냠냠 세 번에 다 먹고 내려놓음
  [0, 900, 1800].forEach(ms => setTimeout(() => { me.emote = 'eat'; me.emoteT = 0; if (connected) net.emit('emote', 'eat'); }, ms));
  setTimeout(finishItem, 2600);
};
function setShopItem(k: number) {
  store.outfit = withItem(store.outfit ?? 0, k); store.itemDay = dateKey(Date.now()); store.itemBites = k ? 6 : 0; save();
  setOutfit(me, store.outfit | (outfitOf(me) & TEMP));
  if (connected) net.emit('outfit', outfitOf(me));
}
function updateShops(dt: number) {
  if (place.id !== 'jirisan') { shopAt = null; return; }
  if (shopVisit) {
    // 가게 안에 들어가 있는 짧은 시간: 캐릭터를 숨겼다가 '띵동'과 함께 들고 나옴
    shopVisit.t += dt;
    if (shopVisit.t > 0.5) {
      me.inner.visible = true; setShopItem(shopVisit.item); amb.ding();
      toast(SL(...ITEM_TOAST[shopVisit.item])); track('shop_item', { item: shopVisit.item });
      shopVisit = null; nextNibble = 3;
    }
    return;
  }
  const p = me.root.position;
  let here: Shop | null = null;
  for (const s of SHOPS) { const [x, z] = shopDoor(s); if (Math.hypot(p.x - x, p.z - z) < 0.75) here = s; }
  if (!here) { shopAt = null; }
  else if (shopAt !== here.id && mySeat === null && !lying && !jwOn) {
    shopAt = here.id;
    // 리어카·창구라 안으로 들어가지 않고 그 자리에서 받아 듦
    if (itemOf(store.outfit ?? 0) !== here.item) { shopVisit = { item: here.item, t: 0 }; }
  }
  // 들고 있으면 가끔 한 입·한 모금
  if (itemOf(outfitOf(me)) && !me.emote && me.state !== 'walk' && !lying && (nextNibble -= dt) <= 0) {
    nextNibble = 8 + Math.random() * 7; me.emote = 'eat'; me.emoteT = 0; if (connected) net.emit('emote', 'eat');
    // 한 입씩 줄어들다 다 먹으면 내려놓음
    store.itemBites = (store.itemBites ?? 6) - 1; save();
    if (store.itemBites <= 0) setTimeout(finishItem, 1800);
  }
  // 행동 메뉴: 들고 있을 때만 '다 먹기 / 다 마시기'
  const it = itemOf(outfitOf(me)), fb = $('finishBtn');
  if (fb.hidden === !!it) fb.hidden = !it;
  if (it && fb.dataset.k !== String(it)) { fb.dataset.k = String(it); $('finishIc').textContent = it === 1 ? '🍙' : it === 2 ? '☕' : '🍶'; $('finishLabel').textContent = T.finish[it]; }
}

// ================= 옷장 (모으기) =================
function setWear(mask: number) {
  store.outfit = mask & ~TEMP; save();
  setOutfit(me, store.outfit | (outfitOf(me) & TEMP));
  if (connected) net.emit('outfit', outfitOf(me));
}
const KO = lang === 'ko';
function renderWardrobe() {
  const cur = store.outfit ?? 0, got = store.got ?? [], fresh = store.gotNew ?? [];
  $('wearCount').innerHTML = T.wearCount(ITEMS.filter(it => hasItem(it.id)).length, ITEMS.length);
  $('wardrobe').innerHTML = SLOTS.map(slot => {
    const tiles = ITEMS.filter(it => it.slot === slot).map(it => {
      const mine = got.includes(it.id), on = mine && isOn(it, cur);
      const mom = it.giver === 'mother' ? `<em class="bdg mom">🕊️</em>` : it.season && !mine ? `<em class="bdg ssn">${KO ? { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울', seollal: '설날' }[it.season] : { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter', seollal: 'New Year' }[it.season]}</em>` : '';
      const nw = fresh.includes(it.id) ? '<em class="bdg new">NEW</em>' : '';
      return mine
        ? `<button class="tile wear" data-w="${it.id}" aria-pressed="${on}">${mom}${nw}<i>${it.icon}</i><span>${itemName(it)}</span>${it.giver === 'mother' ? `<small>${T.wearMother}</small>` : ''}</button>`
        : `<div class="tile wear locked">${mom}<i>${it.icon}</i><span>${T.wearLocked}</span><small class="how">${itemHow(it)}</small></div>`;
    }).join('');
    return `<h3 class="wear-h">${SLOT_NAME[slot][KO ? 0 : 1]}</h3><div class="outfit-grid wear-grid">${tiles}</div>`;
  }).join('');
}
$('wardrobe').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest('[data-w]') as HTMLElement | null; if (!btn) return;
  const it = ITEMS.find(x => x.id === btn.dataset.w); if (!it || !hasItem(it.id)) return;
  setWear(toggleWear(it, store.outfit ?? 0)); renderWardrobe();
  track('wear', { slot: it.slot, item: it.id });
});
function endTryOn() { /* 사기·입어 보기는 없어짐 (모으기만) */ }
migrateWardrobe();
setOutfit(me, store.outfit ?? 0);

/** 받는 순간: 주는 이의 말 → 카드 (어미가 남긴 건 금테) → 지금 하기 / 나중에 */
let giving = false;
async function giveItem(it: Item) {
  if (giving || hasItem(it.id)) return;
  giving = true;
  grantItem(it);
  const who = it.giver === 'crane' ? 'crane' : 'mago';
  for (const [w, text] of T.gift[it.id] ?? []) {
    if (w === 'g') { if (who === 'mago') mago.talk(Math.min(6, text.length * 0.09)); else hall.talk(3); await talk([{ who, text }]); }
    else await talk([{ who: 'me', text }]);
  }
  const mom = it.giver === 'mother';
  $('giftCard').classList.toggle('mom', mom); $('gcMom').hidden = !mom; $('gcMom').textContent = '🕊️ ' + T.wearMother;
  $('gcIc').textContent = it.icon; $('gcName').textContent = itemName(it); $('gcDesc').textContent = itemDesc(it);
  $('gcNow').textContent = T.wearNow; $('gcLater').textContent = T.wearLater;
  $('giftCard').hidden = false; amb.blip(880); setTimeout(() => amb.blip(1180), 140);
  track('item_got', { item: it.id, giver: it.giver });
  const now = await new Promise<boolean>(res => { $('gcNow').onclick = () => res(true); $('gcLater').onclick = () => res(false); });
  $('giftCard').hidden = true;
  if (now) { setWear(wearSet(store.outfit ?? 0, it.slot, it.val)); store.gotNew = (store.gotNew ?? []).filter(x => x !== it.id); save(); }
  if (mom) await talk([{ who: 'me', text: T.giftMom }]);
  giving = false;
}
const giftCtx = () => {
  const p = me.root.position, jiri = place.id === 'jirisan';
  return { days: seenDays(), tales: store.taleNext ?? 0, goals: store.goalCount ?? 0, fedTogether: !!store.feedTogetherDay, season: seasonNow(), atSummit: jiri && p.z < 14 && p.z > -1, atJeseok: jiri && p.z > 40 && p.z < 62 };
};
/** 할미가 건네는 것 (어미가 맡긴 것 포함): 할미와 이야기할 때 */
async function magoGifts() { for (const it of earnable(giftCtx()).filter(x => x.giver === 'mother' || x.giver === 'mago')) await giveItem(it); }
/** 훈장님이 주는 것: 다짐을 쓴 뒤 */
async function craneGifts() { for (const it of earnable(giftCtx()).filter(x => x.giver === 'crane')) await giveItem(it); }
/** 산과 계절이 주는 것: 그 자리·그 계절에 있으면 바로 */
let giftScanAt = 0;
function mountainGifts() {
  if (performance.now() - giftScanAt < 2000 || giving || talking() || introSolo || introRunning || hallMoving) return;
  giftScanAt = performance.now();
  const it = earnable(giftCtx()).find(x => x.giver === 'mountain');
  if (it) void giveItem(it);
}
const openWardrobe = () => { renderWardrobe(); open('outfitSheet'); track('wardrobe_open'); setTimeout(() => { store.gotNew = []; save(); }, 400); };
$('wearBtn').onclick = openWardrobe;
$('wearTile').onclick = () => { setTray(false); openWardrobe(); };
$('outfitBtn').onclick = openWardrobe;
$('placeRoute').onclick = () => { close(); $('routeBtn').click(); };
$('routeBtn').onclick = () => {
  const r = placeRoute(place);
  if (!r) return;
  $('routeTitle').textContent = r.title;
  $('routeLead').innerHTML = r.lead;
  $('routeSteps').innerHTML = r.steps.map(x => `<li>${x}</li>`).join('');
  ($('routeMap') as HTMLAnchorElement).href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.map);
  open('routeSheet'); track('route_opened', { place: place.id });
};
$('routeMap').addEventListener('click', () => track('route_map', { place: place.id }));

// ================= 꽃다발 건네주기 =================
// 사진 자리 두 곳에 마주 서 있고 내가 꽃을 들고 있으면 버튼이 켜진다.
// 누르면 서버가 확인한 뒤 모두에게 같은 순간을 보내고, 두 사람의 손이 맞닿는 순간 꽃이 옮겨 간다.
let giveTarget: string | null = null, handoff: { a: Char; b: Char; aId: string; bId: string; t: number; swapped: boolean } | null = null;
function updateGiveBtn() {
  giveTarget = null;
  if (hasPhotoSpots() && !handoff && (outfitOf(me) & OUTFIT.flowers) && !lying && mySeat === null) {
    const p = me.root.position, i = PHOTO_SPOTS.findIndex(sp => Math.hypot(sp.x - p.x, sp.z - p.z) < 0.42);
    if (i >= 0) {
      const o = PHOTO_SPOTS[1 - i];
      for (const [id, r] of remotes) {
        const q = r.c.root.position;
        if (Math.hypot(o.x - q.x, o.z - q.z) < 0.5 && !(outfitOf(r.c) & OUTFIT.flowers)) { giveTarget = id; break; }
      }
    }
  }
  const b = $('giveBtn'), show = !!giveTarget;
  if (b.hidden === show) b.hidden = !show;
}
$('giveBtn').onclick = () => { if (giveTarget && connected) { net.emit('give', giveTarget); track('give_flowers', { place: place.id }); } };
net.on('give', (from, to) => {
  const a = charOf(from), b = charOf(to);
  if (!a || !b) return;
  a.emote = 'give'; a.emoteT = 0; b.emote = 'take'; b.emoteT = 0;
  handoff = { a, b, aId: from, bId: to, t: 0, swapped: false };
  if (from !== myId && to !== myId) ticker(T.giveSeen(nickOf(from), nickOf(to)));
});
function updateHandoff(dt: number) {
  if (!handoff) return;
  handoff.t += dt;
  // 팔을 뻗어 손이 맞닿는 때(약 0.9초)에 꽃이 왼손으로 넘어가고, 끝나면 받은 사람 오른손으로
  if (!handoff.swapped && handoff.t > 0.9) {
    handoff.swapped = true;
    setOutfit(handoff.a, outfitOf(handoff.a) & ~OUTFIT.flowers);
    showLeftFlowers(handoff.b, true);
    sparkleAt(handoff.a.root.position, handoff.b.root.position);
  }
  if (handoff.t > 2.0) {
    showLeftFlowers(handoff.b, false);
    setOutfit(handoff.b, outfitOf(handoff.b) | OUTFIT.flowers);
    if (handoff.aId === myId) { store.outfit = outfitOf(me) & ~TEMP; save(); toast(T.gave); }
    if (handoff.bId === myId) { store.outfit = outfitOf(me) & ~TEMP; save(); toast(T.got); }
    handoff = null;
  }
}
// 손이 맞닿는 자리에 작은 반짝임
const sparkles: { s: THREE.Sprite; t: number; v: THREE.Vector3 }[] = [];
function sparkleAt(a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.95;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: i % 3 ? 0xfff6e0 : 0xffc0cb, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(mid); s.scale.setScalar(0.18); scene.add(s);
    sparkles.push({ s, t: 0, v: new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.9 + 0.2, (Math.random() - 0.5) * 0.9) });
  }
}
function updateSparkles(dt: number) {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const p = sparkles[i]; p.t += dt;
    p.s.position.addScaledVector(p.v, dt); p.v.y -= dt * 0.6;
    p.s.material.opacity = Math.max(0, 1 - p.t / 1.2);
    if (p.t > 1.2) { scene.remove(p.s); p.s.material.dispose(); sparkles.splice(i, 1); }
  }
}

// ================= 한강 라면 =================
// 라면 기계 앞에 가면 '라면 끓이기' → 4초 뒤 손에 라면. 돗자리에 앉으면 몇 초마다 후루룩.
let ramenBites = 0, nextBite = 0, ramenCooking = false;
function setRamen(on: boolean) {
  const mask = on ? outfitOf(me) | OUTFIT.ramen : outfitOf(me) & ~OUTFIT.ramen;
  setOutfit(me, mask);
  if (connected) net.emit('outfit', mask);
  ramenBites = 0;
}
function updateRamen(t: number) {
  const b = $('ramenBtn');
  const near = place.id === 'hangang' && !ramenCooking && !(outfitOf(me) & OUTFIT.ramen)
    && Math.hypot(me.root.position.x - RAMEN_MACHINE.x, me.root.position.z - RAMEN_MACHINE.z) < 2.4;
  if (b.hidden === near) b.hidden = !near;
  // 앉아서 라면 먹기
  if ((outfitOf(me) & OUTFIT.ramen) && mySeat !== null && !me.emote && t > nextBite) {
    nextBite = t + 3500;
    me.emote = 'eat'; me.emoteT = 0; if (connected) net.emit('emote', 'eat');
    amb.step('water');
    if (++ramenBites >= 6) { setTimeout(() => { setRamen(false); toast(T.ramenAte); track('ramen_eaten', { place: place.id }); }, 1600); nextBite = t + 1e9; }
  }
}
$('ramenBtn').onclick = () => {
  ramenCooking = true; $('ramenBtn').hidden = true;
  scenery.cook(); toast(T.ramenCooking);
  turnTo(me, Math.atan2(-(RAMEN_MACHINE.x - me.root.position.x), -(RAMEN_MACHINE.z - me.root.position.z)), 1);
  track('ramen_cook', { place: place.id });
  setTimeout(() => { ramenCooking = false; if (place.id !== 'hangang') return; setRamen(true); nextBite = 0; toast(T.ramenDone); }, 4000);
};

// ================= 산 정상: 언덕을 넘어 절벽 끝에 닿으면 해돋이 =================
// 정상 직전에 나타나서 몇 걸음 걸어야 풍경이 열린다. 해돋이 시간이 아니면 끝에 닿는 순간 다시보기를 틀어 줌.
function updateSummit() {
  if (!has.peak(place.id) || summitReached) return;
  if (me.root.position.z > SUMMIT.crestZ - 0.6) return;
  summitReached = true;
  track('summit_reached', { place: place.id });
  // 뒤쪽 언덕에 가리지 않게 카메라를 조금 높여서 발아래 절벽과 운해를 내려다봄
  if (!lying) setView(Math.max(cam.tDist, 7), 0.46, 0);
  const live = !!sunriseInfo(place, Date.now()).windowSR;
  if (cycling()) toast(T.summitCycle(mmss(cycleToSunrise())));
  else if (!live && !replay) { toast(T.summitReach); setTimeout(() => startReplay(true), 900); }
}

// ================= 야호 메아리 · 늦잠 잔 사람 (천왕봉) =================
const pick = <X,>(a: readonly X[]) => a[Math.floor(Math.random() * a.length)];
let lastYaho = 0, lateDoneFor = -1;
/** 누가 외쳤든 같은 장소 사람은 모두 메아리를 들음. 5번에 1번쯤 산이 엉뚱하게 대답 */
function yahoFrom(c: Char) {
  say(c, T.yahoShout, 1800);
  const near = c.root.position.distanceTo(me.root.position);
  // 같은 4초 안에 외친 건 모두에게 같은 대답이 오도록 시간으로 정함
  const slot = Math.floor(Date.now() / 4000), reply = (slot * 2654435761 >>> 0) % 5 === 0 ? T.yahoReplies[slot % T.yahoReplies.length] : null;
  echo.shout(c.root.position, T.yahoEcho, reply);
  if (reply && c === me) setTimeout(() => say(me, '!?', 2000, 0.7), 3600);
  // 진짜 사람 목소리 녹음(/yaho.mp3)이 있으면 그걸 메아리로, 없으면 기기 음성으로 "야호"만 읽음
  const vol = clamp(1.2 - near / 30, 0, 1);
  if (amb.on && near < 30) amb.playEcho('/yaho.mp3', vol).then(ok => { if (!ok) speakYaho(vol); });
}
function speakYaho(vol: number) {
  if ('speechSynthesis' in window) {
    // 목소리 메아리: 점점 작고 낮게 세 번
    [0, 0.8, 1.5].forEach((d, i) => setTimeout(() => {
      const u = new SpeechSynthesisUtterance(lang === 'ko' ? '야호' : 'Yaho');
      u.lang = lang === 'ko' ? 'ko-KR' : 'en-US'; u.volume = 0.8 * Math.pow(0.45, i) * vol; u.pitch = 1.2 - i * 0.15; u.rate = 0.9;
      speechSynthesis.speak(u);
    }, d * 1000 + (i ? 300 : 0)));
  }
}
const SHOW_LATE = false;
function updateYaho(t: number) {
  // 야호 버튼은 피드백으로 뺌 (코드는 남김)
  const show = false;
  if ($('yahoBtn').hidden === show) $('yahoBtn').hidden = !show;
  // 해가 뜨고 15초쯤 지나면 늦잠 잔 사람이 헐레벌떡 (순환마다 한 번, LIVE면 그날 한 번)
  // 늦잠 잔 사람도 피드백으로 뺌 (코드는 남김)
  if (!SHOW_LATE || !has.peak(place.id) || late.busy) return;
  const key = cycling() ? Math.floor(Date.now() / CYCLE) : Math.floor(Date.now() / 86400000);
  const after = cycling() ? cyclePhase() - SR_PHASE : (Date.now() - (sunriseInfo(place, Date.now()).last ?? 0)) / CYCLE;
  if (key !== lateDoneFor && after > 0.05 && after < 0.12) {
    lateDoneFor = key;
    late.start({ huff: T.lateHuff, flop: pick(T.lateLines) });
    track('late_sleeper', { place: place.id });
  }
  void t;
}
$('yahoBtn').onclick = () => {
  const now = performance.now();
  if (now - lastYaho < 3500) return;
  lastYaho = now;
  me.emote = 'yaho'; me.emoteT = 0; if (connected) net.emit('emote', 'yaho');
  yahoFrom(me);
  track('yaho', { place: place.id });
};

// ================= 같이 해 띄우기 (금빛 해돋이) =================
// 해 뜨기 전 잠깐 '해야 솟아라!'로 응원. 한 사람 10번까지. 게이지가 차면 금빛 해돋이 (못 채워도 해는 그냥 뜸).
// 지금은 혼자서도 금빛 해돋이가 되도록 목표 16 (내 응원 10 + 가짜 사용자 8). 여럿이 모여야 되게 하려면 30으로
const CHEER_GOAL = 16, CHEER_MAX = 10, BOT_CHEER = 8;
const GOLD_TOTAL = 48;
let cheer = { key: '', total: 0, people: 0 }, myCheers: Record<string, number> = {}, cheerHinted = '', goldT = 0, lastBotSpark = 0;
/** 지금이 응원 시간이면 이번 해돋이의 이름(key)과 진행률(0~1), 아니면 null */
function cheerWindow(): { key: string; k: number } | null {
  if (cycling()) { const ph = cyclePhase(); return ph < SR_PHASE - 0.004 ? { key: `c${Math.floor(Date.now() / CYCLE)}`, k: ph / SR_PHASE } : null; }
  const sr = sunriseInfo(place, Date.now()).windowSR;
  if (!sr || store.realSky && !sr) return null;
  const left = sr - Date.now();
  return left > 0 && left < 5 * 60000 ? { key: `l${sr}`, k: 1 - left / (5 * 60000) } : null;
}
const cheerPct = (w: { key: string; k: number }) => Math.min(1, ((cheer.key === w.key ? cheer.total : 0) + BOT_CHEER * w.k) / CHEER_GOAL);
const sparkTmp = new THREE.Vector3(), horizonTmp = new THREE.Vector3();
/** 지평선 위 해가 뜰 자리의 화면 좌표 (카메라 뒤면 null) */
function horizonScreen() {
  const d = world.sunDir; horizonTmp.set(d.x, 0, d.z).normalize().multiplyScalar(800).add(camera.position); horizonTmp.y = 0;
  const p = horizonTmp.project(camera);
  if (p.z > 1 || Math.abs(p.x) > 1.3) return null;
  return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight] as const;
}
/** 응원한 사람에게서 빛 알갱이가 게이지로 날아감 */
function spark(from: THREE.Vector3) {
  // 빛 알갱이는 응원 버튼으로 모인다 (게이지가 버튼 안에서 차오름)
  const r = $('cheerBtn').getBoundingClientRect(); if (!r.width) return;
  const h = [r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height / 2];
  sparkTmp.copy(from); sparkTmp.y += 1.6; const p = sparkTmp.project(camera);
  if (p.z > 1) return;
  const el = document.createElement('div'); el.className = 'spark';
  const x0 = (p.x + 1) / 2 * innerWidth, y0 = (1 - p.y) / 2 * innerHeight, a = Math.PI * (0.15 + Math.random() * 0.7);
  void a; const x1 = h[0], y1 = h[1];
  el.style.left = `${x0}px`; el.style.top = `${y0}px`; $('sparks').appendChild(el);
  el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.6)`, opacity: 0.2 }], { duration: 900, easing: 'ease-in' }).onfinish = () => el.remove();
}
function updateCheer(t: number, dt: number) {
  // 금빛 해돋이 여운: 40초에 걸쳐 천천히 원래 하늘로
  // 금빛 해돋이: 해가 올라오는 동안 8초에 걸쳐 천천히 물들고(ease-in-out), 끝날 땐 12초에 걸쳐 서서히 원래 하늘로
  if (goldT > 0) {
    goldT = Math.max(0, goldT - dt);
    const inK = clamp((GOLD_TOTAL - goldT) / 8, 0, 1), outK = Math.min(1, goldT / 12);
    const ease = (x: number) => x * x * (3 - 2 * x);
    world.setGolden(ease(inK) * ease(outK));
  }
  const w = cheerWindow(), b = $('cheerBtn'), g = $('gauge');
  const show = !!w && !openSheet && !lying;
  if (b.hidden === show) b.hidden = !show;
  if (!w) { if (!g.hidden) g.hidden = true; return; }
  if (cheerHinted !== w.key) { cheerHinted = w.key; ticker(T.cheerHint); }
  const mine = myCheers[w.key] ?? 0, left = CHEER_MAX - mine;
    b.dataset.done = left > 0 ? '0' : '1';
  // 햇살 게이지 = 버튼 자체가 왼쪽부터 차오름 (해 뜨는 장면을 가리지 않게)
  const pct = cheerPct(w);
  if (!g.hidden) g.hidden = true;
  b.style.setProperty('--fill', `${(pct * 100).toFixed(1)}%`);
  b.classList.toggle('full', pct >= 1);
  const lbl = pct >= 1 ? T.gaugeFull : left > 0 ? T.cheerBtn : T.cheerDone;
  if ($('cheerLabel').textContent !== lbl) $('cheerLabel').textContent = lbl;
  $('cheerLeft').textContent = `${Math.round(pct * 100)}%`;
  b.setAttribute('aria-label', `${lbl} · ${T.gauge(Math.round(pct * 100))}`);
  // 가짜 사용자들도 가끔 응원 (보이기만)
  if (t - lastBotSpark > 2400 && bots.count) { lastBotSpark = t; const ps = bots.positions(); spark(ps[Math.floor(Math.random() * ps.length)]); }
}
$('cheerBtn').onclick = () => {
  const w = cheerWindow(); if (!w) return;
  const mine = myCheers[w.key] ?? 0; if (mine >= CHEER_MAX) return;
  myCheers = { [w.key]: mine + 1 };
  me.emote = 'stretch'; me.emoteT = 0.6; spark(me.root.position);
  if (connected) net.emit('cheer', w.key);
  else { if (cheer.key !== w.key) cheer = { key: w.key, total: 0, people: 1 }; cheer.total++; }
  track('cheer', { place: place.id, n: mine + 1 });
};
net.on('cheer', (key, total, people, from) => {
  cheer = { key, total, people };
  if (from && from !== myId) { const r = remotes.get(from); if (r) { r.c.emote = 'stretch'; r.c.emoteT = 0.6; spark(r.c.root.position); } }
});
/** 해가 지평선을 넘는 순간: 게이지가 찼으면 금빛 해돋이, 편지가 있으면 배달 */
let lastWindowKey = '';
function sunRoseNow() {
  const key = lastWindowKey;
  setTimeout(askAfterSun, 9000);
  // 5분 해도 오늘 도장(작은 도장) + 햇살 1 (하루 3번까지)
  if (cycling()) { markSeen('replay'); earnCycle(); }
  if (key) {
    const k = Math.min(1, ((cheer.key === key ? cheer.total : 0) + BOT_CHEER) / CHEER_GOAL);
    if (k >= 1) {
      goldT = GOLD_TOTAL;
      if (!store.golden) { store.golden = true; save(); }
      const n = cheer.key === key ? cheer.people : 1;
      $('goldenText').textContent = T.golden(n);
      // 하늘이 어느 정도 물든 뒤에 카드가 뜨게 (갑자기 튀지 않게)
      setTimeout(() => { $('goldenCard').hidden = false; }, 3500);
      setTimeout(() => { $('goldenCard').hidden = true; }, 10500);
      for (let i = 0; i < 14; i++) setTimeout(() => spark(me.root.position), 600 + i * 260);
      track('golden_sunrise', { place: place.id, people: n });
      if ((myCheers[key] ?? 0) > 0) setTimeout(() => earnGolden(), 4000);
    } else if ((myCheers[key] ?? 0) > 0) setTimeout(() => toast(T.notGolden(Math.round(k * 100))), 2500);
  }
  setTimeout(deliverLetter, goldT > 0 ? 7500 : 2500);
}
setInterval(() => { const w = cheerWindow(); if (w) lastWindowKey = w.key; }, 500);

// ================= 내일의 해에게 보내는 편지 =================
// 편지는 이 기기에만 저장. 다음 날 처음 해가 뜰 때 해가 다시 가져다줌.
const todayKey = () => dateKey(Date.now());
function updateLetterBtn() { if (!$('letterBtn').hidden) $('letterBtn').hidden = true; } // 편지는 해 뜬 뒤 물어보기 + 기록·알람 메뉴로 옮김
function askLetter() {
  if (store.letter || openSheet || store.letterAskDay === dateKey(Date.now())) return;
  store.letterAskDay = dateKey(Date.now()); save();
  $('letterAsk').hidden = false; track('letter_ask');
  setTimeout(() => { $('letterAsk').hidden = true; }, 12000);
}
/** 해가 뜬 직후 한 번: 사진 남기기 · 내일 알람 · 내일의 나에게 (감동한 순간이 알람을 켤 확률이 가장 높음) */
let afterSunTimer = 0;
function askAfterSun() {
  const day = dateKey(Date.now());
  if (store.afterSunDay === day) return;
  if (openSheet || talking()) { setTimeout(askAfterSun, 4000); return; }
  store.afterSunDay = day; save();
  $('asAlarm').hidden = store.alarm.on;
  $('asLetter').hidden = !!store.letter;
  $('afterSun').hidden = false; track('after_sun_card', { alarmOn: store.alarm.on });
  clearTimeout(afterSunTimer); afterSunTimer = window.setTimeout(() => { $('afterSun').hidden = true; }, 30000);
}
const hideAfterSun = () => { $('afterSun').hidden = true; clearTimeout(afterSunTimer); };
$('afterSunX').onclick = () => { hideAfterSun(); track('after_sun_x'); };
$('asPhoto').onclick = () => { hideAfterSun(); snapPhoto('after_sun'); };
$('asAlarm').onclick = () => {
  if (!store.alarm.on) { store.alarm.on = true; save(); chime(); renderAlarm(); }
  $('asAlarm').hidden = true; toast(T.afterSunAlarmOn); track('alarm_toggled', { on: true, place: place.id, from: 'after_sun' });
  if ($('asLetter').hidden) hideAfterSun();
};
$('asLetter').onclick = () => { hideAfterSun(); $('letterBtn').click(); track('letter_ask_yes', { from: 'after_sun' }); };
$('letterAskYes').onclick = () => { $('letterAsk').hidden = true; $('letterBtn').click(); track('letter_ask_yes'); };
$('letterAskNo').onclick = () => { $('letterAsk').hidden = true; };
setInterval(updateLetterBtn, 500);
$('letterBtn').onclick = () => { ($('letterInput') as HTMLTextAreaElement).value = ''; $('letterCount').textContent = '0 / 60'; open('letterSheet'); track('letter_open'); };
$('letterInput').addEventListener('input', () => { $('letterCount').textContent = `${($('letterInput') as HTMLTextAreaElement).value.length} / 60`; });
$('letterGo').onclick = () => {
  const text = ($('letterInput') as HTMLTextAreaElement).value.trim().slice(0, 60);
  if (!text) { toast(T.letterEmpty); return; }
  store.letter = { day: todayKey(), text, at: Date.now() };
  store.letterDays = [...new Set([...(store.letterDays ?? []), todayKey()])].slice(-60); save();
  close(); track('letter_sent', { len: text.length });
  const pl = $('plane'); pl.hidden = true; void pl.offsetWidth; pl.hidden = false;
  setTimeout(() => { pl.hidden = true; $('letterSent').hidden = false; }, 2300);
  setTimeout(() => { $('letterSent').hidden = true; }, 16000);
};
$('letterAlarm').onclick = () => { $('letterSent').hidden = true; if (!store.alarm.on) $('alarmBtn').click(); else toast(T.alarmToggledOn); };
$('letterSentClose').onclick = () => { $('letterSent').hidden = true; };
/** 어제 이전에 쓴 편지가 있으면 해가 가져옴 */
function deliverLetter() {
  const L = store.letter;
  if (!L || L.day >= todayKey() || !$('letterArrive').hidden || !$('letterPaper').hidden) return;
  $('letterArrive').hidden = false; track('letter_arrived');
}
let loadChecked = false;
/** 진짜 하늘을 보는 중(LIVE 이후·실제 하늘)이면 해가 이미 떠 있을 때 바로 배달 */
function maybeDeliverOnLoad(alt: number, live: boolean, cyc: boolean) {
  if (loadChecked || cyc) return;
  loadChecked = true;
  if (alt > 0.5 || live) setTimeout(deliverLetter, 4000);
}
function letterStreak(day: string) {
  const days = new Set(store.letterDays ?? []); let n = 0;
  for (let d = new Date(day + 'T12:00:00'); days.has(dateKey(d.getTime())); d.setDate(d.getDate() - 1)) n++;
  return Math.max(1, n);
}
$('letterOpenBtn').onclick = () => {
  const L = store.letter; if (!L) { $('letterArrive').hidden = true; return; }
  $('letterArrive').hidden = true;
  $('letterFrom').textContent = T.letterFrom(new Date(L.at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-NZ', { month: 'long', day: 'numeric' }));
  $('letterText').textContent = L.text;
  $('letterStreak').textContent = T.letterStreak(letterStreak(L.day));
  $('letterPaper').hidden = false;
  store.letter = undefined; save();
  track('letter_read');
};
$('letterPaperClose').onclick = () => { $('letterPaper').hidden = true; };
$('letterWriteToday').onclick = () => { $('letterPaper').hidden = true; $('letterBtn').click(); };

// ================= 해변 강아지 =================
// 강아지는 서버가 채널마다 한 마리씩 움직이고, 쓰다듬으면 모두에게 같은 반응이 보인다.
function applyDogName() { life.setName(dogName()); ($('petBtn') as HTMLButtonElement).textContent = T.petBtn(dogName()); }
applyDogName();
function updatePetBtn() {
  const d = Math.hypot(life.dogPos.x - me.root.position.x, life.dogPos.z - me.root.position.z);
  const b = $('petBtn');
  // 1.7m 안에 들어오면 켜고 2.3m 밖으로 나가야 끔 (경계에서 깜빡이지 않게)
  const show = connected && !lying && !handoff && d < (b.hidden ? 1.7 : 2.3);
  if (b.hidden === show) b.hidden = !show;
}
$('petBtn').onclick = () => {
  if (mySeat !== null) standUp();
  turnTo(me, Math.atan2(-(life.dogPos.x - me.root.position.x), -(life.dogPos.z - me.root.position.z)), 1);
  net.emit('pet');
};
function renderDogLine() {
  const key = `${place.id}|${new Intl.DateTimeFormat('en-CA', { timeZone: place.tz }).format(new Date())}`;
  const n = store.pets?.key === key ? store.pets.n : 0;
  $('dogLine').hidden = !n; if (n) $('dogLine').textContent = T.dogLine(dogName(), n);
}

// ================= 해변을 채워 주는 가상 사용자 =================
// 내 화면에만 있고 서버에는 없어서 위쪽 인원수·통계에 들어가지 않는다. 진짜 사람이 와도 그대로 있다.
const bots = createBots({
  scene, seats, placeId: () => place.id, matsHere: () => has.mats(place.id),
  // 해 뜨기 직전이면 산에서 돌아다니던 봇들도 정상으로 모임
  sunSoon: () => lastAltForBanner > -3 && lastAltForBanner < 0.3,
  onLantern: (pos, nick) => { if (!LANTERN_ON) return; lanterns.launch(pos, undefined, true); ticker(T.lanternBy(nick)); },
});
if (!introSolo) bots.fill();


// ================= 햇살 포인트 =================
// 오른쪽 위 햇살 칩: 받을 때 반짝이며 숫자가 올라가고, 누르면 햇살 메뉴(도장 달력·쓰기·버는 법·내역)
const nightFx = createNightFx(scene, GLOW);
const SL = (ko: string, en: string) => (lang === 'ko' ? ko : en);
let sunShown = sunTotal(), sunAnim: { from: number; to: number; t0: number } | null = null;
$('sunNum').textContent = String(sunShown);
onSun((gain, total) => {
  if (gain <= 0) { sunShown = total; $('sunNum').textContent = String(total); return; }
  sunAnim = { from: sunShown, to: total, t0: performance.now() };
  const chip = $('sunChip'); chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
  setTimeout(() => chip.classList.remove('pop'), 1800);
});
function updateSunChip() {
  if (!sunAnim) return;
  const k = Math.min(1, (performance.now() - sunAnim.t0) / 1200), e = 1 - Math.pow(1 - k, 3);
  sunShown = Math.round(sunAnim.from + (sunAnim.to - sunAnim.from) * e);
  $('sunNum').textContent = String(sunShown);
  if (k >= 1) sunAnim = null;
}
const SUN_REASON: Record<string, [string, string]> = {
  live: ['진짜 해돋이(LIVE)', 'LIVE sunrise'], cycle: ['5분 해돋이', '5-minute sunrise'], golden: ['금빛 해돋이 함께', 'Golden sunrise'],
  streak3: ['3일 연속 보너스', '3-day streak bonus'], streak7: ['7일 연속 보너스', '7-day streak bonus'], shield: ['연속 기록 지키기', 'Streak saver'],
  star: ['별똥별 띄우기', 'Shooting star'], fire: ['불꽃 쏘기', 'Firework'], test: ['테스트 햇살', 'Test sunlight'],
};
const reasonOf = (t: string) => {
  const r = SUN_REASON[t]; if (r) return SL(r[0], r[1]);
  const it = ITEMS.find(x => x.id === t); if (it) return itemName(it);
  if (t.startsWith('lc:')) return SL('풍등 색', 'Lantern colour');
  if (t.startsWith('lp:')) return SL('풍등 무늬', 'Lantern pattern');
  if (t.startsWith('jf:')) return SL('쥐불놀이 불 색', 'Fire spin colour');
  return t;
};
let calMonth = new Date(); calMonth.setDate(1);
function renderSunSheet() {
  $('sunTotal').textContent = String(sunTotal());
  const days = store.days, keys = Object.keys(days);
  const ym = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}`;
  const inMonth = keys.filter(k => k.startsWith(ym));
  const streak = streakCount();
  $('sunStats').innerHTML = [
    [SL('연속', 'Streak'), SL(`${streak}일`, `${streak}d`), true],
    [SL('이번 달 본 날', 'Days this month'), String(inMonth.length), false],
    [SL('LIVE로 본 날', 'LIVE days'), String(keys.filter(k => days[k] === 'live').length), false],
  ].map(([a, b, hi]) => `<div><small>${a}</small><b${hi ? ' class="hi"' : ''}>${b}</b></div>`).join('');
  $('calTitle').textContent = calMonth.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  $('calWeek').innerHTML = (lang === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map(d => `<span>${d}</span>`).join('');
  const first = calMonth.getDay(), n = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate(), today = dateKey(Date.now());
  let html = '<span></span>'.repeat(first);
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`, v = days[k];
    const cls = v === 'live' ? 'live' : v ? 'cyc' : '';
    html += `<span class="day${k === today ? ' today' : ''}"><i class="st ${cls}">${v ? SUN_SVG : ''}</i><small>${d}</small></span>`;
  }
  $('cal').innerHTML = html;
  $('calLegend').innerHTML = `<span><i class="lg live"></i>${SL('LIVE로 봄', 'LIVE')}</span><span><i class="lg cyc"></i>${SL('5분 해로 봄', '5-min sun')}</span><span><i class="lg today"></i>${SL('오늘', 'Today')}</span>`;
  const next = streak < 3 ? 3 : streak < 7 ? 7 : 0;
  $('sunGoal').innerHTML = next
    ? `<div class="g-row"><b>${SL(`${next}일 연속 보너스까지`, `To ${next}-day streak`)}</b><em>+${next === 3 ? EARN.streak3 : EARN.streak7} ${SL('햇살', 'sun')}</em></div><div class="g-bar"><i style="width:${(streak / next) * 100}%"></i></div><small>${SL(`${next - streak}일 남았어요`, `${next - streak} more day(s)`)}</small>`
    : `<div class="g-row"><b>${SL('7일 연속 달성!', '7-day streak!')}</b></div>`;
  const night = canJwibul();
  const uses: [string, string, string, string, boolean][] = [
    ['wear', '🧥', SL('옷', 'Clothes'), SL('새 옷을 입어 보고 사기', 'Try on and buy'), true],
    ...(LANTERN_ON ? [['lantern', '🏮', SL('풍등 꾸미기', 'Lantern style'), SL('색·무늬 바꾸기', 'Colours and patterns'), true] as [string, string, string, string, boolean]] : []),
    ['jwibul', '🔥', SL('쥐불놀이', 'Fire spin'), night ? SL('무료 · 지금 할 수 있어요', 'Free · available now') : SL('무료 · 밤에만', 'Free · night only'), night],
    ['shield', '🛡️', SL('연속 기록 지키기', 'Streak saver'), `${SL('햇살', 'Sun')} ${PRICE.shield} · ${SL(`하루를 놓친 다음 날 · 이번 달 ${shieldsLeft()}번 남음`, `the day after a miss · ${shieldsLeft()} left this month`)}`, false],
  ];
  $('sunUses').innerHTML = uses.map(([id, ic, t, d, on]) => `<button class="use-row${on ? '' : ' off'}" data-use="${id}"><i>${ic}</i><span><b>${t}</b><small>${d}</small></span><em>›</em></button>`).join('');
  $('sunRules').innerHTML = ([
    [SL('진짜 해돋이(LIVE) 보기', 'Watch the LIVE sunrise'), SL('하루 한 번, 실제 일출 시각에', 'once a day'), EARN.live],
    [SL('5분마다 뜨는 해 보기', 'Watch a 5-minute sunrise'), SL(`하루 최대 ${EARN.cycleMax}번까지`, `up to ${EARN.cycleMax} a day`), EARN.cycle],
    [SL('금빛 해돋이에 함께하기', 'Join a golden sunrise'), SL('응원 버튼을 한 번이라도 누르면', 'cheer at least once'), EARN.golden],
    [SL('3일 연속', '3-day streak'), SL('연속 기록 보너스', 'streak bonus'), EARN.streak3],
    [SL('7일 연속', '7-day streak'), SL('연속 기록 보너스', 'streak bonus'), EARN.streak7],
  ] as [string, string, number][]).map(([a, b, p]) => `<div class="rule"><span><b>${a}</b><small>${b}</small></span><em>+${p}</em></div>`).join('');
  const log = store.sunLog ?? [];
  $('sunLogList').innerHTML = log.length
    ? log.slice(0, 12).map(l => `<div class="lg-row"><small>${l.d.slice(5).replace('-', '.')}</small><span>${reasonOf(l.t)}</span><em class="${l.p > 0 ? 'plus' : ''}">${l.p > 0 ? '+' : ''}${l.p}</em></div>`).join('')
    : `<p class="empty">${SL('아직 내역이 없어요. 해를 보면 햇살이 쌓여요.', 'Nothing yet. Watch a sunrise to earn sunlight.')}</p>`;
}
const SUN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
// 개발자 테스트: ?me=1로 기록에서 빠진 기기에서만 ?sun=500 처럼 햇살을 넣을 수 있음 (한 번 넣고 주소에서 지움)
(() => {
  try {
    const q = new URLSearchParams(location.search), n = Number(q.get('sun'));
    if (!q.has('sun') || localStorage.getItem('oneul-hae-optout') !== '1' || !Number.isFinite(n) || n <= 0) return;
    grant(Math.min(100000, Math.floor(n)));
    q.delete('sun'); q.delete('me');
    history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
    setTimeout(() => toast(SL(`테스트 햇살 ${n} 넣었어요`, `Added ${n} test sunlight`)), 1500);
  } catch { /* 무시 */ }
})();
$('sunChip').onclick = () => { calMonth = new Date(); calMonth.setDate(1); renderSunSheet(); open('sunSheet'); track('sun_open', { sun: sunTotal() }); };
$('calPrev').onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderSunSheet(); };
$('calNext').onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderSunSheet(); };
$('sunUses').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('[data-use]') as HTMLElement | null; if (!b) return;
  const u = b.dataset.use;
  if (u === 'wear') { close(); openWardrobe(); return; }
  if (u === 'lantern') { close(); openLanternShop(); return; }
  if (u === 'shield') { toast(SL('하루를 놓친 다음 날 들어오면 자동으로 물어봐요', "We'll offer it the day after you miss a sunrise")); return; }
  if (!isNight()) { toast(SL('밤에만 할 수 있어요 🌙', 'Only at night 🌙')); return; }
  close();
  if (u === 'jwibul') toggleJwibul(); else if (u === 'star') shootStar(); else if (u === 'fire') shootFire();
});

// ---------- 밤 ----------
/** 밤: 해가 지평선 4° 아래 + 해 뜨기 1분 전부터는 쉼 (해돋이를 가리지 않게) */
// 테스트용: 쥐불놀이를 낮에도 할 수 있게. 밤에만 되게 되돌리려면 false로
const JW_ANYTIME = true;
const canJwibul = () => JW_ANYTIME || isNight();
function isNight() {
  if (lastAltForBanner > -4 || lastAltForBanner < -89) return false;
  if (cycling()) return cycleToSunrise() > 60000;
  const sr = sunriseInfo(place, Date.now()).next;
  return !sr || sr - Date.now() > 60000;
}
let jwOn = false, jwSpeed = 7;
function setJwibul(on: boolean) {
  jwOn = on;
  const col = store.fireColor ?? 0;
  const mask = (outfitOf(me) & ~(JWIBUL | (3 << 14))) | (on ? JWIBUL | (col << 14) : 0);
  setOutfit(me, mask);
  if (connected) net.emit('outfit', mask);
  $('jwibulBtn').classList.toggle('on', on);
}
function toggleJwibul() {
  if (!jwOn && !canJwibul()) { toast(SL('밤에만 할 수 있어요 🌙', 'Only at night 🌙')); return; }
  if (!jwOn && mySeat !== null) standUp();
  setJwibul(!jwOn);
  if (jwOn) { jwSpeed = 7; toast(SL('화면을 톡톡 누르면 더 빨리 돌아요', 'Tap the screen to spin faster')); track('jwibul', { place: place.id }); }
}
$('jwibulBtn').onclick = toggleJwibul;
function shootStar() {
  if (!spend('star', PRICE.star)) { toast(SL(`햇살 ${PRICE.star}이 필요해요`, `Needs ${PRICE.star} sunlight`)); return; }
  sky.force();
  if (connected) net.emit('sky', 'star', 0, 0);
  track('night_star', { place: place.id });
}
function shootFire() {
  if (!spend('fire', PRICE.fire)) { toast(SL(`햇살 ${PRICE.fire}이 필요해요`, `Needs ${PRICE.fire} sunlight`)); return; }
  const x = me.root.position.x + (Math.random() - 0.5) * 30, c = Math.floor(Math.random() * FIRE_COLORS.length);
  nightFx.firework(x, c, ORIGIN);
  if (connected) net.emit('sky', 'fire', x, c);
  track('night_fire', { place: place.id });
}
const ORIGIN = new THREE.Vector3();
$('starBtn').onclick = shootStar;
$('fireBtn').onclick = shootFire;
net.on('sky', (id, kind, x, c) => {
  if (kind === 'star') sky.force(); else nightFx.firework(x, c, ORIGIN);
  const r = remotes.get(id);
  if (r) ticker(kind === 'star' ? SL(`${localizeNick(r.info.nick)}님이 별똥별을 띄웠어요`, `${localizeNick(r.info.nick)} sent a shooting star`) : SL(`${localizeNick(r.info.nick)}님이 불꽃을 쐈어요`, `${localizeNick(r.info.nick)} set off a firework`));
});
const canPos = new THREE.Vector3();
// 내 캐릭터를 톡 누르면 옷 입기 (옷 버튼 대신)
const tapRay = new THREE.Raycaster(), tapNdc = new THREE.Vector2();
let tapStart: { x: number; y: number; t: number } | null = null;
cvs.addEventListener('pointerdown', e => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
cvs.addEventListener('pointerup', e => {
  const t0 = tapStart; tapStart = null;
  if (!t0 || openSheet || Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 10 || performance.now() - t0.t > 450) return;
  // 쥐불놀이 중: 드래그는 평소처럼 시야 돌리기, 화면을 톡톡 누르면 깡통이 더 빨리 돎
  if (jwOn) { jwSpeed = Math.min(24, jwSpeed + 3.2); return; }
  tapNdc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  tapRay.setFromCamera(tapNdc, camera);
  if (tapRay.intersectObject(me.inner, true).length) { openWardrobe(); track('wear_tap_me'); }
});
function emitEmbers(c: Char) {
  const jw = c.inner.getObjectByName('jwibul');
  if (!jw?.visible) return;
  const can = jw.getObjectByName('can'); if (!can) return;
  can.getWorldPosition(canPos);
  const sp = (c.inner.userData.jwSpeed as number | undefined) ?? 7, col = jwColor(outfitOf(c));
  nightFx.ember(canPos, col, sp); nightFx.ember(canPos, col, sp);
}
function updateNight(dt: number) {
  const night = canJwibul(), show = night && !openSheet && !lying && sandK < 0.01;
  // 별똥별·불꽃은 피드백으로 뺌 (해돋이 보러 가서 불꽃놀이는 안 하니까) — 밤엔 쥐불놀이만
  { const el = $('jwibulBtn'); if (el.hidden === show) el.hidden = !show; }
  if (jwOn && !night) { setJwibul(false); }
  if (jwOn) { jwSpeed += (7 - jwSpeed) * Math.min(1, dt * 0.35); me.inner.userData.jwSpeed = jwSpeed; }
  emitEmbers(me);
  for (const r of remotes.values()) emitEmbers(r.c);
  nightFx.update(dt);
  updateSunChip();
}

// ---------- 풍등 꾸미기 ----------
let lsPick = { c: store.lantern?.c ?? 0, p: store.lantern?.p ?? 0 };
const lcPrice = (c: number) => (c === 0 ? 0 : c === 5 ? PRICE.lanternGold : PRICE.lanternColor);
const lpPrice = (p: number) => (p === 0 ? 0 : PRICE.lanternPattern);
const COLOR_NAMES: [string, string][] = [['기본 주황', 'Orange'], ['벚꽃 분홍', 'Pink'], ['하늘 파랑', 'Sky blue'], ['라벤더', 'Lavender'], ['청록', 'Teal'], ['금빛', 'Gold']];
const PAT_NAMES: [string, string][] = [['없음', 'None'], ['별', 'Stars'], ['꽃', 'Flowers'], ['복(福)', 'Luck (福)']];
function renderLanternShop() {
  const cOwn = (c: number) => c === 0 || owns(`lc:${c}`), pOwn = (p: number) => p === 0 || owns(`lp:${p}`);
  $('lsLantern').style.background = LANTERN_COLORS[lsPick.c];
  $('lsMarks').textContent = LANTERN_PATTERNS[lsPick.p] ? (LANTERN_PATTERNS[lsPick.p] + ' ').repeat(9) : '';
  $('lsColors').innerHTML = LANTERN_COLORS.map((hex, i) => `<button class="ls-c${lsPick.c === i ? ' on' : ''}" data-c="${i}" aria-label="${SL(COLOR_NAMES[i][0], COLOR_NAMES[i][1])}"><i style="background:${hex}"></i><small class="${cOwn(i) ? '' : 'price'}">${cOwn(i) ? SL('보유', 'Owned') : lcPrice(i)}</small></button>`).join('');
  $('lsPats').innerHTML = LANTERN_PATTERNS.map((m, i) => `<button class="tile${lsPick.p === i ? ' trying' : ''}" data-p="${i}" aria-pressed="${lsPick.p === i}"><i>${m || '–'}</i><span>${SL(PAT_NAMES[i][0], PAT_NAMES[i][1])}</span><small class="${pOwn(i) ? '' : 'price'}">${pOwn(i) ? SL('보유', 'Owned') : `${SL('햇살', 'Sun')} ${lpPrice(i)}`}</small></button>`).join('');
  const need = (cOwn(lsPick.c) ? 0 : lcPrice(lsPick.c)) + (pOwn(lsPick.p) ? 0 : lpPrice(lsPick.p));
  const same = lsPick.c === (store.lantern?.c ?? 0) && lsPick.p === (store.lantern?.p ?? 0);
  $('lsBuy').hidden = same && !need;
  $('lsBuyText').innerHTML = `<b>${SL(COLOR_NAMES[lsPick.c][0], COLOR_NAMES[lsPick.c][1])} · ${SL(PAT_NAMES[lsPick.p][0], PAT_NAMES[lsPick.p][1])}</b><small>${need ? SL(`내 햇살 ${sunTotal()}`, `You have ${sunTotal()}`) : SL('앞으로 올리는 풍등이 모두 이 모양', 'All your lanterns will look like this')}</small>`;
  const btn = $('lsBuyBtn') as HTMLButtonElement;
  btn.textContent = need ? `${SL('햇살', 'Sun')} ${need} ${SL('사기', 'Buy')}` : SL('이걸로 할게요', 'Use this');
  btn.disabled = need > sunTotal();
}
function openLanternShop() { lsPick = { c: store.lantern?.c ?? 0, p: store.lantern?.p ?? 0 }; renderLanternShop(); open('lanternShop'); track('lantern_shop_open'); }
$('lsColors').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-c]') as HTMLElement | null; if (b) { lsPick.c = +b.dataset.c!; renderLanternShop(); } });
$('lsPats').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-p]') as HTMLElement | null; if (b) { lsPick.p = +b.dataset.p!; renderLanternShop(); } });
$('lsBuyBtn').onclick = () => {
  const { c, p } = lsPick;
  if (c && !owns(`lc:${c}`) && !buy(`lc:${c}`, lcPrice(c))) { toast(SL('햇살이 모자라요', 'Not enough sunlight')); return; }
  if (p && !owns(`lp:${p}`) && !buy(`lp:${p}`, lpPrice(p))) { toast(SL('햇살이 모자라요', 'Not enough sunlight')); renderLanternShop(); return; }
  store.lantern = { c, p }; save(); renderLanternShop();
  toast(SL('다음 풍등부터 이 모양으로 올라가요 🏮', 'Your next lantern will look like this 🏮'));
  track('lantern_style', { c, p });
};

// ---------- 연속 기록 지키기 ----------
setTimeout(() => {
  const n = shieldOffer(); if (!n) return;
  markShieldAsked();
  $('shText').innerHTML = SL(`연속 기록이 <b>${n}일</b>에서 끊기려고 해요.<br>어제 칸을 햇살로 지킬까요?`, `Your <b>${n}-day</b> streak is about to break.<br>Use sunlight to save yesterday?`);
  $('shYes').textContent = `${SL('햇살', 'Sun')} ${PRICE.shield}${SL('으로 지키기', ' — save it')}`;
  ($('shYes') as HTMLButtonElement).disabled = sunTotal() < PRICE.shield;
  $('shLeft').textContent = sunTotal() < PRICE.shield ? SL(`햇살이 ${PRICE.shield - sunTotal()} 모자라요`, `${PRICE.shield - sunTotal()} more sunlight needed`) : SL(`한 달에 2번까지 · 이번 달 ${shieldsLeft()}번 남음`, `Twice a month · ${shieldsLeft()} left`);
  open('shieldSheet'); track('shield_offer', { streak: n });
}, 4500);
$('shYes').onclick = () => { if (useShield()) { close(); toast(SL(`연속 기록을 지켰어요 · ${streakCount()}일째`, `Streak saved · day ${streakCount()}`)); track('shield_use'); } };
$('shNo').onclick = () => close();

Object.assign(window, { __hae: { me, cam, camPos: camera.position, dummy: (x: number, z: number, g: number, mask: number, ry: number) => { const c = makeChar(0xffd65a, 0); setGrowth(c, g); setOutfit(c, mask); c.root.position.set(x, floorY(x, z), z); c.root.rotation.y = ry; scene.add(c.root); const tick = () => { animChar(c, 0.016); requestAnimationFrame(tick); }; tick(); }, magoTo: (x: number, z: number, ry: number) => { mago.root.position.set(x, floorY(x, z), z); mago.look(ry); mago.root.traverse(o => { if ((o as THREE.Sprite).isSprite) o.visible = false; }); }, skyAt: (ms: number | null) => setIntroSky(ms, 0), give: (id: string) => { const it = ITEMS.find(x => x.id === id); if (it) void giveItem(it); }, dayTitle: () => { store.titleDay = ''; showDayTitle(); }, feedNow: () => morningFeed(), feedLeft: () => feed.left, cafe: CAFE, dress: (m: number) => setOutfit(me, m), grow: (g: number) => { growLock = true; setGrowth(me, g); }, mago: () => magoTalk(false), magoPos: MAGO_AT, legend: (k: 'phoenix' | 'crane') => { const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0.08; d.normalize(); legends.fly(k, camera, d); }, hall: () => hallWrite(), crow: () => { lastCrow = 0; crow('test'); }, crane: () => hall.craneWorld(), talk: (g: number) => talk(T.growUp[g].map(([who, text]) => ({ who, text }))), birdDbg: () => birds.debug(), bird: (k: 'fromSun' | 'ribbon' | 'golden' | 'swallows' | 'murmur') => birds.spawn(k, camera, world.sunDir), ageLetter: () => { if (store.letter) { store.letter.day = '2000-01-01'; save(); } }, cheerState: () => ({ cheer, myCheers, w: cheerWindow() }), gag: () => ({ bub: me.root.userData.bubble ? (() => { const v = new THREE.Vector3(); me.root.userData.bubble.getWorldPosition(v); const p = v.clone().project(camera); return [Math.round((p.x + 1) / 2 * innerWidth), Math.round((1 - p.y) / 2 * innerHeight), me.root.userData.bubble.scale.x.toFixed(2), me.root.userData.bubble.visible, me.root.visible]; })() : null, lz: late.pos.z, late: late.busy, bubble: !!me.root.userData.bubble, cyc: cycling(), ph: cyclePhase(), peak: has.peak(place.id) }), project: (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, bots: () => bots.count, dogPos: () => [life.dogPos.x, life.dogPos.z], shot: (on: boolean) => { shotMode = on; }, view: (d: number, p: number, y: number) => setView(d, p, y), forceStar: () => sky.force(), shellsLeft: () => shells.left, castles: () => castles.count, remotes: () => remotes.size, connected: () => connected, seats: () => seats.map(s => s.occ), ghosts: () => traces.count, pos: me.root.position, today: () => stats?.today[place.id] ?? todayVisitors } });
