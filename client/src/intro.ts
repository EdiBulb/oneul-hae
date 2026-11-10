// 인트로: 검은 화면 → 알이 흔들리다 톡 깨짐 → (처음이면) 어둠 속 속마음 → 눈꺼풀이 열리며 장터목 둥지가 보임

const $ = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 알이 깨지는 장면. 누르면 바로 깨짐. 처음 온 사람은 "톡 두드려 보세요" 안내 */
export async function hatch(first: boolean, tapHint: string): Promise<void> {
  const el = $('intro'), egg = $('introEgg'), hint = $('introHint');
  el.hidden = false; el.className = 'intro'; hint.textContent = tapHint; hint.hidden = true;
  let tapped = false; const onTap = () => { tapped = true; };
  el.addEventListener('pointerdown', onTap);
  egg.className = 'egg wobble';
  // 처음엔 조금 더 기다렸다가 안내, 다시 온 사람은 금방 깨짐
  const until = performance.now() + (first ? 4200 : 1100);
  if (first) setTimeout(() => { if (!tapped) hint.hidden = false; }, 1400);
  while (!tapped && performance.now() < until) await wait(60);
  hint.hidden = true; el.removeEventListener('pointerdown', onTap);
  egg.className = 'egg crack'; await wait(380);
  egg.className = 'egg open'; el.classList.add('burst'); await wait(first ? 900 : 650);
  el.classList.add('dark'); // 빛이 잦아들고 다시 어둠
  await wait(first ? 500 : 150);
}

/** 눈꺼풀이 열리며 화면이 보임 (깜빡 한 번) */
export async function openEyes(slow: boolean) {
  const el = $('intro');
  document.body.classList.add('waking');
  el.classList.add('lids', slow ? 'slow' : 'fast');
  await wait(slow ? 2300 : 900);
  el.hidden = true; el.className = 'intro';
  document.body.classList.remove('waking');
}
