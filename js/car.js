// Coches de rally. Tres modelos (compacto, coupé y pick-up de raid), cada uno con su silueta
// y sus detalles. La vista cenital se pre-dibuja en alta resolución (sprite) por modelo +
// decoración + dorsal, y en tiempo real se le añaden suciedad y daños. En el juego, el coche
// se ve en isométrico montando capas de ese sprite a distintas alturas (sprite stacking).
import { rng, lerp, shade, isoView } from './util.js';

const K = 8;              // resolución del sprite: px por unidad de mundo
const SW = 40, SH = 24;   // tamaño del sprite en unidades de mundo

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

// Medio contorno (lado y < 0) de proa a popa; se refleja para cerrar la carrocería.
const MODELS = {
  compacto: {
    half: [[15.3, -3.8], ['Q', 15.4, -6.0, 13.8, -6.5], ['L', 12.6, -6.7], ['Q', 12.0, -7.9, 8.6, -8.0], ['Q', 5.4, -7.9, 4.8, -7.0],
      ['L', -4.6, -7.1], ['Q', -5.2, -8.1, -8.6, -8.2], ['Q', -12.0, -8.1, -12.6, -7.2], ['L', -14.4, -7.0], ['Q', -15.5, -6.6, -15.4, -4.6], ['L', -15.4, 0]],
    axle: [8.6, -8.6], wy: 6.9, tire: [6.2, 3.3], front: 15.3, rear: -15.4, lamps: [-15.75, 3.2, 2.4],
  },
  coupe: {
    half: [[16.5, -3.2], ['Q', 16.6, -5.6, 15.0, -6.2], ['L', 13.5, -6.4], ['Q', 12.8, -7.6, 10.0, -7.7], ['Q', 7.2, -7.6, 6.6, -6.7],
      ['L', -6.6, -6.8], ['Q', -7.2, -7.8, -10.0, -7.9], ['Q', -12.8, -7.8, -13.4, -6.9], ['L', -15.6, -6.6], ['Q', -16.5, -6.2, -16.4, -4.4], ['L', -16.4, 0]],
    axle: [10, -10], wy: 6.7, tire: [6.2, 3.2], front: 16.5, rear: -16.4, lamps: [-16.7, 2.6, 3.0],
  },
  raid: {
    half: [[16.6, -5.0], ['Q', 16.8, -7.2, 15.2, -7.4], ['L', 13.8, -7.6], ['Q', 13.4, -8.7, 10.5, -8.8], ['Q', 7.6, -8.7, 7.2, -7.8],
      ['L', -7.3, -7.8], ['Q', -7.7, -8.8, -10.5, -8.9], ['Q', -13.4, -8.8, -13.8, -7.9], ['L', -16.4, -7.8], ['Q', -16.9, -7.6, -16.9, -6.4], ['L', -16.9, 0]],
    axle: [10.5, -10.5], wy: 7.4, tire: [7.4, 3.9], front: 16.6, rear: -16.9, lamps: [-17.2, 4.6, 2.2],
  },
};
const model = (id) => MODELS[id] || MODELS.compacto;
const wheelsOf = (M) => [[M.axle[0], -M.wy, 1], [M.axle[0], M.wy, 1], [M.axle[1], -M.wy, 0], [M.axle[1], M.wy, 0]];

