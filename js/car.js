// Coches campeones del Mundial de Rallies, de los clásicos de los 70 a los Rally1 híbridos. Cada
// carrocería se genera a partir de sus proporciones (BODIES), cada uno con su silueta
// y sus detalles. La vista cenital se pre-dibuja en alta resolución (sprite) por modelo +
// decoración + dorsal, y en tiempo real se le añaden suciedad y daños. En el juego, el coche
// se ve en isométrico montando capas de ese sprite a distintas alturas (sprite stacking).
import { rng, lerp, shade, isoView, ISO_Z } from './util.js';

const K = 8;              // resolución del sprite: px por unidad de mundo
const SW = 40, SH = 24;   // tamaño del sprite en unidades de mundo

// Decoraciones elegibles (sin marcas ni patrocinadores reales). «epoca» usa los colores de época de
// cada coche (carLivery); en las demás, base null = color de la paleta activa.
export const LIVERIES = {
  epoca:    { label: 'Colores de época del coche',   base: null,      sec: null,      ter: null,      pat: null,      pod: null },
  paleta:   { label: 'Color de la paleta',          base: null,      sec: '#ffffff', ter: '#15171a', pat: 'band',    pod: true },
  franjas:  { label: 'Blanco con franjas azul y rojo', base: '#f3f1ea', sec: '#1d3f8f', ter: '#d4322c', pat: 'sash',  pod: true },
  azul:     { label: 'Azul y amarillo',             base: '#1c3f94', sec: '#f5c400', ter: '#ffffff', pat: 'band',    pod: true },
  rojo:     { label: 'Rojo y blanco',               base: '#c8202a', sec: '#ffffff', ter: '#15171a', pat: 'swoosh',  pod: false },
  oro:      { label: 'Negro y oro',                 base: '#16171a', sec: '#c9a43a', ter: '#c9a43a', pat: 'pin',     pod: true },
  verde:    { label: 'Verde y blanco',              base: '#1f5a3a', sec: '#f2efe6', ter: '#e0b23a', pat: 'split',   pod: false },
  naranja:  { label: 'Blanco y naranja',            base: '#f3f1ea', sec: '#ef7a1a', ter: '#1d2a44', pat: 'stripes', pod: true },
};
export const GHOST_LIVERY = { base: '#e8eef3', sec: '#b8c4cf', ter: '#8795a3', pat: 'stripes', pod: false };
export const DIRT = { barro: '#4e321c', polvo: '#b08657', nieve: '#f4f8fb' };

