// Sonido sintetizado con Web Audio (sin archivos): motor con caja de cambios, rodadura
// según superficie, derrapes, golpes, avisos de carrera y copiloto por voz.
import { clamp } from './util.js';

const NUM = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

export function noteText(no) {
  if (!no) return '';
  if (no.label) return { SALTO: 'salto', BARRO: 'cuidado, barro', AGUA: 'agua', PUENTE: 'puente' }[no.label] || no.label.toLowerCase();
  const dir = no.dir < 0 ? 'izquierda' : 'derecha';
  if (no.grade === 'H') return `horquilla ${dir}`;
  return `${dir} ${NUM[+no.grade] || no.grade}${no.long ? ' larga' : ''}`;
}

export function createAudio() {
  let ctx = null, master = null, ready = false;
  let muted = false, voiceOn = true, volume = 0.8, musicOn = true, musicWanted = false;
  let rain = null, musicBus = null, seqTimer = null, seqNext = 0, seqStep = 0;
  let noiseBuf = null, gravelBuf = null;
  let eng = null, surf = null, rivals = [];
  let rpm = 0.15, load = 0, lastThr = 0, lastT = 0, voice = null;

  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function setP(p, v, tc = 0.03) { p.setTargetAtTime(v, ctx.currentTime, tc); }

  function makeNoise(sec) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  // Grava: chasquidos sueltos de amplitud variable sobre un fondo suave
  function makeGravel(sec) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.05;
    for (let i = 0; i < d.length - 60; i++) {
      if (Math.random() < 0.012) {
        const a = (0.15 + Math.random() * 0.85) * (Math.random() < 0.5 ? -1 : 1);
        for (let k = 0; k < 50; k++) d[i + k] += a * Math.exp(-k / 7) * (k % 2 ? -1 : 1);
      }
    }
    return b;
  }
  function distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  function loop(buf, rate = 1) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.start(0, Math.random() * buf.duration * 0.9); return s;
  }

  // Motor de cuatro cilindros hecho con explosiones: cada muestra en bucle guarda 64 explosiones
  // (golpe grave, resonancia del escape y chasquido de ruido) con pequeñas diferencias entre
  // cilindros, para que suene a motor y no a zumbido. Hay dos muestras por régimen (bajas y altas
  // vueltas) y por carga (con gas: más áspera; sin gas: apagada); se mezclan y se aceleran con
  // playbackRate según las vueltas.
  const ENG_LO = 45, ENG_HI = 140;   // explosiones por segundo de cada muestra
  function makeEngine(fire, onLoad) {
    const sr = ctx.sampleRate, per = sr / fire, n = 64, len = Math.round(per * n);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const cyl = [1, 0.82, 0.93, 0.76], fr = onLoad ? 190 : 140, ring = onLoad ? 0.007 : 0.005;
    const span = Math.min(len, Math.round(sr * 0.05));
    for (let k = 0; k < n; k++) {
      const t0 = Math.round(k * per + (Math.random() - 0.5) * per * 0.05);
      const amp = cyl[k % 4] * (0.85 + Math.random() * 0.3), ph = Math.random() * 0.6;
      for (let i = 0; i < span; i++) {
        const t = i / sr, j = (t0 + i + len) % len;
        const thump = Math.exp(-t / 0.0035) * (1 - Math.exp(-t / 0.0004));
        const body = Math.sin(2 * Math.PI * fr * t + ph) * Math.exp(-t / ring);
        const rasp = (Math.random() * 2 - 1) * Math.exp(-t / (onLoad ? 0.0035 : 0.0015)) * (onLoad ? 0.45 : 0.15);
        d[j] += amp * (1.2 * thump + 0.7 * body + rasp);
      }
    }
    let mean = 0, peak = 0;
    for (let i = 0; i < len; i++) mean += d[i];
    mean /= len;
    for (let i = 0; i < len; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < len; i++) d[i] /= peak;
    return b;
  }
  function buildEngine() {
    const buf = { lo: [makeEngine(ENG_LO, false), makeEngine(ENG_LO, true)], hi: [makeEngine(ENG_HI, false), makeEngine(ENG_HI, true)] };
    const out = gain(0), sum = gain(1), drive = gain(1), shaper = ctx.createWaveShaper(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    shaper.curve = distCurve(1.6); shaper.oversample = '2x';
    hp.type = 'highpass'; hp.frequency.value = 28;
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.6;
    const src = {}, g = {};
    for (const r of ['lo', 'hi']) {
      for (const l of [0, 1]) {
        const k = r + l, s = loop(buf[r][l]), gg = gain(0);
        s.connect(gg).connect(sum); src[k] = s; g[k] = gg;
      }
    }
    sum.connect(drive).connect(shaper).connect(hp).connect(lp).connect(out);
    // turbo: silbido suave
    const tb = ctx.createOscillator(), tbG = gain(0);
    tb.type = 'sine'; tb.connect(tbG).connect(master); tb.start();
    out.connect(master);
    eng = { out, drive, lp, src, g, tb, tbG, buf };
  }
  // Mezcla de las cuatro muestras para unas vueltas y una carga dadas
  function engineMix(e, f, ld, tc) {
    const w = clamp((f - 60) / (120 - 60), 0, 1), wl = Math.cos(w * Math.PI / 2), wh = Math.sin(w * Math.PI / 2);
    const on = Math.sin(ld * Math.PI / 2), off = Math.cos(ld * Math.PI / 2);
    setP(e.src.lo0.playbackRate, f / ENG_LO, tc); setP(e.src.lo1.playbackRate, f / ENG_LO, tc);
    setP(e.src.hi0.playbackRate, f / ENG_HI, tc); setP(e.src.hi1.playbackRate, f / ENG_HI, tc);
    setP(e.g.lo0.gain, wl * off, tc); setP(e.g.lo1.gain, wl * on, tc);
    setP(e.g.hi0.gain, wh * off, tc); setP(e.g.hi1.gain, wh * on, tc);
  }

  function buildSurface() {
    const mk = (buf, type, f, q) => {
      const src = loop(buf), fl = ctx.createBiquadFilter(), g = gain(0);
      fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      src.connect(fl).connect(g).connect(master);
      return { src, fl, g };
    };
    const hiss = mk(noiseBuf, 'bandpass', 800, 0.7);
    const gravel = mk(gravelBuf, 'highpass', 600, 0.5);
    const wind = mk(noiseBuf, 'lowpass', 380, 0.5);
    const slosh = mk(noiseBuf, 'lowpass', 520, 1.2);
    const sloshLfo = ctx.createOscillator(), sl = gain(0.5);
    sloshLfo.frequency.value = 6.5; sloshLfo.connect(sl).connect(slosh.g.gain); sloshLfo.start();
    // chirrido: triángulo con vibrato rápido + ruido estrecho
    const sq = ctx.createOscillator(), sqv = ctx.createOscillator(), sqvg = gain(45), sqf = ctx.createBiquadFilter(), sqg = gain(0);
    sq.type = 'triangle'; sq.frequency.value = 980; sqv.frequency.value = 13;
    sqv.connect(sqvg).connect(sq.frequency);
    sqf.type = 'bandpass'; sqf.frequency.value = 1500; sqf.Q.value = 2;
    sq.connect(sqf).connect(sqg).connect(master);
    sq.start(); sqv.start();
    surf = { hiss, gravel, wind, slosh, sloshDepth: sl, squeal: sqg, sq };
  }

  function buildRain() {
    const src = loop(noiseBuf), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = gain(0);
    hp.type = 'highpass'; hp.frequency.value = 1800; lp.type = 'lowpass'; lp.frequency.value = 9000;
    src.connect(hp).connect(lp).connect(g).connect(master);
    const src2 = loop(gravelBuf, 0.35), bp = ctx.createBiquadFilter(), g2 = gain(0);
    bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
    src2.connect(bp).connect(g2).connect(master);
    rain = { g, g2 };
  }

  // ---------- Música: secuenciador sencillo (Am – F – C – G), 8 compases ----------
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const BASS = [45, 41, 48, 43];
  const ARP = [[69, 72, 76, 81], [65, 69, 72, 77], [64, 67, 72, 76], [67, 71, 74, 79]];
  function inst(t, kind, note) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    if (kind === 'kick') {
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3); return;
    }
    if (kind === 'snare' || kind === 'hat' || kind === 'open') {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      f.type = 'highpass'; f.frequency.value = kind === 'snare' ? 1300 : 7000;
      const d = kind === 'snare' ? 0.16 : kind === 'open' ? 0.14 : 0.035;
      g.gain.setValueAtTime(kind === 'snare' ? 0.26 : 0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + d + 0.02);
      if (kind === 'snare') { o.type = 'triangle'; o.frequency.value = 190; const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.14, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g2).connect(musicBus); o.start(t); o.stop(t + 0.1); }
      return;
    }
    o.type = kind === 'bass' ? 'sawtooth' : 'square';
    o.frequency.value = midi(note);
    f.type = 'lowpass'; f.frequency.value = kind === 'bass' ? 650 : 2200;
    const vol = kind === 'bass' ? 0.16 : 0.045, d = kind === 'bass' ? 0.22 : 0.13;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f).connect(g).connect(musicBus); o.start(t); o.stop(t + d + 0.02);
  }
  function schedule() {
    if (!ready) return;
    const STEP = 60 / 118 / 4;
    while (seqNext < ctx.currentTime + 0.12) {
      const st = seqStep % 16, bar = Math.floor(seqStep / 16) % 8, ch = bar % 4, t = seqNext;
      if (st === 0 || st === 8 || st === 10) inst(t, 'kick');
      if (st === 4 || st === 12) inst(t, 'snare');
      if (st % 2 === 0) inst(t, st === 14 ? 'open' : 'hat');
      if ([0, 2, 3, 6, 8, 10, 11, 14].includes(st)) inst(t, 'bass', BASS[ch] + (st === 3 || st === 11 ? 12 : 0));
      if (bar >= 4) inst(t, 'arp', ARP[ch][st % 4] + (st >= 8 ? 12 : 0));
      seqNext += STEP; seqStep++;
    }
  }
  function syncMusic() {
    if (!ready) return;
    const play = musicOn && musicWanted && !muted;
    if (play && !seqTimer) { seqNext = ctx.currentTime + 0.05; seqStep = 0; setP(musicBus.gain, 0.5, 0.2); seqTimer = setInterval(schedule, 25); }
    else if (!play && seqTimer) { clearInterval(seqTimer); seqTimer = null; setP(musicBus.gain, 0, 0.1); }
  }

  function buildRivals(n) {
    for (let i = 0; i < n; i++) {
      const lp = ctx.createBiquadFilter(), g = gain(0), src = {}, gs = {};
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      lp.type = 'lowpass'; lp.frequency.value = 700;
      for (const r of ['lo', 'hi']) {
        for (const l of [0, 1]) { const k = r + l, s = loop(eng.buf[r][l]); s.connect(gs[k] = gain(0)).connect(lp); src[k] = s; }
      }
      lp.connect(g);
      if (pan) { g.connect(pan).connect(master); } else g.connect(master);
      rivals.push({ src, g: gs, lp, out: g, pan, rpm: 0.2, ld: 0 });
    }
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = gain(muted ? 0 : volume);
      master.connect(comp).connect(ctx.destination);
      noiseBuf = makeNoise(2); gravelBuf = makeGravel(1.6);
      buildEngine(); buildSurface(); buildRivals(3); buildRain();
      musicBus = gain(0.5); musicBus.connect(master);
      ready = true;
    } catch (e) { ready = false; }
    return ready;
  }

  // vueltas (0–1) → frecuencia de encendido de un cuatro cilindros, de 900 a 8000 rpm
  const fireHz = (r) => (900 + clamp(r, 0, 1.1) * 7100) / 30;

  // ---------- Efectos puntuales ----------
  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
    if (!ready || vol <= 0.001) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(dur, type, freq, vol, when = 0, q = 1, sweepTo = null) {
    if (!ready || vol <= 0.001) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  const pop = (when = 0, v = 0.3) => { burst(0.045, 'bandpass', 700 + Math.random() * 500, v, when, 1.4); tone(90, 0.05, 'square', v * 0.3, when); };


  function sfx(name, d = {}) {
    if (!ready) return;
    const v = d.vol == null ? 1 : d.vol;
    switch (name) {
      case 'count': tone(660, 0.14, 'square', 0.16); break;
      case 'go': tone(1320, 0.5, 'square', 0.18); break;
      case 'split':
        if (d.good === true) { tone(988, 0.09, 'sine', 0.25); tone(1319, 0.18, 'sine', 0.25, 0.09); }
        else if (d.good === false) { tone(660, 0.1, 'sine', 0.22); tone(494, 0.2, 'sine', 0.22, 0.1); }
        else tone(880, 0.14, 'sine', 0.22);
        break;
      case 'lap':
        tone(784, 0.1, 'triangle', 0.25); tone(1047, 0.2, 'triangle', 0.25, 0.1);
        if (d.last) tone(1319, 0.3, 'triangle', 0.25, 0.22);
        break;
      case 'finish':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.14, 'triangle', 0.26, i * 0.12));
        break;
      case 'record':
        [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.1, 'sine', 0.2, 0.6 + i * 0.09));
        break;
      case 'hit':
        burst(0.2, 'lowpass', 380, 0.55 * v); tone(85, 0.26, 'sine', 0.6 * v, 0, 40);
        if (v > 0.45) burst(0.09, 'bandpass', 1600, 0.25 * v, 0.01, 5);
        break;
      case 'cone': tone(1700, 0.035, 'square', 0.08 * v); burst(0.06, 'highpass', 3000, 0.14 * v); break;
      case 'pickup': tone(1175, 0.08, 'sine', 0.24); tone(1760, 0.2, 'sine', 0.24, 0.07); break;
      case 'land': burst(0.22, 'lowpass', 260, 0.6 * v); tone(62, 0.22, 'sine', 0.55 * v, 0, 34); break;
      case 'splash': burst(0.5, 'bandpass', 1500, 0.45 * v, 0, 0.8, 500); break;
      case 'mud': burst(0.38, 'lowpass', 450, 0.45 * v, 0, 1.5, 200); break;
      case 'thunder': {
        const w = d.delay || 0.5;
        burst(0.25, 'highpass', 900, 0.25, w, 0.7);
        burst(3.2, 'lowpass', 220, 0.75, w + 0.05, 0.8, 60);
        burst(2.2, 'lowpass', 120, 0.6, w + 0.4, 0.8);
        break;
      }
      case 'extend': [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.12, i * 0.07)); break;
      case 'tick': tone(1480, 0.06, 'square', 0.13); break;
      case 'timeup': [523, 415, 330, 262].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.18, 'sawtooth', 0.14, i * 0.2)); break;
      case 'gear':   // golpe sordo del cambio y, al subir, un petardeo y el soplido del turbo
        burst(0.05, 'lowpass', 420, 0.16, 0, 1.2);
        if (d.up) { pop(0.02, 0.1); if (d.turbo) burst(0.3, 'highpass', 5200, 0.04, 0.03, 0.8, 2600); }
        break;
      case 'combo': tone(1319, 0.07, 'triangle', 0.2); tone(1976, 0.16, 'triangle', 0.2, 0.06); break;
      case 'coin': tone(988, 0.08, 'square', 0.16); tone(1319, 0.3, 'square', 0.16, 0.08); break;
      case 'note': speak(noteText(d.no) + (d.next ? ' y ' + noteText(d.next) : '')); break;
    }
  }

  function pickVoice() {
    const ss = window.speechSynthesis;
    if (!ss || !ss.getVoices) return null;
    const vs = ss.getVoices();
    return vs.find((x) => /^es[-_]ES/i.test(x.lang)) || vs.find((x) => /^es/i.test(x.lang)) || null;
  }
  function speak(text) {
    if (!voiceOn || muted || !text) return;
    try {
      const ss = window.speechSynthesis;
      if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
      if (!voice) voice = pickVoice();
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES'; u.rate = 1.35; u.pitch = 0.9; u.volume = 0.95;
      if (voice) u.voice = voice;
      ss.speak(u);
    } catch (e) { /* sin voz disponible */ }
  }

  // ---------- Bucle continuo ----------
  function silence() {
    if (!ready) return;
    setP(eng.out.gain, 0, 0.08); setP(eng.tbG.gain, 0, 0.08);
    for (const k of ['hiss', 'gravel', 'wind', 'slosh']) setP(surf[k].g.gain, 0, 0.08);
    setP(surf.sloshDepth.gain, 0, 0.08);
    setP(surf.squeal.gain, 0, 0.05);
    for (const r of rivals) setP(r.out.gain, 0, 0.08);
    setP(rain.g.gain, 0, 0.2); setP(rain.g2.gain, 0, 0.2);
  }

  function update(st) {
    if (!ready || ctx.state !== 'running') return;
    const t = ctx.currentTime, dt = clamp(t - lastT, 0, 0.1); lastT = t;
    if (!st || !st.active) { silence(); return; }
    setP(rain.g.gain, st.rain ? 0.09 : 0, 0.3); setP(rain.g2.gain, st.rain ? 0.12 : 0, 0.3);
    const m = st.me, v = m.sp / 300;

    // motor: las vueltas vienen de la caja del juego; con gas en primera el embrague patina
    const shifting = m.shifting, onGas = m.thr && !shifting;
    let target = m.rpm == null ? 0.15 + v * 0.8 : m.rpm;
    if (m.gear === 1 && m.thr) target = Math.max(target, 0.45);
    if (v < 0.02 && !m.thr) target = 0.12;
    if (st.count && m.thr) target = 0.72 + Math.sin(t * 9) * 0.03;           // acelerar en parado en la cuenta atrás
    if (onGas && (m.air || m.slide > 70 || m.hb)) target = Math.min(1.04, target + 0.18); // patina o vuela
    target = Math.max(0.12, target);
    rpm += (target - rpm) * Math.min(1, dt * (shifting ? 14 : target > rpm ? 10 : 6));
    load += ((onGas ? 1 : 0) - load) * Math.min(1, dt * (onGas ? 12 : 7));
    if (lastThr && !m.thr && rpm > 0.6 && !st.count) {     // petardeo al soltar
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) pop(0.05 + i * 0.09 + Math.random() * 0.05, 0.22);
      if (m.turbo) burst(0.35, 'highpass', 5000, 0.06, 0.02, 0.8, 2400);
    }
    lastThr = m.thr;
    const f0 = fireHz(rpm);
    engineMix(eng, f0, load, 0.012);
    setP(eng.drive.gain, 0.7 + load * 0.8, 0.03);
    setP(eng.lp.frequency, 500 + rpm * 2600 + load * 1400, 0.03);
    setP(eng.out.gain, 0.12 + load * 0.12 + rpm * 0.08, 0.02);
    // turbo: silba un poco con carga y vueltas
    const spool = m.turbo ? load * clamp((rpm - 0.4) / 0.55, 0, 1) : 0;
    setP(eng.tb.frequency, 2800 + rpm * 3200, 0.05); setP(eng.tbG.gain, spool * spool * 0.008, 0.15);

    // rodadura según superficie
    const vs = Math.min(1, v * 1.2);
    let hiss = 0, hissF = 800, gravel = 0, slosh = 0, squeal = 0;
    if (!m.air) {
      const k = m.sk === 'off' || m.sk === 'verge' ? 'off-' + m.offKind : m.sk;
      switch (k) {
        case 'asfalto': hiss = 0.05 * vs; hissF = 520; squeal = clamp((m.slide - 34) / 90, 0, 1) * 0.2 + (m.brk && v > 0.3 ? 0.06 : 0); break;
        case 'tierra': gravel = 0.32 * vs + clamp(m.slide / 220, 0, 0.3); hiss = 0.07 * vs; hissF = 1300; break;
        case 'nieve': hiss = 0.17 * vs; hissF = 650; gravel = 0.1 * vs; break;
        case 'barro': slosh = 0.4 * vs; hiss = 0.06 * vs; hissF = 380; break;
        case 'agua': slosh = 0.28 * vs; hiss = 0.3 * vs; hissF = 2600; break;
        case 'off-pradera': hiss = 0.12 * vs; hissF = 1700; gravel = 0.08 * vs; break;
        case 'off-desierto': hiss = 0.2 * vs; hissF = 2300; gravel = 0.14 * vs; break;
        case 'off-nieve': hiss = 0.18 * vs; hissF = 700; break;
        case 'off-selva': hiss = 0.14 * vs; hissF = 1400; gravel = 0.06 * vs; break;
        case 'off-sabana': hiss = 0.16 * vs; hissF = 2000; gravel = 0.1 * vs; break;
        case 'off-outback': hiss = 0.2 * vs; hissF = 2200; gravel = 0.16 * vs; break;
        default: gravel = 0.2 * vs; hiss = 0.1 * vs;
      }
    }
    setP(surf.hiss.g.gain, hiss); setP(surf.hiss.fl.frequency, hissF, 0.05);
    setP(surf.gravel.g.gain, gravel); setP(surf.gravel.src.playbackRate, 0.5 + v * 1.3, 0.05);
    setP(surf.slosh.g.gain, slosh * 0.5); setP(surf.sloshDepth.gain, slosh * 0.5);
    setP(surf.squeal.gain, squeal, 0.02); setP(surf.sq.frequency, 900 + clamp(m.slide, 0, 200) * 1.5, 0.05);
    setP(surf.wind.g.gain, (m.air ? 0.12 : 0) + v * v * 0.1);

    // rivales: motor lejano con panorama
    rivals.forEach((r, i) => {
      const o = st.rivals[i];
      if (!o) { setP(r.out.gain, 0); return; }
      const rv = o.sp / 300, tg = rv < 0.02 ? 0.15 : o.rpm != null ? Math.max(0.2, o.rpm) : 0.2 + rv * 0.7;
      r.rpm += (tg - r.rpm) * Math.min(1, dt * 6);
      r.ld += ((o.thr ? 1 : 0) - r.ld) * Math.min(1, dt * 8);
      engineMix(r, fireHz(r.rpm) * (1 + i * 0.013), r.ld, 0.03);
      setP(r.lp.frequency, 400 + r.rpm * 1500, 0.05);
      const near = clamp(1 - o.dist / 650, 0, 1);
      setP(r.out.gain, near * near * (o.thr ? 0.1 : 0.05), 0.06);
      if (r.pan) setP(r.pan.pan, o.pan, 0.05);
    });
  }

  function applyMaster() { if (ready) setP(master.gain, muted ? 0 : volume, 0.05); }

  return {
    unlock() {
      if (!ctx) { init(); setTimeout(syncMusic, 0); }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (window.speechSynthesis && !voice) voice = pickVoice();
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    update,
    sfx,
    setMusic(on) { musicOn = !!on; syncMusic(); },
    playMusic(want) { musicWanted = !!want; syncMusic(); },
    get music() { return musicOn; },
    setMuted(m) { muted = !!m; applyMaster(); syncMusic(); if (muted && window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (_) {} },
    setVoice(on) { voiceOn = !!on; if (!on && window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (_) {} },
    get muted() { return muted; },
    get voice() { return voiceOn; },
    get ready() { return ready; },
  };
}
