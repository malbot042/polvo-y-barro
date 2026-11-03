// Simulación, IA y render de la carrera en isométrico, con la cámara siguiendo al coche.
// Modelos con características, daños, lluvia, noche, puentes a dos niveles, tiempos
// simulados de los rivales en los rallies del campeonato y el modo recreativa
// (cuenta atrás, controles que dan tiempo y puntos por derrapar).
import { WW, WH, SP, M_PER_PX, ISO_C, clamp, wrapA, store, fmtTime, isoView } from './util.js';
import { SURF, PHYS, VERGE, CONDITIONS, ARCADE, CRT, NIGHT, DEFAULT_CAR, carSpec, torque } from './config.js';
import { buildTrack, nearestGlobal, idxAdd, trackKey } from './track.js';
import { drawCarIso, drawCarShadowIso, carFront, carWheels, carLivery, GHOST_LIVERY } from './car.js';
import { drawDecorIso, decorTop, hasBillboard, drawConeIso, drawLampIso, LAMP_H, drawArchIso, bridgePieces, drawBridgePiece } from './iso.js';

export const RIVALS = [
  { name: 'Lobo', livery: carLivery('lancia-delta-integrale'), skill: 0.95, num: '2', model: 'lancia-delta-integrale' },
  { name: 'Niebla', livery: carLivery('mitsubishi-lancer-evolution'), skill: 0.93, num: '3', model: 'mitsubishi-lancer-evolution' },
  { name: 'Rayo', livery: carLivery('toyota-celica-gt-four'), skill: 0.9, num: '4', model: 'toyota-celica-gt-four' },
];
const BEST_KEY = 'pyb-best-v1';
const NO_INPUT = { t: 0, b: 0, s: 0, hb: 0 };
const OFF_LIKE = { off: 1, verge: 1, barro: 1, agua: 1, nieve: 1 };

// Flecha de nota de copiloto: más curvada cuanto más cerrada es la curva
function drawArrow(c, x, y, s, dir, grade) {
  const deg = { H: 170, 1: 130, 2: 108, 3: 88, 4: 68, 5: 48, 6: 30 }[grade] || 60;
  const ang = (deg * Math.PI) / 180, r = s * 0.3;
  c.save(); c.translate(x, y);
  c.lineWidth = s * 0.15; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, s * 0.45); c.lineTo(0, 0);
  const cx = dir * r;
  let ex = 0, ey = 0;
  for (let k = 1; k <= 14; k++) {
    const ph = dir > 0 ? Math.PI + (ang * k) / 14 : -(ang * k) / 14;
    ex = cx + r * Math.cos(ph); ey = r * Math.sin(ph); c.lineTo(ex, ey);
  }
  c.stroke();
  const ph = dir > 0 ? Math.PI + ang : -ang;
  const tx = dir > 0 ? -Math.sin(ph) : Math.sin(ph), ty = dir > 0 ? Math.cos(ph) : -Math.cos(ph);
  const hs = s * 0.24;
  c.beginPath();
  c.moveTo(ex + tx * hs, ey + ty * hs);
  c.lineTo(ex - ty * hs * 0.75 - tx * hs * 0.15, ey + tx * hs * 0.75 - ty * hs * 0.15);
  c.lineTo(ex + ty * hs * 0.75 - tx * hs * 0.15, ey - tx * hs * 0.75 - ty * hs * 0.15);
  c.closePath(); c.fill();
  c.restore();
}