function bodyPath(c, M) {
  const H = M.half, nodes = [H[0]], segs = H.slice(1);
  c.beginPath(); c.moveTo(H[0][0], H[0][1]);
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
      c.moveTo(18, -10); c.bezierCurveTo(6, -9, 4, 2, -3, 4); c.bezierCurveTo(-8, 5.5, -12, 9, -18, 10);
      c.lineTo(-18, 5.2); c.bezierCurveTo(-12, 5.2, -8, 1.6, -3, 0.4); c.bezierCurveTo(3, -1.4, 6, -5.4, 18, -5.6);
      c.closePath(); c.fill();
      c.strokeStyle = ter; c.lineWidth = 0.55;
      c.beginPath(); c.moveTo(18, -4.6); c.bezierCurveTo(6, -4.4, 3, -0.4, -3, 1.4); c.bezierCurveTo(-8, 3, -12, 6.2, -18, 6.3); c.stroke();
      break;
    }
    case 'stripes': {
      c.fillStyle = sec; c.fillRect(-18, -2.7, 36, 1.9); c.fillRect(-18, 0.8, 36, 1.9);
      c.fillStyle = ter; c.fillRect(-18, -9.6, 36, 2.1); c.fillRect(-18, 7.5, 36, 2.1);
      break;
    }
    case 'split': {
      c.fillStyle = sec;
      c.beginPath(); c.moveTo(18, -10); c.lineTo(4, -10); c.lineTo(-6, 10); c.lineTo(18, 10); c.closePath(); c.fill();
      c.strokeStyle = ter; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(4.6, -10); c.lineTo(-5.4, 10); c.stroke();
      break;
    }
    case 'chevron': {
      c.fillStyle = sec;
      for (const x0 of [15, -2]) {
        c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 - 10, -10); c.lineTo(x0 - 13.5, -10); c.lineTo(x0 - 3.5, 0);
        c.lineTo(x0 - 13.5, 10); c.lineTo(x0 - 10, 10); c.closePath(); c.fill();
      }
      c.strokeStyle = ter; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(16, 0); c.lineTo(6, -10); c.moveTo(16, 0); c.lineTo(6, 10); c.stroke();
      break;
    }
  }
}

// Volumen general: laterales oscuros, centro con brillo, sombra en las aletas
function shadeBody(c, M) {
  const hw = 9.2;
  const g = c.createLinearGradient(0, -hw, 0, hw);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.16, 'rgba(0,0,0,.06)');
  g.addColorStop(0.4, 'rgba(255,255,255,.12)'); g.addColorStop(0.6, 'rgba(255,255,255,.03)');
  g.addColorStop(0.84, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(0,0,0,.46)');
  c.fillStyle = g; c.fillRect(-19, -11, 38, 22);
  for (const x of M.axle) for (const s of [-1, 1]) {
    const y = s * (M.wy + 1.7);
    const rg = c.createRadialGradient(x, y, 0.5, x, y, 4.4);
    rg.addColorStop(0, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(x - 5, y - 5, 10, 10);
  }
}

function glass(c, x0, x1, hwFront, hwBack, light) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, light ? '#3a5266' : '#0d141c'); g.addColorStop(1, light ? '#0d141c' : '#3a5266');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x1, -hwFront); c.quadraticCurveTo(x1 + 0.5, 0, x1, hwFront); c.lineTo(x0, hwBack); c.lineTo(x0, -hwBack); c.closePath(); c.fill();
}

function roofNumber(c, L, x, num, w = 4.8, h = 6.8) {
  c.fillStyle = '#fbfbf8'; c.beginPath(); c.roundRect(x - w / 2, -h / 2, w, h, 0.7); c.fill();
  c.strokeStyle = L.ter; c.lineWidth = 0.3; c.stroke();
  c.save(); c.translate(x, 0); c.rotate(Math.PI / 2);
  c.fillStyle = '#15171a'; c.font = '800 4.6px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(num || '1'), 0, 0.2);
  c.restore();
}

function roof(c, L, x0, x1, hw, r = 1.4) {
  c.save();
  c.beginPath(); c.roundRect(x0, -hw, x1 - x0, hw * 2, r); c.clip();
  c.fillStyle = L.base; c.fillRect(x0 - 1, -hw - 1, x1 - x0 + 2, hw * 2 + 2);
  pattern(c, L);
  const tg = c.createLinearGradient(0, -hw, 0, hw);
  tg.addColorStop(0, 'rgba(0,0,0,.25)'); tg.addColorStop(0.35, 'rgba(255,255,255,.14)'); tg.addColorStop(0.7, 'rgba(255,255,255,.04)'); tg.addColorStop(1, 'rgba(0,0,0,.28)');
  c.fillStyle = tg; c.fillRect(x0 - 1, -hw - 1, x1 - x0 + 2, hw * 2 + 2);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.2; c.beginPath(); c.roundRect(x0, -hw, x1 - x0, hw * 2, r); c.stroke();
}

