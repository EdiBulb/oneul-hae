import * as THREE from 'three';
import { animChar, disposeChar, faceAngle, itemOf, makeChar, outfitOf, setOutfit, textSprite, turnTo, wearSet, withItem, type Char } from './character';
import { ADJ, BODY_COLORS, HAT_COLORS, NOUN, localizeNick, pick } from './places';
import { SHOPS, SUMMIT, canStand, floorY, shopDoor } from './beach-extras';
import type { Seat } from './world';

// 해변을 채워 주는 가상 사용자.
// - 내 화면에만 있고 서버에는 없다 → 위쪽 인원수·통계에는 절대 들어가지 않는다
// - 방석에 앉아 있다가 가끔 기지개·손 흔들기, 풍등도 올린다
// - 진짜 사람이 와도 그대로 앉아 있다 (말없이 있는 사람처럼)

interface Bot { c: Char; label: THREE.Sprite; nick: string; seat: number; tag: string; nextLantern: number; nextEmote: number; walker?: Walk }
/** 산에서 돌아다니는 봇: 정상 전망대 ↔ 능선길 가게 (들고 나오기·의자에 앉기) */
interface Walk { gx: number; gz: number; goal: 'spot' | 'door' | 'seat'; seat: number; item: number; wait: number; stuck: number }
const rand = (a: number, b: number) => a + Math.random() * (b - a);
// 피드백: 유저가 가장 싫어하는 게 '봇' → 꺼 둠 (코드는 그대로, 다시 켜려면 4)
const MAX = 0;

