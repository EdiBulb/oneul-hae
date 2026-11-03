import * as THREE from 'three';
import { animChar, disposeChar, makeChar, textSprite, type Char } from './character';
import { ADJ, BODY_COLORS, HAT_COLORS, NOUN, WISHES, localizeNick, pick } from './places';
import { floorY } from './beach-extras';
import type { Seat } from './world';

// 해변을 채워 주는 가상 사용자.
// - 내 화면에만 있고 서버에는 없다 → 위쪽 인원수·통계에는 절대 들어가지 않는다
// - 방석에 앉아 있다가 가끔 기지개·손 흔들기, 풍등도 올린다
// - 진짜 사람이 늘어나면 그만큼 하나씩 자리를 비운다

interface Bot { c: Char; label: THREE.Sprite; nick: string; seat: number; tag: string; nextLantern: number; nextEmote: number }
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX = 4;

export function createBots(opts: {
  scene: THREE.Scene;
  seats: Seat[];
  placeId: () => string;
  /** 풍등을 올렸을 때 (위치, 소원 문구, 닉네임) */
  onLantern: (pos: THREE.Vector3, wish: string | undefined, nick: string) => void;
}) {
  const { scene, seats } = opts;
  let bots: Bot[] = [];
  let seq = 0;

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
    const idx = freeSeat();
    if (idx === null) return;
    const c = makeChar(pick(BODY_COLORS), pick(HAT_COLORS));
    const nick = localizeNick(`${pick(ADJ)} ${pick(NOUN)}`);
    const label = textSprite(nick, 0.6); label.position.y = 1.85; c.root.add(label);
    scene.add(c.root);
    const now = performance.now();
    const b: Bot = { c, label, nick, seat: idx, tag: `bot:${seq++}`, nextLantern: now + rand(25000, 150000), nextEmote: now + rand(8000, 60000) };
    sitAt(b, idx);
    for (let i = 0; i < 30; i++) animChar(c, 0.05);
    bots.push(b);
  }

  function remove(b: Bot) {
    if (seats[b.seat]?.occ === b.tag) seats[b.seat].occ = null;
    scene.remove(b.c.root); disposeChar(b.c);
    bots = bots.filter(x => x !== b);
  }

  function clear() { [...bots].forEach(remove); }
  /** 처음 들어왔을 때 이미 해변에 사람이 있는 것처럼 바로 채움 */
  function fill(realOthers = 0) {
    // 자리 정보가 새로 고쳐졌으면(재접속) 원래 앉아 있던 방석을 다시 차지
    for (const b of bots) if (!seats[b.seat]?.occ) seats[b.seat].occ = b.tag;
    const want = Math.max(0, MAX - realOthers); while (bots.length < want && freeSeat() !== null) add(); }

  /** realOthers: 지금 이 해변에 있는 나 말고 진짜 사람 수 */
  function update(dt: number, t: number, realOthers: number, cam: THREE.Camera) {
    const want = Math.max(0, MAX - realOthers);
    if (bots.length < want && Math.random() < dt * 0.5) add();      // 천천히 하나씩 들어옴
    if (bots.length > want) remove(bots[bots.length - 1]);          // 진짜 사람이 오면 자리를 비켜 줌
    for (const b of bots) {
      // 진짜 사람이 그 방석에 앉으면 다른 빈 방석으로 옮김
      if (seats[b.seat]?.occ !== b.tag) {
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
        opts.onLantern(b.c.root.position.clone(), Math.random() < 0.6 ? pick(WISHES) : undefined, b.nick);
      }
      animChar(b.c, dt);
      b.label.visible = cam.position.distanceTo(b.c.root.position) < 18;
    }
  }

  /** 해가 뜨는 순간 다 같이 박수 */
  function clap() { for (const b of bots) { b.c.emote = 'clap'; b.c.emoteT = 0; } }

  return { update, clear, fill, clap, get count() { return bots.length; }, positions: () => bots.map(b => b.c.root.position) };
}
