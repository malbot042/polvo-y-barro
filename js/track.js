// Geometría del trazado, notas del copiloto y dibujo de capas estáticas.
import { WW, WH, SP, clamp, lerp, wrapA, rng, hashStr } from './util.js';
import { SURF, ROAD_SURFACES, THEME, OBJ, DEFAULT_W } from './config.js';

const CELL = 80;
export const BRIDGE_H = 18;   // altura del tablero de los puentes (px)

function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

// ---------- Datos del circuito ----------

export function normalizeDef(d) {
  d = d || {};
  const out = {
    name: String(d.name || 'Sin nombre').slice(0, 40),
    type: d.type === 'tramo' ? 'tramo' : 'circuito',
    laps: clamp(parseInt(d.laps, 10) || 3, 1, 9),
    theme: THEME[d.theme] ? d.theme : 'pradera',
    pts: [], objs: [], patches: [],
  };
  for (const p of d.pts || []) {
    if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
    const s = ROAD_SURFACES.includes(p.s) ? p.s : 'tierra';
    out.pts.push({ x: clamp(+p.x, 0, WW), y: clamp(+p.y, 0, WH), s, w: clamp(+p.w || DEFAULT_W[s], 60, 140) });
  }
  for (const o of d.objs || []) {
    if (!o || !OBJ[o.k] || o.k === 'arbusto' || !isFinite(o.x) || !isFinite(o.y)) continue;
    const r = { k: o.k, x: clamp(+o.x, 0, WW), y: clamp(+o.y, 0, WH) };
    if (o.a != null && isFinite(o.a)) r.a = +o.a;
    out.objs.push(r);
  }
  for (const p of d.patches || []) {
    if (!p || (p.k !== 'barro' && p.k !== 'agua') || !isFinite(p.x) || !isFinite(p.y)) continue;
    out.patches.push({ k: p.k, x: clamp(+p.x, 0, WW), y: clamp(+p.y, 0, WH), r: clamp(+p.r || 44, 20, 90) });
  }
  return out;
}

// Versión compacta para exportar / guardar
export function cleanDef(d) {
  return {
    name: d.name, type: d.type, laps: d.laps, theme: d.theme,
    pts: d.pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), s: p.s, w: Math.round(p.w) })),
    objs: d.objs.map((o) => {
      const r = { k: o.k, x: Math.round(o.x), y: Math.round(o.y) };
      if (o.a != null) r.a = Math.round(o.a * 1000) / 1000;
      return r;
    }),
    patches: d.patches.map((p) => ({ k: p.k, x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.r) })),
  };
}

export function trackKey(d) {
  return hashStr(JSON.stringify([d.name, d.type, d.laps, d.pts, d.objs, d.patches])).toString(36);
}

// Curva Catmull-Rom remuestreada cada SP px
export function sampleTrack(def) {
  const P = def.pts, loop = def.type !== 'tramo', m = P.length;
  if (m < (loop ? 3 : 2)) return null;
  const get = (i) => (loop ? P[((i % m) + m) % m] : P[clamp(i, 0, m - 1)]);
  const segs = loop ? m : m - 1, dense = [];
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t), w: lerp(p1.w, p2.w, t), s: p1.s, seg: i });
    }
  }
  if (!loop) { const l = P[m - 1]; dense.push({ x: l.x, y: l.y, w: l.w, s: P[m - 2].s, seg: m - 2 }); }
  const D = dense.length, lim = loop ? D : D - 1, cum = [0];
  for (let i = 1; i <= lim; i++) {
    const a = dense[i - 1], b = dense[i % D];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const L = cum[lim];
  if (L < 40) return null;
  const n = Math.max(8, Math.floor(L / SP)), cnt = loop ? n : n + 1, S = [];
  for (let i = 0, j = 0; i < cnt; i++) {
    const d = Math.min(L, (i * L) / n);
    while (j < lim - 1 && cum[j + 1] < d) j++;
    const a = dense[j], b = dense[(j + 1) % D], span = cum[j + 1] - cum[j];
    const t = span > 0 ? (d - cum[j]) / span : 0;
    S.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), s: t < 0.5 ? a.s : b.s, seg: a.seg });
  }
  const N = S.length;
  S.forEach((p, i) => {
    const a = loop ? S[(i + 1) % N] : S[Math.min(N - 1, i + 1)];
    const b = loop ? S[(i - 1 + N) % N] : S[Math.max(0, i - 1)];
    const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
    p.tx = dx / l; p.ty = dy / l; p.nx = -p.ty; p.ny = p.tx; p.h = Math.atan2(p.ty, p.tx);
  });
  // Cambio de rumbo en los próximos ~96 px (positivo = derecha)
  const WIN = 12;
  S.forEach((p, i) => {
    const j = loop ? (i + WIN) % N : Math.min(N - 1, i + WIN);
    p.hd = (wrapA(S[j].h - p.h) * 180) / Math.PI;
  });
  return { S, n: N, loop, L };
}

