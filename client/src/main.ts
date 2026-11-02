import * as THREE from 'three';
import './style.css';
import type { PlayerInfo, SandPost, St, Stats } from '../../server/src/protocol';
import { createSandBoard } from './sand-board';
import { animChar, disposeChar, faceAngle, makeChar, textSprite, turnTo, type Char, OUTFIT, setOutfit, outfitOf, showLeftFlowers } from './character';
import { createAmbience, fetchWeather, windLabel, type Weather } from './ambience';
import { initAnalytics, track } from './analytics';
import { createLanterns } from './lanterns';
import { createBeachLife } from './beach-life';
import { createTraces } from './traces';
import { benchAt, benchSeats, canStand, createBonfire, createFootprints, createPier, floorY, nightness, BONFIRE, createStones, onPier, surfaceAt, createJetties, hasPhotoSpots, PHOTO_SPOTS, setTerrain, has, RAMEN_MACHINE } from './beach-extras';
import { takePhoto } from './photo';
import { createCastles } from './castles';
import { createShells, PER_DAY, SHELLS } from './shells';
import { createSkyLife } from './skylife';
import { createPlaceScenery } from './place-scenery';
import { connect } from './net';
import { calendarUrl, canPush, initPush, schedulePush } from './reminder';
import { BODY_COLORS, HAT_COLORS, PLACES, WISHES, localizeNick, localizeWish, placeName, placeRegion, type Place, placeBlurb, placeRoute, type PlaceGroup } from './places';
import { T, applyHtml, lang, num, setLang } from './i18n';
import { dateKey, markSeen, save, store, streakCount, wokeToday } from './store';
import { dayName, dur, hm, mmss, sunriseInfo, sunrises } from './sun';
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
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 64 : 50; camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); onResize();

const GLOW = glowTexture();
const world = createWorld(scene, renderer, GLOW);
const lanterns = createLanterns(scene, GLOW);
// 해변 풍경(갈매기·강아지·동네 주민)은 인원수에 넣지 않는다
const life = createBeachLife(scene);
// 해변 강아지 이름 (해변마다 한 마리)
const DOG_NAMES: Record<string, [string, string]> = {
  jeongdongjin: ['해피', 'Happy'], seongsan: ['감귤', 'Gamgyul'], homigot: ['호두', 'Hodu'], gisborne: ['키위', 'Kiwi'],
  jumunjin: ['메밀', 'Memil'], hyangho: ['보리', 'Bori'], hangang: ['라면', 'Ramyeon'],
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
const virtualNow = () => {
  if (!replay) return Date.now();
  const k = Math.min(1, (Date.now() - replay.start) / replay.duration);
  return replay.sr + replay.from + k * replay.span;
};

// ================= 나 =================
const me = makeChar(BODY_COLORS[store.look.body], HAT_COLORS[store.look.hat]);
const spawn = () => { const z = 11 + Math.random() * 3; me.root.position.set((Math.random() * 2 - 1) * 7, groundY(z), z); };
spawn();
scene.add(me.root);
const meLabel = textSprite(T.me, 0.75); meLabel.position.y = 1.9; me.root.add(meLabel);
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
  const label = textSprite(localizeNick(p.nick), 0.6); label.position.y = 1.85; c.root.add(label);
  c.blanket.visible = !!p.blanket;
  if (p.outfit) setOutfit(c, p.outfit);
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
  return n > 0 ? T.aloneVisited(n) : T.alone;
}

function join() {
  net.emit('join', { place: place.id, uid: store.uid, nick: store.nick, look: store.look, woke: wokeToday() });
}
net.on('connect', () => { connected = true; $('conn').classList.remove('show'); join(); renderCounts(); });
net.on('disconnect', () => {
  life.setDog(null); connected = false; $('conn').classList.add('show'); clearRemotes(); renderCounts(); });
