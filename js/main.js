// Arranque: pestañas, paletas, juego libre, recreativa, campeonato, editor, controles y bucle principal.
import { store, fmtTime, esc } from './util.js';
import { SURF, THEME, CAR_MODELS, UPGRADES, CONDITIONS, REPAIR_PER_PCT, ARCADE, carSpec } from './config.js';
import { BUILTIN_RAW, SEASON, ARCADE_STAGES } from './tracks.js';
import { resolveDef, normalizeDef } from './track.js';
import { createGame, RIVALS } from './game.js';
import { createEditor } from './editor.js';
import { LIVERIES, drawCarPreview } from './car.js';
import { createAudio } from './audio.js';
import { createCareer, POINTS } from './career.js';

const $ = (id) => document.getElementById(id);
const BUILTIN = BUILTIN_RAW.map((d) => normalizeDef(resolveDef(d)));
const SAVED_KEY = 'pyb-tracks-v1';
let saved = (Array.isArray(store.get(SAVED_KEY, [])) ? store.get(SAVED_KEY, []) : []).map(normalizeDef);
let testDef = null;
let mode = 'rally';
let carColor = '#e4572e';
let carId = store.get('pyb-car', 'paleta');
const oldModel = (m) => (m === 'raid' ? 'berlina' : m);   // la pick-up de raid pasó a ser la berlina
if (!LIVERIES[carId]) carId = 'paleta';
let quickModel = CAR_MODELS[oldModel(store.get('pyb-model', 'compacto'))] ? oldModel(store.get('pyb-model', 'compacto')) : 'compacto';
let quickCond = CONDITIONS[store.get('pyb-cond', 'seco')] ? store.get('pyb-cond', 'seco') : 'seco';
let inEvent = null;          // prueba del campeonato en curso
let arcRun = null;           // partida de recreativa en curso: { stage, score, carry, continues }
let arcModel = CAR_MODELS[oldModel(store.get('pyb-amodel', 'compacto'))] ? oldModel(store.get('pyb-amodel', 'compacto')) : 'compacto';
let contTimer = null;
const career = createCareer();
function playerLivery() { const L = LIVERIES[carId]; return { ...L, base: L.base || carColor }; }

function trackList() {
  const l = BUILTIN.map((d, i) => ({ id: 'b' + i, label: d.name, def: d }));
  saved.forEach((d, i) => l.push({ id: 's' + i, label: '★ ' + d.name, def: d }));
  if (testDef) l.push({ id: 'editor', label: '✎ ' + testDef.name + ' (en edición)', def: testDef });
  return l;
}
const builtinByName = (name) => BUILTIN.find((d) => d.name === name);

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
audio.setMusic(store.get('pyb-music', true));
function syncSoundUI() {
  $('snd').setAttribute('aria-pressed', !audio.muted); $('snd').textContent = audio.muted ? 'Sonido no' : 'Sonido sí';
  $('voz').setAttribute('aria-pressed', audio.voice); $('voz').textContent = audio.voice ? 'Copiloto sí' : 'Copiloto no';
  $('mus').setAttribute('aria-pressed', audio.music); $('mus').textContent = audio.music ? 'Música sí' : 'Música no';
}
$('snd').addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); store.set('pyb-mute', audio.muted); syncSoundUI(); });
$('voz').addEventListener('click', () => { audio.unlock(); audio.setVoice(!audio.voice); store.set('pyb-voice', audio.voice); syncSoundUI(); });
$('mus').addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.music); store.set('pyb-music', audio.music); syncSoundUI(); });
syncSoundUI();
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => audio.unlock(), { capture: true }));
document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));

// ---------- Juego ----------
const ovl = $('ovl');
const game = createGame($('cv'), {
  livery: playerLivery,
  sfx: (name, d) => audio.sfx(name, d),
  onResults: showResults,
});

