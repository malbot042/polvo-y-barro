// Arranque: pestañas, paletas, selector de circuitos, controles y bucle principal.
import { store, fmtTime, esc } from './util.js';
import { SURF, THEME } from './config.js';
import { BUILTIN_RAW } from './tracks.js';
import { resolveDef, normalizeDef } from './track.js';
import { createGame } from './game.js';
import { createEditor } from './editor.js';
import { LIVERIES, drawCarPreview } from './car.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const BUILTIN = BUILTIN_RAW.map((d) => normalizeDef(resolveDef(d)));
const SAVED_KEY = 'pyb-tracks-v1';
let saved = (Array.isArray(store.get(SAVED_KEY, [])) ? store.get(SAVED_KEY, []) : []).map(normalizeDef);
let testDef = null;
let mode = 'rally';
let carColor = '#e4572e';
let carId = store.get('pyb-car', 'paleta');
if (!LIVERIES[carId]) carId = 'paleta';
function playerLivery() { const L = LIVERIES[carId]; return { ...L, base: L.base || carColor }; }

function trackList() {
  const l = BUILTIN.map((d, i) => ({ id: 'b' + i, label: d.name, def: d }));
  saved.forEach((d, i) => l.push({ id: 's' + i, label: '★ ' + d.name, def: d }));
  if (testDef) l.push({ id: 'editor', label: '✎ ' + testDef.name + ' (en edición)', def: testDef });
  return l;
}

// ---------- Paleta ----------
function setPal(p) {
  const r = document.documentElement;
  if (p === 'azul') delete r.dataset.pal; else r.dataset.pal = p;
  document.querySelectorAll('button[data-pal]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pal === p));
  carColor = getComputedStyle(r).getPropertyValue('--car').trim() || '#e4572e';
  store.set('pyb-pal', p);
  if (editor) editor.refresh();
  drawCarUI();
}
document.querySelectorAll('button[data-pal]').forEach((b) => b.addEventListener('click', () => setPal(b.dataset.pal)));

// ---------- Sonido ----------
const audio = createAudio();
audio.setMuted(store.get('pyb-mute', false));
audio.setVoice(store.get('pyb-voice', true));
function syncSoundUI() {
  $('snd').setAttribute('aria-pressed', !audio.muted);
  $('snd').textContent = audio.muted ? 'Sonido no' : 'Sonido sí';
  $('voz').setAttribute('aria-pressed', audio.voice);
  $('voz').textContent = audio.voice ? 'Copiloto sí' : 'Copiloto no';
}
$('snd').addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); store.set('pyb-mute', audio.muted); syncSoundUI(); });
$('voz').addEventListener('click', () => { audio.unlock(); audio.setVoice(!audio.voice); store.set('pyb-voice', audio.voice); syncSoundUI(); });
syncSoundUI();
// el navegador solo deja sonar audio tras un gesto del usuario
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => audio.unlock(), { capture: true }));
document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));

// ---------- Juego ----------
const ovl = $('ovl');
const game = createGame($('cv'), {
  livery: playerLivery,
  sfx: (name, d) => audio.sfx(name, d),
  onResults: showResults,
});

function showIdle(i) {
  if (!i) {
    ovl.innerHTML = '<div class="card"><h3>Trazado incompleto</h3><p>Vuelve al editor y añade más puntos.</p></div>';
    ovl.hidden = false; return;
  }
  const modeTxt = mode === 'rally' ? 'Rally · contra el reloj' : 'Carrera · 4 coches';
  const meta = [
    i.loop ? `${i.laps} ${i.laps > 1 ? 'vueltas' : 'vuelta'}` : 'Tramo de salida a meta',
    `${Math.round(i.lengthM)} m`,
    i.surfaces.join(' + '),
  ].join(' · ');
  const extra = mode === 'rally'
    ? `<p class="muted">Récord: <b>${i.best != null ? fmtTime(i.best) : 'sin tiempo'}</b>${i.best != null ? ' · correrás contra tu fantasma' : ''}</p>`
    : '<p class="muted">Coge las latas de nitro, usa los saltos y no te dejes empujar.</p>';
  ovl.innerHTML = `<div class="card"><span class="eyebrow">${modeTxt}</span><h3>${esc(i.name)}</h3><p>${meta}</p>${extra}<button class="btn" id="o-go">Empezar</button></div>`;
  ovl.hidden = false;
  $('o-go').addEventListener('click', start);
}

function start() {
  audio.unlock();
  ovl.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  game.start();
}

