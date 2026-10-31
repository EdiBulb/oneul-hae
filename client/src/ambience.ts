// 배경 소리: 음원 파일 없이 Web Audio로 직접 만든다.
// - 파도: 갈색 잡음 + 저역 필터 + 느린 너울(LFO)
// - 바람: 분홍 잡음 + 대역 필터, 실제 풍속에 따라 세기와 돌풍이 바뀜
// - 비: 실제로 비가 오면 고역 잡음이 깔림
// - 새소리/풀벌레: 해의 고도에 따라 새벽 합창 → 낮 새소리 → 밤 풀벌레

export interface Weather { windKmh: number; precipMm: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 전체 볼륨: 폰 스피커 기준으로 맞춤 (측정: 평균 약 -25dB, 피크 약 -14dB) */
const VOLUME = 1.6;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBuffer(ctx: AudioContext, kind: 'brown' | 'pink', seconds = 6) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

export function createAmbience() {
  let ctx: AudioContext | null = null;
  let pinkBuf!: AudioBuffer, fxBus!: GainNode, fireRumble!: GainNode, fireLevel = 0;
  let master!: GainNode, windGain!: GainNode, windFilter!: BiquadFilterNode, rainGain!: GainNode, birdBus!: GainNode;
  let on = true, alt = -20;
  let weather: Weather = { windKmh: 10, precipMm: 0 };
  let timers: number[] = [];

  function loop(src: AudioBuffer) {
    const s = ctx!.createBufferSource(); s.buffer = src; s.loop = true;
    s.loopStart = rand(0, 1); s.start(0, rand(0, 4));
    return s;
  }

  function build() {
    const c = ctx!;
    // 리미터: 소리를 키워도 찢어지지 않게
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = 0.005; limiter.release.value = 0.25;
    limiter.connect(c.destination);
    master = c.createGain(); master.gain.value = 0; master.connect(limiter);
    const brown = noiseBuffer(c, 'brown'), pink = noiseBuffer(c, 'pink');

    // 파도: 두 개의 느린 LFO가 겹쳐서 불규칙한 너울
    const waveLp = c.createBiquadFilter(); waveLp.type = 'lowpass'; waveLp.frequency.value = 480; waveLp.Q.value = 0.4;
    const waveGain = c.createGain(); waveGain.gain.value = 0.42;
    loop(brown).connect(waveLp).connect(waveGain).connect(master);
    const foamHp = c.createBiquadFilter(); foamHp.type = 'highpass'; foamHp.frequency.value = 2600;
    const foamGain = c.createGain(); foamGain.gain.value = 0.025;
    loop(pink).connect(foamHp).connect(foamGain).connect(master);
    for (const [f, depth, foam] of [[0.085, 0.3, 0.02], [0.137, 0.14, 0.012]] as const) {
      const lfo = c.createOscillator(); lfo.frequency.value = f;
      const g1 = c.createGain(); g1.gain.value = depth; lfo.connect(g1).connect(waveGain.gain);
      const g2 = c.createGain(); g2.gain.value = foam; lfo.connect(g2).connect(foamGain.gain);
      lfo.start();
    }

    // 바람
    windFilter = c.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 600; windFilter.Q.value = 0.9;
    windGain = c.createGain(); windGain.gain.value = 0;
    loop(pink).connect(windFilter).connect(windGain).connect(master);

    // 비
    const rainHp = c.createBiquadFilter(); rainHp.type = 'highpass'; rainHp.frequency.value = 900;
    const rainLp = c.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 7000;
    rainGain = c.createGain(); rainGain.gain.value = 0;
    loop(pink).connect(rainHp).connect(rainLp).connect(rainGain).connect(master);

    birdBus = c.createGain(); birdBus.gain.value = 0.07; birdBus.connect(master);

    // 효과음(발소리·물소리·모닥불)
    pinkBuf = pink;
    fxBus = c.createGain(); fxBus.gain.value = 0.5; fxBus.connect(master);
    const rumbleLp = c.createBiquadFilter(); rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 260;
    fireRumble = c.createGain(); fireRumble.gain.value = 0;
    loop(brown).connect(rumbleLp).connect(fireRumble).connect(fxBus);
    crackle();

    gust();
    schedule();
  }

  // ---------- 바람: 몇 초마다 세기와 음색이 바뀌는 돌풍 ----------
  function gust() {
    if (!ctx) return;
    const base = clamp(weather.windKmh / 40, 0.03, 0.7) * 0.32;
    const t = ctx.currentTime;
    windGain.gain.setTargetAtTime(base * rand(0.45, 1.35), t, rand(0.8, 2));
    windFilter.frequency.setTargetAtTime(rand(350, 950) + weather.windKmh * 6, t, 1.5);
    rainGain.gain.setTargetAtTime(weather.precipMm > 0 ? clamp(weather.precipMm / 4, 0.05, 0.28) : 0, t, 2);
    timers.push(window.setTimeout(gust, rand(1800, 4200)));
  }

  // ---------- 효과음 ----------
  /** 잡음 조각을 필터에 통과시켜 짧게 울린다 */
  function burst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, pan = 0) {
    const c = ctx!;
    const src = c.createBufferSource(); src.buffer = pinkBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = c.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(fxBus);
    src.start(t, rand(0, 5)); src.stop(t + dur + 0.02);
    return f;
  }
  function crackle() {
    if (!ctx) return;
    if (fireLevel > 0.02) {
      const t = ctx.currentTime + 0.02, n = Math.random() < 0.25 ? 3 : 1;
      for (let i = 0; i < n; i++) burst(t + i * rand(0.01, 0.04), rand(0.01, 0.035), 'bandpass', rand(1800, 5200), 1.2, fireLevel * rand(0.4, 1.1), rand(-0.3, 0.3));
    }
    fireRumble.gain.setTargetAtTime(fireLevel * 0.5, ctx.currentTime, 0.4);
    timers.push(window.setTimeout(crackle, rand(50, 260)));
  }