function idleCard(i) {
  if (!i) return '<div class="card"><h3>Trazado incompleto</h3><p>Vuelve al editor y añade más puntos.</p></div>';
  if (i.arcade) {
    const a = i.arcade;
    const meta = [i.loop ? `${i.laps} ${i.laps > 1 ? 'vueltas' : 'vuelta'}` : 'Tramo de salida a meta', `${Math.round(i.lengthM)} m`, i.condLabel].join(' · ');
    return `<div class="card"><span class="eyebrow">Recreativa · tramo ${a.stage + 1} de ${a.total}</span><h3>${esc(i.name)}</h3><p>${meta}</p>
      <p class="muted">Sales con <b>${Math.ceil(a.start)} s</b>. Puntos: <b>${a.score}</b> · Continuaciones: <b>${arcRun ? arcRun.continues : 0}</b></p>
      <button class="btn" id="o-go" data-enter>Empezar</button></div>`;
  }
  const ev = i.event;
  const modeTxt = (ev ? `Prueba ${ev.idx + 1} de ${ev.total} · ` : '') + (mode === 'rally' ? 'Rally · contra el reloj' : 'Carrera · 4 coches');
  const meta = [
    i.loop ? `${i.laps} ${i.laps > 1 ? 'vueltas' : 'vuelta'}` : 'Tramo de salida a meta',
    `${Math.round(i.lengthM)} m`,
    i.surfaces.join(' + '),
    i.condLabel,
  ].join(' · ');
  let extra;
  if (mode === 'rally' && i.field) {
    extra = `<p class="muted">Tiempos de los rivales: ${i.field.map((f) => `${esc(f.name)} <b>${fmtTime(f.time)}</b>`).join(' · ')}</p>`;
  } else if (mode === 'rally') {
    extra = `<p class="muted">Récord con este coche: <b>${i.best != null ? fmtTime(i.best) : 'sin tiempo'}</b>${i.best != null ? ' · correrás contra tu fantasma' : ''}</p>`;
  } else extra = '<p class="muted">Coge las latas de nitro, usa los saltos y no te dejes empujar.</p>';
  if (ev) extra += `<p class="muted">Daños al salir: <b>${Math.round(career.car().dmg * 100)}%</b> · Puntos: ${POINTS.join(' / ')}</p>`;
  return `<div class="card"><span class="eyebrow">${modeTxt}</span><h3>${esc(i.name)}</h3><p>${meta}</p>${extra}<button class="btn" id="o-go" data-enter>Empezar</button></div>`;
}
function showIdle(i) {
  ovl.innerHTML = idleCard(i);
  ovl.hidden = false;
  const go = $('o-go'); if (go) go.addEventListener('click', start);
}

function start() {
  audio.unlock();
  ovl.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  game.start();
}

function rallyTable(r) {
  let prevT = 0;
  return r.splits.map((t, k) => {
    const isLap = r.lapEvery ? (k + 1) % r.lapEvery === 0 : true;
    if (!isLap) return '';
    const p = r.prevSplits && r.prevSplits[k] != null ? t - r.prevSplits[k] : null;
    const d = p == null ? '' : `<span class="${p < 0 ? 'good' : 'bad'}">${p < 0 ? '−' : '+'}${Math.abs(p).toFixed(2)}</span>`;
    const label = r.lapEvery ? `Vuelta ${(k + 1) / r.lapEvery}` : k === r.splits.length - 1 ? 'Meta' : 'Parcial ' + (k + 1);
    const lapT = r.lapEvery ? `<td class="muted">${fmtTime(t - prevT)}</td>` : '';
    prevT = t;
    return `<tr><td>${label}</td>${lapT}<td>${fmtTime(t)}</td><td>${d}</td></tr>`;
  }).join('');
}

