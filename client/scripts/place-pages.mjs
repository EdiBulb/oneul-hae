// 빌드 후 해변별 페이지 만들기: dist/<해변>/index.html
// 앱은 그대로이고, 링크 미리보기(제목·설명·이미지)와 대표 주소만 해변마다 다르게 바꾼다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SITE = 'https://hae.abracadelulu.com';
const PAGES = {
  jeongdongjin: { lang: 'ko', title: '정동진 · 오늘의 해, 온라인 해돋이', desc: '강릉 정동진 해변에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
  jirisan: { lang: 'ko', title: '지리산 천왕봉 · 오늘의 해, 온라인 해돋이', desc: '지리산 천왕봉 정상 끝까지 걸어가 운해 위로 떠오르는 해를 사람들과 함께 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.', image: 'og-jirisan.png', alt: '산 정상 난간 앞에서 구름 바다 위로 떠오르는 해를 바라보는 캐릭터들' },
  // hallasan: { lang: 'ko', title: '한라산 백록담 · 오늘의 해, 온라인 해돋이', desc: '남한에서 가장 높은 한라산 백록담 정상에서 끝없는 운해 위로 떠오르는 해를 사람들과 함께 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.', image: 'og-hallasan.png', alt: '한라산 정상에서 구름 바다 위로 떠오르는 해' },
  // seopjikoji: { lang: 'ko', title: '섭지코지 · 오늘의 해, 온라인 해돋이', desc: '제주 섭지코지의 검은 현무암 해안과 촛대바위 사이로 떠오르는 해를 사람들과 함께 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.', image: 'og-seopjikoji.png', alt: '검은 바위와 바다에 선 촛대바위 사이로 떠오르는 해' },
  // seongsan: { lang: 'ko', title: '성산일출봉 · 오늘의 해, 온라인 해돋이', desc: '제주 성산일출봉 앞바다에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
  // homigot: { lang: 'ko', title: '호미곶 · 오늘의 해, 온라인 해돋이', desc: '포항 호미곶 상생의 손 앞에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
};

const base = readFileSync('dist/index.html', 'utf8');
const swap = (html, re, value) => { if (!re.test(html)) throw new Error(`없는 태그: ${re}`); return html.replace(re, value); };

for (const [id, p] of Object.entries(PAGES)) {
  const url = `${SITE}/${id}`, img = `${SITE}/${p.image ?? 'og.png'}`;
  let h = base;
  h = swap(h, /<html lang="[^"]*">/, `<html lang="${p.lang}">`);
  h = swap(h, /<title>[^<]*<\/title>/, `<title>${p.title}</title>`);
  h = swap(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${p.desc}">`);
  h = swap(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  h = swap(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${p.title}">`);
  h = swap(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${p.desc}">`);
  h = swap(h, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img}">`);
  h = swap(h, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${img}">`);
  h = swap(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  if (p.lang === 'en') {
    h = swap(h, /<meta property="og:locale" content="[^"]*">/, '<meta property="og:locale" content="en_US">');
    h = swap(h, /<meta property="og:site_name" content="[^"]*">/, `<meta property="og:site_name" content="Today's Sun">`);
  }
  if (p.alt) h = swap(h, /<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${p.alt}">`);
  mkdirSync(`dist/${id}`, { recursive: true });
  writeFileSync(`dist/${id}/index.html`, h);
}
console.log(`해변별 페이지 ${Object.keys(PAGES).length}개 생성`);