export function createGame(cv, hooks) {
  const ctx = cv.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const layers = { g: mk(WW, WH), t: mk(1, 1) };   // en isométrico no hace falta la capa de copas
  const light = document.createElement('canvas'), lctx = light.getContext('2d');
  let T = null, def = null, key = '', mode = 'rally', state = 'idle';
  let cfg = { cond: 'seco', me: { model: DEFAULT_CAR }, rivals: null, field: false, event: null };
  let COND = CONDITIONS.seco;
  let cd = 0, raceT = 0, doneT = 0, shown = false, finCount = 0;
  let cars = [], parts = [], skids = [], cones = [], ghost = null, rec = [], recT = 0, flash = null;
  let fieldTimes = [], lamps = [], drops = [], splashes = [], thunderT = 8, lightning = 0, emitZ = 0, sim = false;
  let pieces = [], isoB = null;
  // recreativa: tiempo por control (allow), tiempo restante, puntos y combo de derrape
  let arc = null;
  const ghostCv = document.createElement('canvas'), gctx = ghostCv.getContext('2d');
  // efecto de monitor: patrón de barras y viñeta, rehechos solo al cambiar de tamaño o de densidad de píxeles
  let crtOn = true, crtPat = null, crtKey = '';
  const vig = document.createElement('canvas');
  const cam = { x: WW / 2, y: WH / 2 };
  let dpr = 1;
  const keys = { t: 0, b: 0, l: 0, r: 0, hb: 0 };
  let lastCount = 0, lastCall = -1, lastChain = -1;

  const player = () => cars.find((c) => c.me);
  const sfx = (name, d) => { if (!sim && hooks.sfx) hooks.sfx(name, d || {}); };
  function shiftTo(c, g) {
    if (g < 1 || g > PHYS.gears.length || g === c.gear) return;
    const up = g > c.gear;
    c.gear = g; c.shiftT = up ? PHYS.shiftT : PHYS.shiftT * 0.6;
    if (c.me) sfx('gear', { up, gear: g, turbo: c.spec.era !== 'clasico' });
  }
  function atten(c) {
    if (c.me) return 1;
    const me = player();
    return me ? clamp(1 - Math.hypot(c.x - me.x, c.y - me.y) / 520, 0, 1) * 0.7 : 0;
  }
  const carZ = (c) => (c.lv ? T.S[c.idx].z || 0 : 0);
  const progress = (c) => (T.loop ? (c.idx - T.start + T.n) % T.n : c.idx);
  function score(c) {
    if (c.finished) return 1e9 - c.order;
    if (T.loop) { const p = c.cpNext === 0 && c.p > T.n / 2 ? c.p - T.n : c.p; return c.lap * T.n + p; }
    return c.p;
  }
  const ranking = () => [...cars].sort((a, b) => score(b) - score(a));
  const bestKey = () => key + '|' + (cfg.me.model || DEFAULT_CAR);
  const bestFor = () => (store.get(BEST_KEY, {}) || {})[bestKey()] || null;
  function saveBest(r) {
    const all = store.get(BEST_KEY, {}) || {};
    all[bestKey()] = r;
    if (!store.set(BEST_KEY, all)) { all[bestKey()] = { t: r.t, splits: r.splits }; store.set(BEST_KEY, all); }
  }
  const myLivery = () => hooks.livery(cfg.me.model);

  function info() {
    if (!T) return null;
    const surfs = [...new Set(T.S.map((s) => s.s))].map((s) => SURF[s].label.toLowerCase());
    const b = bestFor();
    return {
      name: def.name, loop: T.loop, laps: T.laps, lengthM: T.L * M_PER_PX, surfaces: surfs, best: b ? b.t : null, mode,
      cond: cfg.cond, condLabel: COND.label, bridges: T.bridges.length, event: cfg.event,
      field: fieldTimes.length ? fieldTimes.map((f) => ({ name: f.name, time: f.time })) : null,
      arcade: arc ? { stage: arc.stage, total: arc.total, start: arc.allow[0] + arc.carry, score: arc.base } : null,
    };
  }

  function makeCar(d, idx, lane) {
    const s = T.S[idx], spec = d.spec || carSpec(d.model || DEFAULT_CAR);
    return {
      ...d, spec, model: spec.model, x: s.x + s.nx * lane * s.w, y: s.y + s.ny * lane * s.w, a: s.h, vx: 0, vy: 0, fs: 0, ls: 0,
      idx, nd: 0, lv: 0, p: 0, lap: 0, cpNext: 0, splits: [], finished: false, ft: 0, order: 0,
      gear: 1, rpm: 0, shiftT: 0, odo: 0, air: 0, airMax: 0, airH: 0, h: 0, steer: 0, brk: 0, sk: 'tierra',
      dirt: { barro: 0, polvo: 0, nieve: 0 }, dmg: d.dmg || 0, pull: 0,
      lane, laneT: 1 + Math.random(), stuck: 0, rev: 0, rl: null, rr: null, thr: 0, hb: 0,
    };
  }

  function rivalsList() { return cfg.rivals || RIVALS; }

  function reset() {
    parts = []; skids = []; raceT = 0; doneT = 0; shown = false; finCount = 0; flash = null; rec = []; recT = 0; state = 'idle';
    lastCount = 0; lastCall = -1; lastChain = -1; splashes = []; lightning = 0; thunderT = 6 + Math.random() * 10;
    if (!T) { cars = []; return; }
    cones = T.cones.map((c) => ({ x: c.x, y: c.y, vx: 0, vy: 0, a: 0, va: 0 }));
    const me = { name: 'Tú', me: true, skill: 1, num: '1', model: cfg.me.model, spec: cfg.me.spec, dmg: cfg.me.dmg || 0 };
    const R = rivalsList();
    const solo = mode !== 'carrera';
    const list = solo ? [me] : [R[0], R[1], me, R[2]];
    const rows = solo ? [[5, 0]] : [[5, -0.22], [5, 0.22], [11, -0.22], [11, 0.22]];
    cars = list.map((d, i) => {
      const [back, lane] = rows[i];
      const idx = T.loop ? (T.start - back + T.n) % T.n : Math.max(0, T.start - back);
      return makeCar(d, idx, lane);
    });
    cars.forEach((c) => (c.p = progress(c)));
    const b = bestFor();
    ghost = mode === 'rally' && b && b.ghost ? b.ghost : null;
    if (arc) Object.assign(arc, { left: arc.allow[0] + arc.carry, score: arc.base, combo: 0, comboT: 0, driftT: 0, gates: 0, tick: 99, bonus: 0, pop: null });
    const p = player(); cam.x = p.x; cam.y = p.y;
    // farolas: salida, meta y controles
    lamps = [];
    const lampAt = (s) => { for (const side of [1, -1]) { const o = side * (s.w / 2 + 12); lamps.push([s.x + s.nx * o, s.y + s.ny * o]); } };
    lampAt(T.S[T.start]); if (!T.loop) lampAt(T.S[T.finish]);
    T.cps.forEach((c) => lampAt(T.S[T.loop ? (T.start + c) % T.n : c]));
  }

  function emit(x, y, col, vx, vy, size, life, grow = 1) {
    if (sim || parts.length > 440) return;
    parts.push({ x, y, vx, vy, col, size, life, max: life, grow, z: emitZ });
  }

  function nearLocal(c) {
    const S = T.S, n = T.n;
    let bi = c.idx, bd = Infinity;
    for (let k = -18; k <= 18; k++) {
      let j = c.idx + k;
      if (T.loop) j = (j + n) % n; else if (j < 0 || j >= n) continue;
      const dx = S[j].x - c.x, dy = S[j].y - c.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = j; }
    }
    let d = Math.sqrt(bd);
    if (d > S[bi].w * 0.9) {
      const g = nearestGlobal(T, c.x, c.y);
      if (g.i >= 0 && g.d < d - 6) { bi = g.i; d = g.d; }
    }
    c.idx = bi; c.nd = d;
    c.lv = S[bi].lv && d <= S[bi].w / 2 + 14 ? 1 : 0;
  }

  function ai(c, dt) {
    const S = T.S, sp = Math.hypot(c.vx, c.vy);
    c.laneT -= dt;
    if (c.laneT <= 0) { c.laneT = 1.3 + Math.random() * 2.2; c.lane = (Math.random() * 2 - 1) * 0.2; }
    const t = S[idxAdd(T, c.idx, 5 + Math.floor(sp / 32))];
    let off = c.lane * t.w;
    if (!t.lv) {
      for (const o of T.solids) {
        const px = t.x + t.nx * off, py = t.y + t.ny * off, dx = o.x - px, dy = o.y - py;
        if (dx * dx + dy * dy < (o.r + 20) ** 2) {
          const side = (o.x - t.x) * t.nx + (o.y - t.y) * t.ny;
          off = side > off ? side - o.r - 20 : side + o.r + 20;
          off = clamp(off, -t.w / 2, t.w / 2);
          break;
        }
      }
    }
    const da = wrapA(Math.atan2(t.y + t.ny * off - c.y, t.x + t.nx * off - c.x) - c.a);
    let mx = 0;
    const span = 6 + Math.floor(sp / 11);
    for (let k = 2; k < span; k += 2) mx = Math.max(mx, Math.abs(S[idxAdd(T, c.idx, k)].hd));
    const sk = S[idxAdd(T, c.idx, 8)].s, sf = SURF[sk];
    const g = sf.grip * c.spec.grip * (sk === 'asfalto' || sk === 'tierra' ? COND.grip : 1);
    const tgt = PHYS.max * c.skill * sf.max * c.spec.max * (1 - c.dmg * 0.25) * clamp(1 - mx / 150, 0.33, 1) * (0.55 + 0.45 * Math.min(1, g / 7)) * (COND.night ? 0.95 : 1);
    if (state === 'race' && sp < 12) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
    if (c.stuck > 1.2) { c.rev = 0.9; c.stuck = 0; }
    if (c.rev > 0) { c.rev -= dt; return { t: 0, b: 1, s: -clamp(da * 2, -1, 1), hb: 0 }; }
    return {
      t: sp < tgt ? 1 : 0,
      b: sp > tgt + 25 ? 1 : 0,
      s: clamp(da * 2.6, -1, 1),
      hb: mx > 85 && sp > 140 ? 1 : 0,
    };
  }

  function split(c, isLap) {
    c.splits.push(raceT);
    if (!c.me || sim) return;
    if (arc) {
      const k = c.splits.length, add = arc.allow[k];
      arc.gates++;
      if (add != null) {
        arc.left += add; arc.score += ARCADE.gatePts;
        flash = { txt: `+${add.toFixed(1)} s`, col: '#ffd23f', t: 1.8 };
        sfx('extend');
      }
      if (isLap && T.loop && c.lap < T.laps) sfx('lap', { last: c.lap === T.laps - 1 });
    } else if (mode === 'rally') {
      const k = c.splits.length - 1;
      const ending = T.loop ? c.lap >= T.laps : isLap;
      // en campeonato se compara con el mejor rival; en rally libre, con tu récord
      const ref = cfg.field && fieldTimes.length ? fieldTimes[0].splits : (bestFor() || {}).splits;
      if (ref && ref[k] != null) {
        const d = raceT - ref[k];
        flash = { txt: (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2), col: d < 0 ? '#4cd07d' : '#ff5a5a', t: 2.2 };
        if (!ending) sfx('split', { good: d < 0 });
      } else { flash = { txt: fmtTime(raceT), col: '#ffffff', t: 2 }; if (!ending) sfx('split', { good: null }); }
    } else if (isLap && T.loop && c.lap < T.laps) {
      flash = { txt: c.lap === T.laps - 1 ? 'ÚLTIMA VUELTA' : `VUELTA ${c.lap + 1}`, col: '#ffffff', t: 2 };
      sfx('lap', { last: c.lap === T.laps - 1 });
    }
  }
  function finish(c) {
    if (c.finished) return;
    c.finished = true; c.ft = raceT; c.order = ++finCount;
    if (!c.me) return;
    sfx('finish');
    if (arc && !sim) { bankCombo(); arc.bonus = Math.round(arc.left * ARCADE.secPts); arc.score += arc.bonus; }
  }

  // Recreativa: los derrapes largos sobre la pista suman puntos; chocar o salirse los pierde
  function bankCombo() {
    if (!arc || arc.combo < 1) return;
    const pts = Math.round(arc.combo / 10) * 10;
    if (pts > 0) { arc.score += pts; arc.pop = { txt: `+${pts}`, t: 1.2 }; if (pts >= 300) sfx('combo'); }
    arc.combo = 0; arc.driftT = 0;
  }
  function arcadeStep(me, dt) {
    if (me.finished || me.timeUp) return;
    arc.left -= dt;
    const n = Math.ceil(arc.left);
    if (arc.left < 5.5 && n !== arc.tick && n > 0) { arc.tick = n; sfx('tick'); }
    if (arc.left <= 0) {
      arc.left = 0; me.timeUp = true; arc.combo = 0;
      flash = { txt: 'SIN TIEMPO', col: '#ff5a5a', t: 3 };
      sfx('timeup');
      return;
    }
    const sp = Math.hypot(me.vx, me.vy), slide = Math.abs(me.ls || 0);
    const onRoad = me.sk !== 'off' && me.sk !== 'verge';
    if (me.air <= 0 && sp > ARCADE.driftSpeed && slide > ARCADE.driftSlide && onRoad) {
      arc.driftT += dt;
      const mult = Math.min(ARCADE.maxMult, 1 + Math.floor(arc.driftT / ARCADE.multEvery));
      arc.combo += slide * dt * ARCADE.driftPts * mult;
      arc.mult = mult; arc.comboT = 0.45;
    } else if (arc.combo > 0) {
      if (!onRoad) { arc.combo = 0; arc.driftT = 0; }
      else if ((arc.comboT -= dt) <= 0) bankCombo();
    }
  }

  function hurt(c, amount) {
    if (amount <= 0) return;
    c.dmg = Math.min(1, c.dmg + amount / c.spec.armor);
    if (c.dmg > 0.15 && !c.pull) c.pull = Math.random() < 0.5 ? -1 : 1;
  }

  function updateCar(c, dt) {
    const S = T.S;
    let inp = NO_INPUT;
    if (c.timeUp) inp = NO_INPUT;
    else if (state === 'race') inp = c.me && !c.finished ? { t: keys.t, b: keys.b, s: keys.r - keys.l, hb: keys.hb } : ai(c, dt);
    else if (state === 'done') inp = ai(c, dt);

    nearLocal(c);
    emitZ = carZ(c) + 1;
    const s = S[c.idx];
    let sf, sk;
    if (c.nd <= s.w / 2) { sf = SURF[s.s]; sk = s.s; }
    else if (c.nd <= s.w / 2 + 9) { sf = VERGE; sk = 'verge'; }
    else { sf = T.theme.off; sk = 'off'; }
    if (!c.lv) {
      for (const p of T.patches) {
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy < (p.r * 0.85) ** 2) { sf = SURF[p.k]; sk = p.k; }
      }
    }
    const sp0 = Math.hypot(c.vx, c.vy);
    if (sk !== c.sk && (sk === 'agua' || sk === 'barro') && sp0 > 50 && c.air <= 0) sfx(sk === 'agua' ? 'splash' : 'mud', { vol: atten(c) * Math.min(1, sp0 / 250) });
    c.sk = sk;
    c.thr = inp.t; c.hb = inp.hb;
    if (c.air <= 0 && sp0 > 40) {
      const rate = { barro: 0.14, agua: 0.06, off: 0.035, verge: 0.025, tierra: COND.rain ? 0.04 : 0.014, nieve: 0.02 }[sk] || 0;
      if (rate) {
        const snowy = sk === 'nieve' || ((sk === 'off' || sk === 'verge') && T.def.theme === 'nieve');
        const kind = sk === 'barro' || sk === 'agua' || (COND.rain && sk !== 'nieve') ? 'barro' : snowy ? 'nieve' : 'polvo';
        c.dirt[kind] = Math.min(1, c.dirt[kind] + rate * dt * (sp0 / PHYS.max) * 1.5);
      }
    }

    c.brk = inp.b;
    const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
    const spec = c.spec;

    if (c.air > 0) {
      c.air -= dt;
      c.h = Math.max(0, Math.sin(Math.PI * (1 - c.air / c.airMax))) * c.airH;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.air <= 0) {
        c.h = 0;
        sfx('land', { vol: atten(c) * Math.min(1, c.airH / 30) });
        if (c.airH > 24) hurt(c, ((c.airH - 24) / 420) * spec.land);
        const dust = sk === 'off' || sk === 'verge' ? T.theme.off.dust : sf.dust;
        for (let k = 0; k < 10; k++) emit(c.x, c.y, dust, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 3.5, 0.6, 1.4);
      }
    } else {
      let fs = c.vx * fx + c.vy * fy, ls = c.vx * rx + c.vy * ry;
      // superficie corregida por el coche: los coches de tierra pierden menos fuera de pista; la lluvia quita agarre
      let maxS = sf.max, accS = sf.acc, gripS = sf.grip;
      if (OFF_LIKE[sk]) { maxS = 1 - (1 - maxS) / spec.off; accS = 1 - (1 - accS) / spec.off; gripS *= Math.sqrt(spec.off); }
      if (sk === 'asfalto' || sk === 'tierra' || sk === 'verge') { gripS *= COND.grip; accS *= COND.acc; maxS *= COND.max; }
      // caja de cinco marchas automática para todos.
      // Las vueltas salen de la velocidad y la marcha; el empuje, de la curva de par.
      const top = PHYS.max * c.skill * spec.max, G = PHYS.gears;
      if (c.shiftT > 0) c.shiftT -= dt;
      else {
        if (c.gear < G.length && fs > G[c.gear - 1] * top * PHYS.autoUp && inp.t) shiftTo(c, c.gear + 1);
        else if (c.gear > 1 && fs < G[c.gear - 2] * top * PHYS.autoDown) shiftTo(c, c.gear - 1);
      }
      const gTop = G[c.gear - 1] * top;
      c.rpm = clamp(Math.abs(fs) / gTop, 0, 1.05);
      // en primera el embrague patina y deja salir con el motor alto
      const tq = torque(Math.max(c.rpm, c.gear === 1 ? 0.5 : 0)) * PHYS.gearAcc[c.gear - 1];
      const acc = PHYS.acc * accS * spec.acc * tq;
      if (inp.t && c.shiftT <= 0) fs += acc * dt;
      if (fs > 0) fs -= PHYS.acc * PHYS.drag * (fs / top) ** 2 * dt;   // aire: los últimos km/h cuestan
      if (inp.b) fs -= (fs > 5 ? PHYS.brake * (COND.rain ? 0.85 : 1) : PHYS.reverse) * dt;
      if (!inp.t && !inp.b) fs *= 1 - 0.7 * dt;
      let rb = 1;
      const me = player();
      if (!c.me && me && mode === 'carrera') { const gap = score(c) - score(me); rb = gap > T.n * 0.2 ? 0.9 : gap < -T.n * 0.2 ? 1.07 : 1; }
      // punta según terreno, condiciones y daños; en las marchas cortas manda el corte de inyección
      let max = PHYS.max * c.skill * rb * maxS * spec.max * (1 - c.dmg * 0.25);
      if (c.gear < G.length) max = Math.min(max, gTop);
      if (fs > max) fs = Math.max(max, fs - 520 * dt);
      if (fs < -PHYS.revMax) fs = -PHYS.revMax;
      let grip = gripS * spec.grip;
      // derrape arcade: con gas y volante a fondo la trasera se suelta; al contravolantear vuelve a agarrar
      const vk = clamp((fs - PHYS.max * 0.35) / (PHYS.max * 0.4), 0, 1);
      if (inp.t) grip *= 1 - PHYS.drift * Math.abs(c.steer) * vk;
      if (inp.hb) { grip *= 0.32; fs *= 1 - 1.1 * dt; }
      if (c.steer * ls > 0 && Math.abs(ls) > 25) grip *= PHYS.counter;
      ls *= Math.exp(-grip * dt);
      const steerIn = clamp(inp.s + (c.me ? c.pull * c.dmg * 0.22 : 0), -1, 1);
      c.steer += (steerIn - c.steer) * Math.min(1, dt * 14);
      const rate = PHYS.steer * clamp(fs / 80, -1, 1) * (1 - Math.min(0.32, (Math.abs(fs) / PHYS.max) * 0.32)) * (inp.hb ? 1.35 : 1)
        * (1 + Math.min(PHYS.yaw, Math.abs(ls) / 400));
      c.a += c.steer * rate * dt;
      c.vx = fx * fs + rx * ls; c.vy = fy * fs + ry * ls;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.fs = fs; c.ls = ls;
      c.odo += Math.abs(fs) * dt * M_PER_PX;
      if (!c.lv) {
        for (const r of T.ramps) {
          const ca = Math.cos(r.a), sa = Math.sin(r.a), dx = c.x - r.x, dy = c.y - r.y;
          const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          if (Math.abs(u) < 8 && Math.abs(v) < r.w / 2 + 6) {
            // cuanto más rápido se llega a la cresta, más vuela (menos que con una rampa)
            const along = Math.abs(c.vx * ca + c.vy * sa);
            if (along > 120) { const k = Math.min(1, (along - 120) / (PHYS.max - 120)); c.airMax = 0.2 + 0.4 * k; c.air = c.airMax; c.airH = 5 + 20 * k; }
          }
        }
      }
    }

    // límites del mundo
    if (c.x < 10) { c.x = 10; c.vx = Math.abs(c.vx) * 0.3; }
    if (c.x > WW - 10) { c.x = WW - 10; c.vx = -Math.abs(c.vx) * 0.3; }
    if (c.y < 10) { c.y = 10; c.vy = Math.abs(c.vy) * 0.3; }
    if (c.y > WH - 10) { c.y = WH - 10; c.vy = -Math.abs(c.vy) * 0.3; }

    // obstáculos fijos (se saltan por encima en el aire o desde el puente)
    if (c.h < 10 && !c.lv) {
      for (const o of T.solids) {
        const dx = c.x - o.x, dy = c.y - o.y, rr = o.r + spec.r;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        if (d < rr) {
          const nx = dx / d, ny = dy / d;
          c.x = o.x + nx * rr; c.y = o.y + ny * rr;
          const vn = c.vx * nx + c.vy * ny;
          if (vn < 0) {
            if (vn < -50) sfx('hit', { vol: atten(c) * Math.min(1, -vn / 260) });
            if (vn < -70) { hurt(c, (-vn - 70) / 2200); if (c.me && arc) arc.combo = 0; }
            c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; c.vx *= 0.6; c.vy *= 0.6;
            if (vn < -60) for (let k = 0; k < 6; k++) emit(c.x - nx * 9, c.y - ny * 9, '#e8e2d0', (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 2, 0.4, 0.5);
          }
        }
      }
    }

    // efectos: marcas, polvo, agua, humo de daños
    const sp = Math.hypot(c.vx, c.vy);
    const sliding = c.air <= 0 && sp > 40 && (Math.abs(c.ls) > 38 || (inp.hb && sp > 60) || (inp.b && c.fs > 90));
    const { ax, wy } = carWheels(c.model);
    const rlx = c.x - fx * ax + rx * wy, rly = c.y - fy * ax + ry * wy, rrx = c.x - fx * ax - rx * wy, rry = c.y - fy * ax - ry * wy;
    const soft = sk === 'barro' || sk === 'nieve' || sk === 'off' || sk === 'verge';
    if (!sim && c.air <= 0 && !c.lv && (sliding || (soft && sp > 25)) && c.rl) {
      const col = sk === 'off' || sk === 'verge' ? T.theme.off.skid : (SURF[sk] || SURF.tierra).skid;
      skids.push([c.rl[0], c.rl[1], rlx, rly, col], [c.rr[0], c.rr[1], rrx, rry, col]);
      if (skids.length > 2400) skids.splice(0, 2);
    }
    if (c.air > 0) { c.rl = null; c.rr = null; } else { c.rl = [rlx, rly]; c.rr = [rrx, rry]; }
    if (!sim && c.air <= 0 && sp > 30) {
      const wet = COND.rain && (sk === 'asfalto' || sk === 'tierra');
      const rate = sk === 'asfalto' ? (sliding ? 0.6 : 0) + (wet ? 0.55 : 0) : (sk === 'agua' ? 0.9 : 0.22) + (sliding ? 0.5 : 0) + (sp / PHYS.max) * 0.3;
      if (Math.random() < rate) {
        const col = wet ? 'rgba(225,235,245,.8)' : sk === 'off' || sk === 'verge' ? T.theme.off.dust : SURF[sk].dust;
        const big = sk !== 'barro' && sk !== 'agua' && !wet;
        emit(c.x - fx * 12, c.y - fy * 12, col, -c.vx * 0.2 + (Math.random() - 0.5) * 40, -c.vy * 0.2 + (Math.random() - 0.5) * 40,
          big ? 4 : 2.4, 0.5 + Math.random() * 0.5, big ? 1.6 : 0.8);
      }
    }
    if (c.dmg > 0.45 && Math.random() < (c.dmg - 0.4) * 0.9) {
      const g = c.dmg > 0.8 ? 40 : 120;
      emit(c.x + fx * 10, c.y + fy * 10, `rgba(${g},${g},${g + 6},.7)`, -c.vx * 0.1 + (Math.random() - 0.5) * 20, -c.vy * 0.1 + (Math.random() - 0.5) * 20, 3, 0.9, 2.2);
    }

    // vueltas, parciales y meta
    const prev = c.p;
    c.p = progress(c);
    if ((state !== 'race' && state !== 'done') || c.finished) return;
    if (c.cpNext < T.cps.length) {
      const cp = T.cps[c.cpNext];
      if (c.p >= cp && c.p < cp + 60) { c.cpNext++; split(c, false); }
    }
    if (T.loop) {
      if (prev > T.n * 0.85 && c.p < T.n * 0.15 && c.cpNext === T.cps.length) {
        c.lap++; c.cpNext = 0; split(c, true);
        if (c.lap >= T.laps) finish(c);
      }
    } else if (c.p >= T.finish && c.cpNext === T.cps.length) { split(c, true); finish(c); }
  }

  function collideCars() {
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (Math.abs(a.h - b.h) > 10 || a.lv !== b.lv) continue;
      const min = a.spec.r + b.spec.r;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d >= min) continue;
      const ma = a.spec.mass, mb = b.spec.mass;
      const nx = dx / d, ny = dy / d, o = min - d;
      a.x -= nx * o * mb / (ma + mb); a.y -= ny * o * mb / (ma + mb); b.x += nx * o * ma / (ma + mb); b.y += ny * o * ma / (ma + mb);
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) {
        if (rv < -40) sfx('hit', { vol: Math.max(atten(a), atten(b)) * Math.min(1, -rv / 260) * 0.8 });
        if (rv < -60) { hurt(a, ((-rv - 60) / 3000) * (mb / ma)); hurt(b, ((-rv - 60) / 3000) * (ma / mb)); }
        const imp = -rv * 0.8;
        a.vx -= nx * imp * mb / (ma + mb); a.vy -= ny * imp * mb / (ma + mb);
        b.vx += nx * imp * ma / (ma + mb); b.vy += ny * imp * ma / (ma + mb);
      }
    }
  }

  function updateCones(dt) {
    const f = Math.exp(-2.4 * dt);
    for (const k of cones) {
      for (const c of cars) {
        if (c.h > 8 || c.lv) continue;
        const dx = k.x - c.x, dy = k.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 < 256) {
          const d = Math.sqrt(d2) || 1;
          if (!(k.st > 0)) { k.st = 0.35; sfx('cone', { vol: atten(c) }); }
          k.vx = c.vx * 1.1 + (dx / d) * 60; k.vy = c.vy * 1.1 + (dy / d) * 60; k.va = (Math.random() - 0.5) * 20;
          c.vx *= 0.96; c.vy *= 0.96;
        }
      }
      if (k.st > 0) k.st -= dt;
      k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= f; k.vy *= f; k.a += k.va * dt; k.va *= f;
    }
  }

  // Tiempo de un rival corriendo solo el tramo (para las pruebas de rally del campeonato)
  function simulate(d) {
    const saved = { cars, state, raceT, parts, skids, cones, finCount, arc };
    arc = null;
    sim = true;
    cones = []; finCount = 0; state = 'race'; raceT = 0;
    const idx = T.loop ? (T.start - 5 + T.n) % T.n : Math.max(0, T.start - 5);
    cars = [makeCar({ ...d, me: false }, idx, 0)];
    const c = cars[0], DT = 1 / 60;
    c.p = progress(c);
    while (raceT < 400 && !c.finished) { updateCar(c, DT); raceT += DT; }
    const out = { name: d.name, livery: d.livery, model: c.model, time: c.finished ? c.ft * (0.9 + Math.random() * 0.03) : null, splits: c.splits.map((t) => t * 0.915), raw: c.finished ? c.splits.slice() : null };
    ({ cars, state, raceT, parts, skids, cones, finCount, arc } = saved);
    sim = false;
    return out;
  }

  function step(dt) {
    if (!T || !cars.length) return;
    if (state === 'count') {
      cd -= dt;
      const n = Math.ceil(cd);
      if (n !== lastCount && n > 0) { lastCount = n; sfx('count'); }
      if (cd <= 0) { state = 'race'; sfx('go'); }
    }
    if (state === 'race' || state === 'done') raceT += dt;
    for (const c of cars) updateCar(c, dt);
    collideCars();
    updateCones(dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], f = Math.exp(-3 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= f; p.vy *= f; p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    const me = player();
    if (arc && state === 'race') arcadeStep(me, dt);
    if (arc && arc.pop && (arc.pop.t -= dt) <= 0) arc.pop = null;
    if (state === 'race' && !me.finished && !me.timeUp) callNotes(me);
    if (state === 'race' && !me.finished) {
      recT += dt;
      while (recT >= 1 / 30) { recT -= 1 / 30; rec.push(Math.round(me.x), Math.round(me.y), Math.round(me.a * 100) / 100, Math.round(me.h)); }
    }
    const k = Math.min(1, dt * 3.5);
    cam.x += (me.x + me.vx * 0.45 - cam.x) * k;
    cam.y += (me.y + me.vy * 0.45 - cam.y) * k;
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    // tormenta: relámpago y trueno de vez en cuando
    if (COND.rain && COND.night && state !== 'idle') {
      thunderT -= dt;
      if (thunderT <= 0) { lightning = 1; thunderT = 14 + Math.random() * 18; sfx('thunder', { delay: 0.3 + Math.random() * 1.2 }); }
    }
    if (lightning > 0) lightning = Math.max(0, lightning - dt * 2.2);
    if ((me.finished || me.timeUp) && !shown) {
      doneT += dt;
      if (doneT > (me.timeUp ? 2.4 : 1.6)) { shown = true; state = 'done'; results(); }
    }
  }

  // Copiloto: canta la próxima nota al entrar en distancia y encadena la siguiente si va pegada
  function callNotes(me) {
    const N = T.notes;
    if (!N.length) return;
    let bi = -1, bd = Infinity;
    for (let i = 0; i < N.length; i++) {
      const d = T.loop ? (N[i].i - me.idx + T.n) % T.n : N[i].i - me.idx;
      if (d > 2 && d < bd) { bd = d; bi = i; }
    }
    if (bi < 0 || bd > 62 || bi === lastCall || bi === lastChain) return;
    const j = T.loop ? (bi + 1) % N.length : bi + 1;
    const nx = N[j] && j !== bi ? N[j] : null;
    const gap = nx ? (T.loop ? (nx.i - N[bi].i + T.n) % T.n : nx.i - N[bi].i) : Infinity;
    const chain = nx && gap < 22;
    sfx('note', { no: N[bi], next: chain ? nx : null });
    lastCall = bi; lastChain = chain ? j : -1;
  }

  function results() {
    const me = player();
    if (arc) {
      hooks.onResults({
        mode, track: def.name, cond: cfg.cond, event: cfg.event, timeout: !!me.timeUp, time: me.finished ? me.ft : null,
        left: arc.left, bonus: arc.bonus, score: arc.score, gained: arc.score - arc.base, stage: arc.stage, total: arc.total, dmg: me.dmg, rows: [],
      });
      return;
    }
    const meRow = { name: 'Tú', me: true, color: myLivery().base, time: me.ft, dmg: me.dmg };
    let rows, rally = null;
    if (mode === 'rally') {
      const b = bestFor(), isRec = !b || me.ft < b.t;
      if (isRec) saveBest({ t: me.ft, splits: me.splits, ghost: rec });
      if (isRec && b) sfx('record');
      rally = { best: b ? b.t : null, record: isRec, splits: me.splits, prevSplits: b ? b.splits : null, lapEvery: T.loop ? T.cps.length + 1 : 0 };
      rows = [meRow, ...fieldTimes.map((f) => ({ name: f.name, color: f.livery.base, time: f.time }))]
        .sort((a, b2) => (a.time == null) - (b2.time == null) || a.time - b2.time);
    } else {
      rows = ranking().map((c) => (c.me ? meRow : { name: c.name, color: c.livery.base, time: c.finished ? c.ft : null }));
    }
    rows.forEach((r, i) => (r.pos = i + 1));
    hooks.onResults({ mode, track: def.name, cond: cfg.cond, event: cfg.event, rows, rally, dmg: me.dmg, field: cfg.field });
  }

  const gearLabel = (c) => (c.fs < -5 ? 'R' : String(c.gear));

  function hud() {
    const me = player();
    if (!me) return null;
    let a, aL, b, bL;
    if (T.loop) { aL = 'Vuelta'; a = `${Math.min(me.lap + 1, T.laps)}/${T.laps}`; }
    else { aL = 'Avance'; a = Math.round(clamp((me.p - T.start) / (T.finish - T.start), 0, 1) * 100) + '%'; }
    if (arc) { bL = 'Puntos'; b = String(arc.score); }
    else if (mode === 'carrera') { bL = 'Posición'; b = state === 'idle' ? '–' : `${ranking().indexOf(me) + 1}/${cars.length}`; }
    else if (cfg.field && fieldTimes.length) { bL = 'A batir'; b = fmtTime(fieldTimes[0].time); }
    else { bL = 'Récord'; const bb = bestFor(); b = bb ? fmtTime(bb.t) : '—'; }
    return {
      aL, a, bL, b,
      time: fmtTime(me.finished ? me.ft : raceT),
      speed: Math.round(Math.hypot(me.vx, me.vy) * M_PER_PX * 3.6),
      gear: gearLabel(me),
      dmg: Math.round(me.dmg * 100),
    };
  }

  // ---------- Render ----------
  function blit(img, x0, y0, vw, vh) {
    const sx = Math.max(0, Math.floor(x0)), sy = Math.max(0, Math.floor(y0));
    const ex = Math.min(WW, Math.ceil(x0 + vw)), ey = Math.min(WH, Math.ceil(y0 + vh));
    if (ex > sx && ey > sy) ctx.drawImage(img, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  }

  function setFont(px, weight = 800, italic = true) {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${px}px Saira, "Arial Narrow", sans-serif`;
    if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
  }

  function drawNote(no, x, y, h, u, big, dist) {
    const s = (big ? 34 : 22) * u;
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
    if (no.label) {
      setFont((big ? 24 : 16) * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd23f'; ctx.fillText(no.label, x, y + h * (big ? 0.42 : 0.5));
      let w = ctx.measureText(no.label).width;
      if (big) {
        ctx.font = `600 ${10.5 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillText(dist + ' m', x, y + h * 0.8); w = Math.max(w, ctx.measureText(dist + ' m').width);
      }
      return x + w + 12 * u;
    }
    drawArrow(ctx, x + s / 2 - no.dir * s * 0.28, y + h * (big ? 0.5 : 0.55), s, no.dir, no.grade);
    const tx = x + s + 4 * u;
    setFont((big ? 32 : 20) * u); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(no.grade, tx, y + h * (big ? 0.58 : 0.66));
    let w = ctx.measureText(no.grade).width;
    if (big) {
      const sub = (no.dir < 0 ? 'IZQ' : 'DER') + (no.grade === 'H' ? ' · horquilla' : no.long ? ' · larga' : '') + ' · ' + dist + ' m';
      ctx.font = `600 ${10.5 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(sub, tx, y + h * 0.86); w = Math.max(w, ctx.measureText(sub).width);
    }
    return tx + w + 12 * u;
  }

  function drawNotes(u) {
    const me = player();
    const list = [];
    for (const no of T.notes) {
      const d = T.loop ? (no.i - me.idx + T.n) % T.n : no.i - me.idx;
      if (d > 1 && d < 75) list.push({ no, d });
    }
    if (!list.length) return;
    list.sort((a, b) => a.d - b.d);
    const h = 60 * u, y = 10 * u;
    const w = (list.length > 1 ? 280 : 196) * u, x = cv.width / 2 - w / 2;
    ctx.fillStyle = 'rgba(10,16,22,.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * u); ctx.fill();
    let cx = drawNote(list[0].no, x + 12 * u, y, h, u, true, Math.round((list[0].d * SP * M_PER_PX) / 10) * 10);
    if (list[1]) {
      cx = Math.max(cx, x + 196 * u);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(cx - 10 * u, y + 12 * u, 1.5 * u, h - 24 * u);
      drawNote(list[1].no, cx, y, h, u, false, 0);
    }
  }

  // Límites del trazado ya proyectado, para encajar el minimapa
  function isoBounds(T2) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of T2.S) {
      const u = (q.x - q.y) * ISO_C, v = (q.x + q.y) * ISO_C * 0.5;
      x0 = Math.min(x0, u); y0 = Math.min(y0, v); x1 = Math.max(x1, u); y1 = Math.max(y1, v);
    }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function drawMini(u) {
    const mw = 168 * u, mh = 92 * u, pad = 10 * u, x = cv.width - mw - pad, y = pad;
    ctx.fillStyle = 'rgba(10,16,22,.6)'; ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 8 * u); ctx.fill();
    const b = isoB, sc = Math.min((mw - 18 * u) / b.w, (mh - 18 * u) / b.h);
    const ox = x + mw / 2 - (b.x + b.w / 2) * sc, oy = y + mh / 2 - (b.y + b.h / 2) * sc;
    const k = sc * ISO_C;
    const mx = (wx, wy) => ox + (wx - wy) * k, my = (wx, wy) => oy + (wx + wy) * k * 0.5;
    ctx.save(); ctx.setTransform(k, k * 0.5, -k, k * 0.5, ox, oy);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = (3.2 * u) / k; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke(T.path); ctx.restore();
    const st = T.S[T.start];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(mx(st.x, st.y) - 3 * u, my(st.x, st.y) - 3 * u, 6 * u, 6 * u);
    for (const c of cars) {
      ctx.fillStyle = c.me ? myLivery().base : c.livery.base;
      ctx.beginPath(); ctx.arc(mx(c.x, c.y), my(c.x, c.y), (c.me ? 4.2 : 3.2) * u, 0, 7); ctx.fill();
      if (c.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
    }
  }

  // Cuadro: velocímetro de aguja con cuentavueltas en la corona, cuentakilómetros de rodillos y marcha
  function drawGauge(u) {
    const me = player();
    const R = 58 * u, pad = 12 * u, cx = cv.width - pad - R, cy = cv.height - pad - R;
    const kmh = Math.hypot(me.vx, me.vy) * M_PER_PX * 3.6;
    const topK = PHYS.max * me.spec.max * M_PER_PX * 3.6;
    const full = Math.ceil((topK + 10) / 20) * 20;
    const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, ang = (v) => a0 + sweep * clamp(v, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,22,.78)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
    // corona: vueltas del motor, de verde a rojo en el corte
    const rr = R - 6 * u, rpm = clamp(me.rpm || 0, 0, 1);
    ctx.lineCap = 'butt'; ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 + sweep); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,70,60,.35)'; ctx.beginPath(); ctx.arc(cx, cy, rr, ang(0.9), a0 + sweep); ctx.stroke();
    if (rpm > 0.01) {
      ctx.strokeStyle = rpm > 0.9 ? '#ff5a4a' : rpm > 0.72 ? '#ffd23f' : '#4cd07d';
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0, ang(rpm)); ctx.stroke();
    }
    // escala de km/h
    ctx.strokeStyle = '#ffffff'; ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `600 ${8.5 * u}px Archivo, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= full; v += 10) {
      const a = ang(v / full), big = v % 40 === 0, ca = Math.cos(a), sa = Math.sin(a);
      const r1 = R - 11 * u, r2 = r1 - (big ? 7 : 4) * u;
      ctx.lineWidth = (big ? 1.6 : 1) * u; ctx.globalAlpha = big ? 0.95 : 0.55;
      ctx.beginPath(); ctx.moveTo(cx + ca * r1, cy + sa * r1); ctx.lineTo(cx + ca * r2, cy + sa * r2); ctx.stroke();
      if (big) ctx.fillText(String(v), cx + ca * (r2 - 8 * u), cy + sa * (r2 - 8 * u));
    }
    ctx.globalAlpha = 1;
    // lectura digital y cuentakilómetros (km del recorrido, con rodillo en la última cifra)
    setFont(17 * u); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(Math.round(kmh)), cx, cy + R * 0.42);
    ctx.font = `600 ${7.5 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('km/h', cx, cy + R * 0.56);
    const cells = 5, cw = 7.5 * u, chh = 11 * u, ox = cx - (cells * cw) / 2, oy = cy + R * 0.66;
    const val = me.odo / 10;   // centésimas de km
    ctx.beginPath(); ctx.rect(ox, oy, cells * cw, chh); ctx.save(); ctx.clip();
    ctx.fillStyle = '#05080b'; ctx.fillRect(ox, oy, cells * cw, chh);
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(ox + 3 * cw, oy, 2 * cw, chh);
    ctx.font = `700 ${9 * u}px "Courier New", monospace`; ctx.textBaseline = 'middle';
    for (let k = 0; k < cells; k++) {
      const place = 10 ** (cells - 1 - k), d = Math.floor(val / place) % 10;
      // la última cifra rueda; las demás saltan cuando la de su derecha pasa por el 9
      const roll = k === cells - 1 ? val % 1 : (Math.floor(val) % place === place - 1 ? val % 1 : 0);
      const x = ox + k * cw + cw / 2;
      ctx.fillStyle = k >= 3 ? '#111' : '#f2efe6';
      ctx.fillText(String(d), x, oy + chh / 2 - roll * chh);
      ctx.fillText(String((d + 1) % 10), x, oy + chh * 1.5 - roll * chh);
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(ox + 3 * cw - 0.6 * u, oy + chh - 2.5 * u, 1.2 * u, 1.2 * u);   // coma decimal
    // aguja
    const na = ang(kmh / full), nl = R - 13 * u;
    ctx.strokeStyle = '#ff6a2b'; ctx.lineWidth = 2.4 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(na) * 8 * u, cy - Math.sin(na) * 8 * u); ctx.lineTo(cx + Math.cos(na) * nl, cy + Math.sin(na) * nl); ctx.stroke();
    ctx.fillStyle = '#2a3138'; ctx.beginPath(); ctx.arc(cx, cy, 5 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff6a2b'; ctx.lineWidth = 1.4 * u; ctx.stroke();
    // marcha, a la izquierda
    const gw = 40 * u, gh = 46 * u, gx = cx - R - gw - 6 * u, gy = cy + R - gh;
    ctx.fillStyle = 'rgba(10,16,22,.78)'; ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8 * u); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `600 ${7.5 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('MARCHA', gx + gw / 2, gy + 11 * u);
    setFont(26 * u); ctx.fillStyle = me.shiftT > 0 ? 'rgba(255,255,255,.45)' : '#ffd23f';
    ctx.fillText(gearLabel(me), gx + gw / 2, gy + 39 * u);
    ctx.restore();
  }

  // Marcador de recreativa: segundos que quedan, puntos y derrape en curso
  function drawArcade(u, time) {
    const me = player();
    const x = 12 * u, y = 10 * u, w = 128 * u, h = 76 * u;
    ctx.fillStyle = 'rgba(10,16,22,.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * u); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${10 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText('TIEMPO', x + 12 * u, y + 17 * u);
    const left = arc.left, low = left < 10 && !me.finished;
    const blink = left < 5 && !me.finished && Math.floor(time / 250) % 2;
    setFont(44 * u); ctx.textAlign = 'left';
    ctx.fillStyle = blink ? '#ffffff' : low ? '#ff5a5a' : '#ffd23f';
    ctx.fillText(String(Math.ceil(left)), x + 10 * u, y + 56 * u);
    ctx.font = `600 ${10 * u}px Archivo, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText('PUNTOS', x + 12 * u, y + 70 * u);
    setFont(15 * u); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right';
    ctx.fillText(String(arc.score).padStart(6, '0'), x + w - 10 * u, y + 71 * u);
    if (arc.combo >= 10 || arc.pop) {
      const txt = arc.combo >= 10 ? `DERRAPE ×${arc.mult}  ${Math.round(arc.combo / 10) * 10}` : arc.pop.txt;
      ctx.globalAlpha = arc.combo >= 10 ? 1 : Math.min(1, arc.pop.t * 2);
      bigText(txt, cv.height - 46 * u, 26 * u, arc.combo >= 10 ? '#ffffff' : '#4cd07d');
      ctx.globalAlpha = 1;
    }
  }

  function bigText(txt, y, size, col) {
    setFont(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,16,22,.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(txt, cv.width / 2, y); ctx.fillStyle = col; ctx.fillText(txt, cv.width / 2, y);
  }

  const livOf = (c) => (c.me ? myLivery() : c.livery);

  // Noche: capa de luz de luna con huecos suaves para faros y farolas, luego brillos aditivos
  function renderNight(V) {
    if (light.width !== cv.width || light.height !== cv.height) { light.width = cv.width; light.height = cv.height; }
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, light.width, light.height);
    lctx.fillStyle = `rgba(${NIGHT.tint},${Math.max(0, NIGHT.dark - lightning * 0.5)})`;
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';
    V.set(lctx, 0);
    const LR = NIGHT.lamp;
    for (const [x, y] of lamps) {
      const g = lctx.createRadialGradient(x, y, 0, x, y, LR);
      g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(0.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - LR, y - LR, LR * 2, LR * 2);
    }
    for (const c of cars) {
      const L = livOf(c), fr = carFront(c.model), R = L.pod ? NIGHT.beamPod : NIGHT.beam, w = NIGHT.spread * (L.pod ? 1.15 : 1);
      V.set(lctx, carZ(c)); lctx.translate(c.x, c.y); lctx.rotate(c.a);
      // haz con bordes difuminados: varias pasadas cada vez más abiertas y tenues
      for (const [k, al] of [[1.5, 0.16], [1.3, 0.18], [1.1, 0.22], [0.9, 0.26], [0.7, 0.3], [0.5, 0.3]]) {
        const g = lctx.createRadialGradient(fr, 0, 4, fr, 0, R);
        g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(0.6, `rgba(0,0,0,${al * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath(); lctx.moveTo(fr - 2, -8); lctx.lineTo(fr + R, -R * w * k); lctx.lineTo(fr + R, R * w * k); lctx.lineTo(fr - 2, 8); lctx.closePath(); lctx.fill();
      }
      const A = NIGHT.aura, a = lctx.createRadialGradient(0, 0, 4, 0, 0, A);
      a.addColorStop(0, 'rgba(0,0,0,.85)'); a.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = a; lctx.fillRect(-A, -A, A * 2, A * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(light, 0, 0);
    // brillos
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cars) {
      const fr = carFront(c.model);
      V.set(ctx, carZ(c) + (c.h || 0) + 4); ctx.translate(c.x, c.y); ctx.rotate(c.a);
      for (const s of [-1, 1]) {
        const g = ctx.createRadialGradient(fr, s * 5, 0, fr, s * 5, 12);
        g.addColorStop(0, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.fillRect(fr - 12, s * 5 - 12, 24, 24);
        const rr = ctx.createRadialGradient(-fr, s * 4.5, 0, -fr, s * 4.5, c.brk ? 14 : 7);
        rr.addColorStop(0, c.brk ? 'rgba(255,40,30,.7)' : 'rgba(255,40,30,.3)'); rr.addColorStop(1, 'rgba(255,40,30,0)');
        ctx.fillStyle = rr; ctx.fillRect(-fr - 14, s * 4.5 - 14, 28, 28);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [x, y] of lamps) {
      const sx = V.px(x, y), sy = V.py(x, y, LAMP_H), r = 12 * V.Z;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(255,220,160,.85)'); g.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Lluvia: gotas en pantalla y salpicaduras en el suelo
  function renderRain(V, box, dt) {
    const cw = cv.width, ch = cv.height;
    if (!COND.night) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(45,60,75,${0.24 - lightning * 0.2})`; ctx.fillRect(0, 0, cw, ch); }
    V.set(ctx, 0);
    for (let k = 0; k < 5; k++) splashes.push({ x: box[0] + Math.random() * (box[2] - box[0]), y: box[1] + Math.random() * (box[3] - box[1]), t: 0 });
    ctx.strokeStyle = 'rgba(220,235,248,.45)'; ctx.lineWidth = 0.8;
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.t += dt;
      if (s.t > 0.35) { splashes.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - s.t / 0.35;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1 + s.t * 14, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (drops.length < 260) for (let i = 0; i < 260; i++) drops.push({ x: Math.random(), y: Math.random(), l: 0.02 + Math.random() * 0.04, s: 1.4 + Math.random() * 1.2 });
    ctx.strokeStyle = 'rgba(200,220,240,.38)'; ctx.lineWidth = Math.max(1, dpr * 0.9);
    ctx.beginPath();
    for (const d of drops) {
      d.y += d.s * dt; d.x -= 0.12 * dt;
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random() * 1.1; }
      if (d.x < -0.05) d.x += 1.1;
      ctx.moveTo(d.x * cw, d.y * ch); ctx.lineTo((d.x + d.l * 0.25) * cw, (d.y - d.l) * ch);
    }
    ctx.stroke();
    if (lightning > 0 && !COND.night) { ctx.fillStyle = `rgba(255,255,255,${lightning * 0.35})`; ctx.fillRect(0, 0, cw, ch); }
  }

  // Fantasma: el coche se monta en un canvas aparte y se pega semitransparente
  function drawGhost(V, g) {
    const size = Math.ceil(70 * V.Z), sx = V.px(g.x, g.y), sy = V.py(g.x, g.y, 6 + (g.h || 0));
    if (ghostCv.width !== size) { ghostCv.width = size; ghostCv.height = size; }
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, size, size);
    drawCarIso(gctx, V, g, GHOST_LIVERY, 0, size / 2 - sx, size / 2 - sy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.42; ctx.drawImage(ghostCv, sx - size / 2, sy - size / 2); ctx.globalAlpha = 1;
  }

  // Barras horizontales alineadas con los píxeles reales (sin moiré con escalados no enteros),
  // franjas de fósforo rojo, verde y azul y viñeta suave. Va encima de todo lo del canvas.
  function renderCRT() {
    const cw = cv.width, ch = cv.height, k = cw + 'x' + ch + '@' + dpr;
    if (k !== crtKey) {
      crtKey = k;
      const p = Math.max(2, Math.round(CRT.period * dpr)), lw = Math.max(1, Math.round(p / 3)), mw = Math.max(1, Math.round(dpr));
      const tile = document.createElement('canvas');
      tile.width = mw * 3; tile.height = p;
      const t = tile.getContext('2d');
      ['255,40,40', '40,255,40', '60,90,255'].forEach((col, i) => { t.fillStyle = `rgba(${col},${CRT.mask})`; t.fillRect(i * mw, 0, mw, p); });
      t.fillStyle = `rgba(0,0,0,${CRT.lines})`; t.fillRect(0, p - lw, mw * 3, lw);
      crtPat = ctx.createPattern(tile, 'repeat');
      vig.width = cw; vig.height = ch;
      const v = vig.getContext('2d'), r = Math.hypot(cw, ch) / 2;
      const g = v.createRadialGradient(cw / 2, ch / 2, r * 0.45, cw / 2, ch / 2, r);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${CRT.vignette})`);
      v.fillStyle = g; v.fillRect(0, 0, cw, ch);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = crtPat; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(vig, 0, 0);
  }

  let lastRender = 0;
  function render(time) {
    const dt = clamp((time - lastRender) / 1000, 0, 0.1); lastRender = time;
    const cw = cv.width, ch = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!T) { ctx.fillStyle = '#2a2f35'; ctx.fillRect(0, 0, cw, ch); return; }
    ctx.fillStyle = T.theme.ground2; ctx.fillRect(0, 0, cw, ch);
    const Z = clamp(cv.clientWidth / 560, 0.75, 1.8) * dpr;
    const V = isoView(Z, clamp(cam.x, 0, WW), clamp(cam.y, 0, WH), cw, ch);
    // rectángulo del mundo que cae en pantalla
    const cs = [V.inv(0, 0), V.inv(cw, 0), V.inv(0, ch + 60 * Z), V.inv(cw, ch + 60 * Z)];
    const box = [Math.min(...cs.map((q) => q[0])), Math.min(...cs.map((q) => q[1])), Math.max(...cs.map((q) => q[0])), Math.max(...cs.map((q) => q[1]))];
    V.set(ctx, 0);
    blit(layers.g, box[0], box[1], box[2] - box[0], box[3] - box[1]);
    if (COND.rain) { ctx.fillStyle = 'rgba(20,30,45,.18)'; ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); }   // suelo mojado

    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    let last = null;
    for (const s of skids) {
      if (s[4] !== last) { if (last) ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = last = s[4]; }
      ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]);
    }
    if (last) ctx.stroke();
    for (const c of cars) if (!c.lv) drawCarShadowIso(ctx, V, c, 0);

    // partículas: polvo, agua y humo, con algo de altura
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(V.px(p.x, p.y), V.py(p.x, p.y, p.z + (1 - a) * 6), p.size * (1 + (1 - a) * p.grow) * Z * 0.85, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // todo lo que tiene altura, ordenado de atrás hacia delante (x + y)
    const vis = (x, y) => { const sx = V.px(x, y), sy = V.py(x, y); return sx > -60 * Z && sx < cw + 60 * Z && sy > -20 * Z && sy < ch + 80 * Z; };
    const me = player();
    const meX = V.px(me.x, me.y), meY = V.py(me.x, me.y, carZ(me) + 4), meD = me.x + me.y;
    const items = [];
    for (const list of [T.decor, T.user]) {
      for (const d of list) {
        if (!hasBillboard(d.k) || !vis(d.x, d.y)) continue;
        // si tapa a tu coche, se vuelve transparente
        let al = 1;
        if (d.x + d.y > meD) {
          const sx = V.px(d.x, d.y), sy = V.py(d.x, d.y);
          if (Math.abs(sx - meX) < 22 * Z * (d.s || 1) && sy > meY && sy - decorTop(d) * Z < meY) al = 0.4;
        }
        items.push([d.x + d.y, () => drawDecorIso(ctx, V, d, T.theme, al)]);
      }
    }
    for (const k of cones) if (vis(k.x, k.y)) items.push([k.x + k.y, () => drawConeIso(ctx, V, k)]);
    for (const [x, y] of lamps) if (vis(x, y)) items.push([x + y, () => drawLampIso(ctx, V, x, y)]);
    const arch = (i, label, col) => { const q = T.S[i]; if (vis(q.x, q.y)) items.push([q.x + q.y + 4, () => drawArchIso(ctx, V, q, label, col)]); };
    T.cps.forEach((c, k) => arch(T.loop ? (T.start + c) % T.n : c, arc ? 'CONTROL' : `PARCIAL ${k + 1}`, '#ff7a1a'));
    arch(T.start, T.loop ? 'SALIDA · META' : 'SALIDA', '#ffffff');
    if (!T.loop) arch(T.finish, 'META', '#ffd23f');
    for (const p of pieces) if (vis(p.a.x, p.a.y) || vis(p.e.x, p.e.y)) items.push([p.depth + 40, () => drawBridgePiece(ctx, V, p)]);
    for (const c of cars) {
      if (c.lv) items.push([c.x + c.y + 80, () => { drawCarShadowIso(ctx, V, c, carZ(c)); drawCarIso(ctx, V, c, livOf(c), carZ(c)); }]);
      else items.push([c.x + c.y, () => drawCarIso(ctx, V, c, livOf(c), 0)]);
    }
    if (ghost && state !== 'idle') {
      const i = Math.min(Math.floor(raceT * 30), ghost.length / 4 - 1) * 4;
      if (i >= 0) {
        const g = { x: ghost[i], y: ghost[i + 1], a: ghost[i + 2], h: ghost[i + 3], num: 'F', model: cfg.me.model };
        items.push([g.x + g.y + 1, () => drawGhost(V, g)]);
      }
    }
    items.sort((a, b) => a[0] - b[0]);
    for (const it of items) it[1]();

    if (COND.night) renderNight(V);
    if (COND.rain) renderRain(V, box, dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const u = dpr * clamp(cv.clientWidth / 760, 0.62, 1.1);
    if (me && state !== 'idle' && !me.finished && !me.timeUp) drawNotes(u);
    if (cars.length) drawMini(u);
    if (arc) drawArcade(u, time);
    if (me && state !== 'idle') drawGauge(u);
    if (flash) { ctx.globalAlpha = Math.min(1, flash.t * 2); bigText(flash.txt, 100 * u, 38 * u, flash.col); ctx.globalAlpha = 1; }
    if (state === 'count') bigText(String(Math.ceil(cd)), ch / 2, ch * 0.24, '#ffd23f');
    else if (state === 'race' && raceT < 0.8) bigText('¡YA!', ch / 2, ch * 0.24, '#ffd23f');
    if (me && me.finished && !shown) bigText(mode === 'rally' ? fmtTime(me.ft) : arc ? '¡TRAMO SUPERADO!' : 'META', ch / 2, ch * 0.16, '#ffffff');
    if (crtOn) renderCRT();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
  }

  // opts: { def, mode, cond, me: { model, spec, dmg }, rivals, field, event }
  function setup(opts) {
    if (opts.def !== undefined && opts.def !== def) {
      def = opts.def; T = def ? buildTrack(def, layers, { iso: true }) : null; key = T ? trackKey(def) : '';
      pieces = T ? bridgePieces(T) : [];
      isoB = T ? isoBounds(T) : null;
    }
    if (opts.mode) mode = opts.mode;
    cfg = {
      cond: opts.cond || cfg.cond || 'seco',
      me: opts.me || cfg.me,
      rivals: opts.rivals !== undefined ? opts.rivals : cfg.rivals,
      field: opts.field !== undefined ? !!opts.field : cfg.field,
      event: opts.event !== undefined ? opts.event : cfg.event,
      arcade: opts.arcade !== undefined ? opts.arcade : mode === 'arcade' ? cfg.arcade : null,
    };
    COND = CONDITIONS[cfg.cond] || CONDITIONS.seco;
    fieldTimes = [];
    if (T && mode === 'rally' && cfg.field) {
      fieldTimes = rivalsList().map((r) => simulate(r)).filter((f) => f.time != null).sort((a, b) => a.time - b.time);
    }
    arc = null;
    if (T && mode === 'arcade' && cfg.arcade) arc = arcadeSetup(cfg.arcade);
    reset();
    return info();
  }

  // Tiempo que da cada control: lo que tarda un piloto de referencia con tu coche, con margen
  function arcadeSetup(a) {
    const ref = simulate({ name: 'ref', skill: 1, model: cfg.me.model, spec: cfg.me.spec, livery: {} });
    const gates = (T.cps.length + 1) * T.laps;
    let allow;
    if (ref.raw && ref.raw.length === gates) allow = ref.raw.map((t, k) => (t - (k ? ref.raw[k - 1] : 0)) * a.slack);
    else allow = Array.from({ length: gates }, () => ((T.L * T.laps) / gates / (PHYS.max * 0.6)) * a.slack);
    return { stage: a.stage, total: a.total, base: a.score || 0, carry: a.carry || 0, allow, left: 0, score: 0, combo: 0, comboT: 0, driftT: 0, mult: 1 };
  }

  return {
    keys,
    setup,
    load(d) { return setup({ def: d }); },
    setMode(m) { return setup({ mode: m }); },
    start() { if (!T) return; reset(); state = 'count'; cd = 3; },
    reset() { reset(); return info(); },
    tick: step,
    render,
    resize,
    hud,
    setCRT(on) { crtOn = !!on; },
    info,
    get state() { return state; },
    get arcade() { return arc; },
    get cars() { return cars; },     // para depurar desde la consola
    get track() { return T; },
    audioState() {
      const me = player();
      if (!T || !me || state === 'idle') return { active: false, rain: COND.rain && !!T };
      return {
        active: true,
        count: state === 'count',
        rain: COND.rain,
        me: {
          sp: Math.hypot(me.vx, me.vy), thr: state === 'count' ? keys.t : me.thr, brk: me.brk, hb: me.hb,
          sk: me.sk, slide: Math.abs(me.ls || 0), air: me.air > 0, gear: me.gear, rpm: me.rpm, shifting: me.shiftT > 0, turbo: me.spec.era !== 'clasico', top: me.spec.max * PHYS.max, offKind: T.def.theme, dmg: me.dmg,
        },
        rivals: cars.filter((c) => !c.me).map((c) => ({
          dist: Math.hypot(c.x - me.x, c.y - me.y), pan: clamp((c.x - me.x) / 400, -1, 1), sp: Math.hypot(c.vx, c.vy), thr: c.thr, rpm: c.rpm,
        })),
      };
    },
  };
}