function showResults(r) {
  if (r.mode === 'arcade') { arcadeResults(r); return; }
  const me = r.rows.find((x) => x.me);
  let body, buttons;
  if (inEvent) {
    const out = career.record(r);
    inEvent = null;
    const rows = out.rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.pos}</td><td><i class="dot" style="background:${x.color}"></i>${esc(x.name)}</td><td>${x.time != null ? fmtTime(x.time) : 'en pista'}</td><td>+${x.pts}</td></tr>`).join('');
    body = `<span class="eyebrow">${esc(out.track)} · campeonato</span><h3>${out.pos === 1 ? '¡Victoria!' : out.pos + 'º puesto'}</h3>
      <div class="tscroll"><table class="res"><tbody>${rows}</tbody></table></div>
      <p class="muted">Premio: <b>$${out.prize}</b> · Daños del coche: <b>${Math.round(out.dmg * 100)}%</b></p>
      ${out.champion ? `<p><b>${out.champion === 'Tú' ? `¡Campeón de la temporada! Bonus de $${out.bonus}.` : `${esc(out.champion)} gana la temporada.`}</b></p>` : ''}`;
    buttons = '<button class="btn" id="o-champ" data-enter>Volver al campeonato</button>';
    renderChamp();
  } else {
    const rows = r.rows.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.pos}</td><td><i class="dot" style="background:${x.color}"></i>${esc(x.name)}</td><td>${x.time != null ? fmtTime(x.time) : 'en pista'}</td></tr>`).join('');
    if (r.mode === 'rally') {
      const ra = r.rally, delta = ra.best != null ? me.time - ra.best : null;
      body = `<span class="eyebrow">${ra.record ? 'Nuevo récord' : 'Tiempo final'}</span>
        <h3 class="time">${fmtTime(me.time)}</h3>
        <p class="muted">${ra.best == null ? 'Primer tiempo con este coche aquí. La próxima vez correrás contra tu fantasma.'
          : ra.record ? `Mejoras tu récord en ${Math.abs(delta).toFixed(2)} s.` : `A ${delta.toFixed(2)} s de tu récord (${fmtTime(ra.best)}).`}</p>
        <div class="tscroll"><table class="res"><tbody>${rallyTable(ra)}</tbody></table></div>`;
    } else {
      body = `<span class="eyebrow">${esc(r.track)}</span><h3>${me.pos === 1 ? '¡Victoria!' : me.pos + 'º puesto'}</h3>
        <div class="tscroll"><table class="res"><tbody>${rows}</tbody></table></div>`;
    }
    buttons = '<button class="btn" id="o-again" data-enter>Repetir</button><button class="btn ghost" id="o-menu">Elegir otro</button>';
  }
  ovl.innerHTML = `<div class="card">${body}<div class="row">${buttons}</div></div>`;
  ovl.hidden = false;
  if ($('o-again')) $('o-again').addEventListener('click', start);
  if ($('o-menu')) $('o-menu').addEventListener('click', () => { showIdle(game.reset()); $('p-track').focus(); });
  if ($('o-champ')) $('o-champ').addEventListener('click', () => leaveEvent(true));
}

// ---------- Efecto de monitor ----------
let crt = store.get('pyb-crt', true) !== false;
function syncCRT() {
  $('crt').setAttribute('aria-pressed', crt); $('crt').textContent = crt ? 'CRT sí' : 'CRT no';
  $('cv').classList.toggle('crt', crt);
  game.setCRT(crt);
}
$('crt').addEventListener('click', () => { crt = !crt; store.set('pyb-crt', crt); syncCRT(); });
syncCRT();

// ---------- Juego libre ----------
function quickSetup(def) {
  return game.setup({
    def, mode, cond: quickCond, field: false, event: null, rivals: null,
    me: { model: quickModel, spec: carSpec(quickModel), dmg: 0 },
  });
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
  showIdle(quickSetup(t.def));
}
function setModeUI(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === m));
}
$('p-track').addEventListener('change', loadSelected);
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { setModeUI(b.dataset.mode); loadSelected(); }));
$('p-restart').addEventListener('click', () => { if (!arcRun) start(); });

Object.entries(CAR_MODELS).forEach(([id, M]) => $('p-model').add(new Option(M.label, id)));
$('p-model').value = quickModel;
$('p-model').addEventListener('change', () => { quickModel = $('p-model').value; store.set('pyb-model', quickModel); drawCarUI(); loadSelected(); });
Object.entries(CONDITIONS).forEach(([id, C]) => $('p-cond').add(new Option(C.label, id)));
$('p-cond').value = quickCond;
$('p-cond').addEventListener('change', () => { quickCond = $('p-cond').value; store.set('pyb-cond', quickCond); loadSelected(); });

// ---------- Recreativa ----------
const ARC_KEY = 'pyb-arcade-v1';
function arcScores() { const v = store.get(ARC_KEY, []); return Array.isArray(v) ? v : []; }
const qualifies = (score) => score > 0 && (arcScores().length < 10 || score > arcScores()[9].s);

