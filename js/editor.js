// Editor de circuitos: trazado por puntos, superficie y ancho por tramo, objetos.
import { WW, WH, M_PER_PX, clamp } from './util.js';
import { THEME, WIDTHS, SURF } from './config.js';
import { buildTrack, nearestGlobal, normalizeDef, cleanDef, drawCone, drawNitro } from './track.js';

const TOOL_HINT = {
  trazo: 'Pulsa fuera de la pista para añadir un punto al final y sobre la pista para insertar uno en medio. Arrastra los puntos para moverlos.',
  barro: 'Pulsa sobre la pista para echar una mancha de barro. Frena mucho y patina.',
  agua: 'Pulsa sobre la pista para poner un charco. Salpica y quita agarre.',
  arbol: 'Pulsa para plantar un árbol. Es sólido: quien se salga, choca.',
  roca: 'Pulsa para colocar una roca sólida.',
  paja: 'Pulsa para colocar una paca de paja. Útil para marcar el exterior de las curvas.',
  cono: 'Pulsa para colocar un cono. Los coches los arrastran al pasar.',
  rampa: 'Pulsa sobre la pista para poner una rampa. Se orienta sola en el sentido de la marcha.',
  nitro: 'Pulsa para dejar una lata de nitro. Reaparece a los 8 segundos.',
  borrar: 'Pulsa sobre un punto del trazado o sobre un objeto para quitarlo.',
};