// Convierte objetos definidos con f/o a coordenadas absolutas
export function resolveDef(def) {
  const g = sampleTrack(def);
  const out = JSON.parse(JSON.stringify(def));
  if (!g) return out;
  const at = (f, o) => {
    const s = g.S[Math.floor(f * g.n) % g.n];
    return { x: Math.round(s.x + s.nx * o), y: Math.round(s.y + s.ny * o), a: Math.round(s.h * 1000) / 1000 };
  };
  out.objs = (def.objs || []).map((o) => {
    if (o.f == null) return o;
    const p = at(o.f, o.o || 0);
    return o.k === 'rampa' ? { k: o.k, x: p.x, y: p.y, a: p.a } : { k: o.k, x: p.x, y: p.y };
  });
  out.patches = (def.patches || []).map((p) => {
    if (p.f == null) return p;
    const q = at(p.f, p.o || 0);
    return { k: p.k, x: q.x, y: q.y, r: p.r };
  });
  return out;
}

export const idxAdd = (T, i, k) => (T.loop ? (((i + k) % T.n) + T.n) % T.n : clamp(i + k, 0, T.n - 1));

export function nearestGlobal(T, x, y) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let bi = -1, bd = Infinity;
  for (let r = 0; r <= 4; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const arr = T.grid.get((cx + dx) + ',' + (cy + dy));
        if (!arr) continue;
        for (const i of arr) {
          const s = T.S[i], ex = s.x - x, ey = s.y - y, d = ex * ex + ey * ey;
          if (d < bd) { bd = d; bi = i; }
        }
      }
    }
    if (bi >= 0 && r >= 1) break;
  }
  if (bi < 0) {
    T.S.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; bi = i; } });
  }
  return { i: bi, d: Math.sqrt(bd) };
}

// ---------- Construcción ----------

export function buildTrack(def, layers, opts = {}) {
  const g = sampleTrack(def);
  if (!g) return null;
  const { S, n, loop, L } = g;
  const T = { def, S, n, loop, L, theme: THEME[def.theme] || THEME.pradera };
  T.start = loop ? 0 : Math.min(14, n - 1);
  T.finish = loop ? 0 : Math.max(T.start + 4, n - 12);
  if (loop) T.cps = [Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4)];
  else { const r = T.finish - T.start; T.cps = [T.start + Math.floor(r / 3), T.start + Math.floor((2 * r) / 3)]; }
  T.laps = loop ? clamp(def.laps | 0 || 3, 1, 9) : 1;

  T.grid = new Map();
  S.forEach((s, i) => {
    const k = Math.floor(s.x / CELL) + ',' + Math.floor(s.y / CELL);
    let a = T.grid.get(k);
    if (!a) T.grid.set(k, (a = []));
    a.push(i);
  });

  T.patches = (def.patches || []).map((p) => ({ k: p.k, x: p.x, y: p.y, r: p.r || 44 }));
  T.solids = []; T.ramps = []; T.nitros = []; T.cones = []; T.user = [];
  for (const o of def.objs || []) {
    if (o.k === 'rampa') {
      const a = o.a != null ? o.a : S[nearestGlobal(T, o.x, o.y).i].h;
      T.ramps.push({ x: o.x, y: o.y, a });
    } else if (o.k === 'nitro') T.nitros.push({ x: o.x, y: o.y });
    else if (o.k === 'cono') T.cones.push({ x: o.x, y: o.y });
    else if (OBJ[o.k]) {
      const d = { k: o.k, x: o.x, y: o.y, r: OBJ[o.k].r, s: 1, seed: hashStr(o.x + ',' + o.y) };
      T.user.push(d);
      if (OBJ[o.k].solid) T.solids.push(d);
    }
  }
  findBridges(T);
  T.decor = [];
  if (opts.decor !== false) genDecor(T);
  T.notes = buildNotes(T);

  T.path = new Path2D();
  S.forEach((s, i) => (i ? T.path.lineTo(s.x, s.y) : T.path.moveTo(s.x, s.y)));
  if (loop) T.path.closePath();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of S) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); }
  T.bounds = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };

  if (layers) renderLayers(T, layers, opts.iso);
  return T;
}