function lightPod(c, x, span) {
  c.fillStyle = '#111316'; c.beginPath(); c.roundRect(x - 0.7, -span, 1.4, span * 2, 0.5); c.fill();
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y = -span + 1.3 + (i * (span * 2 - 2.6)) / (n - 1);
    c.fillStyle = '#f7f2d2'; c.beginPath(); c.arc(x, y, 1.05, 0, 7); c.fill();
    c.strokeStyle = '#a99437'; c.lineWidth = 0.28; c.stroke();
  }
}

function headlights(c, x, y0, y1, depth) {
  for (const s of [-1, 1]) {
    c.fillStyle = '#e8f0f5';
    c.beginPath(); c.moveTo(x, s * y0); c.lineTo(x - 0.8, s * y1); c.lineTo(x - 0.8 - depth, s * (y1 - 0.1)); c.lineTo(x - depth + 0.5, s * y0); c.closePath(); c.fill();
  }
}

function tailLights(c, M) {
  const [x, y0, len] = M.lamps;
  c.fillStyle = '#8e1a14';
  for (const s of [-1, 1]) c.fillRect(x, s > 0 ? y0 : -y0 - len, 0.55, len);
}

function mirrors(c, L, x, y) {
  for (const s of [-1, 1]) {
    c.fillStyle = L.base; c.beginPath(); c.ellipse(x, s * y, 0.95, 1.35, s * 0.3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.25; c.stroke();
  }
}

function vents(c, x, ys, w = 3.0) {
  for (const s of [-1, 1]) {
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(x, s > 0 ? ys : -ys - 1.7, w, 1.7, 0.5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.12;
    for (let xx = x + 0.5; xx < x + w - 0.2; xx += 0.55) { c.beginPath(); c.moveTo(xx, s > 0 ? ys + 0.15 : -ys - 1.55); c.lineTo(xx, s > 0 ? ys + 1.55 : -ys - 0.15); c.stroke(); }
  }
}

function bonnetShine(c, x, y) {
  const rg = c.createRadialGradient(x, y, 0.2, x, y, 5);
  rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(x - 5, y - 5, 10, 10);
}

const DETAILS = {
  compacto(c, L, num) {
    c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 0.18;
    c.beginPath(); c.moveTo(6.8, -5.6); c.quadraticCurveTo(13.6, -5.9, 14.3, -4); c.lineTo(14.3, 4); c.quadraticCurveTo(13.6, 5.9, 6.8, 5.6); c.stroke();
    vents(c, 8.8, 1.3);
    bonnetShine(c, 11, -2.5);
    glass(c, 2.6, 6.7, 5.3, 5.9);
    c.fillStyle = 'rgba(255,255,255,.2)';
    c.beginPath(); c.moveTo(6.1, -4.6); c.lineTo(6.5, -3.5); c.lineTo(3.3, 3.8); c.lineTo(2.9, 2.6); c.closePath(); c.fill();
    c.fillStyle = '#18232e';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(2.6, s * 5.9); c.lineTo(-6.5, s * 5.6); c.lineTo(-6.5, s * 6.3); c.lineTo(2.2, s * 6.7); c.closePath(); c.fill(); }
    roof(c, L, -6.6, 2.7, 5.6);
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(0.6, -1.6, 1.7, 3.2, 0.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(2.0, -1.4, 0.25, 2.8);
    roofNumber(c, L, -2.9, num);
    glass(c, -9.9, -6.6, 5.4, 5.0, true);
    // alerón
    c.fillStyle = '#16181c'; c.beginPath(); c.roundRect(-14.4, -8.0, 2.6, 16, 0.5); c.fill();
    c.fillStyle = L.sec; c.fillRect(-13.9, -7.3, 1.5, 14.6);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-13.9, -7.3, 0.4, 14.6);
    c.fillStyle = '#0c0d0f'; c.fillRect(-14.8, -8.4, 3.4, 0.85); c.fillRect(-14.8, 7.55, 3.4, 0.85);
    c.fillStyle = L.ter; c.fillRect(-13.75, -2.6, 1.2, 5.2);
    c.fillStyle = L.sec; for (let y = -2.2; y < 2.4; y += 1.1) c.fillRect(-13.5, y, 0.7, 0.55);
    headlights(c, 14.9, 3.7, 6.0, 1.9);
    if (L.pod) lightPod(c, 15.7, 5.1);
    else { c.fillStyle = '#e23b2e'; c.beginPath(); c.roundRect(15.2, 1.6, 0.9, 1.4, 0.3); c.fill(); c.fillStyle = '#111316'; c.fillRect(14.95, -2.6, 0.5, 5.2); }
  },

  // Coupé de los 70-80: capó largo con abultamiento, cabina retrasada, cola de pato
  coupe(c, L, num) {
    c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 0.18;
    c.beginPath(); c.moveTo(5.0, -5.5); c.lineTo(15.4, -5.2); c.moveTo(5.0, 5.5); c.lineTo(15.4, 5.2); c.stroke();
    // abultamiento del capó
    const hb = c.createLinearGradient(0, -2.6, 0, 2.6);
    hb.addColorStop(0, 'rgba(0,0,0,.22)'); hb.addColorStop(0.45, 'rgba(255,255,255,.22)'); hb.addColorStop(1, 'rgba(0,0,0,.2)');
    c.fillStyle = hb; c.beginPath(); c.roundRect(6.5, -2.6, 8.4, 5.2, 2); c.fill();
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(12.2, -1.3, 1.8, 2.6, 0.5); c.fill();
    bonnetShine(c, 11.5, -3.6);
    glass(c, 0.4, 4.9, 5.0, 5.7);
    c.fillStyle = 'rgba(255,255,255,.2)';
    c.beginPath(); c.moveTo(4.3, -4.3); c.lineTo(4.7, -3.2); c.lineTo(1.1, 3.6); c.lineTo(0.7, 2.5); c.closePath(); c.fill();
    c.fillStyle = '#18232e';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0.4, s * 5.7); c.lineTo(-7.4, s * 5.3); c.lineTo(-7.4, s * 6.0); c.lineTo(0.1, s * 6.5); c.closePath(); c.fill(); }
    roof(c, L, -7.4, 0.5, 5.3, 1.8);
    roofNumber(c, L, -3.4, num, 4.6, 6.4);
    // luneta inclinada con persianas
    glass(c, -11.6, -7.4, 5.2, 4.6, true);
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.35;
    for (let x = -11.0; x < -7.6; x += 0.8) { c.beginPath(); c.moveTo(x, -4.5); c.lineTo(x, 4.5); c.stroke(); }
    // cola de pato
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-15.2, -6.2, 0.5, 12.4);
    c.fillStyle = L.sec; c.fillRect(-16.1, -5.8, 0.9, 11.6);
    // faros escamoteables (cerrados) y antiniebla
    for (const s of [-1, 1]) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.roundRect(13.2, s > 0 ? 3.4 : -5.8, 2.4, 2.4, 0.4); c.fill();
      c.fillStyle = '#f7f2d2'; c.beginPath(); c.arc(16.3, s * 4.4, 0.85, 0, 7); c.fill();
    }
    if (L.pod) lightPod(c, 17.0, 3.8);
  },

  // Pick-up de raid: cabina corta, caja con ruedas de repuesto, arco de seguridad y snorkel
  raid(c, L, num) {
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.2;
    c.beginPath(); c.moveTo(8.0, -6.6); c.lineTo(15.8, -6.4); c.lineTo(15.8, 6.4); c.lineTo(8.0, 6.6); c.stroke();
    vents(c, 10.6, 2.0, 3.6);
    bonnetShine(c, 12.5, -3.5);
    glass(c, 4.6, 7.8, 6.4, 6.9);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.beginPath(); c.moveTo(7.3, -5.6); c.lineTo(7.7, -4.4); c.lineTo(5.3, 4.6); c.lineTo(4.9, 3.4); c.closePath(); c.fill();
    roof(c, L, -3.2, 4.7, 6.8, 1);
    roofNumber(c, L, 0.6, num, 5.2, 7.2);
    // baca con faros
    c.strokeStyle = '#1a1c20'; c.lineWidth = 0.5; c.beginPath(); c.roundRect(-2.8, -6.5, 7.1, 13, 0.6); c.stroke();
    if (L.pod) lightPod(c, 4.6, 5.6);
    // caja de carga
    c.fillStyle = '#1d2024'; c.beginPath(); c.roundRect(-15.8, -6.9, 12.0, 13.8, 0.6); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 0.25;
    for (let y = -5.8; y < 6; y += 1.6) { c.beginPath(); c.moveTo(-15.5, y); c.lineTo(-4.2, y); c.stroke(); }
    for (const y of [-3.2, 3.2]) {
      c.fillStyle = '#0d0e10'; c.beginPath(); c.arc(-10.4, y, 3.0, 0, 7); c.fill();
      c.strokeStyle = '#30343a'; c.lineWidth = 0.5; for (let r = 1; r < 3; r += 0.8) { c.beginPath(); c.arc(-10.4, y, r, 0, 7); c.stroke(); }
      c.fillStyle = '#6b7078'; c.beginPath(); c.arc(-10.4, y, 0.8, 0, 7); c.fill();
    }
    // arco de seguridad
    c.strokeStyle = L.sec; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-4.4, -6.6); c.lineTo(-4.4, 6.6); c.stroke();
    c.beginPath(); c.moveTo(-4.4, -6.2); c.lineTo(-8.4, -5.6); c.moveTo(-4.4, 6.2); c.lineTo(-8.4, 5.6); c.stroke();
    // snorkel
    c.fillStyle = '#16181c'; c.beginPath(); c.roundRect(5.4, 7.0, 3.8, 1.2, 0.5); c.fill();
    c.beginPath(); c.arc(9.0, 7.6, 0.9, 0, 7); c.fill();
    // defensa delantera
    c.fillStyle = '#1a1c20'; c.beginPath(); c.roundRect(16.4, -6.2, 1.0, 12.4, 0.4); c.fill();
    headlights(c, 16.2, 4.2, 6.6, 1.4);
    mirrors(c, L, 6.6, 8.6);
  },
};