// Carrocerías de los coches campeones: [largo, medio ancho, aletas, forma, alerón, faros, tomas de aire,
// colores de época (base, secundario, terciario, patrón, faros auxiliares)]. Sin logotipos ni patrocinadores.
// forma: hatch (compacto), sedan (berlina), coupe, mid (motor central), wedge (cuña)
// alerón: none, duck (labio), small, big, wrc · faros: round (redondos), square, modern · tomas: roof, hood, both
const BODIES = {
  'alpine-a110': [30, 6.6, 0.6, 'coupe', 'none', 'round', '', ['#2350b8', '#f3f1ea', '#c8202a', 'stripes', true]],
  'lancia-stratos': [29, 7.4, 0.8, 'wedge', 'duck', 'round', 'roof', ['#f3f1ea', '#1f8a4c', '#c8202a', 'sash', true]],
  'fiat-131-abarth': [33, 6.8, 0.9, 'sedan', 'duck', 'round', '', ['#f2efe6', '#1f6fd6', '#f5c400', 'split', true]],
  'ford-escort-rs1800': [31, 6.6, 1.0, 'sedan', 'duck', 'round', '', ['#f3f1ea', '#1d3f8f', '#c8202a', 'stripes', true]],
  'opel-ascona-400': [34, 6.9, 1.0, 'sedan', 'duck', 'round', '', ['#f3f1ea', '#c8202a', '#15171a', 'band', true]],
  'audi-quattro': [35, 7.0, 1.1, 'coupe', 'small', 'square', 'hood', ['#f3f1ea', '#c8202a', '#15171a', 'stripes', true]],
  'lancia-rally-037': [31, 7.4, 0.9, 'mid', 'duck', 'square', 'roof', ['#f3f1ea', '#1d3f8f', '#c8202a', 'sash', true]],
  'peugeot-205-t16': [30, 7.1, 1.2, 'mid', 'none', 'square', 'roof', ['#f3f1ea', '#1d3f8f', '#f5c400', 'sash', false]],
  'peugeot-205-t16-e2': [31, 7.2, 1.3, 'mid', 'big', 'square', 'roof', ['#f3f1ea', '#1d3f8f', '#f5c400', 'chevron', false]],
  'lancia-delta-hf': [31, 6.8, 0.8, 'hatch', 'small', 'square', 'hood', ['#f3f1ea', '#1d3f8f', '#c8202a', 'sash', true]],
  'lancia-delta-hf-4wd': [31, 6.9, 0.9, 'hatch', 'small', 'square', 'hood', ['#f3f1ea', '#c8202a', '#1d3f8f', 'stripes', true]],
  'lancia-delta-integrale': [31, 7.0, 1.4, 'hatch', 'small', 'square', 'both', ['#f3f1ea', '#1d3f8f', '#c8202a', 'stripes', true]],
  'toyota-celica-gt-four': [35, 7.0, 1.0, 'coupe', 'big', 'modern', 'hood', ['#f3f1ea', '#c8202a', '#15171a', 'swoosh', true]],
  'toyota-celica-turbo-4wd': [35, 7.1, 1.1, 'coupe', 'big', 'modern', 'both', ['#c8202a', '#f3f1ea', '#15171a', 'swoosh', true]],
  'mitsubishi-lancer-evolution': [35, 7.0, 1.1, 'sedan', 'big', 'modern', 'hood', ['#f3f1ea', '#c8202a', '#15171a', 'split', true]],
  'skoda-felicia-kit-car': [31, 6.8, 1.0, 'hatch', 'small', 'modern', '', ['#1f7a3a', '#f3f1ea', '#15171a', 'split', false]],
  'citroen-xsara-kit-car': [33, 7.0, 1.2, 'hatch', 'small', 'modern', '', ['#c8202a', '#f3f1ea', '#1d3f8f', 'swoosh', false]],
  'subaru-impreza-wrc': [35, 7.1, 1.3, 'sedan', 'wrc', 'modern', 'hood', ['#1c3f94', '#f5c400', '#ffffff', 'band', true]],
  'ford-escort-wrc': [34, 7.0, 1.3, 'sedan', 'wrc', 'modern', 'hood', ['#1c3f94', '#f3f1ea', '#c8202a', 'split', false]],
  'toyota-corolla-wrc': [33, 7.1, 1.4, 'hatch', 'wrc', 'modern', 'roof', ['#f3f1ea', '#c8202a', '#15171a', 'swoosh', false]],
  'peugeot-206-wrc': [32, 7.2, 1.4, 'hatch', 'wrc', 'modern', 'roof', ['#f3f1ea', '#1d3f8f', '#f5c400', 'chevron', false]],
  'citroen-xsara-wrc': [33, 7.2, 1.4, 'hatch', 'wrc', 'modern', 'roof', ['#c8202a', '#f3f1ea', '#1d3f8f', 'band', false]],
  'ford-focus-rs-wrc': [33, 7.2, 1.4, 'hatch', 'wrc', 'modern', 'roof', ['#1c3f94', '#f3f1ea', '#18a0d8', 'swoosh', false]],
  'citroen-c4-wrc': [34, 7.3, 1.4, 'coupe', 'wrc', 'modern', 'roof', ['#c8202a', '#15171a', '#f3f1ea', 'split', false]],
  'citroen-ds3-wrc': [32, 7.3, 1.5, 'hatch', 'wrc', 'modern', 'roof', ['#c8202a', '#15171a', '#f3f1ea', 'band', false]],
  'vw-polo-r-wrc': [32, 7.3, 1.5, 'hatch', 'wrc', 'modern', 'roof', ['#f3f1ea', '#1c3f94', '#18a0d8', 'chevron', false]],
  'ford-fiesta-wrc': [32, 7.4, 1.6, 'hatch', 'wrc', 'modern', 'roof', ['#f3f1ea', '#1c3f94', '#ef7a1a', 'swoosh', false]],
  'toyota-yaris-wrc': [32, 7.5, 1.7, 'hatch', 'wrc', 'modern', 'roof', ['#f3f1ea', '#c8202a', '#15171a', 'sash', false]],
  'hyundai-i20-coupe-wrc': [33, 7.5, 1.6, 'hatch', 'wrc', 'modern', 'roof', ['#1c3f94', '#ef7a1a', '#f3f1ea', 'swoosh', false]],
  'toyota-gr-yaris-rally1': [33, 7.6, 1.6, 'hatch', 'wrc', 'modern', 'roof', ['#15171a', '#c8202a', '#f3f1ea', 'chevron', false]],
  'hyundai-i20-n-rally1': [33, 7.5, 1.6, 'hatch', 'wrc', 'modern', 'roof', ['#1c3f94', '#ef7a1a', '#f3f1ea', 'split', false]],
};
const FALLBACK = 'lancia-delta-integrale';

