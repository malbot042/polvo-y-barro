// Coches de rally de Grupo A de finales de los 80 y principios de los 90. Tres modelos (compacto,
// coupé y berlina, todos turbo 4x4), cada uno con su silueta
// y sus detalles. La vista cenital se pre-dibuja en alta resolución (sprite) por modelo +
// decoración + dorsal, y en tiempo real se le añaden suciedad y daños. En el juego, el coche
// se ve en isométrico montando capas de ese sprite a distintas alturas (sprite stacking).
import { rng, lerp, shade, isoView, ISO_Z } from './util.js';

const K = 8;              // resolución del sprite: px por unidad de mundo
const SW = 40, SH = 24;   // tamaño del sprite en unidades de mundo

// Decoraciones elegibles, con los colores clásicos de los rallies de finales de los 80 y principios
// de los 90 (sin marcas ni patrocinadores reales). base null = color de la paleta activa.
export const LIVERIES = {
  paleta:   { label: 'Color de la paleta',          base: null,      sec: '#ffffff', ter: '#15171a', pat: 'band',    pod: true },
  franjas:  { label: 'Blanco con franjas azul y rojo', base: '#f3f1ea', sec: '#1d3f8f', ter: '#d4322c', pat: 'sash',  pod: true },
  azul:     { label: 'Azul y amarillo',             base: '#1c3f94', sec: '#f5c400', ter: '#ffffff', pat: 'band',    pod: true },
  rojo:     { label: 'Rojo y blanco',               base: '#c8202a', sec: '#ffffff', ter: '#15171a', pat: 'swoosh',  pod: false },
  oro:      { label: 'Negro y oro',                 base: '#16171a', sec: '#c9a43a', ter: '#c9a43a', pat: 'pin',     pod: true },
  verde:    { label: 'Verde y blanco',              base: '#1f5a3a', sec: '#f2efe6', ter: '#e0b23a', pat: 'split',   pod: false },
  naranja:  { label: 'Blanco y naranja',            base: '#f3f1ea', sec: '#ef7a1a', ter: '#1d2a44', pat: 'stripes', pod: true },
};
export const RIVAL_LIVERIES = [
  { base: '#1f4fa8', sec: '#ffffff', ter: '#d4322c', pat: 'stripes', pod: true },
  { base: '#f1efe8', sec: '#c8202a', ter: '#15171a', pat: 'sash',    pod: false },
  { base: '#f2b705', sec: '#15171a', ter: '#ffffff', pat: 'band',    pod: true },
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
  berlina: {
    half: [[16.6, -3.6], ['Q', 16.7, -6.0, 15.1, -6.5], ['L', 13.6, -6.7], ['Q', 13.0, -8.0, 10.2, -8.1], ['Q', 7.4, -8.0, 6.8, -7.1],
      ['L', -7.0, -7.2], ['Q', -7.6, -8.2, -10.4, -8.3], ['Q', -13.2, -8.2, -13.8, -7.3], ['L', -16.0, -7.0], ['Q', -16.9, -6.6, -16.8, -4.6], ['L', -16.8, 0]],
    axle: [10.2, -10.4], wy: 7.0, tire: [6.4, 3.4], front: 16.6, rear: -16.8, lamps: [-17.1, 3.4, 2.8],
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
    case 'band': {
      // banda ancha a lo largo del coche con filetes
      c.fillStyle = sec; c.fillRect(-18, -3.6, 36, 7.2);
      c.fillStyle = ter; c.fillRect(-18, -4.4, 36, 0.6); c.fillRect(-18, 3.8, 36, 0.6);
      c.fillStyle = sec; c.fillRect(-18, -9.8, 36, 1.4); c.fillRect(-18, 8.4, 36, 1.4);
      break;
    }
    case 'sash': {
      // tres franjas en diagonal que cruzan el coche
      const bands = [[sec, 0, 3.4], [ter, 3.9, 1.6], [sec, 6.0, 1.2]];
      for (const [col, o, w] of bands) {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(9 - o, -10); c.lineTo(9 - o - w, -10); c.lineTo(-7 - o - w, 10); c.lineTo(-7 - o, 10); c.closePath(); c.fill();
      }
      break;
    }
    case 'pin': {
      // filetes finos dobles, como las decoraciones de los 70-80
      c.fillStyle = sec;
      for (const s of [-1, 1]) { c.fillRect(-18, s * 7.4 - 0.25, 36, 0.5); c.fillRect(-18, s * 6.4 - 0.15, 36, 0.3); c.fillRect(-18, s * 1.6 - 0.15, 36, 0.3); }
      c.fillRect(9.5, -7.4, 0.5, 14.8); c.fillRect(-12.5, -7.4, 0.5, 14.8);
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

// Alerón trasero sobre patas, con el plano del color secundario
function rearWing(c, L, x, hw) {
  c.fillStyle = '#16181c'; c.beginPath(); c.roundRect(x - 1.3, -hw, 2.6, hw * 2, 0.5); c.fill();
  c.fillStyle = L.sec; c.fillRect(x - 0.8, -hw + 0.7, 1.5, hw * 2 - 1.4);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 0.8, -hw + 0.7, 0.4, hw * 2 - 1.4);
  c.fillStyle = '#0c0d0f'; c.fillRect(x - 1.7, -hw - 0.4, 3.4, 0.85); c.fillRect(x - 1.7, hw - 0.45, 3.4, 0.85);
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

  // Coupé turbo de Grupo A: capó largo con abultamiento y toma de aire, cabina retrasada, alerón
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
    glass(c, -11.6, -7.4, 5.2, 4.6, true);
    rearWing(c, L, -14.9, 7.4);
    headlights(c, 16.2, 3.4, 5.6, 1.6);
    for (const s of [-1, 1]) { c.fillStyle = '#f7f2d2'; c.beginPath(); c.arc(16.0, s * 1.6, 0.6, 0, 7); c.fill(); }
    if (L.pod) lightPod(c, 17.0, 3.8);
  },

  // Berlina turbo 4x4: cuatro puertas, toma de aire en el capó, techo largo y gran alerón en el maletero
  berlina(c, L, num) {
    c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 0.18;
    c.beginPath(); c.moveTo(7.4, -5.8); c.lineTo(15.6, -5.5); c.moveTo(7.4, 5.8); c.lineTo(15.6, 5.5); c.stroke();
    c.beginPath(); c.moveTo(-11.2, -5.6); c.lineTo(-11.2, 5.6); c.stroke();
    // toma de aire del intercooler
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(10.2, -2.0, 3.0, 4.0, 0.8); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(12.8, -1.7, 0.3, 3.4);
    bonnetShine(c, 12, -3.4);
    glass(c, 3.7, 7.4, 5.4, 6.1);
    c.fillStyle = 'rgba(255,255,255,.2)';
    c.beginPath(); c.moveTo(6.9, -4.6); c.lineTo(7.3, -3.5); c.lineTo(4.4, 3.8); c.lineTo(4.0, 2.7); c.closePath(); c.fill();
    c.fillStyle = '#18232e';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(3.7, s * 6.1); c.lineTo(-7.2, s * 5.8); c.lineTo(-7.2, s * 6.5); c.lineTo(3.3, s * 6.9); c.closePath(); c.fill(); }
    c.fillStyle = L.base; for (const s of [-1, 1]) c.fillRect(-2.0, s > 0 ? 5.8 : -6.9, 0.7, 1.1);   // montante central
    roof(c, L, -7.2, 3.7, 5.7);
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(1.4, -1.5, 1.6, 3.0, 0.5); c.fill();
    roofNumber(c, L, -2.0, num);
    glass(c, -11.0, -7.2, 5.5, 5.0, true);
    rearWing(c, L, -15.0, 8.0);
    headlights(c, 16.2, 3.6, 6.0, 1.8);
    if (L.pod) lightPod(c, 17.0, 4.4);
    else { for (const s of [-1, 1]) { c.fillStyle = '#f7f2d2'; c.beginPath(); c.arc(16.1, s * 1.8, 0.6, 0, 7); c.fill(); } }
  },
};

