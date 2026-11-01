// Objetos del escenario en isométrico: árboles, rocas, pacas y cactus como figuras
// pre-dibujadas (billboards), y conos, latas, rampas, farolas, arcos de control y
// puentes dibujados con volumen en cada fotograma. Todo se ordena por profundidad en game.js.
import { rng, shade, ISO_C, ISO_Z } from './util.js';
import { SURF, THEME } from './config.js';

const RES = 4;   // px de sprite por unidad de mundo

// Proyección local de los sprites (misma que la vista, sin zoom)
const pu = (x, y) => (x - y) * ISO_C;
const pv = (x, y, z) => (x + y) * ISO_C * 0.5 - z * ISO_Z;

function poly(c, pts) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.fill();
}

// Caja proyectada: medio largo hx, medio ancho hy, alto h; colores de techo, cara izquierda y cara derecha
function box(c, hx, hy, h, top, left, right) {
  const P = (x, y, z) => [pu(x, y), pv(x, y, z)];
  c.fillStyle = left; poly(c, [P(-hx, hy, 0), P(hx, hy, 0), P(hx, hy, h), P(-hx, hy, h)]);
  c.fillStyle = right; poly(c, [P(hx, -hy, 0), P(hx, hy, 0), P(hx, hy, h), P(hx, -hy, h)]);
  c.fillStyle = top; poly(c, [P(-hx, -hy, h), P(hx, -hy, h), P(hx, hy, h), P(-hx, hy, h)]);
}

// ---------- Figuras pre-dibujadas ----------

const SHAPES = {
  pino(c, R, snow) {
    c.fillStyle = '#5a3d22'; c.fillRect(-1.6, -7, 3.2, 8);
    for (let i = 0; i < 3; i++) {
      const y = -5 - i * 10.5, w = (15 - i * 4) * (0.92 + R() * 0.16), h = 19 - i * 3;
      c.fillStyle = '#3b7a43'; poly(c, [[-w, y], [0, y - h], [0, y + 1.5]]);
      c.fillStyle = '#244d2e'; poly(c, [[0, y - h], [w, y], [0, y + 1.5]]);
      if (snow) { c.fillStyle = 'rgba(250,252,255,.92)'; poly(c, [[-w * 0.45, y - h * 0.55], [0, y - h], [w * 0.4, y - h * 0.55], [0, y - h * 0.42]]); }
    }
  },
  arbol(c, R) {
    c.fillStyle = '#5a3d22'; c.fillRect(-2, -13, 4, 14);
    const cy = -26;
    const blobs = [[0, 0, 12]];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + R() * 0.5; blobs.push([Math.cos(a) * 7, Math.sin(a) * 5, 6.5 + R() * 2.5]); }
    c.fillStyle = '#3f6f2f';
    for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x, cy + y, r, 0, 7); c.fill(); }
    c.fillStyle = '#55893d';
    for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x - 2.5, cy + y - 2.5, r * 0.62, 0, 7); c.fill(); }
    c.fillStyle = '#6ea24c'; c.beginPath(); c.arc(-5, cy - 6, 3.5, 0, 7); c.fill();
  },
  roca(c, R, snow) {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI, rr = 0.75 + R() * 0.3;
      pts.push([Math.cos(a) * 12 * rr, Math.sin(a) * 11 * rr]);
    }
    pts.push([10, 2], [-10, 2]);
    c.fillStyle = '#6d6154'; poly(c, pts);
    c.fillStyle = '#a2957f'; poly(c, pts.slice(1, 6).map(([x, y]) => [x * 0.75 - 1.5, y * 0.8 - 1.5]).concat([[-1, -2]]));
    if (snow) { c.fillStyle = '#f4f7fa'; poly(c, pts.slice(2, 7).map(([x, y]) => [x * 0.6 - 1, y * 0.95 - 0.5]).concat([[0, -5]])); }
  },
  cactus(c, R) {
    const h = 24 + R() * 8;
    c.fillStyle = '#4c7a3a';
    c.beginPath(); c.roundRect(-3, -h, 6, h, 3); c.fill();
    c.beginPath(); c.roundRect(-10, -h * 0.7, 3.6, 9, 1.8); c.fill(); c.fillRect(-9, -h * 0.45, 7, 3);
    c.beginPath(); c.roundRect(6.4, -h * 0.85, 3.6, 11, 1.8); c.fill(); c.fillRect(2, -h * 0.55, 6, 3);
    c.fillStyle = '#6a9a4f'; c.fillRect(-2, -h + 2, 1.6, h - 3);
  },
  paja(c) {
    box(c, 9, 6, 9, '#e3c46a', '#c9a64e', '#a8873a');
    c.strokeStyle = 'rgba(120,90,30,.45)'; c.lineWidth = 0.5;
    for (let k = 1; k < 4; k++) { const z = (k * 9) / 4; c.beginPath(); c.moveTo(pu(-9, 6), pv(-9, 6, z)); c.lineTo(pu(9, 6), pv(9, 6, z)); c.lineTo(pu(9, -6), pv(9, -6, z)); c.stroke(); }
  },
};
const BOX = { pino: [36, 58, 18, 54], arbol: [44, 50, 22, 46], roca: [30, 22, 15, 18], cactus: [26, 40, 13, 37], paja: [30, 26, 15, 18] };