// Genera el contorno, los ejes y el habitáculo a partir de las proporciones
function makeModel([len, hw, fl, shape, wing, lamps, scoop, col]) {
  const hl = len / 2, f = hl, r = -hl, H = hw + fl;
  const aF = f - Math.max(6.4, len * (shape === 'wedge' ? 0.17 : 0.21));
  const aR = r + Math.max(6.4, len * (shape === 'mid' || shape === 'wedge' ? 0.17 : 0.19));
  const nose = hw * (shape === 'wedge' ? 0.42 : 0.55), tail = hw * 0.62;
  const half = [[f, -nose], ['Q', f + 0.1, -hw * 0.95, f - 2, -hw], ['L', aF + 4.2, -hw],
    ['Q', aF + 3.4, -H, aF, -H], ['Q', aF - 3.4, -H, aF - 4.2, -hw],
    ['L', aR + 4.2, -hw], ['Q', aR + 3.4, -H - 0.1, aR, -H - 0.1], ['Q', aR - 3.4, -H - 0.1, aR - 4.2, -hw],
    ['L', r + 1.8, -hw * 0.98], ['Q', r - 0.1, -hw * 0.92, r, -tail], ['L', r, 0]];
  const cab = {
    hatch: [[r + 3.6, aF - 2.0, hw - 0.9], [r + 6.4, aF - 6.0, hw - 1.3], 9.6],
    sedan: [[aR - 1.0, aF - 2.6, hw - 0.9], [aR + 2.0, aF - 6.2, hw - 1.3], 9.6],
    coupe: [[r + 4.6, aF - 4.0, hw - 1.0], [aR + 3.2, aF - 8.0, hw - 1.5], 9.0],
    mid: [[aR + 3.0, aF - 0.6, hw - 1.0], [aR + 5.6, aF - 4.6, hw - 1.4], 8.8],
    wedge: [[aR + 2.4, aF + 1.5, hw - 0.6], [aR + 5.0, aF - 2.6, hw - 1.4], 8.3],
  }[shape];
  return {
    half, axle: [aF, aR], wy: H - 1.2, tire: [lamps === 'modern' ? 6.6 : 6.0, 3.3], front: f, rear: r, hw,
    lamps: [r - 0.3, hw * 0.35, hw * 0.4], shape, wing, lights: lamps, scoop,
    base: cab[0], top: cab[1], roofZ: cab[2],
    livery: { base: col[0], sec: col[1], ter: col[2], pat: col[3], pod: col[4] },
  };
}
const MODELS = Object.fromEntries(Object.entries(BODIES).map(([id, b]) => [id, makeModel(b)]));
const model = (id) => MODELS[id] || MODELS[FALLBACK];
const known = (id) => (MODELS[id] ? id : FALLBACK);
// Colores de época del coche (los usan los rivales y la decoración «Colores de época»)
export function carLivery(id) { return { ...model(id).livery }; }
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