function segCross(a, b, c, d) {
  const d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
  const d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
  const d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Cruces del trazado consigo mismo: el paso que llega después va por un puente
function findBridges(T) {
  const { S, n, loop } = T, segN = loop ? n : n - 1, found = [];
  for (const s of S) { s.lv = 0; s.z = 0; }
  for (let i = 0; i < segN; i++) {
    const a = S[i], b = S[(i + 1) % n];
    const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = T.grid.get((cx + dx) + ',' + (cy + dy));
      if (!arr) continue;
      for (const j of arr) {
        if (j <= i + 30 || j >= segN) continue;
        if (loop && (i - j + n) % n <= 30) continue;
        if (!segCross(a, b, S[j], S[(j + 1) % n])) continue;
        if (found.some((f) => Math.abs(f.i - i) < 12 && Math.abs(f.j - j) < 12)) continue;
        found.push({ i, j });
      }
    }
  }
  T.bridges = found.map(({ i, j }) => {
    const half = Math.ceil((S[i].w / 2 + 40) / SP) + 3;
    for (let k = j - half; k <= j + half; k++) {
      const q = loop ? ((k % n) + n) % n : clamp(k, 0, n - 1);
      // altura del tablero: sube por las rampas de acceso de cada extremo
      const e = clamp(Math.min(k - j + half, j + half - k) / 7, 0, 1);
      S[q].lv = 1; S[q].z = Math.max(S[q].z, BRIDGE_H * e * e * (3 - 2 * e));
    }
    return { from: j - half, to: j + half, under: i };
  });
}

function genDecor(T) {
  const R = rng(hashStr(T.def.name || 'pista'));
  const kinds = T.theme.decor, occ = [...T.user];
  const avoid = T.ramps.concat(T.nitros, T.cones);
  for (let k = 0; k < 1800 && T.decor.length < 240; k++) {
    const x = 20 + R() * (WW - 40), y = 20 + R() * (WH - 40);
    const nn = nearestGlobal(T, x, y);
    if (nn.d < T.S[nn.i].w / 2 + 40) continue;
    if (T.patches.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + 20) ** 2)) continue;
    if (avoid.some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < 900)) continue;
    if (occ.some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < 784)) continue;
    let u = R(), kind = kinds[0][0];
    for (const [kk, p] of kinds) { if (u < p) { kind = kk; break; } u -= p; }
    const s = 0.85 + R() * 0.4;
    const d = { k: kind, x, y, s, r: OBJ[kind].r * s, seed: (R() * 1e9) | 0 };
    T.decor.push(d); occ.push(d);
    if (OBJ[kind].solid) T.solids.push(d);
  }
}

function gradeOf(a) {
  return a > 115 ? 'H' : a > 80 ? '1' : a > 58 ? '2' : a > 42 ? '3' : a > 29 ? '4' : a > 19 ? '5' : '6';
}

