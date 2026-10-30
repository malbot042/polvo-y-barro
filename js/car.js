// Coche de rally visto desde arriba: hatchback de competición con aletas ensanchadas,
// alerón, toma de techo, faros auxiliares y faldillas. Se pre-dibuja en alta resolución
// (sprite) por decoración y se ensucia en tiempo real según la superficie.
import { rng } from './util.js';

const K = 8;              // resolución del sprite: px por unidad de mundo
const SW = 38, SH = 22;   // tamaño del sprite en unidades de mundo (coche: 31 × 16,4)
export const CAR_LEN = 31, CAR_WID = 16.4;

// Decoraciones elegibles. base null = color de la paleta activa.
export const LIVERIES = {
  paleta:  { label: 'Color de la paleta', base: null,      sec: '#ffffff', ter: '#15171a', pat: 'swoosh',  pod: true },
  grava:   { label: 'Blanco y rojo',      base: '#f1efe8', sec: '#d6402b', ter: '#1d2a44', pat: 'stripes', pod: true },
  glaciar: { label: 'Azul glaciar',       base: '#1f5fa8', sec: '#8fd6f2', ter: '#ffffff', pat: 'split',   pod: false },
  oliva:   { label: 'Verde oliva',        base: '#55642f', sec: '#e8b23a', ter: '#121212', pat: 'chevron', pod: true },
  carbono: { label: 'Negro y naranja',    base: '#25272c', sec: '#ff6a1f', ter: '#e9e9e9', pat: 'swoosh',  pod: false },
};
export const RIVAL_LIVERIES = [
  { base: '#2f6fd6', sec: '#ffffff', ter: '#0d1b33', pat: 'stripes', pod: false },
  { base: '#2d9d5b', sec: '#f4f1e6', ter: '#0f2a1c', pat: 'split',   pod: true },
  { base: '#8a4fd1', sec: '#ffb020', ter: '#1a1030', pat: 'chevron', pod: false },
];
export const GHOST_LIVERY = { base: '#e8eef3', sec: '#b8c4cf', ter: '#8795a3', pat: 'stripes', pod: false };
export const DIRT = { barro: '#4e321c', polvo: '#b08657', nieve: '#f4f8fb' };

// Medio contorno (lado izquierdo, y < 0) de proa a popa; se refleja para cerrar la carrocería
const HALF = [
  [15.3, -3.8],
  ['Q', 15.4, -6.0, 13.8, -6.5],
  ['L', 12.6, -6.7],
  ['Q', 12.0, -7.9, 8.6, -8.0],    // aleta delantera
  ['Q', 5.4, -7.9, 4.8, -7.0],
  ['L', -4.6, -7.1],
  ['Q', -5.2, -8.1, -8.6, -8.2],   // aleta trasera
  ['Q', -12.0, -8.1, -12.6, -7.2],
  ['L', -14.4, -7.0],
  ['Q', -15.5, -6.6, -15.4, -4.6],
  ['L', -15.4, 0],
];
const WHEELS = [[8.6, -6.9, 1], [8.6, 6.9, 1], [-8.6, -6.9, 0], [-8.6, 6.9, 0]];

function bodyPath(c) {
  const nodes = [HALF[0]], segs = HALF.slice(1);
  c.beginPath(); c.moveTo(HALF[0][0], HALF[0][1]);
  for (const s of segs) {
    if (s[0] === 'L') { c.lineTo(s[1], s[2]); nodes.push([s[1], s[2]]); }
    else { c.quadraticCurveTo(s[1], s[2], s[3], s[4]); nodes.push([s[3], s[4]]); }
  }
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], p = nodes[i];
    if (s[0] === 'L') c.lineTo(p[0], -p[1]); else c.quadraticCurveTo(s[1], -s[2], p[0], -p[1]);
  }
  c.closePath();
}

function newSprite() {
  const cv = document.createElement('canvas');
  cv.width = SW * K; cv.height = SH * K;
  const c = cv.getContext('2d');
  c.setTransform(K, 0, 0, K, (SW * K) / 2, (SH * K) / 2);
  return [cv, c];
}

