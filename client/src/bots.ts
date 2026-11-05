import * as THREE from 'three';
import { animChar, disposeChar, makeChar, textSprite, type Char } from './character';
import { ADJ, BODY_COLORS, HAT_COLORS, NOUN, localizeNick, pick } from './places';
import { floorY } from './beach-extras';
import type { Seat } from './world';

// 해변을 채워 주는 가상 사용자.
// - 내 화면에만 있고 서버에는 없다 → 위쪽 인원수·통계에는 절대 들어가지 않는다
// - 방석에 앉아 있다가 가끔 기지개·손 흔들기, 풍등도 올린다
// - 진짜 사람이 와도 그대로 앉아 있다 (말없이 있는 사람처럼)

interface Bot { c: Char; label: THREE.Sprite; nick: string; seat: number; tag: string; nextLantern: number; nextEmote: number }
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const MAX = 4;

export function createBots(opts: {
  scene: THREE.Scene;
  seats: Seat[];
  placeId: () => string;
  /** 방석이 없는 곳(경복궁 광장 등)에서는 서서 구경 */
  matsHere: () => boolean;
  /** 풍등을 올렸을 때 (위치, 소원 문구, 닉네임) */
  onLantern: (pos: THREE.Vector3, nick: string) => void;
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
    const standing = !opts.matsHere();
    const idx = standing ? -1 : freeSeat();
    if (idx === null) return;
    const c = makeChar(pick(BODY_COLORS), pick(HAT_COLORS));
    const nick = localizeNick(`${pick(ADJ)} ${pick(NOUN)}`);
    const label = textSprite(nick, 0.6); label.position.y = 1.85; c.root.add(label);
    scene.add(c.root);
    const now = performance.now();
    const b: Bot = { c, label, nick, seat: idx, tag: `bot:${seq++}`, nextLantern: now + rand(25000, 150000), nextEmote: now + rand(8000, 60000) };
    if (standing) {
      const x = rand(-10, 10), z = rand(-6, 9);
      c.root.position.set(x, floorY(x, z), z);
      c.root.rotation.y = rand(-0.5, 0.5); // 대충 궁궐 쪽을 보며 구경
      c.state = 'idle';
    } else sitAt(b, idx);
    for (let i = 0; i < 30; i++) animChar(c, 0.05);
    bots.push(b);
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
    while (bots.length < MAX && (!opts.matsHere() || freeSeat() !== null)) add();
  }

  function update(dt: number, t: number, cam: THREE.Camera) {
    if (bots.length < MAX && Math.random() < dt * 0.5) add(); // 빈 방석이 생기면 천천히 다시 채움
    for (const b of bots) {
      // 진짜 사람이 그 방석에 앉으면 다른 빈 방석으로 옮김
      if (b.seat >= 0 && seats[b.seat]?.occ !== b.tag) {
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
  function clap() { for (const b of bots) { b.c.emote = 'clap'; b.c.emoteT = 0; } }

  return { update, clear, fill, clap, get count() { return bots.length; }, positions: () => bots.map(b => b.c.root.position) };
}