export function createBots(opts: {
  scene: THREE.Scene;
  seats: Seat[];
  placeId: () => string;
  /** 방석이 없는 곳(경복궁 광장 등)에서는 서서 구경 */
  matsHere: () => boolean;
  /** 풍등을 올렸을 때 (위치, 소원 문구, 닉네임) */
  onLantern: (pos: THREE.Vector3, nick: string) => void;
  /** 곧 해가 뜨는지 (산에서 돌아다니던 봇들이 정상으로 모임) */
  sunSoon?: () => boolean;
}) {
  const { scene, seats } = opts;
  let bots: Bot[] = [];
  let seq = 0;
  const max = () => MAX;

  /** 방석(이름 없는 기본 자리)만, 이 장소에 있는 빈 자리 중에서 */
  function freeSeat(): number | null {
    const ids = seats.map((s, i) => i).filter(i => {
      const s = seats[i];
      return !s.occ && !s.kind && (!s.places || s.places.includes(opts.placeId() as never));
    });
    return ids.length ? pick(ids) : null;
  }

  function sitAt(b: Bot, idx: number) {
    const s = seats[idx];
    b.seat = idx; s.occ = b.tag;
    b.c.root.position.set(s.x, floorY(s.x, s.z) + 0.07, s.z);
    b.c.root.rotation.y = s.ry ?? 0;
    b.c.state = 'sit';
  }

  function add() {
    const standing = !opts.matsHere();
    const idx = standing ? -1 : freeSeat();
    if (idx === null) return;
    const c = makeChar(pick(BODY_COLORS), pick(HAT_COLORS));
    // 이 산의 병아리들이 모은 것들 (옷장에 뭐가 있는지 자연스럽게 보여 줌)
    let w = 0;
    if (Math.random() < 0.4) w = wearSet(w, 'head', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.35) w = wearSet(w, 'neck', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.3) w = wearSet(w, 'wing', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.4) w = wearSet(w, 'foot', 1);
    if (w) setOutfit(c, w);
    const nick = localizeNick(`${pick(ADJ)} ${pick(NOUN)}`);
    const label = textSprite(nick, 0.6); label.position.y = 1.58; c.root.add(label);
    scene.add(c.root);
    const now = performance.now();
    const b: Bot = { c, label, nick, seat: idx, tag: `bot:${seq++}`, nextLantern: now + rand(25000, 150000), nextEmote: now + rand(8000, 60000) };
    if (standing && opts.placeId() === 'jirisan') {
      // 정상 전망대에서 시작하거나, 능선길 어딘가에서 시작
      const top = Math.random() < 0.5, x = top ? rand(-4, 4) : rand(-1.2, 1.2), z = top ? rand(0.6, 2.2) : rand(8, 30);
      c.root.position.set(x, floorY(x, z), z); c.root.rotation.y = top ? 0 : Math.PI;
      c.state = 'idle';
      b.walker = { gx: x, gz: z, goal: 'spot', seat: -1, item: 0, wait: rand(2, 10), stuck: 0 };
    } else if (standing) {
      let x = rand(-10, 10), z = rand(-6, 9);
      for (let i = 0; i < 30 && !canStand(x, z); i++) { x = rand(-10, 10); z = rand(-6, 12); }
      c.root.position.set(x, floorY(x, z), z);
      c.root.rotation.y = rand(-0.5, 0.5); // 대충 궁궐 쪽을 보며 구경
      c.state = 'idle';
    } else sitAt(b, idx);
    for (let i = 0; i < 30; i++) animChar(c, 0.05);
    bots.push(b);
  }

  // ---------- 산에서 걷기 ----------
  function summitSpot(w: Walk) { w.gx = rand(-4.2, 4.2); w.gz = rand(0.7, 2.4); w.goal = 'spot'; w.seat = -1; }
  function nextGoal(b: Bot) {
    const w = b.walker!, r = Math.random();
    if (opts.sunSoon?.() || r < 0.45) { summitSpot(w); return; }
    if (r < 0.75) {
      // 가게 문 앞 → 들고 나옴
      const s = pick(SHOPS), [x, z] = shopDoor(s); w.gx = x; w.gz = z; w.goal = 'door'; w.item = s.item; return;
    }
    // 가게 의자·평상 (빈 곳)
    const ids = seats.map((s, i) => i).filter(i => seats[i].places?.includes('jirisan' as never) && (seats[i].kind === 'chair' || seats[i].kind === 'floor') && !seats[i].occ);
    if (!ids.length) { summitSpot(w); return; }
    const i = pick(ids), s = seats[i]; w.gx = s.sx ?? s.x; w.gz = s.sz ?? s.z; w.goal = 'seat'; w.seat = i;
  }
  function standUpBot(b: Bot) {
    if (b.seat >= 0 && seats[b.seat]?.occ === b.tag) seats[b.seat].occ = null;
    b.seat = -1; b.c.state = 'idle'; b.c.bench = false;
    const p = b.c.root.position; p.y = floorY(p.x, p.z);
  }
  function walkBot(b: Bot, dt: number) {
    const w = b.walker!, p = b.c.root.position;
    if (b.seat >= 0) { // 앉아 있는 중
      if ((w.wait -= dt) <= 0 || opts.sunSoon?.() || seats[b.seat]?.occ !== b.tag) {
        const s = seats[b.seat]; standUpBot(b); if (s?.sx !== undefined) { p.x = s.sx; p.z = s.sz!; p.y = floorY(p.x, p.z); }
        nextGoal(b);
      }
      return;
    }
    const dx = w.gx - p.x, dz = w.gz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.25) {
      b.c.state = 'idle';
      if (w.goal === 'door') {
        if (itemOf(outfitOf(b.c)) !== w.item) setOutfit(b.c, withItem(outfitOf(b.c), w.item));
        w.goal = 'spot'; w.wait = rand(1, 3);
      } else if (w.goal === 'seat') {
        const s = seats[w.seat];
        if (s && !s.occ) {
          s.occ = b.tag; b.seat = w.seat; b.c.state = 'sit'; b.c.bench = !!s.bench;
          p.set(s.x, s.bench ? s.y! : s.y! + 0.04, s.z); b.c.root.rotation.y = s.ry;
          w.wait = rand(20, 45); return;
        }
        nextGoal(b); return;
      }
      if ((w.wait -= dt) <= 0) { nextGoal(b); w.wait = rand(8, 25); }
      // 정상에 서 있을 땐 해 쪽을 바라봄
      if (p.z < SUMMIT.crestZ) turnTo(b.c, 0, dt);
      return;
    }
    // 목표로 걸어감 (막히면 옆으로 비켜 가고, 오래 막히면 목표를 바꿈)
    const sp = Math.min(d, 1.5 * dt), ux = dx / d, uz = dz / d;
    let nx = p.x + ux * sp, nz = p.z + uz * sp;
    if (!canStand(nx, nz)) {
      const side = Math.sin(b.c.phase) > 0 ? 1 : -1;
      nx = p.x - uz * sp * side; nz = p.z + ux * sp * side;
      if (!canStand(nx, nz)) { nx = p.x; nz = p.z; }
      if ((w.stuck += dt) > 3) { w.stuck = 0; summitSpot(w); }
    } else w.stuck = 0;
    p.x = nx; p.z = nz; p.y = floorY(nx, nz);
    b.c.state = 'walk'; turnTo(b.c, faceAngle(ux, uz), dt);
  }

  function remove(b: Bot) {
    if (b.seat >= 0 && seats[b.seat]?.occ === b.tag) seats[b.seat].occ = null;
    scene.remove(b.c.root); disposeChar(b.c);
    bots = bots.filter(x => x !== b);
  }

  function clear() { [...bots].forEach(remove); }
  /** 처음 들어왔을 때 이미 해변에 사람이 있는 것처럼 바로 채움 */
  function fill() {
    // 자리 정보가 새로 고쳐졌으면(재접속) 원래 앉아 있던 방석을 다시 차지
    for (const b of bots) if (b.seat >= 0 && !seats[b.seat]?.occ) seats[b.seat].occ = b.tag;
    while (bots.length < max() && (!opts.matsHere() || freeSeat() !== null)) add();
  }

  function update(dt: number, t: number, cam: THREE.Camera) {
    if (bots.length < max() && Math.random() < dt * 0.5) add(); // 빈 방석이 생기면 천천히 다시 채움
    for (const b of bots) {
      // 진짜 사람이 그 방석에 앉으면 다른 빈 방석으로 옮김
      if (b.walker) walkBot(b, dt);
      else if (b.seat >= 0 && seats[b.seat]?.occ !== b.tag) {
        const idx = freeSeat();
        if (idx === null) { remove(b); continue; }
        sitAt(b, idx);
      }
      if (t > b.nextEmote) {
        b.nextEmote = t + rand(40000, 120000);
        b.c.emote = Math.random() < 0.6 ? 'stretch' : 'wave'; b.c.emoteT = 0;
      }
      if (t > b.nextLantern) {
        b.nextLantern = t + rand(90000, 240000);
        opts.onLantern(b.c.root.position.clone(), b.nick); // 글자 없는 풍등
      }
      animChar(b.c, dt);
      b.label.visible = cam.position.distanceTo(b.c.root.position) < 18;
    }
  }

  /** 해가 뜨는 순간 다 같이 박수 */
  function clap() { for (const b of bots) { b.c.emote = itemOf(outfitOf(b.c)) ? 'raise' : 'clap'; b.c.emoteT = 0; } }

  return { update, clear, fill, clap, get count() { return bots.length; }, positions: () => bots.map(b => b.c.root.position) };
}