// Notas del copiloto: curvas agrupadas con grado 1 (cerrada) a 6 (muy abierta), H = horquilla
function buildNotes(T) {
  const { S, n } = T, notes = [];
  let cur = null;
  const close = (c) => { if (c.end - c.i >= 2) notes.push({ i: c.i, dir: c.sg > 0 ? 1 : -1, grade: gradeOf(c.peak), long: c.end - c.i > 34 }); };
  for (let i = 0; i < n; i++) {
    const v = S[i].hd, sg = Math.sign(v);
    if (Math.abs(v) > 9) {
      if (cur && cur.sg === sg) { cur.peak = Math.max(cur.peak, Math.abs(v)); cur.end = i; }
      else { if (cur) close(cur); cur = { i, sg, peak: Math.abs(v), end: i }; }
    } else if (cur) { close(cur); cur = null; }
  }
  if (cur) close(cur);
  for (const r of T.ramps) notes.push({ i: Math.max(0, nearestGlobal(T, r.x, r.y).i - 3), label: 'SALTO' });
  for (const b of T.bridges) notes.push({ i: ((b.from - 2) % n + n) % n, label: 'PUENTE' });
  for (const p of T.patches) {
    const nn = nearestGlobal(T, p.x, p.y);
    if (nn.d < T.S[nn.i].w / 2 + p.r * 0.6) notes.push({ i: Math.max(0, nn.i - Math.round(p.r / SP)), label: p.k === 'barro' ? 'BARRO' : 'AGUA' });
  }
  return notes.sort((a, b) => a.i - b.i);
}

// ---------- Dibujo de capas estáticas ----------

let groundCache = null, groundKey = '';

export function paintGround(g, theme, seed) {
  const k = theme.label + '|' + seed;
  if (!groundCache) { groundCache = document.createElement('canvas'); groundCache.width = WW; groundCache.height = WH; }
  if (k !== groundKey) {
    groundKey = k;
    const c = groundCache.getContext('2d'), R = rng(seed ^ 0x5bd1e995);
    c.fillStyle = theme.ground; c.fillRect(0, 0, WW, WH);
    c.globalAlpha = 0.45; c.fillStyle = theme.ground2;
    for (let i = 0; i < 650; i++) { c.beginPath(); c.ellipse(R() * WW, R() * WH, 20 + R() * 60, 14 + R() * 40, R() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    for (let i = 0; i < 7000; i++) {
      c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)';
      c.fillRect(R() * WW, R() * WH, 1 + R() * 2, 1 + R() * 2);
    }
  }
  g.drawImage(groundCache, 0, 0);
}

function strokeAlong(g, T, pred, offs, col, lw) {
  const { S, n } = T, segN = T.loop ? n : n - 1;
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const o of offs) {
    g.beginPath();
    let pen = false;
    for (let i = 0; i < segN; i++) {
      const a = S[i], b = S[(i + 1) % n];
      if (!pred(a)) { pen = false; continue; }
      if (!pen) { g.moveTo(a.x + a.nx * a.w * o, a.y + a.ny * a.w * o); pen = true; }
      g.lineTo(b.x + b.nx * b.w * o, b.y + b.ny * b.w * o);
    }
    g.stroke();
  }
}

function quad(g, a, b, o1, o2) {
  g.beginPath();
  g.moveTo(a.x + a.nx * o1, a.y + a.ny * o1);
  g.lineTo(b.x + b.nx * o1, b.y + b.ny * o1);
  g.lineTo(b.x + b.nx * o2, b.y + b.ny * o2);
  g.lineTo(a.x + a.nx * o2, a.y + a.ny * o2);
  g.closePath(); g.fill();
}