function makeSprite(L, num, id) {
  const M = model(id), [cv, c] = newSprite();
  c.fillStyle = '#141619';
  const [rx] = [M.axle[1]];
  for (const s of [-1, 1]) c.fillRect(rx - 3.6, s > 0 ? M.wy - 1.6 : -M.wy - 1.4, 0.8, 3);   // faldillas
  if (id !== 'raid') mirrors(c, L, id === 'coupe' ? 2.4 : 4.2, id === 'coupe' ? 7.4 : 7.9);
  bodyPath(c, M); c.fillStyle = L.base; c.fill();
  c.save(); bodyPath(c, M); c.clip(); pattern(c, L); shadeBody(c, M); c.restore();
  bodyPath(c, M); c.lineWidth = 0.35; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  (DETAILS[id] || DETAILS.compacto)(c, L, num);
  tailLights(c, M);
  return cv;
}

function makeShadow(id) {
  const M = model(id), [cv, c] = newSprite();
  if ('filter' in c) c.filter = `blur(${K * 0.9}px)`;
  c.fillStyle = 'rgba(0,0,0,.45)';
  bodyPath(c, M); c.fill();
  return cv;
}

function makeDirt(col, id) {
  const M = model(id), [cv, c] = newSprite();
  const R = rng(col.length * 977 + col.charCodeAt(1) + id.length);
  c.save(); bodyPath(c, M); c.clip();
  c.fillStyle = col;
  for (let i = 0; i < 1600; i++) {
    const x = -17 + R() * 34, y = -9.5 + R() * 19;
    const w = (x < -4 ? 1 : x < 5 ? 0.5 : 0.32) * (Math.abs(y) > 5 ? 1.3 : 0.6);
    if (R() > w) continue;
    c.globalAlpha = 0.2 + R() * 0.6;
    c.beginPath(); c.arc(x, y, 0.2 + R() * 0.85, 0, 7); c.fill();
  }
  for (const [x] of wheelsOf(M)) for (const s of [-1, 1]) {
    for (let k = 0; k < 16; k++) {
      c.globalAlpha = 0.25 + R() * 0.4;
      c.fillRect(x - 3.2 - R() * 7, s * (4.8 + R() * 3.8), 1.5 + R() * 3.5, 0.35 + R() * 0.3);
    }
  }
  c.restore();
  return cv;
}