function pattern(c, L) {
  const { sec, ter } = L;
  c.lineJoin = 'round';
  switch (L.pat) {
    case 'swoosh': {
      c.fillStyle = sec;
      c.beginPath();
      c.moveTo(17, -9); c.bezierCurveTo(6, -9, 4, 2, -3, 4); c.bezierCurveTo(-8, 5.5, -12, 9, -17, 9);
      c.lineTo(-17, 5.2); c.bezierCurveTo(-12, 5.2, -8, 1.6, -3, 0.4); c.bezierCurveTo(3, -1.4, 6, -5.4, 17, -5.6);
      c.closePath(); c.fill();
      c.strokeStyle = ter; c.lineWidth = 0.55;
      c.beginPath(); c.moveTo(17, -4.6); c.bezierCurveTo(6, -4.4, 3, -0.4, -3, 1.4); c.bezierCurveTo(-8, 3, -12, 6.2, -17, 6.3); c.stroke();
      break;
    }
    case 'stripes': {
      c.fillStyle = sec; c.fillRect(-17, -2.7, 34, 1.9); c.fillRect(-17, 0.8, 34, 1.9);
      c.fillStyle = ter; c.fillRect(-17, -8.6, 34, 1.1); c.fillRect(-17, 7.5, 34, 1.1);
      break;
    }
    case 'split': {
      c.fillStyle = sec;
      c.beginPath(); c.moveTo(17, -9); c.lineTo(4, -9); c.lineTo(-6, 9); c.lineTo(17, 9); c.closePath(); c.fill();
      c.strokeStyle = ter; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(4.6, -9); c.lineTo(-5.4, 9); c.stroke();
      break;
    }
    case 'chevron': {
      c.fillStyle = sec;
      for (const x0 of [14.5, -2]) {
        c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 - 9, -9); c.lineTo(x0 - 12.5, -9); c.lineTo(x0 - 3.5, 0);
        c.lineTo(x0 - 12.5, 9); c.lineTo(x0 - 9, 9); c.closePath(); c.fill();
      }
      c.strokeStyle = ter; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(15.5, 0); c.lineTo(6.5, -9); c.moveTo(15.5, 0); c.lineTo(6.5, 9); c.stroke();
      break;
    }
  }
}

