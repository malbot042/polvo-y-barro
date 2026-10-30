// Sonido sintetizado con Web Audio (sin archivos): motor con caja de cambios, rodadura
// según superficie, derrapes, golpes, nitro, avisos de carrera y copiloto por voz.
import { clamp } from './util.js';

const GEARS = [0, 0.16, 0.32, 0.5, 0.7, 0.92, 9];   // fracción de velocidad punta por marcha
const NUM = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

export function noteText(no) {
  if (!no) return '';
  if (no.label) return { SALTO: 'salto', BARRO: 'cuidado, barro', AGUA: 'agua' }[no.label] || no.label.toLowerCase();
  const dir = no.dir < 0 ? 'izquierda' : 'derecha';
  if (no.grade === 'H') return `horquilla ${dir}`;
  return `${dir} ${NUM[+no.grade] || no.grade}${no.long ? ' larga' : ''}`;
}

export function createAudio() {
  let ctx = null, master = null, ready = false;
  let muted = false, voiceOn = true, volume = 0.8;
  let noiseBuf = null, gravelBuf = null;
  let eng = null, surf = null, rivals = [];
  let gear = 1, rpm = 0.15, lastThr = 0, lastT = 0, voice = null;

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

  function buildEngine() {
    const out = gain(0), shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), am = gain(0.65);
    shaper.curve = distCurve(3.2);
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2.2;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), lfo = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine'; lfo.type = 'square';
    const g1 = gain(0.5), g2 = gain(0.2), g3 = gain(0.55), gl = gain(0.35);
    o1.connect(g1).connect(shaper); o2.connect(g2).connect(shaper);
    shaper.connect(am).connect(lp).connect(out);
    o3.connect(g3).connect(out);
    lfo.connect(gl).connect(am.gain);
    out.connect(master);
    [o1, o2, o3, lfo].forEach((o) => o.start());
    eng = { out, lp, o1, o2, o3, lfo };
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

  function buildRivals(n) {
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = gain(0);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 700;
      o.connect(lp); o2.connect(gain(0.3)).connect(lp); lp.connect(g);
      if (pan) { g.connect(pan).connect(master); } else g.connect(master);
      o.start(); o2.start();
      rivals.push({ o, o2, lp, g, pan, rpm: 0.2 });
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
      buildEngine(); buildSurface(); buildRivals(3);
      ready = true;
    } catch (e) { ready = false; }
    return ready;
  }

  function gearFor(v) { let g = 1; while (g < 6 && v >= GEARS[g]) g++; return g; }
  function rpmFor(v, g) { const lo = GEARS[g - 1], hi = Math.min(GEARS[g], 1.35); return (g === 1 ? 0.18 : 0.42) + (g === 1 ? 0.8 : 0.58) * clamp((v - lo) / (hi - lo), 0, 1); }

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
      case 'nitro':
        burst(1.3, 'bandpass', 300, 0.32 * v, 0, 2.2, 3800); tone(180, 1.0, 'sawtooth', 0.05 * v, 0, 420);
        break;
      case 'pickup': tone(1175, 0.08, 'sine', 0.24); tone(1760, 0.2, 'sine', 0.24, 0.07); break;
      case 'land': burst(0.22, 'lowpass', 260, 0.6 * v); tone(62, 0.22, 'sine', 0.55 * v, 0, 34); break;
      case 'splash': burst(0.5, 'bandpass', 1500, 0.45 * v, 0, 0.8, 500); break;
      case 'mud': burst(0.38, 'lowpass', 450, 0.45 * v, 0, 1.5, 200); break;
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
    setP(eng.out.gain, 0, 0.08);
    for (const k of ['hiss', 'gravel', 'wind', 'slosh']) setP(surf[k].g.gain, 0, 0.08);
    setP(surf.sloshDepth.gain, 0, 0.08);
    setP(surf.squeal.gain, 0, 0.05);
    for (const r of rivals) setP(r.g.gain, 0, 0.08);
  }

  function update(st) {
    if (!ready || ctx.state !== 'running') return;
    const t = ctx.currentTime, dt = clamp(t - lastT, 0, 0.1); lastT = t;
    if (!st || !st.active) { silence(); return; }
    const m = st.me, v = m.sp / 300;

    // motor y marchas
    const g = gearFor(v);
    if (g > gear && m.thr) { pop(0.01, 0.18); burst(0.03, 'highpass', 2600, 0.08); }
    gear = g;
    let target = v < 0.02 && !m.thr ? 0.14 : rpmFor(v, gear);
    if (st.count && m.thr) target = 0.78;                       // acelerar en parado en la cuenta atrás
    if (m.thr && (m.air || m.slide > 70 || m.hb)) target = Math.min(1.05, target + 0.22); // patina o vuela
    if (m.boost) target = Math.min(1.08, target + 0.08);
    rpm += (target - rpm) * Math.min(1, dt * (target > rpm ? 9 : 6));
    if (lastThr && !m.thr && rpm > 0.62 && !st.count) { const n = 1 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) pop(0.05 + i * 0.09 + Math.random() * 0.05, 0.22); }
    lastThr = m.thr;
    const f0 = 30 + rpm * 200;
    setP(eng.o1.frequency, f0, 0.02); setP(eng.o2.frequency, f0 * 2.012, 0.02);
    setP(eng.o3.frequency, f0 * 0.5, 0.02); setP(eng.lfo.frequency, f0 * 0.5, 0.02);
    setP(eng.lp.frequency, 450 + rpm * 2400 + (m.thr ? 900 : 0) + (m.boost ? 800 : 0), 0.03);
    setP(eng.out.gain, 0.1 + (m.thr ? 0.16 : 0.03) + rpm * 0.08, 0.04);

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
      if (!o) { setP(r.g.gain, 0); return; }
      const rv = o.sp / 300, tg = rv < 0.02 ? 0.15 : rpmFor(rv, gearFor(rv));
      r.rpm += (tg - r.rpm) * Math.min(1, dt * 6);
      const f = 30 + r.rpm * 200;
      setP(r.o.frequency, f * (1 + i * 0.013), 0.03); setP(r.o2.frequency, f * 2.01, 0.03);
      setP(r.lp.frequency, 400 + r.rpm * 1500, 0.05);
      const near = clamp(1 - o.dist / 650, 0, 1);
      setP(r.g.gain, near * near * (o.thr ? 0.07 : 0.035), 0.06);
      if (r.pan) setP(r.pan.pan, o.pan, 0.05);
    });
  }

  function applyMaster() { if (ready) setP(master.gain, muted ? 0 : volume, 0.05); }

  return {
    unlock() {
      if (!ctx) init();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (window.speechSynthesis && !voice) voice = pickVoice();
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    update,
    sfx,
    setMuted(m) { muted = !!m; applyMaster(); if (muted && window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (_) {} },
    setVoice(on) { voiceOn = !!on; if (!on && window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch (_) {} },
    get muted() { return muted; },
    get voice() { return voiceOn; },
    get ready() { return ready; },
  };
}
