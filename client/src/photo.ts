// 지금 보고 있는 3D 화면을 사진으로: 화면 버튼(UI)은 빼고 장면만 찍은 뒤
// 아래에 장소·날짜·주소를 작게 새겨 넣는다.

let logo: HTMLImageElement | null = null;
function loadLogo() {
  if (logo) return Promise.resolve(logo);
  return new Promise<HTMLImageElement | null>(res => {
    const img = new Image();
    img.onload = () => { logo = img; res(img); };
    img.onerror = () => res(null);
    img.src = '/icon-192.png';
  });
}
loadLogo();

/** render()로 방금 그린 WebGL 캔버스를 같은 순간에 복사해야 빈 화면이 안 나온다 */
export function takePhoto(gl: HTMLCanvasElement, render: () => void, place: string, tz: string): Promise<Blob | null> {
  const W = gl.width, H = gl.height;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d')!;
  render();
  g.drawImage(gl, 0, 0);

  // 아래쪽 어둡게 깔고 글씨
  const u = W / 400; // 화면 폭 기준 크기
  const band = 64 * u;
  const grad = g.createLinearGradient(0, H - band * 1.6, 0, H);
  grad.addColorStop(0, 'rgba(10,10,25,0)'); grad.addColorStop(1, 'rgba(10,10,25,.62)');
  g.fillStyle = grad; g.fillRect(0, H - band * 1.6, W, band * 1.6);

  const now = new Date();
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const pad = 16 * u, ls = 30 * u;
  let x = pad;
  if (logo) { g.drawImage(logo, pad, H - pad - ls - 6 * u, ls + 6 * u, ls + 6 * u); x += ls + 16 * u; }
  g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  g.font = `700 ${15 * u}px 'Gowun Batang', serif`;
  g.fillText(`오늘의 해 · ${place}`, x, H - pad - 17 * u);
  g.fillStyle = 'rgba(255,255,255,.78)';
  g.font = `500 ${11 * u}px 'Pretendard', system-ui, sans-serif`;
  g.fillText(`${date} ${time} · hae.abracadelulu.com`, x, H - pad);

  return new Promise(res => out.toBlob(b => res(b), 'image/jpeg', 0.92));
}