function makeSprite(L, num) {
  const [cv, c] = newSprite();
  // faldillas detrás de las ruedas traseras
  c.fillStyle = '#141619';
  for (const s of [-1, 1]) c.fillRect(-12.3, s > 0 ? 5.3 : -8.3, 0.8, 3);
  // retrovisores
  for (const s of [-1, 1]) {
    c.fillStyle = L.base; c.beginPath(); c.ellipse(4.2, s * 7.9, 0.95, 1.35, s * 0.3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.25; c.stroke();
  }

  // carrocería + decoración + volumen
  bodyPath(c); c.fillStyle = L.base; c.fill();
  c.save(); bodyPath(c); c.clip();
  pattern(c, L);
  const g = c.createLinearGradient(0, -8.3, 0, 8.3);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.16, 'rgba(0,0,0,.06)');
  g.addColorStop(0.4, 'rgba(255,255,255,.12)'); g.addColorStop(0.6, 'rgba(255,255,255,.03)');
  g.addColorStop(0.84, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(0,0,0,.46)');
  c.fillStyle = g; c.fillRect(-17, -9, 34, 18);
  // sombra en el borde de las aletas
  for (const x of [8.6, -8.6]) {
    for (const s of [-1, 1]) {
      const rg = c.createRadialGradient(x, s * 8.6, 0.5, x, s * 8.6, 4.2);
      rg.addColorStop(0, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(x - 5, s * 8.6 - 5, 10, 10);
    }
  }
  c.restore();
  bodyPath(c); c.lineWidth = 0.35; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();

  // juntas de capó y portón
  c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 0.18;
  c.beginPath(); c.moveTo(6.8, -5.6); c.quadraticCurveTo(13.6, -5.9, 14.3, -4); c.lineTo(14.3, 4); c.quadraticCurveTo(13.6, 5.9, 6.8, 5.6); c.stroke();
  c.beginPath(); c.moveTo(-10.1, -5.5); c.lineTo(-11.4, -5.4); c.moveTo(-10.1, 5.5); c.lineTo(-11.4, 5.4); c.stroke();
  // rejillas del capó
  for (const s of [-1, 1]) {
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(8.8, s > 0 ? 1.3 : -3.0, 3.0, 1.7, 0.5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.12;
    for (let x = 9.3; x < 11.6; x += 0.55) { c.beginPath(); c.moveTo(x, s > 0 ? 1.45 : -2.85); c.lineTo(x, s > 0 ? 2.85 : -1.45); c.stroke(); }
  }
  // capó: brillo
  let rg = c.createRadialGradient(11, -2.5, 0.2, 11, -2.5, 5);
  rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(6, -7.5, 9, 10);

  // parabrisas
  const wg = c.createLinearGradient(2.6, 0, 6.8, 0);
  wg.addColorStop(0, '#0d141c'); wg.addColorStop(1, '#3a5266');
  c.fillStyle = wg;
  c.beginPath(); c.moveTo(6.7, -5.3); c.quadraticCurveTo(7.2, 0, 6.7, 5.3); c.lineTo(2.6, 5.9); c.lineTo(2.6, -5.9); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.2)';
  c.beginPath(); c.moveTo(6.1, -4.6); c.lineTo(6.5, -3.5); c.lineTo(3.3, 3.8); c.lineTo(2.9, 2.6); c.closePath(); c.fill();
  // ventanillas laterales
  c.fillStyle = '#18232e';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(2.6, s * 5.9); c.lineTo(-6.5, s * 5.6); c.lineTo(-6.5, s * 6.3); c.lineTo(2.2, s * 6.7); c.closePath(); c.fill(); }

  // techo
  c.save();
  c.beginPath(); c.roundRect(-6.6, -5.6, 9.3, 11.2, 1.4); c.clip();
  c.fillStyle = L.base; c.fillRect(-7, -6, 10, 12);
  pattern(c, L);
  const tg = c.createLinearGradient(0, -5.6, 0, 5.6);
  tg.addColorStop(0, 'rgba(0,0,0,.25)'); tg.addColorStop(0.35, 'rgba(255,255,255,.14)'); tg.addColorStop(0.7, 'rgba(255,255,255,.04)'); tg.addColorStop(1, 'rgba(0,0,0,.28)');
  c.fillStyle = tg; c.fillRect(-7, -6, 10, 12);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.2; c.beginPath(); c.roundRect(-6.6, -5.6, 9.3, 11.2, 1.4); c.stroke();
  // toma de aire del techo
  c.fillStyle = '#111316'; c.beginPath(); c.roundRect(0.6, -1.6, 1.7, 3.2, 0.5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(2.0, -1.4, 0.25, 2.8);
  // panel de dorsal
  c.fillStyle = '#fbfbf8'; c.beginPath(); c.roundRect(-5.3, -3.4, 4.8, 6.8, 0.7); c.fill();
  c.strokeStyle = L.ter; c.lineWidth = 0.3; c.stroke();
  c.save(); c.translate(-2.9, 0); c.rotate(Math.PI / 2);
  c.fillStyle = '#15171a'; c.font = '800 4.6px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(num || '1'), 0, 0.2);
  c.restore();

  // luneta
  const bg = c.createLinearGradient(-10, 0, -6.6, 0);
  bg.addColorStop(0, '#2e4253'); bg.addColorStop(1, '#0d141c');
  c.fillStyle = bg;
  c.beginPath(); c.moveTo(-6.6, -5.4); c.lineTo(-6.6, 5.4); c.lineTo(-9.7, 5.0); c.quadraticCurveTo(-10.1, 0, -9.7, -5.0); c.closePath(); c.fill();

  // alerón trasero con derivas y bloques de patrocinador sin marca
  c.fillStyle = '#16181c'; c.beginPath(); c.roundRect(-14.4, -8.0, 2.6, 16, 0.5); c.fill();
  c.fillStyle = L.sec; c.fillRect(-13.9, -7.3, 1.5, 14.6);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-13.9, -7.3, 0.4, 14.6);
  c.fillStyle = '#0c0d0f'; c.fillRect(-14.8, -8.4, 3.4, 0.85); c.fillRect(-14.8, 7.55, 3.4, 0.85);
  c.fillStyle = L.ter; c.fillRect(-13.75, -2.6, 1.2, 5.2);
  c.fillStyle = L.sec; for (let y = -2.2; y < 2.4; y += 1.1) c.fillRect(-13.5, y, 0.7, 0.55);

  // faros, faros auxiliares y pilotos
  for (const s of [-1, 1]) {
    c.fillStyle = '#e8f0f5';
    c.beginPath(); c.moveTo(14.9, s * 3.7); c.lineTo(14.1, s * 6.0); c.lineTo(13.0, s * 5.9); c.lineTo(13.6, s * 3.7); c.closePath(); c.fill();
    c.fillStyle = '#8e1a14'; c.fillRect(-15.75, s > 0 ? 3.2 : -5.6, 0.55, 2.4);
  }
  if (L.pod) {
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(15.0, -5.1, 1.4, 10.2, 0.5); c.fill();
    for (const y of [-3.7, -1.25, 1.25, 3.7]) {
      c.fillStyle = '#f7f2d2'; c.beginPath(); c.arc(15.7, y, 1.05, 0, 7); c.fill();
      c.strokeStyle = '#a99437'; c.lineWidth = 0.28; c.stroke();
    }
  } else {
    c.fillStyle = '#e23b2e'; c.beginPath(); c.roundRect(15.2, 1.6, 0.9, 1.4, 0.3); c.fill();   // cinta de remolque
    c.fillStyle = '#111316'; c.fillRect(14.95, -2.6, 0.5, 5.2);                              // toma frontal
  }
  return cv;
}

function makeShadow() {
  const [cv, c] = newSprite();
  if ('filter' in c) c.filter = `blur(${K * 0.9}px)`;
  c.fillStyle = 'rgba(0,0,0,.45)';
  bodyPath(c); c.fill();
  c.fillRect(-14.4, -8, 2.6, 16);
  return cv;
}

function makeDirt(col) {
  const [cv, c] = newSprite();
  const R = rng(col.length * 977 + col.charCodeAt(1));
  c.save(); bodyPath(c); c.clip();
  c.fillStyle = col;
  for (let i = 0; i < 1500; i++) {
    const x = -16 + R() * 32, y = -8.5 + R() * 17;
    const w = (x < -4 ? 1 : x < 5 ? 0.5 : 0.32) * (Math.abs(y) > 4.8 ? 1.3 : 0.6);
    if (R() > w) continue;
    c.globalAlpha = 0.2 + R() * 0.6;
    c.beginPath(); c.arc(x, y, 0.2 + R() * 0.85, 0, 7); c.fill();
  }
  // salpicaduras detrás de cada rueda
  for (const [x, , ] of WHEELS) for (const s of [-1, 1]) {
    for (let k = 0; k < 16; k++) {
      c.globalAlpha = 0.25 + R() * 0.4;
      c.fillRect(x - 3.2 - R() * 7, s * (4.6 + R() * 3.6), 1.5 + R() * 3.5, 0.35 + R() * 0.3);
    }
  }
  c.restore();
  c.globalAlpha = 0.5; c.fillRect(-14.4, -8, 2.6, 16);
  return cv;
}

const cache = new Map();
function sprite(L, num) {
  const k = [L.base, L.sec, L.ter, L.pat, L.pod, num].join('|');
  let s = cache.get(k);
  if (!s) { if (cache.size > 40) cache.clear(); s = makeSprite(L, num); cache.set(k, s); }
  return s;
}
let SHADOW = null;
const dirtCache = {};

// Dibuja el coche en coordenadas de mundo (car: x, y, a, h, steer, brk, num, dirt)
export function drawCar(c, car, L, alpha = 1) {
  if (!SHADOW) SHADOW = makeShadow();
  const h = car.h || 0, sc = 1 + h * 0.014;
  c.save();
  c.globalAlpha = alpha * 0.85;
  c.translate(car.x + 2.2 + h * 0.6, car.y + 3.2 + h * 0.8); c.rotate(car.a); c.scale(sc, sc);
  c.drawImage(SHADOW, -SW / 2, -SH / 2, SW, SH);
  c.restore();

  c.save();
  c.globalAlpha = alpha;
  c.translate(car.x, car.y); c.rotate(car.a); c.scale(sc, sc);
  for (const [x, y, front] of WHEELS) {
    c.save(); c.translate(x, y); if (front) c.rotate((car.steer || 0) * 0.42);
    c.fillStyle = '#0e0f11'; c.beginPath(); c.roundRect(-3.1, -1.65, 6.2, 3.3, 0.9); c.fill();
    c.fillStyle = '#2c2f34'; for (let t = -2.5; t < 2.6; t += 1.1) c.fillRect(t, -1.65, 0.45, 3.3);
    c.restore();
  }
  c.drawImage(sprite(L, car.num), -SW / 2, -SH / 2, SW, SH);
  if (car.dirt) {
    for (const k in DIRT) {
      const v = car.dirt[k];
      if (v > 0.02) {
        if (!dirtCache[k]) dirtCache[k] = makeDirt(DIRT[k]);
        c.globalAlpha = alpha * Math.min(0.6, v * 0.75);
        c.drawImage(dirtCache[k], -SW / 2, -SH / 2, SW, SH);
      }
    }
    c.globalAlpha = alpha;
  }
  if (car.brk) {
    c.globalAlpha = alpha * 0.4; c.fillStyle = '#ff2a1a';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(-16.3, s * 4.4, 2.4, 0, 7); c.fill(); }
    c.globalAlpha = alpha; c.fillStyle = '#ff3b2a';
    for (const s of [-1, 1]) c.fillRect(-15.8, s > 0 ? 3.2 : -5.6, 0.7, 2.4);
  }
  c.restore();
}

// Vista previa en un canvas de interfaz
export function drawCarPreview(cv, L, num = '1', rot = -Math.PI / 2) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const vertical = Math.abs(Math.sin(rot)) > 0.5;
  const s = Math.min(cv.width / ((vertical ? SH : SW) + 1), cv.height / ((vertical ? SW : SH) + 1));
  c.setTransform(s, 0, 0, s, cv.width / 2 - 1.2 * s, cv.height / 2 - 1.6 * s);
  c.imageSmoothingQuality = 'high';
  drawCar(c, { x: 0, y: 0, a: rot, h: 0, num, steer: 0 }, L, 1);
}
