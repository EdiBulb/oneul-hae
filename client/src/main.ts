import * as THREE from 'three';
import './style.css';
import type { PlayerInfo, St, Stats } from '../../server/src/protocol';
import { animChar, disposeChar, faceAngle, makeChar, textSprite, turnTo, type Char } from './character';
import { createAmbience, fetchWeather, windLabel, type Weather } from './ambience';
import { createLanterns } from './lanterns';
import { connect } from './net';
import { BODY_COLORS, HAT_COLORS, PLACES, WISHES, type Place } from './places';
import { dateKey, markSeen, save, store, streakCount, wokeToday } from './store';
import { dayName, dur, hm, mmss, sunriseInfo, sunrises } from './sun';
import { createWorld, glowTexture, groundY } from './world';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
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
const seats = world.seats;

// ================= 상태 =================
let place: Place = PLACES[0];
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
const meLabel = textSprite('나', 0.75); meLabel.position.y = 1.9; me.root.add(meLabel);
const meLabelBase = meLabel.scale.clone();
const meRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32),
  new THREE.MeshBasicMaterial({ color: 0xffa14d, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
meRing.rotation.x = -Math.PI / 2; meRing.position.y = 0.03; me.root.add(meRing);
let mySeat: number | null = null;
$('myNick').textContent = store.nick;

// ================= 다른 사람들 (실시간) =================
interface Remote { info: PlayerInfo; c: Char; label: THREE.Sprite; tx: number; tz: number; ry: number; st: St }
const remotes = new Map<string, Remote>();
let myId = '';

function addRemote(p: PlayerInfo) {
  if (remotes.has(p.id)) return;
  const c = makeChar(BODY_COLORS[p.look.body % BODY_COLORS.length], HAT_COLORS[p.look.hat % HAT_COLORS.length]);
  c.root.position.set(p.x, groundY(p.z), p.z);
  c.root.rotation.y = p.ry;
  const label = textSprite(p.nick, 0.6); label.position.y = 1.85; c.root.add(label);
  scene.add(c.root);
  remotes.set(p.id, { info: p, c, label, tx: p.x, tz: p.z, ry: p.ry, st: p.st });
}
function removeRemote(id: string) {
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
    p.y = groundY(p.z) + (r.st === 2 ? 0.07 : 0);
    r.c.state = r.st === 2 ? 'sit' : (r.st === 1 || d > 0.05) ? 'walk' : 'idle';
    turnTo(r.c, r.ry, dt);
    animChar(r.c, dt);
    r.label.visible = camera.position.distanceTo(p) < 18;
  }
}

// ================= 서버 연결 =================
const net = connect();
let connected = false;
let stats: Stats | null = null;

function join() {
  net.emit('join', { place: place.id, uid: store.uid, nick: store.nick, look: store.look, woke: wokeToday() });
}
net.on('connect', () => { connected = true; $('conn').classList.remove('show'); join(); renderCounts(); });
net.on('disconnect', () => { connected = false; $('conn').classList.add('show'); clearRemotes(); renderCounts(); });
net.on('connect_error', () => { $('conn').classList.add('show'); });
$('conn').classList.add('show');

net.on('welcome', w => {
  if (w.place !== place.id) return;
  myId = w.id;
  clearRemotes();
  w.players.forEach(addRemote);
  seats.forEach(s => (s.occ = null));
  for (const [idx, id] of Object.entries(w.seats)) if (seats[+idx]) seats[+idx].occ = id;
  if (mySeat !== null) { seats[mySeat].occ = null; mySeat = null; me.state = 'idle'; }
  if (w.players.length === 0) ticker('지금은 나 혼자예요 · 친구를 불러 같이 봐요');
  else ticker(`${w.players.length}명이 먼저 와 있어요`);
});
net.on('joined', p => { addRemote(p); ticker(`${p.nick}님이 해변에 왔어요`); });
net.on('left', id => removeRemote(id));
net.on('tick', batch => {
  for (const [id, x, z, ry, st] of batch) {
    const r = remotes.get(id); // 내 위치도 묶음에 들어 있지만 remotes에 없으니 건너뜀
    if (!r) continue;
    r.tx = x; r.tz = z; r.ry = ry; r.st = st;
  }
});
net.on('emote', (id, e) => { const r = remotes.get(id); if (r) { r.c.emote = e; r.c.emoteT = 0; } });
net.on('lantern', (id, x, z) => {
  const r = remotes.get(id);
  lanterns.launch(new THREE.Vector3(x, groundY(z), z));
  if (r) ticker(`${r.info.nick}님이 풍등을 올렸어요`);
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
  const st: St = mySeat !== null ? 2 : me.state === 'walk' ? 1 : 0;
  const key = `${p.x.toFixed(2)},${p.z.toFixed(2)},${me.root.rotation.y.toFixed(2)},${st}`;
  if (t - lastSent < 125 || (key === lastSentKey && t - lastSent < 1000)) return;
  lastSent = t; lastSentKey = key;
  net.volatile.emit('s', +p.x.toFixed(2), +p.z.toFixed(2), +me.root.rotation.y.toFixed(2), st);
}

function renderCounts() {
  const online = stats?.online[place.id] ?? (connected ? remotes.size + 1 : 0);
  $('viewerCount').textContent = connected ? online.toLocaleString('ko-KR') : '연결 중…';
  $('viewerUnit').textContent = connected ? '명' : '';
  [...$('chips').children].forEach((el, i) => {
    const n = stats?.online[PLACES[i].id] ?? 0;
    (el.querySelector('em') as HTMLElement).textContent = n ? `${n}명` : '';
  });
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
  const k = clamp(cam.dist / 10, 1, 2.2);
  meLabel.scale.set(meLabelBase.x * k, meLabelBase.y * k, 1);
  meLabel.position.y = 1.9 + (k - 1) * 0.12;
  meRing.scale.setScalar(Math.min(3, 0.8 + cam.dist / 14));
  $('viewName').textContent = cam.tDist > 20 ? '전체 보기' : cam.tDist > 9 ? '3인칭' : '내 시점';
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
  if (ptrs.size === 1) { cam.tYaw -= dx * 0.007; cam.tPitch = clamp(cam.tPitch + dy * 0.005, 0.04, 1.35); }
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
    if (s.occ) return;
    const d = Math.hypot(s.x - me.root.position.x, s.z - me.root.position.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function standUp() {
  if (mySeat !== null) { seats[mySeat].occ = null; mySeat = null; net.emit('stand'); }
  me.state = 'idle';
}
function updateMe(dt: number) {
  readInput();
  const p = me.root.position, moving = Math.hypot(input.x, input.y) > 0.12;
  if (moving) {
    if (mySeat !== null) standUp();
    // 조이스틱 위쪽 = 카메라가 바라보는 방향
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = rx * input.x + fx * input.y, mz = rz * input.x + fz * input.y;
    const sp = 3.2 * dt;
    p.x = clamp(p.x + mx * sp, -22, 22); p.z = clamp(p.z + mz * sp, -1.6, 17);
    p.y = groundY(p.z); me.state = 'walk'; turnTo(me, faceAngle(mx, mz), dt);
  } else if (mySeat === null) me.state = 'idle';
  else turnTo(me, 0, dt);
  animChar(me, dt);
  $('sitBtn').textContent = mySeat !== null ? '일어나기' : nearestFreeSeat() !== null ? '방석에 앉기' : '방석 찾기';
}

// ================= 상단 문구 =================
let lastTickerAt = 0, lastWokeNote = 0;
function ticker(msg: string) { $('ticker').textContent = msg; lastTickerAt = performance.now(); }

function updateUI(now: number, alt: number, t: number) {
  const info = sunriseInfo(place, now), tz = place.tz, live = !replay && !!info.windowSR;
  $('liveDot').className = 'dot' + (live || replay ? '' : ' off');
  $('progress').style.display = replay ? 'block' : 'none';
  if (replay) {
    const k = Math.min(1, (Date.now() - replay.start) / replay.duration);
    $('progressBar').style.width = `${k * 100}%`;
    $('status').textContent = `다시보기 · ${dayName(replay.sr, tz)}`;
    $('headline').textContent = alt < -0.8 ? '곧 해가 떠요' : '해가 떴어요';
    $('sub').textContent = `${place.name} 일출 ${hm(replay.sr, tz)}`;
    if (k >= 1) { replay = null; if (markSeen('replay')) toast('다시보기로 오늘의 해를 봤어요'); }
  } else if (live) {
    const sr = info.windowSR!;
    $('status').innerHTML = `<span class="dot"></span>LIVE · ${place.name}${weatherNow ? ` · ${windLabel(weatherNow)}` : ''}`;
    if (now < sr) { $('headline').textContent = '곧 해가 떠요'; $('sub').textContent = `일출 ${hm(sr, tz)} · ${mmss(sr - now)} 남음`; }
    else { $('headline').textContent = '해가 떴어요'; $('sub').textContent = `${place.name} 일출 ${hm(sr, tz)}`; }
  } else {
    $('status').textContent = `${place.name} · 현지 ${hm(now, tz)}${weatherNow ? ` · ${windLabel(weatherNow)}` : ''}`;
    if (info.next) {
      $('headline').textContent = alt < -6 ? '아직 밤이에요' : info.last ? `오늘 해는 ${hm(info.last, tz)}에 떴어요` : '해가 떠 있어요';
      $('sub').textContent = `다음 해돋이 ${dayName(info.next, tz)} ${hm(info.next, tz)} · ${dur(info.next - now)} 남음`;
    }
  }
  // 해가 떠오르는 장면을 5초 이상 보면 오늘 기록
  if ((live || replay) && alt > 0.3) {
    if (!watchStart) watchStart = Date.now();
    if (live && !seenFlag && Date.now() - watchStart > 5000) {
      seenFlag = true;
      if (markSeen('live')) toast(`오늘의 해를 봤어요 · ${streakCount()}일째`);
    }
  }
  // 진짜 숫자만: 오늘 알람 끄고 온 사람
  const woke = stats?.woke[place.id] ?? 0;
  if (live && woke > 0 && t - lastWokeNote > 15000 && t - lastTickerAt > 5000) {
    lastWokeNote = t; ticker(`오늘 알람을 끄고 나온 사람 ${woke.toLocaleString('ko-KR')}명`);
  }
  if (connected && remotes.size === 0 && t - lastTickerAt > 20000) ticker('지금은 나 혼자예요 · 친구를 불러 같이 봐요');
}

// ================= 루프 =================
let lastT = performance.now(), lastUI = 0;
function loop(t: number) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const now = virtualNow();
  updateMe(dt);
  updateCamera(dt);
  const info = sunriseInfo(place, now);
  const ref = replay ? replay.sr : (info.windowSR ?? info.next ?? info.last ?? now);
  const alt = world.update(now, place, ref, camera, t);
  amb.setAlt(alt);
  updateRemotes(dt);
  lanterns.update(dt);
  sendState(t);
  if (t - lastUI > 250) { updateUI(now, alt, t); lastUI = t; }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ================= 채널 =================
const chips = $('chips');
PLACES.forEach(p => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.innerHTML = `${p.name}<span>${p.region}</span><em></em>`;
  b.setAttribute('aria-pressed', String(p === place));
  b.onclick = () => {
    if (place === p) return;
    place = p; replay = null; seenFlag = false; watchStart = 0;
    [...chips.children].forEach((c, i) => c.setAttribute('aria-pressed', String(PLACES[i] === p)));
    if (mySeat !== null) { mySeat = null; me.state = 'idle'; }
    seats.forEach(s => (s.occ = null));
    clearRemotes(); lanterns.clear(); world.buildLandmark(p); renderAlarm(); renderCounts(); refreshWeather();
    spawn();
    if (connected) join();
    toast(`${p.name}${p.id === 'gisborne' ? ' · 세계에서 가장 먼저 해가 뜨는 곳 중 하나' : ''}에 왔어요`);
  };
  chips.appendChild(b);
});

// ================= 버튼 =================
$('sitBtn').onclick = () => {
  if (mySeat !== null) { standUp(); return; }
  const idx = nearestFreeSeat();
  if (idx === null) { toast('빈 방석 가까이 가면 앉을 수 있어요'); return; }
  const sitHere = () => {
    const s = seats[idx];
    s.occ = 'me'; mySeat = idx; me.state = 'sit';
    me.root.position.set(s.x, groundY(s.z) + 0.07, s.z);
  };
  if (!connected) { sitHere(); return; }
  // 서버가 먼저 온 사람에게 방석을 준다
  net.emit('sit', idx, ok => { if (ok) sitHere(); else toast('방금 다른 사람이 앉았어요'); });
};
const doEmote = (e: 'stretch' | 'wave') => { me.emote = e; me.emoteT = 0; if (connected) net.emit('emote', e); };
$('stretchBtn').onclick = () => doEmote('stretch');
$('waveBtn').onclick = () => doEmote('wave');

$('zoomIn').onclick = () => setView(cam.tDist / 1.5);
$('zoomOut').onclick = () => setView(cam.tDist * 1.5, Math.max(cam.tPitch, 0.45));
$('overview').onclick = () => setView(26, 0.5, 0);
$('resetView').onclick = () => setView(6.4, 0.3, 0);

let openSheet: HTMLElement | null = null;
const back = $('sheetBack');
function open(id: string) { openSheet = $(id); openSheet.classList.add('open'); back.classList.add('open'); }
function close() { openSheet?.classList.remove('open'); back.classList.remove('open'); openSheet = null; }
back.onclick = close;
$('lanternBtn').onclick = () => open('wishSheet');
$('menuBtn').onclick = () => { renderStreak(); renderAlarm(); open('menuSheet'); };

let lastMyLantern = 0;
function releaseLantern(text: string) {
  if (performance.now() - lastMyLantern < 3000) { toast('풍등은 3초에 하나씩 올릴 수 있어요'); return; }
  lastMyLantern = performance.now();
  close();
  lanterns.launch(me.root.position, text);
  if (connected) net.emit('lantern', +me.root.position.x.toFixed(2), +me.root.position.z.toFixed(2));
  toast(`'${text}' 풍등을 올렸어요`);
}
WISHES.forEach(w => {
  const b = document.createElement('button');
  b.className = 'wish'; b.textContent = w;
  b.onclick = () => releaseLantern(w);
  $('wishes').appendChild(b);
});
const wishInput = $('wishInput') as HTMLInputElement;
wishInput.addEventListener('input', () => { $('wishCount').textContent = `${wishInput.value.length} / 24`; });
$('wishForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = wishInput.value.trim().replace(/\s+/g, ' ');
  if (!text) { toast('소원을 한 줄 적어 주세요'); return; }
  wishInput.value = ''; $('wishCount').textContent = '0 / 24'; wishInput.blur();
  // 직접 쓴 소원은 서버로 보내지 않으므로 다른 사람에게 노출되지 않는다
  releaseLantern(text);
});

$('replayBtn').onclick = () => {
  close();
  const now = Date.now(), info = sunriseInfo(place, now);
  replay = { sr: info.last ?? info.next!, start: now, duration: 45000, from: -30 * 60000, span: 55 * 60000 };
  watchStart = 0;
};
async function copy(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast(text); }
}
$('copyBtn').onclick = () => {
  const n = streakCount();
  copy(`☀ 오늘도 해 봤다 · ${place.name}${n ? ` · ${n}일째` : ''}\n${location.origin}`, '문구를 복사했어요');
};
$('inviteBtn').onclick = () => copy(`내일 아침 같이 해 보러 가요 ☀ ${location.origin}`, '초대 링크를 복사했어요');

let toastTimer = 0;
function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

// ================= 연속 기록 =================
function renderStreak() {
  const week = $('week'); week.innerHTML = '';
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 6; i >= 0; i--) {
    const t = Date.now() - i * 86400000, v = store.days[dateKey(t)];
    const el = document.createElement('div');
    el.className = 'day' + (i === 0 ? ' today' : '');
    el.innerHTML = `<i class="${v ?? ''}"></i>${i === 0 ? '오늘' : names[new Date(t).getDay()]}`;
    week.appendChild(el);
  }
  const n = streakCount();
  $('streakText').innerHTML = n ? `<span class="big">${n}일째</span><br>해를 보고 있어요` : '오늘 해를 보면<br>기록이 시작돼요';
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
  $('alarmBtn').textContent = on ? '알람 켜짐' : '알람 켜기';
  $('alarmText').innerHTML = on
    ? `<b>${dayName(a.at, tz)} ${hm(a.at, tz)}</b>에 깨워드릴게요<br>${place.name} 일출 ${hm(a.sr, tz)}`
    : `해 뜨기 5분 전 알람<br>다음은 <b>${hm(a.at, tz)}</b> · ${place.name}`;
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
  $('wakeText').innerHTML = waiting > 0
    ? `지금 <b>${place.name}</b> 해변에 <b>${waiting.toLocaleString('ko-KR')}명</b>이<br>먼저 나와 해를 기다리고 있어요.`
    : `<b>${place.name}</b> 해변의 첫 번째 사람이 되어 보세요.`;
  $('wake').dataset.demo = demo ? '1' : '0';
  $('wake').classList.add('open');
  chime(); clearInterval(ringTimer); ringTimer = window.setInterval(chime, 3200);
}
$('alarmBtn').onclick = () => {
  store.alarm.on = !store.alarm.on; save();
  if (store.alarm.on) { chime(); toast('알람을 켰어요 · 해 뜨기 5분 전에 울려요'); }
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
    if (connected) net.emit('woke');
  }
  toast('좋은 아침이에요 · 같이 해 봐요');
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
  if (isStandalone) { if (force) toast('이미 앱으로 열려 있어요'); return; }
  if (!force && store.installSnooze && Date.now() - store.installSnooze < SNOOZE) return;
  if (!force && !installEvent && !isIOS && !isKakao) return; // 설치를 지원하지 않는 브라우저면 조용히 넘어감
  const ios = $('installIos'), go = $('installGo');
  ios.hidden = true;
  if (isKakao) {
    // 카카오톡 안의 브라우저는 설치가 안 돼서, 기본 브라우저로 열어 줌
    $('installTitle').textContent = '브라우저에서 열어 설치해요';
    go.textContent = '브라우저로 열기';
  } else if (installEvent) {
    $('installTitle').textContent = '앱으로 설치할까요?';
    go.textContent = '설치하기';
  } else if (isIOS) {
    $('installTitle').textContent = '홈 화면에 추가할까요?';
    ios.hidden = false;
    go.textContent = '알겠어요';
  } else {
    $('installTitle').textContent = '홈 화면에 추가하기';
    go.textContent = '알겠어요';
    toast("브라우저 메뉴(⋮)에서 '홈 화면에 추가'를 눌러 주세요");
  }
  open('installSheet');
}
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e as InstallPromptEvent;
  if (store.hinted && !openSheet) setTimeout(() => showInstall(false), 3000);
});
addEventListener('appinstalled', () => { installEvent = null; close(); toast('설치됐어요 · 내일 아침 홈 화면에서 만나요'); });
$('installGo').onclick = async () => {
  if (isKakao) { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`; return; }
  if (installEvent) {
    const ev = installEvent; installEvent = null;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
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
  b.setAttribute('aria-label', store.soundOn ? '소리 끄기' : '소리 켜기');
}
$('soundBtn').onclick = () => {
  store.soundOn = !store.soundOn; save();
  amb.setOn(store.soundOn); renderSoundBtn();
  toast(store.soundOn ? `${place.name}의 소리를 켰어요` : '소리를 껐어요');
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
    title = others > 0 ? '같이 해를 봐 줘서 고마워요' : '오늘 해를 봐 줘서 고마워요';
    text = (others > 0 ? `<b>${place.name}</b>에서 <b>${others}명</b>과 함께 오늘의 해를 봤어요.<br>` : `<b>${place.name}</b>에서 오늘의 해를 봤어요.<br>`)
      + (n > 1 ? `벌써 <b>${n}일째</b>예요. 내일도 같이 봐요.` : '오늘 하루도 따뜻하게 보내요.');
  } else if (live && info.windowSR && Date.now() < info.windowSR) {
    title = '해가 곧 떠요!';
    text = `<b>${hm(info.windowSR, place.tz)}</b>에 해가 떠요. 조금만 더 있다 갈까요?`;
  } else {
    title = '와 줘서 고마워요';
    text = info.next
      ? `다음 해돋이는 <b>${dayName(info.next, place.tz)} ${hm(info.next, place.tz)}</b>이에요.<br>그때 해변에서 같이 봐요.`
      : '다음 해돋이에 다시 만나요.';
  }
  $('byeTitle').textContent = title;
  $('byeText').innerHTML = text;
  $('byeStay').textContent = live && !seenToday ? '해 뜨는 거 보고 갈게요' : '조금 더 있을게요';
  open('byeSheet');
}
function leave() {
  leaving = true;
  close();
  net.disconnect();
  amb.pause();
  $('goodbyeText').innerHTML = store.days[dateKey(Date.now())]
    ? '오늘 해를 같이 봐서 즐거웠어요.<br>내일 아침, 해변에서 다시 만나요.'
    : '내일 아침, 해변에서 다시 만나요.';
  $('goodbye').classList.add('open');
  // 이 사이트로 들어오기 전 페이지가 있으면 그쪽으로 돌아감 (없으면 작별 화면이 남아 있음)
  setTimeout(() => history.go(-2), 900);
}
$('exitBtn').onclick = openBye;
$('byeStay').onclick = close;
$('byeLeave').onclick = leave;
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
  if (openSheet?.id === 'byeSheet') { close(); return; }
  openBye();
});

// ================= 시작 =================
const askInstallSoon = () => setTimeout(() => { if (!openSheet) showInstall(false); }, 4000);
if (!store.hinted) $('hint').classList.add('open');
else askInstallSoon();
$('hintBtn').onclick = () => { $('hint').classList.remove('open'); store.hinted = true; save(); amb.unlock(); askInstallSoon(); };
world.buildLandmark(place);
renderStreak(); renderAlarm(); renderCounts();
requestAnimationFrame(loop);

// 테스트용 (브라우저 콘솔에서 확인)
Object.assign(window, { __hae: { remotes: () => remotes.size, connected: () => connected, seats: () => seats.map(s => s.occ) } });