// Firme, arcén y marcas de las muestras que cumplan sel(muestra)
function paintRoad(g, T, sel, deck = false) {
  const th = T.theme, S = T.S, n = T.n, segN = T.loop ? n : n - 1;
  const segOk = (i) => sel(S[i]) && (T.loop || i < n - 1) && sel(S[(i + 1) % n]);
  if (deck) {
    g.fillStyle = '#8c8a84';
    for (let i = 0; i < segN; i++) if (segOk(i)) { const a = S[i], b = S[(i + 1) % n]; quad(g, a, b, -a.w / 2 - 7, a.w / 2 + 7); }
  } else {
    g.fillStyle = th.verge;
    for (const s of S) if (sel(s)) { g.beginPath(); g.arc(s.x, s.y, s.w / 2 + 9, 0, 7); g.fill(); }
  }
  for (let i = 0; i < segN; i++) {
    if (!segOk(i)) continue;
    const a = S[i], b = S[(i + 1) % n];
    g.fillStyle = SURF[a.s].col;
    quad(g, a, b, -a.w / 2, a.w / 2);
    if (!deck) { g.beginPath(); g.arc(a.x, a.y, a.w / 2, 0, 7); g.fill(); }
  }
  if (!T.loop && !deck && sel(S[n - 1])) { const l = S[n - 1]; g.fillStyle = SURF[l.s].col; g.beginPath(); g.arc(l.x, l.y, l.w / 2, 0, 7); g.fill(); }

  const R = rng(99);
  for (const s of S) {
    if (!sel(s)) continue;
    for (let k = 0; k < 4; k++) {
      const o = (R() - 0.5) * s.w * 0.92, al = (R() - 0.5) * 8;
      g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)';
      g.fillRect(s.x + s.nx * o + s.tx * al, s.y + s.ny * o + s.ty * al, 1.5 + R() * 1.5, 1.5 + R() * 1.5);
    }
  }
  strokeAlong(g, T, (q) => sel(q) && q.s === 'tierra', [0.21, -0.21], 'rgba(70,42,20,.22)', 7);
  strokeAlong(g, T, (q) => sel(q) && q.s === 'nieve', [0.2, -0.2], 'rgba(120,140,170,.32)', 8);
  for (let i = 0; i < segN; i++) {
    if (!segOk(i)) continue;
    const a = S[i], b = S[(i + 1) % n];
    if (a.s !== 'asfalto') continue;
    const kerb = Math.abs(a.hd) > 18 && !deck;
    if (!kerb && ((i >> 1) % 2 === 0)) {
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    for (const side of [1, -1]) {
      if (kerb) { g.fillStyle = i % 2 ? '#ece9e4' : '#c8382e'; quad(g, a, b, side * (a.w / 2 - 7), side * (a.w / 2)); }
      else { g.fillStyle = 'rgba(255,255,255,.8)'; quad(g, a, b, side * (a.w / 2 - 5), side * (a.w / 2 - 3)); }
    }
  }
}

// Cada puente se dibuja en su propio canvas (solo su rectángulo) para pintarlo encima de los coches de abajo
function renderBridges(T) {
  const S = T.S, n = T.n;
  for (const b of T.bridges) {
    const idx = [];
    for (let k = b.from; k <= b.to; k++) idx.push(((k % n) + n) % n);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of idx) { const s = S[i], r = s.w / 2 + 14; x0 = Math.min(x0, s.x - r); y0 = Math.min(y0, s.y - r); x1 = Math.max(x1, s.x + r); y1 = Math.max(y1, s.y + r); }
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(x1 - x0)); cv.height = Math.max(1, Math.ceil(y1 - y0));
    const g = cv.getContext('2d');
    g.translate(-x0, -y0);
    const set = new Set(idx.map((i) => S[i]));
    paintRoad(g, T, (q) => set.has(q), true);
    // barandillas (sin los extremos, que son las rampas de acceso)
    for (const side of [1, -1]) {
      g.strokeStyle = '#4a4a47'; g.lineWidth = 4; g.lineCap = 'butt';
      g.beginPath();
      idx.slice(4, -4).forEach((i, k) => { const s = S[i], o = side * (s.w / 2 + 5); k ? g.lineTo(s.x + s.nx * o, s.y + s.ny * o) : g.moveTo(s.x + s.nx * o, s.y + s.ny * o); });
      g.stroke();
      g.strokeStyle = '#d6d3cb'; g.lineWidth = 1.6; g.stroke();
    }
    b.cv = cv; b.x = x0; b.y = y0;
  }
}

