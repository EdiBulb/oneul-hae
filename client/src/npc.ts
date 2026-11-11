// NPC 공통 틀: 가까이 가면 '💬 이름' 버튼 하나, 머리 위엔 가끔 한 줄 혼잣말, 누르면 그 NPC의 대화.
// 대화 내용(퀘스트 단계에 따라 바뀌는 것)은 각 NPC의 talk()가 정하고, 여기서는 '누가 가까운지'와 '보여 주기'만 맡음.
import * as THREE from 'three';
import { textSprite } from './character';
import { addSpeaker, talking } from './talk';

export interface NpcDef {
  id: string;
  /** 대화창 이름 [한국어, 영어] + 목소리 높이 (톡톡 소리) */
  name: [string, string];
  pitch: number;
  root: THREE.Object3D;
  /** 머리 위 혼잣말 높이 */
  head: number;
  /** 이 장소에서만 보임 */
  place?: string;
  /** 대화 버튼이 뜨는 거리 (기본 3) */
  talkR?: number;
  /** 지금 보일지 (밤에만 나오는 도깨비 등) */
  visible?: () => boolean;
  /** 머리 위에 띄울 짧은 혼잣말 후보 (없으면 조용). 매번 한 줄씩 돌아가며 */
  idle?: () => string[];
  /** 말 걸 거리가 있을 때 머리 위 💬 (퀘스트 단계가 바뀌었을 때 등) */
  hasNews?: () => boolean;
  /** 눌렀을 때 대화 (퀘스트 진행은 여기서) */
  talk: () => Promise<void>;
  update?: (dt: number, t: number) => void;
}

export function createNpcs(opts: { scene: THREE.Scene; me: () => THREE.Vector3; place: () => string; btn: HTMLButtonElement; blocked: () => boolean; lang: () => 'ko' | 'en' }) {
  const list: (NpcDef & { bubble: THREE.Sprite | null; bubbleT: number; idleN: number; news: THREE.Sprite })[] = [];
  let near: (typeof list)[number] | null = null, busy = false;
  const label = (n: NpcDef) => n.name[opts.lang() === 'ko' ? 0 : 1];

  opts.btn.onclick = async () => {
    if (!near || busy || talking()) return;
    const n = near; busy = true; opts.btn.hidden = true; clearBubble(n);
    try { await n.talk(); } finally { busy = false; }
  };
  function clearBubble(n: (typeof list)[number]) { if (n.bubble) { n.root.remove(n.bubble); n.bubble.material.map?.dispose(); n.bubble.material.dispose(); n.bubble = null; } }

  return {
    add(def: NpcDef) {
      addSpeaker(def.id, def.name, def.pitch);
      const news = textSprite('💬', 0.8); news.position.y = def.head + 0.45; news.visible = false; def.root.add(news);
      list.push({ ...def, bubble: null, bubbleT: 3 + Math.random() * 4, idleN: Math.floor(Math.random() * 5), news });
    },
    get busy() { return busy; },
    /** 지금 대화 버튼이 가리키는 NPC */
    get near() { return near?.id ?? null; },
    update(dt: number, t: number) {
      const p = opts.me(), place = opts.place();
      let best: (typeof list)[number] | null = null, bestD = Infinity;
      for (const n of list) {
        const on = (!n.place || n.place === place) && (n.visible?.() ?? true);
        n.root.visible = on; if (!on) { clearBubble(n); continue; }
        n.update?.(dt, t);
        const d = Math.hypot(p.x - n.root.position.x, p.z - n.root.position.z);
        if (d < (n.talkR ?? 3) && d < bestD) { best = n; bestD = d; }
        n.news.visible = !busy && !!n.hasNews?.();
        n.news.position.y = n.head + 0.45 + Math.sin(t * 3) * 0.05;
        // 혼잣말: 가까이(9m 안) 있을 때만. 4.5초 보이고, 7~10초 쉼. 대화 중엔 안 함
        n.bubbleT -= dt;
        if (n.bubbleT <= 0) {
          if (n.bubble) { clearBubble(n); n.bubbleT = 7 + Math.random() * 3; }
          else {
            const lines = d < 9 && !busy && !talking() ? n.idle?.() ?? [] : [];
            if (lines.length) { const s = textSprite(lines[n.idleN++ % lines.length], 0.7); s.position.y = n.head + (n.news.visible ? 0.95 : 0.35); n.root.add(s); n.bubble = s; n.bubbleT = 4.5; }
            else n.bubbleT = 7 + Math.random() * 3;
          }
        }
        if (n.bubble && (busy || talking())) { clearBubble(n); n.bubbleT = 7; }
      }
      near = best;
      const show = !!best && !busy && !opts.blocked();
      if (show) { const txt = label(best!); if (opts.btn.textContent !== txt) opts.btn.textContent = txt; }
      if (opts.btn.hidden === show) opts.btn.hidden = !show;
    },
  };
}