// Detalles vistos desde arriba: capó, lunas, techo con dorsal, tomas de aire, alerón y faros
function details(c, L, num, M) {
  const { front: f, rear: r, hw, base, top } = M;
  c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = 0.18;
  c.beginPath(); c.moveTo(base[1] + 0.4, -hw + 1.2); c.lineTo(f - 1.2, -hw + 1.5); c.moveTo(base[1] + 0.4, hw - 1.2); c.lineTo(f - 1.2, hw - 1.5); c.stroke();
  const hood = (base[1] + f) / 2;
  if (M.scoop === 'hood' || M.scoop === 'both') {
    c.fillStyle = '#111316'; c.beginPath(); c.roundRect(hood - 1.2, -1.9, 2.8, 3.8, 0.8); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(hood + 1.3, -1.6, 0.3, 3.2);
  } else if (M.lights !== 'round') vents(c, hood - 1.5, 1.3);
  bonnetShine(c, hood + 1, -hw * 0.4);
  // lunas laterales, parabrisas y luneta
  c.fillStyle = '#18232e';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(base[1] - 0.3, s * base[2]); c.lineTo(top[1], s * top[2]); c.lineTo(top[0], s * top[2]); c.lineTo(base[0] + 0.3, s * base[2]); c.closePath(); c.fill();
  }
  glass(c, top[1], base[1], base[2] - 0.4, top[2] + 0.2);
  c.fillStyle = 'rgba(255,255,255,.2)';
  const wx = (top[1] + base[1]) / 2;
  c.beginPath(); c.moveTo(wx + 0.6, -top[2] + 0.8); c.lineTo(wx + 1.0, -top[2] + 1.9); c.lineTo(wx - 1.0, top[2] - 1.2); c.lineTo(wx - 1.4, top[2] - 2.3); c.closePath(); c.fill();
  roof(c, L, top[0], top[1], top[2]);
  if (M.scoop === 'roof' || M.scoop === 'both') { c.fillStyle = '#111316'; c.beginPath(); c.roundRect(top[1] - 2.4, -1.5, 1.7, 3.0, 0.5); c.fill(); }
  roofNumber(c, L, (top[0] + top[1]) / 2 - (M.scoop === 'roof' || M.scoop === 'both' ? 0.9 : 0), num, Math.min(4.8, (top[1] - top[0]) * 0.5), Math.min(6.8, top[2] * 1.2));
  glass(c, base[0], top[0], top[2] + 0.1, base[2] - 0.5, true);
  // motor central: rejillas en la tapa trasera
  if (M.shape === 'mid' || M.shape === 'wedge') {
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 0.35;
    for (let x = base[0] - 1.2; x > r + 3.5; x -= 0.9) { c.beginPath(); c.moveTo(x, -hw * 0.5); c.lineTo(x, hw * 0.5); c.stroke(); }
  }
  // alerón
  if (M.wing === 'duck') {
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(r + 1.4, -hw * 0.85, 0.5, hw * 1.7);
    c.fillStyle = L.sec; c.fillRect(r + 0.3, -hw * 0.82, 1.0, hw * 1.64);
  } else if (M.wing === 'small') rearWing(c, L, r + 2.0, hw * 0.85);
  else if (M.wing === 'big') rearWing(c, L, r + 2.2, hw + 0.5);
  else if (M.wing === 'wrc') {
    rearWing(c, L, r + 2.4, hw + 0.9);
    c.fillStyle = L.ter; c.fillRect(r + 4.1, -hw + 0.4, 0.8, hw * 2 - 0.8);
  }
  // faros
  if (M.lights === 'round') {
    for (const s of [-1, 1]) for (const y of [0.42, 0.74]) {
      c.fillStyle = '#e8f0f5'; c.beginPath(); c.arc(f - 1.0, s * hw * y, 1.05, 0, 7); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.25; c.stroke();
    }
  } else if (M.lights === 'square') headlights(c, f - 0.2, hw * 0.35, hw * 0.85, 1.6);
  else headlights(c, f - 0.3, hw * 0.45, hw * 0.92, 2.2);
  if (L.pod) lightPod(c, f + 0.5, hw * 0.62);
}