// iso: el juego dibuja con volumen rampas, árboles, rocas, postes y puentes; aquí solo va el suelo
export function renderLayers(T, layers, iso = false) {
  const g = layers.g.getContext('2d'), t = layers.t.getContext('2d');
  const th = T.theme, S = T.S, n = T.n, segN = T.loop ? n : n - 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  paintGround(g, th, hashStr(T.def.name || ''));

  for (const d of T.decor) if (d.k === 'arbusto') drawBush(g, d, th);
  for (const d of T.decor.concat(T.user)) if (OBJ[d.k] && OBJ[d.k].solid) drawShadow(g, d);

  paintRoad(g, T, (q) => !q.lv);
  // sombra de los puentes sobre el suelo
  for (const b of T.bridges) {
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let k = b.from + 3; k <= b.to - 3; k++) {
      const a = S[((k % n) + n) % n], c2 = S[(((k + 1) % n) + n) % n];
      g.save(); g.translate(11, 13); quad(g, a, c2, -a.w / 2 - 6, a.w / 2 + 6); g.restore();
    }
  }

  for (const p of T.patches) drawPatch(g, p);
  drawChecker(g, S[T.start]);
  if (!T.loop) drawChecker(g, S[T.finish]);
  if (iso) return;
  for (const r of T.ramps) drawRamp(g, r);

  // capa superior: copas de árboles, rocas, postes de control
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, WW, WH);
  for (const d of T.decor) if (d.k !== 'arbusto') drawDecor(t, d, th);
  for (const d of T.user) drawDecor(t, d, th);
  const cpAbs = T.cps.map((c) => (T.loop ? (T.start + c) % n : c));
  for (const i of cpAbs) drawPosts(t, S[i], '#ff7a1a');
  drawPosts(t, S[T.start], '#ffffff');
  if (!T.loop) drawPosts(t, S[T.finish], '#ffffff');
  renderBridges(T);
}

function drawChecker(g, s) {
  g.save(); g.translate(s.x, s.y); g.rotate(s.h);
  const w = s.w;
  for (let y = -w / 2, r = 0; y < w / 2; y += 7, r++) {
    for (let x = 0; x < 2; x++) {
      g.fillStyle = (r + x) % 2 ? '#16181b' : '#f4f4f2';
      g.fillRect(-7 + x * 7, y, 7, Math.min(7, w / 2 - y));
    }
  }
  g.restore();
}

function drawPosts(t, s, flag) {
  for (const side of [1, -1]) {
    const o = side * (s.w / 2 + 12), x = s.x + s.nx * o, y = s.y + s.ny * o;
    t.fillStyle = 'rgba(0,0,0,.3)'; t.beginPath(); t.arc(x + 2, y + 2, 3.5, 0, 7); t.fill();
    t.fillStyle = flag;
    t.beginPath(); t.moveTo(x, y); t.lineTo(x - s.tx * 9 + s.nx * 3, y - s.ty * 9 + s.ny * 3); t.lineTo(x - s.tx * 9 - s.nx * 3, y - s.ty * 9 - s.ny * 3); t.closePath(); t.fill();
    t.fillStyle = '#1b1e22'; t.beginPath(); t.arc(x, y, 3, 0, 7); t.fill();
  }
}

export function drawRamp(g, r) {
  g.save(); g.translate(r.x, r.y); g.rotate(r.a);
  const L = 34, W = 60;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-L / 2 + 5, -W / 2 + 5, L, W);
  const gr = g.createLinearGradient(-L / 2, 0, L / 2, 0);
  gr.addColorStop(0, '#6b5a45'); gr.addColorStop(1, '#d2bb93');
  g.fillStyle = gr; g.fillRect(-L / 2, -W / 2, L, W);
  g.strokeStyle = 'rgba(60,45,30,.55)'; g.lineWidth = 1.5;
  for (let x = -L / 2 + 6; x < L / 2 - 4; x += 6) { g.beginPath(); g.moveTo(x, -W / 2); g.lineTo(x, W / 2); g.stroke(); }
  for (let y = -W / 2, k = 0; y < W / 2; y += 10, k++) { g.fillStyle = k % 2 ? '#1b1b1b' : '#f2c230'; g.fillRect(L / 2 - 5, y, 5, 10); }
  g.restore();
}