net.on('connect_error', () => { $('conn').classList.add('show'); });
$('conn').classList.add('show');

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
  traces.set(w.traces);
  sandPosts = w.board ?? []; renderSandLabel(); if (sandOpen) renderSand();
  todayVisitors = w.traces.visitors;
  if (w.players.length > 0) ticker(T.alreadyHere(w.players.length));
  else ticker(aloneMsg());
});
net.on('joined', p => { addRemote(p); ticker(T.joined(localizeNick(p.nick))); });
net.on('left', id => removeRemote(id));
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
net.on('lantern', (id, x, z, text) => {
  const r = remotes.get(id);
  // 공개된 소원이고, 내가 '다른 사람 소원 보기'를 켜 두었을 때만 글자를 띄움
  const wish = text && store.seeWishes ? localizeWish(text) : undefined;
  lanterns.launch(new THREE.Vector3(x, groundY(z), z), wish, true);
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
  $('placeBtnCount').textContent = connected ? `· ${T.hereNow(online)}` : '';
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
const DIST_MIN = 3, DIST_MAX = 46;
function setView(d: number, pitch?: number, yaw?: number) {
  cam.tDist = clamp(d, DIST_MIN, DIST_MAX);
  if (pitch !== undefined) cam.tPitch = pitch;
  if (yaw !== undefined) cam.tYaw = yaw;
}
const camLook = new THREE.Vector3(0, 1.5, 0), target = new THREE.Vector3(), want = new THREE.Vector3();
const eye = { yaw: 0, pitch: 0.95, tYaw: 0, tPitch: 0.95 };
let eyeK = 0;
const eyePos = new THREE.Vector3(), eyeLook = new THREE.Vector3(), lookTmp = new THREE.Vector3();
function updateCamera(dt: number) {
  const e = 1 - Math.pow(0.004, dt);
  cam.yaw += (cam.tYaw - cam.yaw) * e; cam.pitch += (cam.tPitch - cam.pitch) * e; cam.dist += (cam.tDist - cam.dist) * e;
  const p = me.root.position;
  target.set(p.x, p.y + (mySeat !== null ? 1.0 : 1.3), p.z);
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    target.x + Math.sin(cam.yaw) * cp * cam.dist,
    Math.max(0.6, target.y + Math.sin(cam.pitch) * cam.dist),
    target.z + Math.cos(cam.yaw) * cp * cam.dist);
  // 가까이에선 수평선을, 멀리선 앞쪽 해변 전체를 바라봄
  const close = clamp((12 - cam.dist) / 9, 0, 1), far = clamp((cam.dist - 9) / 18, 0, 1);
  const ahead = 9 * close + cam.dist * 0.75 * far;
  want.set(target.x - Math.sin(cam.yaw) * ahead, target.y + 0.3 * close, target.z - Math.cos(cam.yaw) * ahead);
  camLook.lerp(want, 1 - Math.pow(0.02, dt));
  camera.lookAt(camLook);
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
    me.inner.localToWorld(eyePos.set(0, 1.17, -0.46));
    const yaw = me.root.rotation.y + eye.yaw, cp = Math.cos(eye.pitch);
    eyeLook.set(eyePos.x - Math.sin(yaw) * cp * 10, eyePos.y + Math.sin(eye.pitch) * 10, eyePos.z - Math.cos(yaw) * cp * 10);
    camera.position.lerp(eyePos, k);
    lookTmp.copy(camLook).lerp(eyeLook, k);
    camera.lookAt(lookTmp);
  }
  meLabel.visible = meRing.visible = eyeK < 0.4 && !shotMode;
  const k = clamp(cam.dist / 10, 1, 2.2);
  meLabel.scale.set(meLabelBase.x * k, meLabelBase.y * k, 1);
  meLabel.position.y = 1.9 + (k - 1) * 0.12;
  meRing.scale.setScalar(Math.min(3, 0.8 + cam.dist / 14));
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
  else if (ptrs.size === 1) { cam.tYaw -= dx * 0.007; cam.tPitch = clamp(cam.tPitch + dy * 0.005, 0.04, 1.35); }
  else if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()];
    setView(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)));
  }
});
const ptrEnd = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
cvs.addEventListener('pointerup', ptrEnd); cvs.addEventListener('pointercancel', ptrEnd);
cvs.addEventListener('wheel', e => { e.preventDefault(); setView(cam.tDist * (1 + e.deltaY * 0.0012)); }, { passive: false });