export function createEditor(cv, hooks) {
  const $ = (id) => document.getElementById(id);
  const ctx = cv.getContext('2d');
  const mk = () => { const c = document.createElement('canvas'); c.width = WW; c.height = WH; return c; };
  const layers = { g: mk(), t: mk() };
  let def = null, T = null, tool = 'trazo', sel = -1, drag = null, undo = [], need = null, dirty = true, dpr = 1;

  const pxWorld = () => WW / (cv.clientWidth || 1);
  const schedule = (q) => { need = need === 'full' ? 'full' : q; };
  const push = () => { undo.push(JSON.stringify(def)); if (undo.length > 60) undo.shift(); };
  const hint = (msg) => { $('e-hint').textContent = msg; };

  function load(d) {
    def = normalizeDef(JSON.parse(JSON.stringify(d)));
    sel = -1; undo = []; schedule('full'); syncForm(); syncPoint();
  }

  function status() {
    const len = T ? `${Math.round(T.L * M_PER_PX)} m` : def.type === 'tramo' ? 'faltan puntos (mínimo 2)' : 'faltan puntos (mínimo 3)';
    $('e-stat').textContent = `${def.pts.length} puntos · ${len} · ${def.objs.length + def.patches.length} objetos`;
  }

  function syncForm() {
    $('e-name').value = def.name;
    $('e-type').value = def.type;
    $('e-laps').value = def.laps;
    $('e-laps').disabled = def.type === 'tramo';
    $('e-theme').value = def.theme;
  }

  function syncPoint() {
    const box = $('e-point');
    if (sel < 0 || !def.pts[sel]) { box.hidden = true; return; }
    box.hidden = false;
    const p = def.pts[sel];
    const nxt = def.type === 'tramo' && sel === def.pts.length - 1 ? 'final del tramo' : `tramo hasta el punto ${((sel + 1) % def.pts.length) + 1}`;
    $('e-point-title').textContent = `Punto ${sel + 1}`;
    $('e-point-sub').textContent = nxt;
    box.querySelectorAll('[data-surf]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.surf === p.s));
    box.querySelectorAll('[data-width]').forEach((b) => b.setAttribute('aria-pressed', WIDTHS[b.dataset.width] === Math.round(p.w)));
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t));
    hint(TOOL_HINT[t] || '');
  }

  function update() {
    if (need) {
      const quick = need === 'quick';
      need = null;
      T = buildTrack(def, layers, { decor: !quick });
      dirty = true;
      status();
    }
    render();
  }

  function render() {
    if (!dirty || !cv.width) return;
    dirty = false;
    const W = cv.width, H = cv.height, sc = W / WW, px = pxWorld();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e4572e';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (T) {
      ctx.drawImage(layers.g, 0, 0, W, H);
      for (const b of T.bridges) if (b.cv) ctx.drawImage(b.cv, b.x * sc, b.y * sc, b.cv.width * sc, b.cv.height * sc);
      ctx.drawImage(layers.t, 0, 0, W, H);
    }
    else { ctx.fillStyle = (THEME[def.theme] || THEME.pradera).ground; ctx.fillRect(0, 0, W, H); }
    ctx.setTransform(sc, 0, 0, sc, 0, 0);

    for (const o of def.objs) {
      if (o.k === 'cono') drawCone(ctx, o);
      else if (o.k === 'nitro') drawNitro(ctx, o, 0);
    }
    // contorno de manchas para poder seleccionarlas
    ctx.lineWidth = 1.2 * px; ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = 'rgba(255,255,255,.55)';
    for (const p of def.patches) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); }

    // polígono de control
    ctx.setLineDash([6 * px, 6 * px]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    def.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (def.type !== 'tramo' && def.pts.length > 2) ctx.closePath();
    ctx.stroke(); ctx.setLineDash([]);

    if (T) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2 * px; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 20; i < T.n - 4; i += 36) {
        const s = T.S[i];
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.h);
        ctx.beginPath(); ctx.moveTo(-4 * px, -5 * px); ctx.lineTo(3 * px, 0); ctx.lineTo(-4 * px, 5 * px); ctx.stroke();
        ctx.restore();
      }
      tag(T.S[T.start], 'SALIDA', px);
      if (!T.loop) tag(T.S[T.finish], 'META', px);
    }

    def.pts.forEach((p, i) => {
      const r = (i === sel ? 11 : 8.5) * px;
      ctx.fillStyle = i === sel ? accent : '#ffffff'; ctx.strokeStyle = '#13283b'; ctx.lineWidth = 2 * px;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = i === sel ? '#ffffff' : '#13283b';
      ctx.font = `700 ${9 * px}px Archivo, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y + 0.5 * px);
    });

    if (!def.pts.length) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(10,16,22,.65)';
      const w = Math.min(W - 40, 520 * dpr), h = 64 * dpr;
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, H / 2 - h / 2, w, h, 10 * dpr); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `600 ${14 * dpr}px Archivo, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Pulsa en el mapa para poner el primer punto del trazado', W / 2, H / 2);
    }
  }

  function tag(s, txt, px) {
    const o = s.w / 2 + 26, x = s.x + s.nx * o, y = s.y + s.ny * o;
    ctx.font = `italic 800 ${12 * px}px Saira, sans-serif`;
    const w = ctx.measureText(txt).width + 12 * px;
    ctx.fillStyle = 'rgba(10,16,22,.8)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 9 * px, w, 18 * px, 4 * px); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 0.5 * px);
  }

  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * WW, 0, WW), y: clamp(((e.clientY - r.top) / r.height) * WH, 0, WH) };
  }

  function pickPoint(w, rad) {
    let pi = -1, pd = rad;
    def.pts.forEach((p, i) => { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < pd) { pd = d; pi = i; } });
    return pi;
  }
  function pickObj(w, rad) {
    let best = null, bd = rad;
    def.objs.forEach((o, i) => { const d = Math.hypot(o.x - w.x, o.y - w.y); if (d < bd) { bd = d; best = { arr: 'objs', i }; } });
    if (!best) def.patches.forEach((p, i) => { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < p.r * 0.8 && d < bd + p.r) { bd = d; best = { arr: 'patches', i }; } });
    return best;
  }
  function rampAngle(o) { if (!T) return 0; return Math.round(T.S[nearestGlobal(T, o.x, o.y).i].h * 1000) / 1000; }

  cv.addEventListener('pointerdown', (e) => {
    if (!def) return;
    e.preventDefault();
    const w = toWorld(e), rad = 14 * pxWorld();
    const pi = pickPoint(w, rad), ob = pickObj(w, rad * 1.2);
    const capture = () => { try { cv.setPointerCapture(e.pointerId); } catch (_) {} };

    if (tool === 'borrar') {
      if (ob) { push(); def[ob.arr].splice(ob.i, 1); schedule('full'); }
      else if (pi >= 0) { push(); def.pts.splice(pi, 1); sel = -1; schedule('full'); syncPoint(); }
      return;
    }
    if (pi >= 0 && (tool === 'trazo' || !ob)) {
      push(); sel = pi; drag = { type: 'pt', i: pi }; capture(); syncPoint(); dirty = true; return;
    }
    if (ob) { push(); drag = { type: 'obj', ref: ob }; capture(); return; }

    push();
    if (tool === 'trazo') {
      const base = def.pts[sel] || def.pts[def.pts.length - 1];
      const np = { x: w.x, y: w.y, s: base ? base.s : 'tierra', w: base ? base.w : WIDTHS.normal };
      let at = def.pts.length;
      if (T) {
        const g = nearestGlobal(T, w.x, w.y);
        if (g.i >= 0 && g.d < T.S[g.i].w / 2) at = T.S[g.i].seg + 1;
      }
      def.pts.splice(at, 0, np);
      sel = at; drag = { type: 'pt', i: at }; capture();
      schedule('quick'); syncPoint();
      return;
    }
    if (tool === 'barro' || tool === 'agua') def.patches.push({ k: tool, x: w.x, y: w.y, r: 44 });
    else {
      const o = { k: tool, x: w.x, y: w.y };
      if (tool === 'rampa') o.a = rampAngle(o);
      def.objs.push(o);
    }
    schedule('full');
  });

  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const w = toWorld(e);
    if (drag.type === 'pt') { const p = def.pts[drag.i]; p.x = w.x; p.y = w.y; schedule('quick'); }
    else { const o = def[drag.ref.arr][drag.ref.i]; o.x = w.x; o.y = w.y; schedule('quick'); }
  });
  const endDrag = () => {
    if (!drag) return;
    if (drag.type === 'obj') { const o = def[drag.ref.arr][drag.ref.i]; if (o && o.k === 'rampa') o.a = rampAngle(o); }
    drag = null; schedule('full');
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // ---------- Formulario ----------
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('e-name').addEventListener('input', () => { def.name = $('e-name').value.slice(0, 40) || 'Sin nombre'; });
  $('e-name').addEventListener('change', () => schedule('full'));
  $('e-type').addEventListener('change', () => { push(); def.type = $('e-type').value; syncForm(); syncPoint(); schedule('full'); });
  $('e-laps').addEventListener('change', () => { def.laps = clamp(parseInt($('e-laps').value, 10) || 3, 1, 9); $('e-laps').value = def.laps; });
  $('e-theme').addEventListener('change', () => { push(); def.theme = $('e-theme').value; schedule('full'); });

  $('e-point').querySelectorAll('[data-surf]').forEach((b) => b.addEventListener('click', () => {
    if (sel < 0) return; push(); def.pts[sel].s = b.dataset.surf; schedule('full'); syncPoint();
  }));
  $('e-point').querySelectorAll('[data-width]').forEach((b) => b.addEventListener('click', () => {
    if (sel < 0) return; push(); def.pts[sel].w = WIDTHS[b.dataset.width]; schedule('full'); syncPoint();
  }));
  $('e-all').addEventListener('click', () => {
    if (sel < 0) return; push();
    const p = def.pts[sel];
    def.pts.forEach((q) => { q.s = p.s; q.w = p.w; });
    schedule('full'); hint(`Todo el trazado es ahora ${SURF[p.s].label.toLowerCase()}.`);
  });
  $('e-delpt').addEventListener('click', () => {
    if (sel < 0) return; push(); def.pts.splice(sel, 1); sel = -1; schedule('full'); syncPoint();
  });

  function doUndo() {
    if (!undo.length) { hint('No hay nada que deshacer.'); return; }
    def = JSON.parse(undo.pop()); sel = -1; schedule('full'); syncForm(); syncPoint();
  }
  $('e-undo').addEventListener('click', doUndo);
  $('e-new').addEventListener('click', () => {
    push();
    def = { name: 'Circuito nuevo', type: 'circuito', laps: 3, theme: def.theme, pts: [], objs: [], patches: [] };
    sel = -1; schedule('full'); syncForm(); syncPoint(); setTool('trazo');
  });
  $('e-load').addEventListener('change', () => {
    const id = $('e-load').value;
    const t = hooks.tracks().find((x) => x.id === id);
    if (t) { load(t.def); hint(`Abierto «${t.def.name}». Los cambios no tocan el original hasta que guardes.`); }
    $('e-load').value = '';
  });
  $('e-test').addEventListener('click', () => {
    if (!T) { hint(def.type === 'tramo' ? 'Un tramo necesita al menos 2 puntos.' : 'Un circuito necesita al menos 3 puntos.'); return; }
    hooks.test(cleanDef(def));
  });
  $('e-save').addEventListener('click', () => {
    if (!T) { hint('Completa el trazado antes de guardarlo.'); return; }
    const ok = hooks.save(cleanDef(def));
    hint(ok ? `Guardado en este navegador como «${def.name}». Ya aparece en la lista de circuitos.` : 'No se pudo guardar: el navegador no permite almacenamiento local. Usa Exportar.');
  });
  $('e-export').addEventListener('click', () => {
    $('e-json').value = JSON.stringify(cleanDef(def));
    $('e-json').select();
    hint('Copia el texto y compártelo. Quien lo pegue en Importar tendrá tu circuito.');
  });
  $('e-copy').addEventListener('click', () => {
    const ta = $('e-json');
    if (!ta.value) ta.value = JSON.stringify(cleanDef(def));
    const done = () => hint('Copiado al portapapeles.');
    const fallback = () => { ta.focus(); ta.select(); hint('Texto seleccionado: cópialo con Ctrl+C o Cmd+C.'); };
    try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (_) { fallback(); }
  });
  $('e-import').addEventListener('click', () => {
    try {
      const d = JSON.parse($('e-json').value);
      const n = normalizeDef(d);
      if (!n.pts.length) throw new Error('sin puntos');
      push(); def = n; sel = -1; schedule('full'); syncForm(); syncPoint();
      hint(`Importado «${n.name}».`);
    } catch (_) {
      hint('Ese texto no es un circuito válido. Pega el texto completo que da Exportar.');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!hooks.visible()) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { e.preventDefault(); push(); def.pts.splice(sel, 1); sel = -1; schedule('full'); syncPoint(); }
  });

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; dirty = true; }
  }

  function refreshLoadList() {
    const sel2 = $('e-load');
    sel2.replaceChildren(new Option('Abrir un circuito…', ''));
    hooks.tracks().filter((t) => t.id !== 'editor').forEach((t) => sel2.add(new Option(t.label, t.id)));
  }

  setTool('trazo');
  return { load, update, resize, refreshLoadList, refresh() { dirty = true; }, get def() { return def; } };
}