// Daños: abolladuras, arañazos y luna agrietada
function makeDamage(id) {
  const M = model(id), [cv, c] = newSprite();
  const R = rng(4242 + id.length);
  c.save(); bodyPath(c, M); c.clip();
  for (let i = 0; i < 14; i++) {
    const x = (R() < 0.5 ? M.front - 3 : M.rear + 3) * (0.5 + R() * 0.5), y = (R() < 0.5 ? -1 : 1) * (4 + R() * 5);
    const rg = c.createRadialGradient(x, y, 0.2, x, y, 1.5 + R() * 2.5);
    rg.addColorStop(0, 'rgba(0,0,0,.55)'); rg.addColorStop(0.6, 'rgba(0,0,0,.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(x - 5, y - 5, 10, 10);
  }
  c.strokeStyle = 'rgba(235,235,235,.75)'; c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = -16 + R() * 32, y = (R() < 0.5 ? -1 : 1) * (3 + R() * 6);
    c.lineWidth = 0.12 + R() * 0.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 6, y + (R() - 0.5) * 1.4); c.stroke();
  }
  c.restore();
  // luna agrietada
  const gx = id === 'coupe' ? 3 : id === 'raid' ? 6.4 : 4.8;
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.14;
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, l = 1.5 + R() * 3;
    c.beginPath(); c.moveTo(gx, -1.4); c.lineTo(gx + Math.cos(a) * l * 0.5, -1.4 + Math.sin(a) * l); c.stroke();
  }
  return cv;
}

