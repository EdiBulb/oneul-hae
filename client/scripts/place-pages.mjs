// 빌드 후 해변별 페이지 만들기: dist/<해변>/index.html
// 앱은 그대로이고, 링크 미리보기(제목·설명·이미지)와 대표 주소만 해변마다 다르게 바꾼다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SITE = 'https://hae.abracadelulu.com';
const PAGES = {
  jeongdongjin: { lang: 'ko', title: '정동진 · 오늘의 해, 온라인 해돋이', desc: '강릉 정동진 해변에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
  seongsan: { lang: 'ko', title: '성산일출봉 · 오늘의 해, 온라인 해돋이', desc: '제주 성산일출봉 앞바다에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
  homigot: { lang: 'ko', title: '호미곶 · 오늘의 해, 온라인 해돋이', desc: '포항 호미곶 상생의 손 앞에서 사람들과 함께 실시간 해돋이를 봐요. 설치 없이 바로 접속하는 3D 온라인 해돋이.' },
  gisborne: { lang: 'ko', title: '기스본 · 오늘의 해, 온라인 해돋이', desc: '세계에서 가장 먼저 해가 뜨는 도시 중 하나, 뉴질랜드 기스본에서 함께 실시간 해돋이를 봐요.' },
  jumunjin: {
    lang: 'en',
    title: "Jumunjin Breakwater, Korea · Today's Sun",
    desc: "Stand on the little breakwater known from the K-drama 'Goblin'. A live 3D Korean seaside you can visit from anywhere: real sunrise, long coats, red scarves and photos together.",
    image: 'og-jumunjin.png',
    alt: 'Two characters, one holding a buckwheat bouquet and one in a red scarf, facing each other on a breakwater at sunrise',
  },
  hyangho: {
    lang: 'en',
    title: "Hyangho Bus Stop, Korea · Today's Sun",
    desc: 'Sit at the little seaside bus stop from a famous K-pop album cover, on the beach in Gangneung. A live 3D Korean seaside you can visit from anywhere.',
    image: 'og-hyangho.png',
    alt: 'A small blue-roofed bus stop with a purple bench on a sandy beach, the sea behind it',
  },
  hangang: {
    lang: 'en',
    title: "Han River Ramyeon, Seoul · Today's Sun",
    desc: "Cook convenience-store ramyeon and eat it on a picnic mat by Seoul's Han River at night, with people from around the world. No app needed.",
    image: 'og-hangang.png',
    alt: 'Characters eating instant noodles on picnic mats by the Han River with the lit-up Seoul skyline across the water',
  },
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