function makeSprite(L, num, id) {
  const M = model(id), [cv, c] = newSprite();
  c.fillStyle = '#141619';
  const [rx] = [M.axle[1]];
  for (const s of [-1, 1]) c.fillRect(rx - 3.6, s > 0 ? M.wy - 1.6 : -M.wy - 1.4, 0.8, 3);   // faldillas
  mirrors(c, L, id === 'coupe' ? 2.4 : id === 'berlina' ? 3.4 : 4.2, id === 'coupe' ? 7.4 : id === 'berlina' ? 8.0 : 7.9);
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
  berlina:  { base: [-11.0, 7.4, 6.1], top: [-7.2, 3.7, 5.7] },
};
export const CAR_TOP = ROOF_Z;

// Capas laterales: la carrocería con su decoración, oscurecida en `dark` (null = negro de los bajos)
const sides = new Map();
function side(id, L, dark) {
  const k = [id, L.base, L.sec, L.ter, L.pat, dark].join('|');
  let cv = sides.get(k);
  if (!cv) {
    if (sides.size > 80) sides.clear();
    cv = document.createElement('canvas');
    cv.width = SW * KS; cv.height = SH * KS;
    const c = cv.getContext('2d');
    c.setTransform(KS, 0, 0, KS, (SW * KS) / 2, (SH * KS) / 2);
    const M = model(id);
    bodyPath(c, M);
    if (dark == null) { c.fillStyle = '#17191c'; c.fill(); }
    else {
      c.fillStyle = L.base; c.fill();
      c.save(); bodyPath(c, M); c.clip(); pattern(c, L);
      c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(-SW / 2, -SH / 2, SW, SH); c.restore();
    }
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
  const lo = side(id, L, null), mid = side(id, L, 0.45), hi = side(id, L, 0.22);
  const step = Math.min(0.5, 0.9 / (V.Z * ISO_Z));   // capas a menos de 1 px en pantalla: sin escalones al ampliar
  for (let z = 1.6; z < BODY_Z; z += step) { at(z); c.drawImage(z < 2.2 ? lo : z < 3.8 ? mid : hi, -SW / 2, -SH / 2, SW, SH); }
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
  for (let z = BODY_Z + step; z < ROOF_Z; z += step) {
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