function showResults(r) {
  let body;
  if (r.mode === 'rally') {
    const delta = r.best != null ? r.time - r.best : null;
    // En circuitos se muestra el paso por meta de cada vuelta; en tramos, cada parcial
    let prevT = 0;
    const rows = r.splits.map((t, k) => {
      const isLap = r.lapEvery ? (k + 1) % r.lapEvery === 0 : true;
      if (!isLap) return '';
      const p = r.prevSplits && r.prevSplits[k] != null ? t - r.prevSplits[k] : null;
      const d = p == null ? '' : `<span class="${p < 0 ? 'good' : 'bad'}">${p < 0 ? '−' : '+'}${Math.abs(p).toFixed(2)}</span>`;
      const label = r.lapEvery ? `Vuelta ${(k + 1) / r.lapEvery}` : k === r.splits.length - 1 ? 'Meta' : 'Parcial ' + (k + 1);
      const lapT = r.lapEvery ? `<td class="muted">${fmtTime(t - prevT)}</td>` : '';
      prevT = t;
      return `<tr><td>${label}</td>${lapT}<td>${fmtTime(t)}</td><td>${d}</td></tr>`;
    }).join('');
    body = `<span class="eyebrow">${r.record ? 'Nuevo récord' : 'Tiempo final'}</span>
      <h3 class="time">${fmtTime(r.time)}</h3>
      <p class="muted">${r.best == null ? 'Primer tiempo en este circuito. La próxima vez correrás contra tu fantasma.'
        : r.record ? `Mejoras tu récord en ${Math.abs(delta).toFixed(2)} s.` : `A ${delta.toFixed(2)} s de tu récord (${fmtTime(r.best)}).`}</p>
      <div class="tscroll"><table class="res"><tbody>${rows}</tbody></table></div>`;
  } else {
    const me = r.rows.find((x) => x.me);
    const rows = r.rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.pos}</td><td><i class="dot" style="background:${x.color}"></i>${esc(x.name)}</td><td>${x.time != null ? fmtTime(x.time) : 'en pista'}</td></tr>`).join('');
    body = `<span class="eyebrow">${esc(r.track)}</span><h3>${me.pos === 1 ? '¡Victoria!' : me.pos + 'º puesto'}</h3>
      <div class="tscroll"><table class="res"><tbody>${rows}</tbody></table></div>`;
  }
  ovl.innerHTML = `<div class="card">${body}<div class="row"><button class="btn" id="o-again">Repetir</button><button class="btn ghost" id="o-menu">Elegir otro</button></div></div>`;
  ovl.hidden = false;
  $('o-again').addEventListener('click', start);
  $('o-menu').addEventListener('click', () => { showIdle(game.reset()); $('p-track').focus(); });
}

function refreshTrackSelect(keep) {
  const s = $('p-track'), cur = keep || s.value;
  s.replaceChildren();
  trackList().forEach((t) => s.add(new Option(t.label, t.id)));
  if ([...s.options].some((o) => o.value === cur)) s.value = cur;
  editor.refreshLoadList();
}

function loadSelected() {
  const t = trackList().find((x) => x.id === $('p-track').value) || trackList()[0];
  showIdle(game.load(t.def));
}

$('p-track').addEventListener('change', loadSelected);
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  showIdle(game.setMode(mode));
}));
$('p-restart').addEventListener('click', start);

// Teclado
const KMAP = { ArrowUp: 't', KeyW: 't', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', Space: 'hb', ShiftLeft: 'n', ShiftRight: 'n', KeyN: 'n' };
const typing = (e) => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
window.addEventListener('keydown', (e) => {
  if ($('pane-play').hidden || typing(e)) return;
  if (e.code === 'Enter' && game.state === 'idle' && !ovl.hidden && $('o-go')) { e.preventDefault(); start(); return; }
  if (e.code === 'KeyM') { audio.unlock(); audio.setMuted(!audio.muted); store.set('pyb-mute', audio.muted); syncSoundUI(); return; }
  const k = KMAP[e.code]; if (!k) return;
  e.preventDefault(); game.keys[k] = 1;
});
window.addEventListener('keyup', (e) => { const k = KMAP[e.code]; if (k) game.keys[k] = 0; });
window.addEventListener('blur', () => { for (const k in game.keys) game.keys[k] = 0; });

// Botones táctiles
document.querySelectorAll('.pad').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); game.keys[k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { game.keys[k] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, off));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---------- Coche ----------
const carSel = $('p-car');
Object.entries(LIVERIES).forEach(([id, L]) => carSel.add(new Option(L.label, id)));
carSel.value = carId;
function setCar(id) {
  carId = LIVERIES[id] ? id : 'paleta';
  carSel.value = carId;
  store.set('pyb-car', carId);
  drawCarUI();
}
carSel.addEventListener('change', () => setCar(carSel.value));

// Garaje: las cinco decoraciones, pulsables
const garage = $('garage');
Object.entries(LIVERIES).forEach(([id, L]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'gcar'; b.dataset.car = id;
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  const cap = document.createElement('span'); cap.textContent = L.label;
  b.append(cv, cap);
  b.addEventListener('click', () => setCar(id));
  garage.append(b);
});
function drawCarUI() {
  if (!garage) return;
  drawCarPreview($('p-car-prev'), playerLivery(), '1', 0);
  garage.querySelectorAll('.gcar').forEach((b) => {
    const L = LIVERIES[b.dataset.car];
    b.setAttribute('aria-pressed', b.dataset.car === carId);
    drawCarPreview(b.querySelector('canvas'), { ...L, base: L.base || carColor }, '1');
  });
}

// ---------- Editor ----------
const editor = createEditor($('ecv'), {
  tracks: trackList,
  visible: () => !$('pane-edit').hidden,
  test(def) {
    testDef = normalizeDef(def);
    refreshTrackSelect('editor');
    $('p-track').value = 'editor';
    showTab('play');
    loadSelected();
  },
  save(def) {
    const n = normalizeDef(def);
    const i = saved.findIndex((d) => d.name === n.name);
    if (i >= 0) saved[i] = n; else saved.push(n);
    const ok = store.set(SAVED_KEY, saved);
    refreshTrackSelect();
    return ok;
  },
});

// ---------- Pestañas ----------
function showTab(t) {
  $('pane-play').hidden = t !== 'play';
  $('pane-edit').hidden = t !== 'edit';
  $('t-play').setAttribute('aria-selected', t === 'play');
  $('t-edit').setAttribute('aria-selected', t === 'edit');
  for (const k in game.keys) game.keys[k] = 0;
  requestAnimationFrame(() => { game.resize(); editor.resize(); editor.refresh(); });
}
$('t-play').addEventListener('click', () => showTab('play'));
$('t-edit').addEventListener('click', () => showTab('edit'));

// ---------- HUD ----------
let hudKey = '';
function updateHud() {
  const h = game.hud();
  if (!h) return;
  const nit = '◆'.repeat(h.nitro) + '◇'.repeat(Math.max(0, 3 - h.nitro));
  const k = [h.aL, h.a, h.bL, h.b, h.time, h.speed, nit].join('|');
  if (k === hudKey) return;
  hudKey = k;
  $('h-al').textContent = h.aL; $('h-a').textContent = h.a;
  $('h-bl').textContent = h.bL; $('h-b').textContent = h.b;
  $('h-time').textContent = h.time; $('h-speed').textContent = h.speed; $('h-nitro').textContent = nit;
}

// ---------- Tabla de superficies ----------
(function surfTable() {
  const base = SURF.asfalto;
  const rows = [
    ['asfalto', SURF.asfalto, 'Tramo del trazado', SURF.asfalto.col],
    ['tierra', SURF.tierra, 'Tramo del trazado', SURF.tierra.col],
    ['nieve', SURF.nieve, 'Tramo del trazado', SURF.nieve.col],
    ['barro', SURF.barro, 'Mancha que se coloca', SURF.barro.col],
    ['agua', SURF.agua, 'Charco que se coloca', SURF.agua.col],
    ['hierba', THEME.pradera.off, 'Fuera de pista en pradera', THEME.pradera.ground],
    ['arena', THEME.desierto.off, 'Fuera de pista en desierto', THEME.desierto.ground],
    ['nieveh', THEME.nieve.off, 'Fuera de pista en montaña', THEME.nieve.ground],
  ];
  $('surf-body').innerHTML = rows.map(([, s, where, col]) => {
    const g = Math.round((s.grip / base.grip) * 100), m = Math.round(s.max * 100);
    return `<tr><td><span class="sw" style="background:${col}"></span>${s.label}</td>
      <td><span class="bar" style="width:${g * 0.6}px"></span>${g}%</td>
      <td><span class="bar alt" style="width:${m * 0.6}px"></span>${m}%</td><td>${where}</td></tr>`;
  }).join('');
})();

// ---------- Inicio ----------
setPal(store.get('pyb-pal', 'azul'));
refreshTrackSelect('b0');
editor.load({ ...BUILTIN[0], name: 'Mi circuito' });
loadSelected();

drawCarUI();
const ro = new ResizeObserver(() => { game.resize(); editor.resize(); });
ro.observe($('cv')); ro.observe($('ecv'));
game.resize(); editor.resize();

let last = performance.now(), acc = 0;
const DT = 1 / 120;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!$('pane-play').hidden) {
    acc += dt;
    while (acc >= DT) { game.tick(DT); acc -= DT; }
    game.render(now);
    updateHud();
    audio.update(game.audioState());
  } else { acc = 0; audio.update(null); }
  if (!$('pane-edit').hidden) editor.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Acceso desde la consola del navegador para depurar: __pyb.game.cars, __pyb.editor.def…
window.__pyb = { game, editor, audio };