  // ---------- 새소리 ----------
  function note(t: number, f0: number, f1: number, dur: number, vol: number, pan: number, type: OscillatorType = 'sine') {
    const c = ctx!;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = c.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(birdBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function bird() {
    const c = ctx!, t = c.currentTime + 0.05, pan = rand(-0.85, 0.85), v = rand(0.35, 0.9);
    const kind = Math.random();
    if (kind < 0.45) { // 짧게 떨어지는 지저귐 2~4번
      const n = 2 + Math.floor(Math.random() * 3), f = rand(3000, 4600);
      for (let i = 0; i < n; i++) note(t + i * rand(0.11, 0.16), f, f - rand(500, 1100), 0.085, v, pan);
    } else if (kind < 0.75) { // 빠른 떨림(트릴)
      const n = 7 + Math.floor(Math.random() * 6), f = rand(4200, 5600);
      for (let i = 0; i < n; i++) note(t + i * 0.034, f + Math.sin(i) * 180, f - 300, 0.03, v * 0.7, pan);
    } else { // 느린 휘파람 두 음
      const f = rand(1700, 2300);
      note(t, f, f * 1.2, 0.28, v * 0.8, pan);
      note(t + 0.36, f * 1.15, f * 0.95, 0.32, v * 0.8, pan);
    }
  }
  function crickets() {
    const c = ctx!, t = c.currentTime + 0.05, pan = rand(-0.7, 0.7);
    for (let i = 0; i < 3; i++) note(t + i * 0.055, 4300, 4250, 0.035, 0.18, pan, 'triangle');
  }

  /** 해 고도에 따라 다음 소리까지의 간격을 정한다 */
  function schedule() {
    if (!ctx) return;
    const windy = weather.windKmh > 35 || weather.precipMm > 0.3;
    let perMin = 0;
    if (alt < -8) perMin = 0;
    else if (alt < -2) perMin = 5;       // 동트기 전 한두 마리
    else if (alt < 10) perMin = 26;      // 해 뜰 무렵 새벽 합창
    else perMin = 9;                      // 낮
    if (windy) perMin *= 0.4;
    if (perMin > 0) {
      bird();
      timers.push(window.setTimeout(schedule, (60000 / perMin) * rand(0.4, 1.6)));
    } else {
      if (!windy) crickets();
      timers.push(window.setTimeout(schedule, rand(700, 1600)));
    }
  }

  function fade(to: number, sec = 1.5) {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(to, ctx.currentTime, sec / 3);
  }

  return {
    /** 반드시 사용자의 터치(클릭) 안에서 불러야 소리가 난다 */
    unlock() {
      if (!on) return;
      if (!ctx) {
        try { ctx = new AudioContext(); } catch { return; }
        build();
      }
      ctx.resume().then(() => fade(VOLUME, 3)).catch(() => {});
    },
    setOn(v: boolean) {
      on = v;
      if (v) this.unlock(); else fade(0, 0.6);
    },
    get on() { return on; },
    get started() { return !!ctx && ctx.state === 'running'; },
    setAlt(a: number) { alt = a; },
    setWeather(w: Weather) { weather = w; },
    /** 내 발걸음: 물에서는 찰박, 데크에서는 통통 */
    step(kind: 'sand' | 'water' | 'wood') {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.01, pan = rand(-0.15, 0.15);
      if (kind === 'water') {
        const f = burst(t, 0.22, 'bandpass', rand(900, 1400), 0.8, 0.9, pan);
        f.frequency.exponentialRampToValueAtTime(rand(380, 600), t + 0.2);
        burst(t + 0.03, 0.16, 'highpass', 3200, 0.5, 0.25, pan);
      } else if (kind === 'wood') {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(rand(150, 180), t); o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(fxBus); o.start(t); o.stop(t + 0.14);
        burst(t, 0.03, 'bandpass', 2400, 1, 0.25, pan);
      } else {
        burst(t, 0.07, 'bandpass', rand(1500, 2400), 0.7, 0.08, pan);
      }
    },
    /** 모닥불 소리 크기 (0~1): 밤의 정도 × 불과의 거리 */
    setFire(level: number) { fireLevel = clamp(level, 0, 1); },
    /** 다른 앱으로 넘어가면 잠시 멈춤 */
    pause() { ctx?.suspend().catch(() => {}); },
    resume() { if (on && ctx) ctx.resume().catch(() => {}); },
  };
}

/** Open-Meteo 무료 날씨 API (키 필요 없음). 실패하면 기본값으로 */
export async function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,precipitation`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return { windKmh: Number(j.current?.wind_speed_10m ?? 10), precipMm: Number(j.current?.precipitation ?? 0) };
  } catch { return null; }
}

export function windLabel(w: Weather) {
  if (w.precipMm > 0.2) return '비';
  const k = w.windKmh;
  return k < 6 ? '고요함' : k < 20 ? '산들바람' : k < 38 ? '바람' : '강한 바람';
}