// ================= 내 캐릭터 이동 =================
function nearestFreeSeat(): number | null {
  let best: number | null = null, bd = 2.6;
  seats.forEach((s, i) => {
    if (s.occ || (s.places && !s.places.includes(place.id))) return;
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
    lying = false;
    // 조이스틱 위쪽 = 카메라가 바라보는 방향
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = rx * input.x + fx * input.y, mz = rz * input.x + fz * input.y;
    const sp = 3.2 * dt;
    // 갈 수 있는 곳만: 막히면 벽을 따라 미끄러지듯
    const nx = p.x + mx * sp, nz = p.z + mz * sp;
    if (canStand(nx, nz)) { p.x = nx; p.z = nz; }
    else if (canStand(nx, p.z)) p.x = nx;
    else if (canStand(p.x, nz)) p.z = nz;
    p.y = floorY(p.x, p.z); me.state = 'walk'; turnTo(me, faceAngle(mx, mz), dt);
    const surf = prints.step('me', p.x, p.z, me.root.rotation.y);
    if (surf) amb.step(surf === 'grass' ? 'sand' : surf);
  } else if (mySeat === null) {
    me.state = lying ? 'lie' : 'idle';
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
  $('sitBtn').textContent = mySeat !== null || lying ? T.standUp : near !== null ? (seats[near].kind === 'log' ? T.sitLog : seats[near].kind === 'pier' ? T.sitPier : seats[near].kind === 'bus' ? T.sitBench : T.sitDown) : T.findSeat;
}

// ================= 상단 문구 =================
let lastTickerAt = 0, lastWokeNote = 0;
/** 해변 소식: 잠깐 떴다가 4초 뒤 스르르 사라짐 (화면을 가리지 않도록) */
let tickerTimer = 0;
function ticker(msg: string) {
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

function updateUI(now: number, alt: number, t: number) {
  const info = sunriseInfo(place, now), tz = place.tz, live = !replay && !!info.windowSR, pn = placeName(place);
  const wx = weatherNow ? ` · ${windLabel(weatherNow)}` : '';
  $('liveDot').className = 'dot' + (live || replay ? '' : ' off');
  $('progress').style.display = replay ? 'block' : 'none';
  // 해가 지평선을 넘는 순간, 해 뜨기 1분 전에는 자동으로 펼침
  if (lastAltForBanner < 0 && alt >= 0 && (live || replay)) expandBanner(10000);
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
    if (k >= 1) { replay = null; track('replay_finished', { place: place.id }); if (markSeen('replay')) { toast(T.replaySeen); track('sunrise_seen', { place: place.id, kind: 'replay', streak: streakCount() }); } }
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
  } else {
    full = `${T.localTime(pn, hm(now, tz))}${wx}`;
    compact = info.next ? T.nextCompact(pn, hm(info.next, tz), dur(info.next - now)) : pn;
    if (info.next) {
      $('headline').textContent = alt < -6 ? T.night : info.last ? T.roseAt(hm(info.last, tz)) : T.sunUp;
      $('sub').textContent = T.nextSunrise(dayName(info.next, tz), hm(info.next, tz), dur(info.next - now));
    }
  }
  const expanded = Date.now() < expandedUntil;
  $('center').classList.toggle('collapsed', !expanded);
  $('status').innerHTML = expanded ? full : `${compact}<span class="chev">▾</span>`;
  // 해가 떠오르는 장면을 5초 이상 보면 오늘 기록
  if ((live || replay) && alt > 0.3) {
    if (!watchStart) watchStart = Date.now();
    if (live && !seenFlag && Date.now() - watchStart > 5000) {
      seenFlag = true;
      if (markSeen('live')) { toast(T.liveSeen(streakCount())); track('sunrise_seen', { place: place.id, kind: 'live', streak: streakCount(), others: remotes.size }); }
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
function loop(t: number) {
  const realDt = Math.min(0.5, (t - lastT) / 1000), dt = Math.min(0.05, realDt); lastT = t;
  const now = virtualNow();
  updateMe(dt);
  updateCamera(dt);
  const info = sunriseInfo(place, now);
  const ref = replay ? replay.sr : (info.windowSR ?? info.next ?? info.last ?? now);
  const alt = world.update(now, place, ref, camera, t);
  amb.setAlt(alt);
  updateRemotes(dt);
  lanterns.update(dt);
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
  scenery.update(dt, t, night);
  updateRamen(t);
  updateSparkles(dt);
  if (sky.update(dt, t, alt, camera, lying)) showStarWish();
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
const GROUPS: [PlaceGroup, () => string][] = [['sunrise', () => T.groupSunrise], ['kcontent', () => T.groupKcontent], ['seoul', () => T.groupSeoul]];
const ICON: Record<string, string> = { jeongdongjin: '🚉', seongsan: '🌋', homigot: '✋', gisborne: '🌏', jumunjin: '💐', hyangho: '🚏', hangang: '🍜' };
function renderPlaceList() {
  $('placeList').innerHTML = GROUPS.map(([g, label]) => {
    const rows = PLACES.filter(p => p.group === g).map(p => {
      const n = stats?.online[p.id] ?? 0;
      return `<button class="place-row" data-id="${p.id}" aria-current="${p === place}"><i class="pi">${ICON[p.id] ?? '📍'}</i><span class="pt"><b>${placeName(p)}<small>${placeRegion(p)}</small></b><span>${placeBlurb(p)}</span></span><em>${n ? T.hereNow(n) : ''}</em></button>`;
    }).join('');
    return rows ? `<div class="place-group"><h3>${label()}</h3>${rows}</div>` : '';
  }).join('');
}
$('placeBtn').onclick = () => { renderPlaceList(); open('placeSheet'); track('place_picker_opened', { place: place.id }); };
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
  clearRemotes(); lanterns.clear(); traces.clear(); prints.clear(); castles.clear(); world.buildLandmark(p); applyTerrain(p);
  history.replaceState(history.state, '', `/${p.id}${location.search}`); placeShells(); renderAlarm(); renderCounts(); refreshWeather();
  spawn();
  if (connected) join();
  expandBanner();
  toast(T.arrived(placeName(p), p.id === 'gisborne'));
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
    me.root.position.set(s.x, s.bench ? s.y! : groundY(s.z) + 0.07, s.z);
  };
  if (!connected) { sitHere(); return; }
  // 서버가 먼저 온 사람에게 방석을 준다
  net.emit('sit', idx, ok => { if (ok) { sitHere(); track('sat_down', { place: place.id, spot: seats[idx].kind ?? 'cushion' }); } else toast(T.seatTaken); });
};
const doEmote = (e: 'stretch' | 'wave' | 'cheers' | 'clap') => { me.emote = e; me.emoteT = 0; if (connected) net.emit('emote', e); track('emote', { type: e }); };
$('stretchBtn').onclick = () => doEmote('stretch');
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
  if (surfaceAt(p.x, p.z) !== 'sand' || onPier(p.x, p.z)) { toast(T.lieNo); return; }
  lying = true; eyeView = true; lieSince = performance.now(); me.state = 'lie'; me.emote = null;
  eye.yaw = eye.tYaw = 0; eye.pitch = eye.tPitch = 0.95;
  // 누우면 카메라를 낮춰 하늘이 화면 가득 들어오게
  setView(5.5, 0.12, me.root.rotation.y + 1.1); // 비스듬히 옆에서: 누운 모습과 하늘·바다가 같이 보이게
  toast(T.lieHint);
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
function open(id: string) { openSheet = $(id); openSheet.classList.add('open'); back.classList.add('open'); }
function close() {
  // 모래에 쓰다가 닫으면 모래 위 미리보기도 지움
  if (openSheet?.id === 'sandSheet') { $('sandPreview').hidden = true; $('sand').classList.remove('previewing'); }
  openSheet?.classList.remove('open'); back.classList.remove('open', 'over-sand'); openSheet = null;
}
back.onclick = close;
$('lanternBtn').onclick = () => open('wishSheet');

// ================= 사진 =================
let photoUrl = '', photoBlob: Blob | null = null;
$('photoBtn').onclick = async () => {
  meRing.visible = false;
  const blob = await takePhoto(renderer.domElement, () => renderer.render(scene, camera), placeName(place), place.tz);
  meRing.visible = true;
  if (!blob) { toast(T.photoFail); return; }
  const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = blob; photoUrl = URL.createObjectURL(blob);
  ($('photoImg') as HTMLImageElement).src = photoUrl;
  const name = `${T.photoFile}-${placeName(place)}-${new Date().toISOString().slice(0, 10)}.jpg`;
  const save = $('photoSave') as HTMLAnchorElement; save.href = photoUrl; save.download = name;
  const file = new File([blob], name, { type: 'image/jpeg' });
  $('photoShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  open('photoSheet');
  track('photo_taken', { place: place.id });
};
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
  lanterns.launch(me.root.position, text);
  // 고른 소원은 함께 보여 주고, 직접 쓴 소원은 '다른 사람에게도 보여주기'를 체크했을 때만 서버로 보낸다
  const shared = !custom || store.shareWish;
  if (connected) net.emit('lantern', +me.root.position.x.toFixed(2), +me.root.position.z.toFixed(2), shared ? text : undefined);
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

$('replayBtn').onclick = () => {
  close();
  const now = Date.now(), info = sunriseInfo(place, now);
  replay = { sr: info.last ?? info.next!, start: now, duration: 45000, from: -30 * 60000, span: 55 * 60000 };
  watchStart = 0; expandBanner(4000);
};
async function copy(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast(text); }
}
$('copyBtn').onclick = () => {
  track('share_copied', { streak: streakCount() });
  const n = streakCount();
  copy(`${T.sawToday(placeName(place), n)}\n${location.origin}`, T.copied);
};
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
  const n = streakCount();
  $('streakText').innerHTML = n ? T.streak(n) : T.streakEmpty;
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
$('demoBtn').onclick = () => {
  close();
  const info = sunriseInfo(place, Date.now());
  openWake((info.last ?? info.next!) - 5 * 60000, true);
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
  if (store.hinted && !openSheet) setTimeout(() => showInstall(false), 3000);
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
$('installMenuBtn').onclick = () => { close(); setTimeout(() => showInstall(true), 300); };

// ================= 후원 =================
// Vercel 환경 변수 VITE_SUPPORT_URL에 후원 페이지 주소를 넣으면 메뉴에 버튼이 나타남
const SUPPORT_URL: string | undefined = import.meta.env.VITE_SUPPORT_URL;
// 카카오페이 송금코드 (한국 사용자용). 바꾸면 public/kakaopay-qr.png도 다시 만들어야 함
const KAKAOPAY_URL: string = import.meta.env.VITE_KAKAOPAY_URL ?? 'https://qr.kakaopay.com/FT8ClKPN7';
if (KAKAOPAY_URL) {
  $('supportBlock').hidden = false;
  const k = $('kakaoBtn') as HTMLAnchorElement;
  k.href = KAKAOPAY_URL; k.hidden = false;
  // 마우스로 보는 컴퓨터에서만 QR 표시 (폰에서는 버튼을 누르면 바로 카카오페이가 열림)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) $('kakaoQr').hidden = false;
}
if (SUPPORT_URL) {
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
const askInstallSoon = () => setTimeout(() => { if (!openSheet) showInstall(false); }, 4000);
if (!store.hinted) $('hint').classList.add('open');
else { askInstallSoon(); expandBanner(); }
$('hintBtn').onclick = () => { $('hint').classList.remove('open'); store.hinted = true; save(); amb.unlock(); expandBanner(); askInstallSoon(); };
world.buildLandmark(place);
applyTerrain(place);
renderStreak(); renderAlarm(); renderCounts();
requestAnimationFrame(loop);

// 테스트용 (브라우저 콘솔에서 확인)
// ================= 별똥별 · 조개 · 모래성 =================
let starTimer = 0;
function showStarWish() {
  const b = $('starWish'); b.hidden = false;
  clearTimeout(starTimer); starTimer = window.setTimeout(() => (b.hidden = true), 8000);
  track('shooting_star', { place: place.id, lying });
}
$('starWish').onclick = () => { $('starWish').hidden = true; open('wishSheet'); track('star_wish', { place: place.id }); };

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
  $('routeBtn').hidden = !placeRoute(p);
  // 라면은 그 장소에서만: 다른 곳으로 가면 내려놓음
  if (outfitOf(me) & OUTFIT.ramen) setRamen(false);
}
const OUTFIT_BTNS: [string, number][] = [['ofSweat', OUTFIT.sweat], ['ofScarf', OUTFIT.scarf], ['ofFlowers', OUTFIT.flowers]];
function renderOutfit() { OUTFIT_BTNS.forEach(([id, bit]) => $(id).setAttribute('aria-pressed', String(!!((store.outfit ?? 0) & bit)))); }
setOutfit(me, store.outfit ?? 0);
OUTFIT_BTNS.forEach(([id, bit]) => {
  $(id).onclick = () => {
    store.outfit = (store.outfit ?? 0) ^ bit; save();
    setOutfit(me, store.outfit | (outfitOf(me) & OUTFIT.ramen)); renderOutfit();
    if (connected) net.emit('outfit', outfitOf(me));
    track('outfit', { place: place.id, mask: store.outfit });
  };
});
$('outfitBtn').onclick = () => { renderOutfit(); open('outfitSheet'); };
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
    if (handoff.aId === myId) { store.outfit = outfitOf(me) & ~OUTFIT.ramen; save(); toast(T.gave); }
    if (handoff.bId === myId) { store.outfit = outfitOf(me) & ~OUTFIT.ramen; save(); toast(T.got); }
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

Object.assign(window, { __hae: { dogPos: () => [life.dogPos.x, life.dogPos.z], shot: (on: boolean) => { shotMode = on; }, view: (d: number, p: number, y: number) => setView(d, p, y), forceStar: () => sky.force(), shellsLeft: () => shells.left, castles: () => castles.count, remotes: () => remotes.size, connected: () => connected, seats: () => seats.map(s => s.occ), ghosts: () => traces.count, pos: me.root.position, today: () => stats?.today[place.id] ?? todayVisitors } });