const cache = new Map();
function sprite(L, num, id) {
  const k = [id, L.base, L.sec, L.ter, L.pat, L.pod, num].join('|');
  let s = cache.get(k);
  if (!s) { if (cache.size > 48) cache.clear(); s = makeSprite(L, num, id); cache.set(k, s); }
  return s;
}
const extra = {};
function layer(kind, id, maker) { const k = kind + id; return extra[k] || (extra[k] = maker()); }

// Dibuja el coche en coordenadas de mundo (car: x, y, a, h, steer, brk, num, dirt, dmg, model)
export function drawCar(c, car, L, alpha = 1) {
  const id = MODELS[car.model] ? car.model : 'compacto', M = model(id);
  const h = car.h || 0, sc = 1 + h * 0.014;
  c.save();
  c.globalAlpha = alpha * 0.85;
  c.translate(car.x + 2.2 + h * 0.6, car.y + 3.2 + h * 0.8); c.rotate(car.a); c.scale(sc, sc);
  c.drawImage(layer('sh', id, () => makeShadow(id)), -SW / 2, -SH / 2, SW, SH);
  c.restore();

  c.save();
  c.globalAlpha = alpha;
  c.translate(car.x, car.y); c.rotate(car.a); c.scale(sc, sc);
  const [tl, tw] = M.tire;
  for (const [x, y, front] of wheelsOf(M)) {
    c.save(); c.translate(x, y); if (front) c.rotate((car.steer || 0) * 0.42);
    c.fillStyle = '#0e0f11'; c.beginPath(); c.roundRect(-tl / 2, -tw / 2, tl, tw, 0.9); c.fill();
    c.fillStyle = '#2c2f34'; for (let t = -tl / 2 + 0.6; t < tl / 2 - 0.3; t += 1.1) c.fillRect(t, -tw / 2, 0.45, tw);
    c.restore();
  }
  c.drawImage(sprite(L, car.num, id), -SW / 2, -SH / 2, SW, SH);
  if (car.dirt) {
    for (const k in DIRT) {
      const v = car.dirt[k];
      if (v > 0.02) {
        c.globalAlpha = alpha * Math.min(0.6, v * 0.75);
        c.drawImage(layer('d' + k, id, () => makeDirt(DIRT[k], id)), -SW / 2, -SH / 2, SW, SH);
      }
    }
    c.globalAlpha = alpha;
  }
  if (car.dmg > 0.05) {
    c.globalAlpha = alpha * Math.min(1, car.dmg * 1.3);
    c.drawImage(layer('dm', id, () => makeDamage(id)), -SW / 2, -SH / 2, SW, SH);
    c.globalAlpha = alpha;
  }
  if (car.brk) {
    const [lx, ly, len] = M.lamps;
    c.globalAlpha = alpha * 0.4; c.fillStyle = '#ff2a1a';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(lx - 0.5, s * (ly + len / 2), 2.4, 0, 7); c.fill(); }
    c.globalAlpha = alpha; c.fillStyle = '#ff3b2a';
    for (const s of [-1, 1]) c.fillRect(lx - 0.1, s > 0 ? ly : -ly - len, 0.7, len);
  }
  c.restore();
}