const bbCache = new Map();
function billboard(kind, variant, snow) {
  const k = kind + variant + (snow ? 's' : '');
  let b = bbCache.get(k);
  if (!b) {
    const [w, h, ax, ay] = BOX[kind];
    const cv = document.createElement('canvas');
    cv.width = w * RES; cv.height = h * RES;
    const c = cv.getContext('2d');
    c.setTransform(RES, 0, 0, RES, ax * RES, ay * RES);
    SHAPES[kind](c, rng(variant * 7919 + kind.length), snow);
    b = { cv, w, h, ax, ay };
    bbCache.set(k, b);
  }
  return b;
}

export const hasBillboard = (k) => !!SHAPES[k];

// Árbol, roca, cactus o paca en (d.x, d.y). alpha < 1 para no tapar el coche.
export function drawDecorIso(c, V, d, th, alpha = 1) {
  const b = billboard(d.k, (d.seed >>> 0) % 4, th === THEME.nieve), s = (d.s || 1) * V.Z;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = alpha;
  c.drawImage(b.cv, V.px(d.x, d.y) - b.ax * s, V.py(d.x, d.y) - b.ay * s, b.w * s, b.h * s);
  c.globalAlpha = 1;
}
export function decorTop(d) { return (BOX[d.k] ? BOX[d.k][3] : 20) * (d.s || 1); }

// ---------- Objetos con volumen ----------

export function drawConeIso(c, V, k) {
  const x = V.px(k.x, k.y), y = V.py(k.x, k.y), Z = V.Z;
  c.setTransform(Z, 0, 0, Z, x, y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1.5, 0.5, 5, 2.5, 0, 0, 7); c.fill();
  c.rotate(Math.sin(k.a || 0) * 1.2);
  c.fillStyle = '#2a2a2a'; c.fillRect(-4.5, -1.2, 9, 1.8);
  c.fillStyle = '#e8541a'; poly(c, [[-3.6, -1], [3.6, -1], [0.6, -11], [-0.6, -11]]);
  c.fillStyle = '#ff8a3d'; poly(c, [[-3.6, -1], [0, -1], [0, -11], [-0.6, -11]]);
  c.fillStyle = '#f4f4f2'; poly(c, [[-2.6, -4.5], [2.6, -4.5], [1.9, -7], [-1.9, -7]]);
}

export function drawNitroIso(c, V, p, time) {
  const b = 2 + Math.sin((time || 0) / 260) * 1.5;
  const x = V.px(p.x, p.y), y = V.py(p.x, p.y), Z = V.Z;
  c.setTransform(Z, 0, 0, Z, x, y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, 7); c.fill();
  c.translate(0, -b);
  c.fillStyle = '#c99a00'; c.beginPath(); c.roundRect(-5, -15, 10, 15, 2.5); c.fill();
  c.fillStyle = '#ffd23f'; c.beginPath(); c.roundRect(-5, -15, 7, 15, 2.5); c.fill();
  c.fillStyle = '#ffe680'; c.beginPath(); c.ellipse(0, -15, 5, 2.2, 0, 0, 7); c.fill();
  c.fillStyle = '#1d2630'; c.font = 'italic 800 9px Saira, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', 0, -7);
}

