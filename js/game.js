// Simulación, IA y render de la carrera (cámara cenital que sigue al coche).
import { WW, WH, SP, M_PER_PX, clamp, wrapA, store, fmtTime } from './util.js';
import { SURF, PHYS, VERGE } from './config.js';
import { buildTrack, nearestGlobal, idxAdd, trackKey, drawCone, drawNitro } from './track.js';
import { drawCar, RIVAL_LIVERIES, GHOST_LIVERY } from './car.js';

const RIVALS = [
  { name: 'Lobo', livery: RIVAL_LIVERIES[0], skill: 0.95, num: '2' },
  { name: 'Niebla', livery: RIVAL_LIVERIES[1], skill: 0.92, num: '3' },
  { name: 'Rayo', livery: RIVAL_LIVERIES[2], skill: 0.89, num: '4' },
];
const BEST_KEY = 'pyb-best-v1';
const NO_INPUT = { t: 0, b: 0, s: 0, n: 0, hb: 0 };

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
  const mk = () => { const c = document.createElement('canvas'); c.width = WW; c.height = WH; return c; };
  const layers = { g: mk(), t: mk() };
  let T = null, def = null, key = '', mode = 'rally', state = 'idle';
  let cd = 0, raceT = 0, doneT = 0, shown = false, finCount = 0;
  let cars = [], parts = [], skids = [], cones = [], nitros = [], ghost = null, rec = [], recT = 0, flash = null;
  const cam = { x: WW / 2, y: WH / 2 };
  let dpr = 1;
  const keys = { t: 0, b: 0, l: 0, r: 0, n: 0, hb: 0 };
  let lastCount = 0, lastCall = -1, lastChain = -1;

  const player = () => cars.find((c) => c.me);
  const sfx = (name, d) => { if (hooks.sfx) hooks.sfx(name, d || {}); };
  // volumen de un efecto según la distancia al jugador
  function atten(c) {
    if (c.me) return 1;
    const me = player();
    return me ? clamp(1 - Math.hypot(c.x - me.x, c.y - me.y) / 520, 0, 1) * 0.7 : 0;
  }
  const progress = (c) => (T.loop ? (c.idx - T.start + T.n) % T.n : c.idx);
  function score(c) {
    if (c.finished) return 1e9 - c.order;
    if (T.loop) { const p = c.cpNext === 0 && c.p > T.n / 2 ? c.p - T.n : c.p; return c.lap * T.n + p; }
    return c.p;
  }
  const ranking = () => [...cars].sort((a, b) => score(b) - score(a));
  const bestFor = () => (store.get(BEST_KEY, {}) || {})[key] || null;
  function saveBest(r) {
    const all = store.get(BEST_KEY, {}) || {};
    all[key] = r;
    if (!store.set(BEST_KEY, all)) { all[key] = { t: r.t, splits: r.splits }; store.set(BEST_KEY, all); }
  }

  function info() {
    if (!T) return null;
    const surfs = [...new Set(T.S.map((s) => s.s))].map((s) => SURF[s].label.toLowerCase());
    const b = bestFor();
    return { name: def.name, loop: T.loop, laps: T.laps, lengthM: T.L * M_PER_PX, surfaces: surfs, best: b ? b.t : null, mode };
  }

  function reset() {
    parts = []; skids = []; raceT = 0; doneT = 0; shown = false; finCount = 0; flash = null; rec = []; recT = 0; state = 'idle'; lastCount = 0; lastCall = -1; lastChain = -1;
    if (!T) { cars = []; return; }
    cones = T.cones.map((c) => ({ x: c.x, y: c.y, vx: 0, vy: 0, a: 0, va: 0 }));
    nitros = T.nitros.map((p) => ({ x: p.x, y: p.y, t: 0 }));
    const me = { name: 'Tú', me: true, skill: 1, num: '1' };
    const list = mode === 'rally' ? [me] : [RIVALS[0], RIVALS[1], me, RIVALS[2]];
    const rows = mode === 'rally' ? [[5, 0]] : [[5, -0.22], [5, 0.22], [11, -0.22], [11, 0.22]];
    cars = list.map((d, i) => {
      const [back, lane] = rows[i];
      const idx = T.loop ? (T.start - back + T.n) % T.n : Math.max(0, T.start - back);
      const s = T.S[idx];
      return {
        ...d, x: s.x + s.nx * lane * s.w, y: s.y + s.ny * lane * s.w, a: s.h, vx: 0, vy: 0, fs: 0, ls: 0,
        idx, nd: 0, p: 0, lap: 0, cpNext: 0, splits: [], finished: false, ft: 0, order: 0,
        nitro: 2, nitroT: 0, air: 0, airMax: 0, airH: 0, h: 0, steer: 0, brk: 0, sk: 'tierra', dirt: { barro: 0, polvo: 0, nieve: 0 },
        lane, laneT: 1 + Math.random(), stuck: 0, rev: 0, rl: null, rr: null,
      };
    });
    cars.forEach((c) => (c.p = progress(c)));
    const b = bestFor();
    ghost = mode === 'rally' && b && b.ghost ? b.ghost : null;
    const p = player(); cam.x = p.x; cam.y = p.y;
  }

  function emit(x, y, col, vx, vy, size, life, grow = 1) {
    if (parts.length > 420) return;
    parts.push({ x, y, vx, vy, col, size, life, max: life, grow });
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
  }

  function ai(c, dt) {
    const S = T.S, sp = Math.hypot(c.vx, c.vy);
    c.laneT -= dt;
    if (c.laneT <= 0) { c.laneT = 1.3 + Math.random() * 2.2; c.lane = (Math.random() * 2 - 1) * 0.2; }
    const t = S[idxAdd(T, c.idx, 5 + Math.floor(sp / 32))];
    let off = c.lane * t.w;
    for (const o of T.solids) {
      const px = t.x + t.nx * off, py = t.y + t.ny * off, dx = o.x - px, dy = o.y - py;
      if (dx * dx + dy * dy < (o.r + 20) ** 2) {
        const side = (o.x - t.x) * t.nx + (o.y - t.y) * t.ny;
        off = side > off ? side - o.r - 20 : side + o.r + 20;
        off = clamp(off, -t.w / 2, t.w / 2);
        break;
      }
    }
    const da = wrapA(Math.atan2(t.y + t.ny * off - c.y, t.x + t.nx * off - c.x) - c.a);
    let mx = 0;
    const span = 6 + Math.floor(sp / 11);
    for (let k = 2; k < span; k += 2) mx = Math.max(mx, Math.abs(S[idxAdd(T, c.idx, k)].hd));
    const sf = SURF[S[idxAdd(T, c.idx, 8)].s];
    const tgt = PHYS.max * c.skill * sf.max * clamp(1 - mx / 150, 0.33, 1) * (0.55 + 0.45 * Math.min(1, sf.grip / 7));
    if (state === 'race' && sp < 12) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
    if (c.stuck > 1.2) { c.rev = 0.9; c.stuck = 0; }
    if (c.rev > 0) { c.rev -= dt; return { t: 0, b: 1, s: -clamp(da * 2, -1, 1), n: 0, hb: 0 }; }
    return {
      t: sp < tgt ? 1 : 0,
      b: sp > tgt + 25 ? 1 : 0,
      s: clamp(da * 2.6, -1, 1),
      n: mx < 8 && c.nitro > 0 && sp > 150 && Math.random() < 0.01 ? 1 : 0,
      hb: mx > 85 && sp > 140 ? 1 : 0,
    };
  }

  function split(c, isLap) {
    c.splits.push(raceT);
    if (!c.me) return;
    if (mode === 'rally') {
      const b = bestFor(), k = c.splits.length - 1;
      const ending = T.loop ? c.lap >= T.laps : isLap;
      if (b && b.splits && b.splits[k] != null) {
        const d = raceT - b.splits[k];
        flash = { txt: (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2), col: d < 0 ? '#4cd07d' : '#ff5a5a', t: 2.2 };
        if (!ending) sfx('split', { good: d < 0 });
      } else { flash = { txt: fmtTime(raceT), col: '#ffffff', t: 2 }; if (!ending) sfx('split', { good: null }); }
    } else if (isLap && T.loop && c.lap < T.laps) {
      flash = { txt: c.lap === T.laps - 1 ? 'ÚLTIMA VUELTA' : `VUELTA ${c.lap + 1}`, col: '#ffffff', t: 2 };
      sfx('lap', { last: c.lap === T.laps - 1 });
    }
  }
  function finish(c) { if (c.finished) return; c.finished = true; c.ft = raceT; c.order = ++finCount; if (c.me) sfx('finish'); }

  function updateCar(c, dt) {
    const S = T.S;
    let inp = NO_INPUT;
    if (state === 'race') inp = c.me && !c.finished ? { t: keys.t, b: keys.b, s: keys.r - keys.l, n: keys.n, hb: keys.hb } : ai(c, dt);
    else if (state === 'done') inp = ai(c, dt);

    nearLocal(c);
    const s = S[c.idx];
    let sf, sk;
    if (c.nd <= s.w / 2) { sf = SURF[s.s]; sk = s.s; }
    else if (c.nd <= s.w / 2 + 9) { sf = VERGE; sk = 'verge'; }
    else { sf = T.theme.off; sk = 'off'; }
    for (const p of T.patches) {
      const dx = c.x - p.x, dy = c.y - p.y;
      if (dx * dx + dy * dy < (p.r * 0.85) ** 2) { sf = SURF[p.k]; sk = p.k; }
    }
    const sp0 = Math.hypot(c.vx, c.vy);
    if (sk !== c.sk && (sk === 'agua' || sk === 'barro') && sp0 > 50 && c.air <= 0) sfx(sk === 'agua' ? 'splash' : 'mud', { vol: atten(c) * Math.min(1, sp0 / 250) });
    c.sk = sk;
    c.thr = inp.t; c.hb = inp.hb;
    if (c.air <= 0 && sp0 > 40) {
      const rate = { barro: 0.14, agua: 0.06, off: 0.035, verge: 0.025, tierra: 0.014, nieve: 0.02 }[sk] || 0;
      if (rate) {
        const snowy = sk === 'nieve' || ((sk === 'off' || sk === 'verge') && T.def.theme === 'nieve');
        const kind = sk === 'barro' || sk === 'agua' ? 'barro' : snowy ? 'nieve' : 'polvo';
        c.dirt[kind] = Math.min(1, c.dirt[kind] + rate * dt * (sp0 / PHYS.max) * 1.5);
      }
    }

    if (inp.n && c.nitro > 0 && c.nitroT <= 0 && c.air <= 0) { c.nitro--; c.nitroT = 1.4; sfx('nitro', { vol: atten(c) }); }
    if (c.nitroT > 0) c.nitroT -= dt;
    const boost = c.nitroT > 0;
    c.brk = inp.b;
    const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;

    if (c.air > 0) {
      c.air -= dt;
      c.h = Math.max(0, Math.sin(Math.PI * (1 - c.air / c.airMax))) * c.airH;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.air <= 0) {
        c.h = 0;
        sfx('land', { vol: atten(c) * Math.min(1, c.airH / 30) });
        const dust = sk === 'off' || sk === 'verge' ? T.theme.off.dust : sf.dust;
        for (let k = 0; k < 10; k++) emit(c.x, c.y, dust, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 3.5, 0.6, 1.4);
      }
    } else {
      let fs = c.vx * fx + c.vy * fy, ls = c.vx * rx + c.vy * ry;
      const acc = PHYS.acc * sf.acc * (boost ? 1.9 : 1);
      if (inp.t) fs += acc * dt;
      if (inp.b) fs -= (fs > 5 ? PHYS.brake : PHYS.reverse) * dt;
      if (!inp.t && !inp.b) fs *= 1 - 0.7 * dt;
      let rb = 1;
      if (!c.me) { const gap = score(c) - score(player()); rb = gap > T.n * 0.2 ? 0.9 : gap < -T.n * 0.2 ? 1.07 : 1; }
      const max = PHYS.max * c.skill * rb * sf.max * (boost ? 1.35 : 1);
      if (fs > max) fs = Math.max(max, fs - 520 * dt);
      if (fs < -PHYS.revMax) fs = -PHYS.revMax;
      let grip = sf.grip;
      if (inp.hb) { grip *= 0.32; fs *= 1 - 1.1 * dt; }
      ls *= Math.exp(-grip * dt);
      c.steer += (clamp(inp.s, -1, 1) - c.steer) * Math.min(1, dt * 14);
      const rate = PHYS.steer * clamp(fs / 80, -1, 1) * (1 - Math.min(0.32, (Math.abs(fs) / PHYS.max) * 0.32)) * (inp.hb ? 1.35 : 1);
      c.a += c.steer * rate * dt;
      c.vx = fx * fs + rx * ls; c.vy = fy * fs + ry * ls;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.fs = fs; c.ls = ls;
      for (const r of T.ramps) {
        const ca = Math.cos(r.a), sa = Math.sin(r.a), dx = c.x - r.x, dy = c.y - r.y;
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        if (Math.abs(u) < 17 && Math.abs(v) < 30) {
          const along = c.vx * ca + c.vy * sa;
          if (along > 60) { const k = Math.min(1, along / PHYS.max); c.airMax = 0.3 + 0.55 * k; c.air = c.airMax; c.airH = 10 + 26 * k; }
        }
      }
    }

    // límites del mundo
    if (c.x < 10) { c.x = 10; c.vx = Math.abs(c.vx) * 0.3; }
    if (c.x > WW - 10) { c.x = WW - 10; c.vx = -Math.abs(c.vx) * 0.3; }
    if (c.y < 10) { c.y = 10; c.vy = Math.abs(c.vy) * 0.3; }
    if (c.y > WH - 10) { c.y = WH - 10; c.vy = -Math.abs(c.vy) * 0.3; }

    // obstáculos fijos (se saltan por encima en el aire)
    if (c.h < 10) {
      for (const o of T.solids) {
        const dx = c.x - o.x, dy = c.y - o.y, rr = o.r + PHYS.carR;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        if (d < rr) {
          const nx = dx / d, ny = dy / d;
          c.x = o.x + nx * rr; c.y = o.y + ny * rr;
          const vn = c.vx * nx + c.vy * ny;
          if (vn < 0) {
            if (vn < -50) sfx('hit', { vol: atten(c) * Math.min(1, -vn / 260) });
            c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; c.vx *= 0.6; c.vy *= 0.6;
            if (vn < -60) for (let k = 0; k < 6; k++) emit(c.x - nx * 9, c.y - ny * 9, '#e8e2d0', (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 2, 0.4, 0.5);
          }
        }
      }
    }
    for (const p of nitros) if (p.t <= 0 && (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 324) { p.t = 8; c.nitro = Math.min(3, c.nitro + 1); if (c.me) sfx('pickup'); }

    // efectos: marcas y polvo
    const sp = Math.hypot(c.vx, c.vy);
    const sliding = c.air <= 0 && sp > 40 && (Math.abs(c.ls) > 38 || (inp.hb && sp > 60) || (inp.b && c.fs > 90));
    const rlx = c.x - fx * 8.6 + rx * 6.9, rly = c.y - fy * 8.6 + ry * 6.9, rrx = c.x - fx * 8.6 - rx * 6.9, rry = c.y - fy * 8.6 - ry * 6.9;
    const soft = sk === 'barro' || sk === 'nieve' || sk === 'off' || sk === 'verge';
    if (c.air <= 0 && (sliding || (soft && sp > 25)) && c.rl) {
      const col = sk === 'off' || sk === 'verge' ? T.theme.off.skid : (SURF[sk] || SURF.tierra).skid;
      skids.push([c.rl[0], c.rl[1], rlx, rly, col], [c.rr[0], c.rr[1], rrx, rry, col]);
      if (skids.length > 2400) skids.splice(0, 2);
    }
    if (c.air > 0) { c.rl = null; c.rr = null; } else { c.rl = [rlx, rly]; c.rr = [rrx, rry]; }
    if (c.air <= 0 && sp > 30) {
      const rate = sk === 'asfalto' ? (sliding ? 0.6 : 0) : (sk === 'agua' ? 0.9 : 0.22) + (sliding ? 0.5 : 0) + (sp / PHYS.max) * 0.3;
      if (Math.random() < rate) {
        const col = sk === 'off' || sk === 'verge' ? T.theme.off.dust : SURF[sk].dust;
        const big = sk !== 'barro' && sk !== 'agua';
        emit(c.x - fx * 12, c.y - fy * 12, col, -c.vx * 0.2 + (Math.random() - 0.5) * 40, -c.vy * 0.2 + (Math.random() - 0.5) * 40,
          big ? 4 : 2.4, 0.5 + Math.random() * 0.5, big ? 1.6 : 0.6);
      }
    }
    if (boost && Math.random() < 0.9) emit(c.x - fx * 14, c.y - fy * 14, Math.random() < 0.5 ? '#ffd23f' : '#ff6a1f', -fx * 70, -fy * 70, 2.5, 0.3, 0);

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
      if (Math.abs(a.h - b.h) > 10) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = 20;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d, o = (min - d) / 2;
      a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) { if (rv < -40) sfx('hit', { vol: Math.max(atten(a), atten(b)) * Math.min(1, -rv / 260) * 0.8 }); const imp = -rv * 0.8; a.vx -= nx * imp * 0.5; a.vy -= ny * imp * 0.5; b.vx += nx * imp * 0.5; b.vy += ny * imp * 0.5; }
    }
  }

  function updateCones(dt) {
    const f = Math.exp(-2.4 * dt);
    for (const k of cones) {
      for (const c of cars) {
        if (c.h > 8) continue;
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
    for (const p of nitros) if (p.t > 0) p.t -= dt;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i], f = Math.exp(-3 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= f; p.vy *= f; p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    const me = player();
    if (state === 'race' && !me.finished) callNotes(me);
    if (state === 'race' && !me.finished) {
      recT += dt;
      while (recT >= 1 / 30) { recT -= 1 / 30; rec.push(Math.round(me.x), Math.round(me.y), Math.round(me.a * 100) / 100, Math.round(me.h)); }
    }
    const k = Math.min(1, dt * 3.5);
    cam.x += (me.x + me.vx * 0.45 - cam.x) * k;
    cam.y += (me.y + me.vy * 0.45 - cam.y) * k;
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    if (me.finished && !shown) {
      doneT += dt;
      if (doneT > 1.6) { shown = true; state = 'done'; results(); }
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
    if (mode === 'rally') {
      const b = bestFor(), isRec = !b || me.ft < b.t;
      if (isRec) saveBest({ t: me.ft, splits: me.splits, ghost: rec });
      if (isRec && b) sfx('record');
      hooks.onResults({
        mode, track: def.name, time: me.ft, best: b ? b.t : null, record: isRec, splits: me.splits,
        prevSplits: b ? b.splits : null, lapEvery: T.loop ? T.cps.length + 1 : 0,
      });
    } else {
      hooks.onResults({
        mode, track: def.name,
        rows: ranking().map((c, i) => ({ pos: i + 1, name: c.name, color: c.me ? hooks.livery().base : c.livery.base, me: !!c.me, time: c.finished ? c.ft : null })),
      });
    }
  }

  function hud() {
    const me = player();
    if (!me) return null;
    let a, aL, b, bL;
    if (T.loop) { aL = 'Vuelta'; a = `${Math.min(me.lap + 1, T.laps)}/${T.laps}`; }
    else { aL = 'Avance'; a = Math.round(clamp((me.p - T.start) / (T.finish - T.start), 0, 1) * 100) + '%'; }
    if (mode === 'carrera') { bL = 'Posición'; b = state === 'idle' ? '–' : `${ranking().indexOf(me) + 1}/${cars.length}`; }
    else { bL = 'Récord'; const bb = bestFor(); b = bb ? fmtTime(bb.t) : '—'; }
    return {
      aL, a, bL, b,
      time: fmtTime(me.finished ? me.ft : raceT),
      speed: Math.round(Math.hypot(me.vx, me.vy) * M_PER_PX * 3.6),
      nitro: me.nitro,
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

  function drawMini(u) {
    const mw = 150 * u, mh = 96 * u, pad = 10 * u, x = cv.width - mw - pad, y = cv.height - mh - pad;
    ctx.fillStyle = 'rgba(10,16,22,.6)'; ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 8 * u); ctx.fill();
    const b = T.bounds, sc = Math.min((mw - 18 * u) / b.w, (mh - 18 * u) / b.h);
    const ox = x + mw / 2 - (b.x + b.w / 2) * sc, oy = y + mh / 2 - (b.y + b.h / 2) * sc;
    ctx.save(); ctx.setTransform(sc, 0, 0, sc, ox, oy);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = (3.2 * u) / sc; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke(T.path); ctx.restore();
    const st = T.S[T.start];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ox + st.x * sc - 3 * u, oy + st.y * sc - 3 * u, 6 * u, 6 * u);
    for (const c of cars) {
      ctx.fillStyle = c.me ? hooks.livery().base : c.livery.base;
      ctx.beginPath(); ctx.arc(ox + c.x * sc, oy + c.y * sc, (c.me ? 4.2 : 3.2) * u, 0, 7); ctx.fill();
      if (c.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
    }
  }

  function bigText(txt, y, size, col) {
    setFont(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(10,16,22,.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(txt, cv.width / 2, y); ctx.fillStyle = col; ctx.fillText(txt, cv.width / 2, y);
  }

  function render(time) {
    const cw = cv.width, ch = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!T) { ctx.fillStyle = '#2a2f35'; ctx.fillRect(0, 0, cw, ch); return; }
    ctx.fillStyle = T.theme.ground2; ctx.fillRect(0, 0, cw, ch);
    const z = clamp(cv.clientWidth / 700, 0.62, 1.5) * dpr, vw = cw / z, vh = ch / z;
    const cx = vw >= WW ? WW / 2 : clamp(cam.x, vw / 2, WW - vw / 2);
    const cy = vh >= WH ? WH / 2 : clamp(cam.y, vh / 2, WH - vh / 2);
    const x0 = cx - vw / 2, y0 = cy - vh / 2;
    ctx.setTransform(z, 0, 0, z, -x0 * z, -y0 * z);
    blit(layers.g, x0, y0, vw, vh);

    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    let last = null;
    for (const s of skids) {
      if (s[4] !== last) { if (last) ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = last = s[4]; }
      ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]);
    }
    if (last) ctx.stroke();

    for (const p of nitros) if (p.t <= 0) drawNitro(ctx, p, time);
    for (const k of cones) drawCone(ctx, k);
    if (ghost && state !== 'idle') {
      const i = Math.min(Math.floor(raceT * 30), ghost.length / 4 - 1) * 4;
      if (i >= 0) drawCar(ctx, { x: ghost[i], y: ghost[i + 1], a: ghost[i + 2], h: ghost[i + 3], num: 'F' }, GHOST_LIVERY, 0.42);
    }
    const myLiv = hooks.livery();
    for (const c of cars) if (c.h <= 8) drawCar(ctx, c, c.me ? myLiv : c.livery);
    for (const p of parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * p.grow), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    blit(layers.t, x0, y0, vw, vh);
    for (const c of cars) if (c.h > 8) drawCar(ctx, c, c.me ? myLiv : c.livery);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const u = dpr * clamp(cv.clientWidth / 760, 0.62, 1.1);
    const me = player();
    if (me && state !== 'idle' && !me.finished) drawNotes(u);
    if (cars.length) drawMini(u);
    if (flash) { ctx.globalAlpha = Math.min(1, flash.t * 2); bigText(flash.txt, 100 * u, 38 * u, flash.col); ctx.globalAlpha = 1; }
    if (state === 'count') bigText(String(Math.ceil(cd)), ch / 2, ch * 0.24, '#ffd23f');
    else if (state === 'race' && raceT < 0.8) bigText('¡YA!', ch / 2, ch * 0.24, '#ffd23f');
    if (me && me.finished && !shown) bigText(mode === 'rally' ? fmtTime(me.ft) : 'META', ch / 2, ch * 0.16, '#ffffff');
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
  }

  return {
    keys,
    load(d) { def = d; T = d ? buildTrack(d, layers) : null; key = T ? trackKey(d) : ''; reset(); return info(); },
    setMode(m) { mode = m; reset(); return info(); },
    start() { if (!T) return; reset(); state = 'count'; cd = 3; },
    reset() { reset(); return info(); },
    tick: step,
    render,
    resize,
    hud,
    info,
    get state() { return state; },
    get cars() { return cars; },
    audioState() {
      const me = player();
      if (!T || !me || state === 'idle') return { active: false };
      return {
        active: true,
        count: state === 'count',
        me: {
          sp: Math.hypot(me.vx, me.vy), thr: state === 'count' ? keys.t : me.thr, brk: me.brk, hb: me.hb,
          sk: me.sk, slide: Math.abs(me.ls || 0), air: me.air > 0, boost: me.nitroT > 0, offKind: T.def.theme,
        },
        rivals: cars.filter((c) => !c.me).map((c) => ({
          dist: Math.hypot(c.x - me.x, c.y - me.y), pan: clamp((c.x - me.x) / 400, -1, 1), sp: Math.hypot(c.vx, c.vy), thr: c.thr,
        })),
      };
    },     // para depurar desde la consola
    get track() { return T; },
  };
}