// Datos para la iluminación nocturna: posición del frontal y si lleva faros auxiliares
export function carFront(id) { return model(id).front; }

// ---------- Vista isométrica ----------

const KS = 4;                       // resolución de las capas laterales
const BODY_Z = 5.5, ROOF_Z = 9.5;   // altura del capó y del techo
// Habitáculo: base y techo como [x trasera, x delantera, medio ancho]
const CABIN = {
  compacto: { base: [-9.9, 6.7, 5.9], top: [-6.6, 2.7, 5.6] },
  coupe:    { base: [-11.6, 4.9, 5.7], top: [-7.4, 0.5, 5.3] },
  raid:     { base: [-3.6, 7.8, 6.9], top: [-3.2, 4.7, 6.8] },
};
export const CAR_TOP = ROOF_Z;

const sides = new Map();
function side(id, col) {
  const k = id + col;
  let cv = sides.get(k);
  if (!cv) {
    if (sides.size > 60) sides.clear();
    cv = document.createElement('canvas');
    cv.width = SW * KS; cv.height = SH * KS;
    const c = cv.getContext('2d');
    c.setTransform(KS, 0, 0, KS, (SW * KS) / 2, (SH * KS) / 2);
    bodyPath(c, model(id)); c.fillStyle = col; c.fill();
    sides.set(k, cv);
  }
  return cv;
}

// Sombra del coche sobre el suelo (o sobre el tablero del puente, a la altura z0)
export function drawCarShadowIso(c, V, car, z0 = 0) {
  const id = MODELS[car.model] ? car.model : 'compacto', h = car.h || 0;
  V.set(c, z0);
  c.globalAlpha = 0.85 * Math.max(0.35, 1 - h / 60);
  c.translate(car.x + 1.5 + h * 0.55, car.y + 1.5 + h * 0.55); c.rotate(car.a);
  c.drawImage(layer('sh', id, () => makeShadow(id)), -SW / 2, -SH / 2, SW, SH);
  c.globalAlpha = 1;
}

