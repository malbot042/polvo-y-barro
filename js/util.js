// Utilidades compartidas
export const WW = 3600;          // ancho del mundo (px)
export const WH = 2400;          // alto del mundo (px)
export const AREA = (WW * WH) / (2400 * 1500);   // superficie frente al mundo original, para escalar la decoración
export const SP = 8;             // separación entre muestras del trazado (px)
export const M_PER_PX = 0.15;    // escala: un coche (26 px) ≈ 4 m

// Proyección isométrica 2:1: el mundo se gira 45° y se aplasta a la mitad en vertical.
// La física sigue en el plano (x, y); z es la altura, que sube en pantalla.
export const ISO_C = Math.SQRT1_2;
export const ISO_Z = 0.86;

// Vista centrada en (camX, camY) con zoom Z sobre un canvas de cw×ch px
export function isoView(Z, camX, camY, cw, ch) {
  const a = Z * ISO_C, b = Z * ISO_C * 0.5, c = -Z * ISO_C, d = Z * ISO_C * 0.5, zk = Z * ISO_Z;
  const ox = cw / 2 - (a * camX + c * camY), oy = ch / 2 - (b * camX + d * camY), det = a * d - b * c;
  return {
    Z, a, b, c, d, ox, oy,
    // mundo → pantalla
    px: (x, y) => a * x + c * y + ox,
    py: (x, y, z = 0) => b * x + d * y + oy - z * zk,
    // pantalla → mundo (sobre el suelo)
    inv(sx, sy) { const u = sx - ox, v = sy - oy; return [(d * u - c * v) / det, (-b * u + a * v) / det]; },
    // transforma el contexto para dibujar en coordenadas de mundo a la altura z
    set(g, z = 0, dx = 0, dy = 0) { g.setTransform(a, b, c, d, ox + dx, oy - z * zk + dy); },
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function wrapA(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Generador pseudoaleatorio con semilla (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  str = String(str);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// localStorage tolerante a fallos (modo privado, cuota, etc.)
export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  },
};

export function shade(hex, f) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16) || 0;
  const r = Math.min(255, ((v >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((v >> 8) & 255) * f) | 0;
  const b = Math.min(255, (v & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

export function fmtTime(t) {
  if (t == null || !isFinite(t)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