function renderArcade() {
  $('a-cont').textContent = ARCADE.continues;
  $('a-models').innerHTML = Object.entries(CAR_MODELS).map(([id, M]) => `<button type="button" data-amodel="${id}" aria-pressed="${id === arcModel}">${M.label}</button>`).join('');
  $('a-models').querySelectorAll('[data-amodel]').forEach((b) => b.addEventListener('click', () => {
    arcModel = b.dataset.amodel; store.set('pyb-amodel', arcModel); renderArcade();
  }));
  $('a-stages').innerHTML = ARCADE_STAGES.map((e) => {
    const d = builtinByName(e.track);
    return `<li><span>${esc(e.track)}<small>${d.type === 'tramo' ? 'Tramo' : e.laps + ' vueltas'} · ${CONDITIONS[e.cond].label}</small></span></li>`;
  }).join('');
  const sc = arcScores();
  $('a-scores').innerHTML = sc.length
    ? sc.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.n)}</td><td>${x.st >= ARCADE_STAGES.length ? 'completo' : 'tramo ' + (x.st + 1)}</td><td>${x.s.toLocaleString('es-ES')}</td></tr>`).join('')
    : '<tr><td class="muted">Todavía no hay puntuaciones.</td></tr>';
}
$('a-go').addEventListener('click', () => {
  if (inEvent) leaveEvent(false);
  arcRun = { stage: 0, score: 0, carry: 0, continues: ARCADE.continues };
  audio.sfx('coin');
  enterArcadeStage();
});

function enterArcadeStage() {
  const st = ARCADE_STAGES[arcRun.stage];
  const def = { ...builtinByName(st.track), laps: st.laps };
  showTab('play');
  $('p-event').hidden = false;
  $('p-event-k').textContent = `Recreativa · tramo ${arcRun.stage + 1} de ${ARCADE_STAGES.length}`;
  $('p-event-t').textContent = `${st.track} · ${CONDITIONS[st.cond].label}`;
  $('p-event-back').textContent = 'Dejar la partida';
  document.querySelector('.setup').classList.add('locked');
  drawCarUI();
  showIdle(game.setup({
    def, mode: 'arcade', cond: st.cond, field: false, event: null, rivals: null,
    me: { model: arcModel, spec: carSpec(arcModel), dmg: 0 },
    arcade: { stage: arcRun.stage, total: ARCADE_STAGES.length, score: arcRun.score, carry: arcRun.carry, slack: st.slack },
  }));
}
function leaveArcade(toTab) {
  clearInterval(contTimer);
  arcRun = null;
  $('p-event').hidden = true;
  $('p-event-back').textContent = 'Volver al campeonato';
  document.querySelector('.setup').classList.remove('locked');
  drawCarUI();
  if (toTab) showTab('arcade');
  loadSelected();
}

function card(body, buttons) {
  ovl.innerHTML = `<div class="card">${body}<div class="row">${buttons}</div></div>`;
  ovl.hidden = false;
}

function arcadeResults(r) {
  if (!arcRun) return;
  clearInterval(contTimer);
  if (!r.timeout) {
    arcRun.score = r.score; arcRun.carry = r.left * ARCADE.carry; arcRun.stage++;
    const last = arcRun.stage >= ARCADE_STAGES.length;
    card(`<span class="eyebrow">Tramo ${r.stage + 1} de ${r.total} · superado</span><h3 class="time">${fmtTime(r.time)}</h3>
      <div class="tscroll"><table class="res"><tbody>
        <tr><td>Tiempo sobrante</td><td>${r.left.toFixed(1)} s</td></tr>
        <tr><td>Bonus de meta</td><td>+${r.bonus}</td></tr>
        <tr><td>Puntos en el tramo</td><td>+${r.gained}</td></tr>
        <tr class="me"><td>Total</td><td>${r.score.toLocaleString('es-ES')}</td></tr>
      </tbody></table></div>
      ${last ? '' : `<p class="muted">Los ${r.left.toFixed(1)} s que sobran se suman al siguiente tramo.</p>`}`,
      last ? '<button class="btn" id="o-next" data-enter>Ver la puntuación final</button>' : '<button class="btn" id="o-next" data-enter>Siguiente tramo</button>');
    $('o-next').addEventListener('click', () => {
      if (!last) { enterArcadeStage(); return; }
      const extra = arcRun.continues * 2000;
      arcRun.score += extra;
      gameOver(true, extra);
    });
    return;
  }
  if (arcRun.continues <= 0) { gameOver(false, 0); return; }
  let n = ARCADE.countdown;
  card(`<span class="eyebrow">Tramo ${r.stage + 1} de ${r.total}</span><h3>Sin tiempo</h3>
    <p class="muted">¿Continuar? Repites este tramo con los puntos que traías (${arcRun.score.toLocaleString('es-ES')}). Te quedan <b>${arcRun.continues}</b> continuaciones.</p>
    <p class="cont-n" id="o-n">${n}</p>`,
    '<button class="btn" id="o-cont" data-enter>Continuar</button><button class="btn ghost" id="o-end">Terminar</button>');
  contTimer = setInterval(() => {
    n--;
    if ($('o-n')) $('o-n').textContent = n;
    if (n <= 0) { clearInterval(contTimer); gameOver(false, 0); } else audio.sfx('tick');
  }, 1000);
  $('o-cont').addEventListener('click', () => { clearInterval(contTimer); arcRun.continues--; arcRun.carry = 0; audio.sfx('coin'); enterArcadeStage(); });
  $('o-end').addEventListener('click', () => { clearInterval(contTimer); gameOver(false, 0); });
}

function gameOver(complete, extra) {
  const run = arcRun, score = run.score;
  const head = `<span class="eyebrow">${complete ? 'Recorrido completo' : 'Fin de la partida'}</span>
    <h3 class="time">${score.toLocaleString('es-ES')}</h3>
    <p class="muted">${complete ? `Has terminado los ${ARCADE_STAGES.length} tramos.${extra ? ` Bonus por continuaciones sin usar: +${extra}.` : ''}` : `Llegaste al tramo ${run.stage + 1} de ${ARCADE_STAGES.length}.`}</p>`;
  const finish = () => {
    card(head, '<button class="btn" id="o-again" data-enter>Jugar otra vez</button><button class="btn ghost" id="o-out">Salir</button>');
    $('o-again').addEventListener('click', () => { arcRun = { stage: 0, score: 0, carry: 0, continues: ARCADE.continues }; audio.sfx('coin'); enterArcadeStage(); });
    $('o-out').addEventListener('click', () => leaveArcade(true));
  };
  if (!qualifies(score)) { finish(); return; }
  card(`${head}<form id="o-form" class="initials"><label class="fld">Tus iniciales<input id="o-ini" maxlength="3" autocomplete="off" spellcheck="false" required></label>
    <button class="btn" type="submit">Guardar</button></form>`, '');
  const inp = $('o-ini');
  inp.value = store.get('pyb-ini', '');
  inp.focus(); inp.select();
  $('o-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (inp.value.toUpperCase().replace(/[^A-ZÑ0-9]/g, '') || '???').slice(0, 3);
    store.set('pyb-ini', name);
    const list = arcScores();
    list.push({ n: name, s: score, st: complete ? ARCADE_STAGES.length : run.stage, m: arcModel });
    list.sort((a, b) => b.s - a.s);
    store.set(ARC_KEY, list.slice(0, 10));
    audio.sfx('record');
    finish();
  });
}

// ---------- Campeonato ----------
function enterEvent() {
  const ev = career.event();
  if (!ev) return;
  if (arcRun) leaveArcade(false);
  const def = builtinByName(ev.track);
  inEvent = ev;
  setModeUI(ev.mode);
  showTab('play');
  $('p-event').hidden = false;
  $('p-event-k').textContent = `Campeonato · temporada ${ev.season} · prueba ${ev.idx + 1} de ${ev.total}`;
  $('p-event-t').textContent = `${ev.track} · ${ev.mode === 'rally' ? 'Rally' : 'Carrera'} · ${CONDITIONS[ev.cond].label}`;
  document.querySelector('.setup').classList.add('locked');
  drawCarUI();
  showIdle(game.setup({
    def, mode: ev.mode, cond: ev.cond, field: ev.mode === 'rally', event: ev,
    rivals: career.rivals(RIVALS),
    me: { model: career.carId, spec: career.spec(), dmg: career.car().dmg },
  }));
}
function leaveEvent(toChamp) {
  inEvent = null;
  $('p-event').hidden = true;
  document.querySelector('.setup').classList.remove('locked');
  setModeUI(mode);
  drawCarUI();
  if (toChamp) showTab('champ');
  loadSelected();
}
$('p-event-back').addEventListener('click', () => (arcRun ? leaveArcade(true) : leaveEvent(true)));

let resetArmed = false;
function chHint(msg) { $('c-hint').textContent = msg; }
function statBar(label, v) { return `<div class="stat">${label}<i style="--v:${Math.round(Math.max(0.05, Math.min(1, v)) * 100)}%"></i></div>`; }

function renderChamp() {
  $('c-money').textContent = '$' + career.money.toLocaleString('es-ES');
  $('c-season').textContent = career.season.n;
  const ev = career.event();
  $('c-round').textContent = ev ? `${ev.idx + 1}/${ev.total}` : 'Fin';
  $('c-titles').textContent = career.titles;

  // próxima prueba
  if (ev) {
    const d = builtinByName(ev.track);
    $('c-next').innerHTML = `<span class="eyebrow">Próxima prueba · ${ev.idx + 1} de ${ev.total}</span><h3>${esc(ev.track)}</h3>
      <div class="tags"><span class="tag">${ev.mode === 'rally' ? 'Rally contra el reloj' : 'Carrera a 4'}</span>
      <span class="tag">${d.type === 'tramo' ? 'Tramo' : d.laps + ' vueltas'}</span><span class="tag">${THEME[d.theme].label}</span>
      <span class="tag cond">${CONDITIONS[ev.cond].label}</span></div>
      <p class="muted">Corres con el ${CAR_MODELS[career.carId].label} con ${Math.round(career.car().dmg * 100)}% de daños.</p>
      <div class="row"><button class="btn" id="c-go">Correr la prueba</button></div>`;
    $('c-go').addEventListener('click', enterEvent);
  } else {
    const st = career.standings();
    $('c-next').innerHTML = `<span class="eyebrow">Temporada ${career.season.n} terminada</span>
      <h3>${st[0].name === 'Tú' ? '¡Eres campeón!' : esc(st[0].name) + ' es campeón'}</h3>
      <p class="muted">Quedas ${st.findIndex((x) => x.name === 'Tú') + 1}º con ${st.find((x) => x.name === 'Tú').pts} puntos. En la siguiente temporada los rivales llevan mejoras.</p>
      <div class="row"><button class="btn" id="c-nexts">Empezar la temporada ${career.season.n + 1}</button></div>`;
    $('c-nexts').addEventListener('click', () => { career.nextSeason(); renderChamp(); });
  }

  // calendario
  $('c-cal').innerHTML = SEASON.map((e, i) => {
    const res = career.season.results[i];
    const cls = res ? 'done' : ev && i === ev.idx ? 'now' : '';
    const right = res ? `<b>${res.pos}º · +${res.pts}</b>` : ev && i === ev.idx ? '<b>Siguiente</b>' : '';
    return `<li class="${cls}"><span>${esc(e.track)}<small>${e.mode === 'rally' ? 'Rally' : 'Carrera'} · ${CONDITIONS[e.cond].label}</small></span>${right}</li>`;
  }).join('');

  // clasificación
  $('c-stand').innerHTML = career.standings().map((s, i) => `<tr class="${s.name === 'Tú' ? 'me' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.pts} pts</td></tr>`).join('');

  // garaje
  $('c-models').innerHTML = Object.entries(CAR_MODELS).map(([id, M]) => {
    const own = career.owned(id), sel = career.carId === id, sp = carSpec(id);
    return `<button type="button" class="model" data-model="${id}" aria-pressed="${sel}">
      <canvas aria-hidden="true"></canvas><b>${M.label}</b>
      ${statBar('Punta', (sp.max - 0.8) / 0.35)}${statBar('Agarre', (sp.grip - 0.75) / 0.4)}${statBar('Fuera pista', (sp.off - 0.7) / 0.9)}${statBar('Resistencia', (sp.armor - 0.7) / 0.9)}
      <span class="price">${sel ? 'En uso' : own ? 'Tuyo · usar' : '$' + M.price.toLocaleString('es-ES')}</span></button>`;
  }).join('');
  $('c-models').querySelectorAll('.model').forEach((b) => {
    const id = b.dataset.model;
    drawCarPreview(b.querySelector('canvas'), playerLivery(), '1', id);
    b.addEventListener('click', () => {
      if (career.owned(id)) { career.selectCar(id); chHint(`Ahora corres con el ${CAR_MODELS[id].label}. ${CAR_MODELS[id].desc}`); }
      else if (career.buyCar(id)) { chHint(`Has comprado el ${CAR_MODELS[id].label}. ${CAR_MODELS[id].desc}`); audio.sfx('pickup'); }
      else chHint(`Te faltan $${(CAR_MODELS[id].price - career.money).toLocaleString('es-ES')} para el ${CAR_MODELS[id].label}. ${CAR_MODELS[id].desc}`);
      renderChamp();
    });
  });

  // mejoras
  $('c-upcar').textContent = CAR_MODELS[career.carId].label;
  $('c-ups').innerHTML = Object.entries(UPGRADES).map(([k, U]) => {
    const lvl = career.level(k), price = career.upPrice(k);
    const pips = [0, 1, 2, 3].map((i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="up"><b>${U.label}</b><div class="pips" aria-label="Nivel ${lvl} de 4">${pips}</div><small>${U.desc}</small>
      <button type="button" class="sbtn" data-up="${k}" ${price == null || price > career.money ? 'disabled' : ''}>${price == null ? 'Al máximo' : '$' + price.toLocaleString('es-ES')}</button></div>`;
  }).join('');
  $('c-ups').querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
    if (career.buyUp(b.dataset.up)) { audio.sfx('pickup'); chHint(`${UPGRADES[b.dataset.up].label} mejorado al nivel ${career.level(b.dataset.up)}.`); renderChamp(); }
  }));

  // taller
  const dmg = Math.round(career.car().dmg * 100), cost = career.repairCost();
  $('c-dmgfill').style.width = dmg + '%';
  $('c-dmgtxt').textContent = dmg ? `Daños: ${dmg}%. Repararlo entero cuesta $${cost.toLocaleString('es-ES')} ($${REPAIR_PER_PCT} por punto).` : 'El coche está como nuevo.';
  $('c-repair').disabled = !dmg || career.money < REPAIR_PER_PCT;
  $('c-repair').textContent = dmg && career.money < cost ? `Reparar lo que alcance` : 'Reparar';
}
$('c-repair').addEventListener('click', () => {
  const n = career.repair();
  if (n) { audio.sfx('pickup'); chHint(`Reparados ${n} puntos de daños.`); }
  renderChamp();
});
$('c-reset').addEventListener('click', () => {
  if (!resetArmed) { resetArmed = true; $('c-reset').textContent = 'Pulsa otra vez para borrar todo el progreso'; setTimeout(() => { resetArmed = false; $('c-reset').textContent = 'Borrar el campeonato y empezar de cero'; }, 4000); return; }
  resetArmed = false; career.resetAll(); $('c-reset').textContent = 'Borrar el campeonato y empezar de cero';
  chHint('Campeonato borrado. Empiezas con $1.200 y el Compacto.'); renderChamp();
});

// ---------- Teclado y táctil ----------
const KMAP = { ArrowUp: 't', KeyW: 't', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', Space: 'hb', ShiftLeft: 'n', ShiftRight: 'n', KeyN: 'n' };
const typing = (e) => /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
window.addEventListener('keydown', (e) => {
  if ($('pane-play').hidden || typing(e)) return;
  if (e.code === 'Enter' && !ovl.hidden) {
    const b = ovl.querySelector('[data-enter]');
    if (b) { e.preventDefault(); b.click(); return; }
  }
  if (e.code === 'KeyF') { toggleFull(); return; }
  if (e.code === 'Escape' && isFull() && !document.fullscreenElement && !document.webkitFullscreenElement) { exitFull(); return; }
  if (e.code === 'KeyM') { audio.unlock(); audio.setMuted(!audio.muted); store.set('pyb-mute', audio.muted); syncSoundUI(); return; }
  const k = KMAP[e.code]; if (!k) return;
  e.preventDefault(); game.keys[k] = 1;
});
window.addEventListener('keyup', (e) => { const k = KMAP[e.code]; if (k) game.keys[k] = 0; });
window.addEventListener('blur', () => { for (const k in game.keys) game.keys[k] = 0; });
document.querySelectorAll('.pad').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); game.keys[k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { game.keys[k] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, off));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---------- Decoración ----------
const carSel = $('p-car');
Object.entries(LIVERIES).forEach(([id, L]) => carSel.add(new Option(L.label, id)));
carSel.value = carId;
function setCar(id) {
  carId = LIVERIES[id] ? id : 'paleta';
  carSel.value = carId;
  store.set('pyb-car', carId);
  drawCarUI();
  if (!$('pane-champ').hidden) renderChamp();
}
carSel.addEventListener('change', () => setCar(carSel.value));
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
  const m = arcRun ? arcModel : inEvent ? career.carId : quickModel;
  drawCarPreview($('p-car-prev'), playerLivery(), '1', m);
  garage.querySelectorAll('.gcar').forEach((b) => {
    const L = LIVERIES[b.dataset.car];
    b.setAttribute('aria-pressed', b.dataset.car === carId);
    drawCarPreview(b.querySelector('canvas'), { ...L, base: L.base || carColor }, '1', m);
  });
}

// ---------- Editor ----------
const editor = createEditor($('ecv'), {
  tracks: trackList,
  visible: () => !$('pane-edit').hidden,
  test(def) {
    if (inEvent) leaveEvent(false);
    if (arcRun) leaveArcade(false);
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

// ---------- Pantalla completa ----------
// Usa la API nativa si existe; si no (Safari en iPhone) o la rechaza, el juego ocupa toda la ventana.
const gameEl = document.querySelector('.game');
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const isFull = () => gameEl.classList.contains('full');
function syncFs() {
  const on = isFull();
  $('fs').setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
  $('fs').title = on ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)';
  document.documentElement.classList.toggle('noscroll', on);
  requestAnimationFrame(() => game.resize());
}
async function enterFull() {
  audio.unlock();
  gameEl.classList.add('full');
  syncFs();
  try {
    if (gameEl.requestFullscreen) await gameEl.requestFullscreen({ navigationUI: 'hide' });
    else if (gameEl.webkitRequestFullscreen) gameEl.webkitRequestFullscreen();
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch (_) { /* sin API nativa: se queda a ventana completa */ }
}
function exitFull() {
  if (fsElement()) {
    try { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  }
  gameEl.classList.remove('full');
  syncFs();
}
function toggleFull() { if (isFull()) exitFull(); else enterFull(); }
$('fs').addEventListener('click', (e) => { e.currentTarget.blur(); toggleFull(); });
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  if (!fsElement() && isFull()) { gameEl.classList.remove('full'); syncFs(); }
}));

// ---------- Pestañas ----------
function showTab(t) {
  if (t !== 'play' && isFull()) exitFull();
  for (const p of ['play', 'arcade', 'champ', 'edit']) {
    $('pane-' + p).hidden = t !== p;
    $('t-' + p).setAttribute('aria-selected', t === p);
  }
  for (const k in game.keys) game.keys[k] = 0;
  if (t === 'champ') renderChamp();
  if (t === 'arcade') renderArcade();
  requestAnimationFrame(() => { game.resize(); editor.resize(); editor.refresh(); });
}
$('t-play').addEventListener('click', () => showTab('play'));
$('t-arcade').addEventListener('click', () => showTab('arcade'));
$('t-champ').addEventListener('click', () => showTab('champ'));
$('t-edit').addEventListener('click', () => showTab('edit'));

// ---------- HUD ----------
let hudKey = '';
function updateHud() {
  const h = game.hud();
  if (!h) return;
  const nit = '◆'.repeat(h.nitro) + '◇'.repeat(Math.max(0, h.nitroCap - h.nitro));
  const k = [h.aL, h.a, h.bL, h.b, h.time, h.speed, nit, h.dmg].join('|');
  if (k === hudKey) return;
  hudKey = k;
  $('h-al').textContent = h.aL; $('h-a').textContent = h.a;
  $('h-bl').textContent = h.bL; $('h-b').textContent = h.b;
  $('h-time').textContent = h.time; $('h-speed').textContent = h.speed; $('h-nitro').textContent = nit;
  $('h-dmg').textContent = h.dmg + '%';
}

// ---------- Tabla de superficies ----------
(function surfTable() {
  const base = SURF.asfalto;
  const rows = [
    [SURF.asfalto, 'Tramo del trazado', SURF.asfalto.col],
    [SURF.tierra, 'Tramo del trazado', SURF.tierra.col],
    [SURF.nieve, 'Tramo del trazado', SURF.nieve.col],
    [SURF.barro, 'Mancha que se coloca', SURF.barro.col],
    [SURF.agua, 'Charco que se coloca', SURF.agua.col],
    [THEME.pradera.off, 'Fuera de pista en pradera', THEME.pradera.ground],
    [THEME.desierto.off, 'Fuera de pista en desierto', THEME.desierto.ground],
    [THEME.nieve.off, 'Fuera de pista en montaña', THEME.nieve.ground],
  ];
  $('surf-body').innerHTML = rows.map(([s, where, col]) => {
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
  const playing = !$('pane-play').hidden;
  if (playing) {
    acc += dt;
    while (acc >= DT) { game.tick(DT); acc -= DT; }
    game.render(now);
    updateHud();
    audio.update(game.audioState());
  } else { acc = 0; audio.update(null); }
  // música en menús: fuera de la pista o con la tarjeta de inicio/resultados a la vista
  audio.playMusic(!playing || (!ovl.hidden && (game.state === 'idle' || game.state === 'done')));
  if (!$('pane-edit').hidden) editor.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Acceso desde la consola del navegador para depurar
window.__pyb = { game, editor, audio, career, toggleFull, enterEvent };