function makeSprite(L, num, id) {
  const M = model(id), [cv, c] = newSprite();
  c.fillStyle = '#141619';
  const [rx] = [M.axle[1]];
  for (const s of [-1, 1]) c.fillRect(rx - 3.6, s > 0 ? M.wy - 1.6 : -M.wy - 1.4, 0.8, 3);   // faldillas
  mirrors(c, L, M.base[1] - 1.6, M.hw + 0.9);
  bodyPath(c, M); c.fillStyle = L.base; c.fill();
  c.save(); bodyPath(c, M); c.clip(); pattern(c, L); shadeBody(c, M); c.restore();
  bodyPath(c, M); c.lineWidth = 0.35; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
  details(c, L, num, M);
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
  const gx = (model(id).top[1] + model(id).base[1]) / 2;
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
  const id = known(car.model), M = model(id);
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
// Eje trasero y separación de las ruedas, para las marcas de derrape
export function carWheels(id) { const M = model(id); return { ax: -M.axle[1], wy: M.wy }; }

// ---------- Vista isométrica ----------

const KS = 4;                       // resolución de las capas laterales
const BODY_Z = 5.5, ROOF_Z = 9.6;   // altura del capó y del techo más alto
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
  const id = known(car.model), h = car.h || 0;
  V.set(c, z0);
  c.globalAlpha = 0.85 * Math.max(0.35, 1 - h / 60);
  c.translate(car.x + 1.5 + h * 0.55, car.y + 1.5 + h * 0.55); c.rotate(car.a);
  c.drawImage(layer('sh', id, () => makeShadow(id)), -SW / 2, -SH / 2, SW, SH);
  c.globalAlpha = 1;
}

// Coche en isométrico: ruedas, laterales, capó con suciedad y daños, cabina acristalada y techo.
// z0: altura del suelo bajo el coche (tablero de un puente); dx, dy: desplazamiento en pantalla.
export function drawCarIso(c, V, car, L, z0 = 0, dx = 0, dy = 0) {
  const id = known(car.model), M = model(id), cab = M, RZ = M.roofZ;
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
  // alerón grande: se repite elevado sobre el maletero
  if (M.wing === 'big' || M.wing === 'wrc') {
    const x0 = M.rear + 0.5, x1 = M.rear + (M.wing === 'wrc' ? 5.2 : 3.8), hy = M.hw + (M.wing === 'wrc' ? 1.3 : 0.9);
    const wsx = (x0 + SW / 2) * K, wsy = (SH / 2 - hy) * K, wsw = (x1 - x0) * K, wsh = hy * 2 * K;
    for (let z = BODY_Z + 0.6; z < BODY_Z + 2.6; z += step) {
      at(z); c.fillStyle = '#121416';
      for (const s of [-1, 1]) c.fillRect(x0 + 0.3, s > 0 ? hy - 0.9 : -hy, x1 - x0 - 0.6, 0.9);
    }
    at(BODY_Z + 2.6);
    c.drawImage(spr, wsx, wsy, wsw, wsh, x0, -hy, x1 - x0, hy * 2);
  }
  const glassCol = '#1c2833', pillar = shade(L.base, 0.68);
  for (let z = BODY_Z + step; z < RZ; z += step) {
    const t = (z - BODY_Z) / (RZ - BODY_Z);
    const x0 = lerp(cab.base[0], cab.top[0], t), x1 = lerp(cab.base[1], cab.top[1], t), hw = lerp(cab.base[2], cab.top[2], t);
    at(z);
    c.fillStyle = z > RZ - 1.1 ? pillar : glassCol;
    c.beginPath(); c.roundRect(x0, -hw, x1 - x0, hw * 2, 1.2); c.fill();
  }
  at(RZ);
  const [rx0, rx1, rhw] = cab.top, sx = (rx0 + SW / 2) * K, sy = (SH / 2 - rhw) * K, sw = (rx1 - rx0) * K, sh = rhw * 2 * K;
  c.drawImage(spr, sx, sy, sw, sh, rx0, -rhw, rx1 - rx0, rhw * 2);
  for (const [img, a] of dirt) { c.globalAlpha = a * 0.7; c.drawImage(img, sx, sy, sw, sh, rx0, -rhw, rx1 - rx0, rhw * 2); }
  c.globalAlpha = 1;
}

// Vista previa en un canvas de interfaz, en isométrico y de tres cuartos
export function drawCarPreview(cv, L, num = '1', id = FALLBACK, extraState = {}) {
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