export function drawLampIso(c, V, x, y) {
  const sx = V.px(x, y), sy = V.py(x, y), Z = V.Z;
  c.setTransform(Z, 0, 0, Z, sx, sy);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 0.5, 3, 1.5, 0, 0, 7); c.fill();
  c.fillStyle = '#3a3f45'; c.fillRect(-0.9, -36, 1.8, 36);
  c.fillStyle = '#2a2e33'; c.fillRect(-3.5, -37.5, 7, 2.4);
  c.fillStyle = '#f4e9c0'; c.fillRect(-3, -35.4, 6, 1);
}
export const LAMP_H = 35;

// Rampa de salto en cuña: sube de 0 a H hacia el labio (dirección r.a)
export function drawRampIso(c, V, r) {
  const L = 34, W = 60, H = 8, ca = Math.cos(r.a), sa = Math.sin(r.a);
  const P = (u, v, z) => { const x = r.x + u * ca - v * sa, y = r.y + u * sa + v * ca; return [V.px(x, y), V.py(x, y, z)]; };
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (sa - ca > 0) { c.fillStyle = '#5b4b39'; poly(c, [P(-L / 2, -W / 2, 0), P(L / 2, -W / 2, 0), P(L / 2, -W / 2, H)]); }
  if (ca - sa > 0) { c.fillStyle = '#5b4b39'; poly(c, [P(-L / 2, W / 2, 0), P(L / 2, W / 2, 0), P(L / 2, W / 2, H)]); }
  if (ca + sa > 0) {
    for (let v = -W / 2, k = 0; v < W / 2; v += 10, k++) {
      c.fillStyle = k % 2 ? '#1b1b1b' : '#f2c230';
      poly(c, [P(L / 2, v, 0), P(L / 2, v + 10, 0), P(L / 2, v + 10, H), P(L / 2, v, H)]);
    }
  }
  c.fillStyle = '#c2a983'; poly(c, [P(-L / 2, -W / 2, 0), P(L / 2, -W / 2, H), P(L / 2, W / 2, H), P(-L / 2, W / 2, 0)]);
  c.strokeStyle = 'rgba(60,45,30,.45)'; c.lineWidth = 1.2 * V.Z;
  c.beginPath();
  for (let u = -L / 2 + 6; u < L / 2 - 2; u += 6) { const z = ((u + L / 2) / L) * H; c.moveTo(...P(u, -W / 2, z)); c.lineTo(...P(u, W / 2, z)); }
  c.stroke();
  for (let v = -W / 2, k = 0; v < W / 2; v += 10, k++) {
    c.fillStyle = k % 2 ? '#1b1b1b' : '#f2c230';
    poly(c, [P(L / 2 - 4, v, H * 0.88), P(L / 2, v, H), P(L / 2, v + 10, H), P(L / 2 - 4, v + 10, H * 0.88)]);
  }
}