function drawPatch(g, p) {
  const R = rng(hashStr(p.k + p.x + ',' + p.y));
  const mud = p.k === 'barro';
  const base = mud ? '#5b3c22' : '#4f7fa3', hi = mud ? '#76512f' : '#7fb0d0';
  const blobs = [];
  for (let k = 0; k < 7; k++) {
    const a = R() * 6.28, d = R() * p.r * 0.42, r = p.r * (0.42 + R() * 0.3);
    blobs.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, r * (0.7 + R() * 0.25), R() * 3]);
  }
  g.fillStyle = mud ? 'rgba(60,38,20,.35)' : 'rgba(40,70,95,.25)';
  for (const b of blobs) { g.beginPath(); g.ellipse(b[0], b[1], b[2] + 5, b[3] + 5, b[4], 0, 7); g.fill(); }
  g.fillStyle = base;
  for (const b of blobs) { g.beginPath(); g.ellipse(b[0], b[1], b[2], b[3], b[4], 0, 7); g.fill(); }
  g.fillStyle = hi;
  for (let k = 0; k < 4; k++) {
    const a = R() * 6.28, d = R() * p.r * 0.35, r = p.r * (0.1 + R() * 0.14);
    g.beginPath(); g.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, r * 0.6, R() * 3, 0, 7); g.fill();
  }
  if (!mud) {
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(p.x + (R() - 0.5) * p.r * 0.5, p.y + (R() - 0.5) * p.r * 0.5, p.r * (0.15 + R() * 0.2), R() * 3, R() * 3 + 1.6); g.stroke(); }
  }
}

function drawShadow(g, d) {
  const r = (d.r || 10) * 1.45;
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath(); g.ellipse(d.x + r * 0.45, d.y + r * 0.5, r, r * 0.8, 0.6, 0, 7); g.fill();
}

function drawBush(g, d, th) {
  const R = rng(d.seed), s = d.s || 1;
  g.fillStyle = th.bush;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(d.x + (R() - 0.5) * 10 * s, d.y + (R() - 0.5) * 8 * s, (3 + R() * 4) * s, 0, 7); g.fill(); }
}

function star(c, x, y, R1, R2, k, rot) {
  c.beginPath();
  for (let i = 0; i < k * 2; i++) {
    const a = rot + (i * Math.PI) / k, r = i % 2 ? R2 : R1;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}

function blob(c, x, y, r, R) {
  c.beginPath(); c.arc(x, y, r * 0.7, 0, 7); c.fill();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 6.28 + R() * 0.6, d = r * 0.42;
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + R() * 0.15), 0, 7); c.fill();
  }
}