// Coche en isométrico: ruedas, laterales, capó con suciedad y daños, cabina acristalada y techo.
// z0: altura del suelo bajo el coche (tablero de un puente); dx, dy: desplazamiento en pantalla.
export function drawCarIso(c, V, car, L, z0 = 0, dx = 0, dy = 0) {
  const id = MODELS[car.model] ? car.model : 'compacto', M = model(id), cab = CABIN[id];
  const base = z0 + (car.h || 0);
  const at = (z) => { V.set(c, base + z, dx, dy); c.translate(car.x, car.y); c.rotate(car.a); };
  const [tl, tw] = M.tire;
  for (const z of [0.3, 1.1, 1.9, 2.7]) {
    at(z);
    c.fillStyle = z > 2 ? '#2b2e33' : '#0e0f11';
    for (const [x, y, front] of wheelsOf(M)) {
      if (front && car.steer) { c.save(); c.translate(x, y); c.rotate(car.steer * 0.42); c.fillRect(-tl / 2, -tw / 2, tl, tw); c.restore(); }
      else c.fillRect(x - tl / 2, y - tw / 2, tl, tw);
    }
  }
  const lo = side(id, '#17191c'), mid = side(id, shade(L.base, 0.52)), hi = side(id, shade(L.base, 0.74));
  for (let z = 1.6; z < BODY_Z; z += 0.5) { at(z); c.drawImage(z < 2.2 ? lo : z < 3.8 ? mid : hi, -SW / 2, -SH / 2, SW, SH); }
  const [lx, ly, len] = M.lamps;
  at(BODY_Z - 1.2);
  c.fillStyle = car.brk ? '#ff3b2a' : '#8e1a14';
  for (const s of [-1, 1]) c.fillRect(lx - 0.4, s > 0 ? ly : -ly - len, 1, len);
  at(BODY_Z);
  const spr = sprite(L, car.num, id);
  c.drawImage(spr, -SW / 2, -SH / 2, SW, SH);
  const dirt = [];
  if (car.dirt) {
    for (const k in DIRT) {
      const v = car.dirt[k];
      if (v > 0.02) dirt.push([layer('d' + k, id, () => makeDirt(DIRT[k], id)), Math.min(0.6, v * 0.75)]);
    }
  }
  for (const [img, a] of dirt) { c.globalAlpha = a; c.drawImage(img, -SW / 2, -SH / 2, SW, SH); }
  if (car.dmg > 0.05) { c.globalAlpha = Math.min(1, car.dmg * 1.3); c.drawImage(layer('dm', id, () => makeDamage(id)), -SW / 2, -SH / 2, SW, SH); }
  c.globalAlpha = 1;
  if (car.brk) {
    c.globalAlpha = 0.45; c.fillStyle = '#ff2a1a';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(lx - 0.5, s * (ly + len / 2), 2.4, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  const glassCol = '#1c2833', pillar = shade(L.base, 0.68);
  for (let z = BODY_Z + 0.5; z < ROOF_Z; z += 0.5) {
    const t = (z - BODY_Z) / (ROOF_Z - BODY_Z);
    const x0 = lerp(cab.base[0], cab.top[0], t), x1 = lerp(cab.base[1], cab.top[1], t), hw = lerp(cab.base[2], cab.top[2], t);
    at(z);
    c.fillStyle = z > ROOF_Z - 1.1 ? pillar : glassCol;
    c.beginPath(); c.roundRect(x0, -hw, x1 - x0, hw * 2, 1.2); c.fill();
  }
  at(ROOF_Z);
  const [rx0, rx1, rhw] = cab.top, sx = (rx0 + SW / 2) * K, sy = (SH / 2 - rhw) * K, sw = (rx1 - rx0) * K, sh = rhw * 2 * K;
  c.drawImage(spr, sx, sy, sw, sh, rx0, -rhw, rx1 - rx0, rhw * 2);
  for (const [img, a] of dirt) { c.globalAlpha = a * 0.7; c.drawImage(img, sx, sy, sw, sh, rx0, -rhw, rx1 - rx0, rhw * 2); }
  c.globalAlpha = 1;
}

// Vista previa en un canvas de interfaz, en isométrico y de tres cuartos
export function drawCarPreview(cv, L, num = '1', id = 'compacto', extraState = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width / 36, cv.height / 22);
  const V = isoView(s, 0, 0, cv.width, cv.height + ROOF_Z * s * 0.8);
  c.imageSmoothingQuality = 'high';
  const car = { x: 0, y: 0, a: -0.3, h: 0, num, steer: 0, model: id, ...extraState };
  drawCarShadowIso(c, V, car);
  drawCarIso(c, V, car, L);
  c.setTransform(1, 0, 0, 1, 0, 0);
}