// Arco de salida, control o meta sobre la pista
export function drawArchIso(c, V, s, label, col) {
  const o = s.w / 2 + 10, H = 30, B = 8;
  let A = [s.x + s.nx * o, s.y + s.ny * o], C = [s.x - s.nx * o, s.y - s.ny * o];
  if (V.px(...A) > V.px(...C)) [A, C] = [C, A];
  const Z = V.Z;
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x, y] of [A, C]) {
    const sx = V.px(x, y), sy = V.py(x, y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx + Z, sy, 4 * Z, 2 * Z, 0, 0, 7); c.fill();
    c.fillStyle = '#2b2f35'; c.fillRect(sx - 1.4 * Z, V.py(x, y, H + B), 2.8 * Z, (H + B) * Z * ISO_Z);
  }
  const a0 = [V.px(...A), V.py(...A, H)], c0 = [V.px(...C), V.py(...C, H)];
  const bh = B * Z * ISO_Z;
  c.fillStyle = col;
  poly(c, [[a0[0], a0[1]], [c0[0], c0[1]], [c0[0], c0[1] - bh], [a0[0], a0[1] - bh]]);
  c.fillStyle = 'rgba(0,0,0,.22)';
  poly(c, [[a0[0], a0[1]], [c0[0], c0[1]], [c0[0], c0[1] - bh * 0.18], [a0[0], a0[1] - bh * 0.18]]);
  const dx = c0[0] - a0[0], dy = c0[1] - a0[1], len = Math.hypot(dx, dy) || 1;
  c.setTransform(dx / len, dy / len, 0, 1, (a0[0] + c0[0]) / 2, (a0[1] + c0[1]) / 2 - bh * 0.55);
  c.fillStyle = col === '#ffffff' || col === '#ffd23f' ? '#16181b' : '#ffffff';
  c.font = `italic 800 ${6.4 * Z}px Saira, "Arial Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, 0, 0, len * 0.9);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- Puentes ----------

// Tramos del tablero, cada uno con su profundidad para ordenarlos con los coches
export function bridgePieces(T) {
  const S = T.S, n = T.n, out = [];
  const at = (k) => S[T.loop ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k))];
  for (const b of T.bridges) {
    for (let k = b.from; k < b.to; k++) {
      const a = at(k), e = at(k + 1);
      if (a === e) continue;
      out.push({ a, e, k, depth: (a.x + a.y + e.x + e.y) / 2 });
    }
  }
  return out;
}

export function drawBridgePiece(c, V, p) {
  const { a, e } = p, Z = V.Z;
  const edge = (s, side, dz = 0) => { const o = side * (s.w / 2 + 7); const x = s.x + s.nx * o, y = s.y + s.ny * o; return [V.px(x, y), V.py(x, y, s.z + dz)]; };
  c.setTransform(1, 0, 0, 1, 0, 0);
  // pilares
  if (p.k % 5 === 0 && a.z > 6) {
    for (const side of [-1, 1]) {
      const o = side * (a.w / 2 + 3), x = a.x + a.nx * o, y = a.y + a.ny * o;
      c.fillStyle = '#6f6c66'; c.fillRect(V.px(x, y) - 2.5 * Z, V.py(x, y, a.z), 5 * Z, a.z * Z * ISO_Z);
      c.fillStyle = '#8c8982'; c.fillRect(V.px(x, y) - 2.5 * Z, V.py(x, y, a.z), 2 * Z, a.z * Z * ISO_Z);
    }
  }
  // canto del tablero en el lado que mira a la cámara
  for (const side of [-1, 1]) {
    if (side * (a.nx + a.ny) <= 0) continue;
    c.fillStyle = '#5f5d58';
    poly(c, [edge(a, side), edge(e, side), edge(e, side, -3.5), edge(a, side, -3.5)]);
  }
  const surf = SURF[a.s] || SURF.asfalto;
  c.fillStyle = shade(surf.col, 1.08);
  poly(c, [edge(a, -1), edge(e, -1), edge(e, 1), edge(a, 1)]);
  if (a.s === 'asfalto' && p.k % 4 < 2) {
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2 * Z;
    c.beginPath(); c.moveTo(V.px(a.x, a.y), V.py(a.x, a.y, a.z)); c.lineTo(V.px(e.x, e.y), V.py(e.x, e.y, e.z)); c.stroke();
  }
  // barandillas en la parte alta
  if (a.z > 9) {
    for (const side of [-1, 1]) {
      const p0 = edge(a, side, 4.5), p1 = edge(e, side, 4.5), b0 = edge(a, side);
      c.strokeStyle = '#d6d3cb'; c.lineWidth = 1.4 * Z;
      c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke();
      if (p.k % 2 === 0) { c.strokeStyle = '#4a4a47'; c.lineWidth = 1 * Z; c.beginPath(); c.moveTo(...b0); c.lineTo(...p0); c.stroke(); }
    }
  }
}