function rock(c, x, y, r, R, k) {
  c.beginPath();
  for (let i = 0; i < k; i++) {
    const a = (i / k) * 6.28, rr = r * (0.75 + R() * 0.3);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.85;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}

export function drawDecor(c, d, th) {
  const s = d.s || 1, snow = th === THEME.nieve;
  const R = rng(d.seed || 1);
  switch (d.k) {
    case 'pino': {
      const r = 15 * s, rot = R() * 6.28;
      [[1, '#244d2e'], [0.72, '#2f6338'], [0.45, '#3b7a43']].forEach(([f, col]) => { c.fillStyle = col; star(c, d.x, d.y, r * f, r * f * 0.62, 8, rot); });
      if (snow) { c.fillStyle = 'rgba(250,252,255,.9)'; star(c, d.x - 2, d.y - 2, r * 0.55, r * 0.32, 8, rot); }
      break;
    }
    case 'arbol': {
      const r = 17 * s;
      c.fillStyle = '#3f6f2f'; blob(c, d.x, d.y, r, R);
      c.fillStyle = '#55893d'; blob(c, d.x - 3, d.y - 3, r * 0.62, R);
      c.fillStyle = '#6ea24c'; c.beginPath(); c.arc(d.x - 6, d.y - 6, r * 0.25, 0, 7); c.fill();
      break;
    }
    case 'roca': {
      const r = 12 * s;
      c.fillStyle = '#7d7062'; rock(c, d.x, d.y, r, R, 7);
      c.fillStyle = '#a2957f'; rock(c, d.x - 2, d.y - 2.5, r * 0.6, R, 6);
      if (snow) { c.fillStyle = '#f4f7fa'; rock(c, d.x - 3, d.y - 3.5, r * 0.4, R, 5); }
      break;
    }
    case 'cactus': {
      c.fillStyle = '#4c7a3a';
      c.beginPath(); c.arc(d.x, d.y, 6.5 * s, 0, 7); c.fill();
      c.beginPath(); c.ellipse(d.x - 9 * s, d.y, 5 * s, 3 * s, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(d.x + 8 * s, d.y + 2 * s, 4.5 * s, 2.8 * s, 0, 0, 7); c.fill();
      c.fillStyle = '#6a9a4f'; c.beginPath(); c.arc(d.x - 1.5, d.y - 1.5, 3 * s, 0, 7); c.fill();
      break;
    }
    case 'palmera': {
      const rot = R() * 6.28;
      c.strokeStyle = '#3f7a2c'; c.lineWidth = 3 * s; c.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const a = rot + (k / 7) * 6.28;
        c.beginPath(); c.moveTo(d.x, d.y); c.quadraticCurveTo(d.x + Math.cos(a + 0.3) * 9 * s, d.y + Math.sin(a + 0.3) * 9 * s, d.x + Math.cos(a) * 15 * s, d.y + Math.sin(a) * 15 * s); c.stroke();
      }
      c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(d.x, d.y, 2.5 * s, 0, 7); c.fill();
      break;
    }
    case 'acacia': {
      c.fillStyle = '#5f7a32'; c.beginPath(); c.ellipse(d.x, d.y, 18 * s, 13 * s, R() * 3, 0, 7); c.fill();
      c.fillStyle = '#76913f'; c.beginPath(); c.ellipse(d.x - 3, d.y - 3, 10 * s, 7 * s, R() * 3, 0, 7); c.fill();
      break;
    }
    case 'paja': {
      c.fillStyle = '#d4b25a'; c.beginPath(); c.arc(d.x, d.y, 10, 0, 7); c.fill();
      c.strokeStyle = '#a8873a'; c.lineWidth = 1.2;
      for (let r = 3; r < 10; r += 2.5) { c.beginPath(); c.arc(d.x, d.y, r, 0, 7); c.stroke(); }
      break;
    }
  }
}

// ---------- Objetos dinámicos ----------

export function drawCone(c, k) {
  c.save(); c.translate(k.x, k.y); c.rotate(k.a || 0);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(2, 2, 6, 0, 7); c.fill();
  c.fillStyle = '#e8541a'; c.fillRect(-5, -5, 10, 10);
  c.fillStyle = '#ff8a3d'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 2.4, 0, 7); c.fill();
  c.fillStyle = '#ff6a1f'; c.beginPath(); c.arc(0, 0, 1.1, 0, 7); c.fill();
  c.restore();
}

export function drawNitro(c, p, time) {
  const b = Math.sin((time || 0) / 260) * 1.5;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 4, 7, 5, 0, 0, 7); c.fill();
  c.save(); c.translate(p.x, p.y - b);
  c.fillStyle = '#ffd23f'; c.beginPath(); c.roundRect(-6, -8, 12, 16, 3); c.fill();
  c.fillStyle = '#c99a00'; c.fillRect(-6, 4, 12, 2);
  c.fillStyle = '#1d2630'; c.font = 'italic 800 10px Saira, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', 0, -1);
  c.restore();
}
