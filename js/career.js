// Modo campeonato: dinero, garaje (coches, mejoras, daños) y temporada con puntos.
// Todo se guarda en el navegador.
import { store, clamp } from './util.js';
import { CAR_MODELS, UPGRADES, UP_PRICES, REPAIR_PER_PCT, START_CAR, OLD_CARS, carSpec } from './config.js';
import { carLivery } from './car.js';
import { SEASON } from './tracks.js';

const KEY = 'pyb-career-v1';
export const POINTS = [10, 6, 4, 2];
export const PRIZES = [1500, 900, 550, 300];
export const TITLE_BONUS = 3000;
const DRIVERS = ['Tú', 'Lobo', 'Niebla', 'Rayo'];

const newSeason = (n) => ({ n, idx: 0, points: Object.fromEntries(DRIVERS.map((d) => [d, 0])), results: [] });
const fresh = () => ({ money: 1200, car: START_CAR, cars: { [START_CAR]: { up: {}, dmg: 0 } }, season: newSeason(1), titles: 0 });
// Coches de los rivales en cada temporada: de los clásicos a los Rally1
const RIVAL_CARS = [
  ['ford-escort-rs1800', 'lancia-stratos', 'opel-ascona-400'],
  ['lancia-delta-integrale', 'mitsubishi-lancer-evolution', 'toyota-celica-gt-four'],
  ['subaru-impreza-wrc', 'peugeot-206-wrc', 'citroen-xsara-wrc'],
  ['citroen-ds3-wrc', 'vw-polo-r-wrc', 'ford-fiesta-wrc'],
  ['toyota-yaris-wrc', 'hyundai-i20-n-rally1', 'toyota-gr-yaris-rally1'],
];
const valid = (s) => s && typeof s.money === 'number' && s.cars && s.cars[s.car] && s.season && s.season.points;

export function createCareer() {
  let s = store.get(KEY, null);
  if (s && s.cars) {   // coches genéricos de versiones anteriores → su equivalente real
    for (const [old, now] of Object.entries(OLD_CARS)) {
      if (s.cars[old]) { s.cars[now] = s.cars[now] || s.cars[old]; delete s.cars[old]; }
      if (s.car === old) s.car = now;
    }
  }
  if (!valid(s)) s = fresh();
  const save = () => store.set(KEY, s);
  const cur = () => s.cars[s.car];

  return {
    get money() { return s.money; },
    get carId() { return s.car; },
    get season() { return s.season; },
    get titles() { return s.titles; },
    owned(id) { return !!s.cars[id]; },
    car: cur,
    spec(id = s.car) { return carSpec(id, (s.cars[id] || {}).up || {}); },
    level(k) { return cur().up[k] || 0; },
    event() {
      const i = s.season.idx;
      return i < SEASON.length ? { ...SEASON[i], idx: i, total: SEASON.length, season: s.season.n } : null;
    },
    // Rivales: más rápidos en cada prueba y con mejoras en temporadas siguientes
    rivals(base) {
      const diff = 1 + s.season.idx * 0.012 + (s.season.n - 1) * 0.01;
      const lvl = Math.min(4, Math.floor((s.season.n - 1) / RIVAL_CARS.length) * 2);
      const cars = RIVAL_CARS[Math.min(RIVAL_CARS.length - 1, s.season.n - 1)];
      return base.map((r, i) => {
        const model = cars[i % cars.length];
        return { ...r, model, livery: carLivery(model), skill: Math.min(1.08, r.skill * diff), spec: carSpec(model, { motor: lvl, neumaticos: lvl }) };
      });
    },
    buyCar(id) {
      const M = CAR_MODELS[id];
      if (!M || s.cars[id] || s.money < M.price) return false;
      s.money -= M.price; s.cars[id] = { up: {}, dmg: 0 }; s.car = id; save(); return true;
    },
    selectCar(id) { if (!s.cars[id]) return false; s.car = id; save(); return true; },
    upPrice(k) { const l = cur().up[k] || 0; return l >= UP_PRICES.length ? null : UP_PRICES[l]; },
    buyUp(k) {
      if (!UPGRADES[k]) return false;
      const p = this.upPrice(k);
      if (p == null || s.money < p) return false;
      s.money -= p; cur().up[k] = (cur().up[k] || 0) + 1; save(); return true;
    },
    repairCost() { return Math.round(cur().dmg * 100) * REPAIR_PER_PCT; },
    repair() {
      const c = cur(), pct = Math.round(c.dmg * 100);
      if (!pct) return 0;
      const can = Math.min(pct, Math.floor(s.money / REPAIR_PER_PCT));
      if (can <= 0) return 0;
      s.money -= can * REPAIR_PER_PCT; c.dmg = Math.max(0, (pct - can) / 100); save();
      return can;
    },
    // Apunta el resultado de la prueba en curso
    record(res) {
      const ev = this.event();
      if (!ev) return null;
      const out = { track: ev.track, mode: ev.mode, cond: ev.cond, rows: [] };
      for (const r of res.rows) {
        const pts = r.time != null || ev.mode === 'carrera' ? POINTS[r.pos - 1] || 0 : 0;
        s.season.points[r.name] = (s.season.points[r.name] || 0) + pts;
        out.rows.push({ name: r.name, pos: r.pos, time: r.time, pts, color: r.color, me: !!r.me });
      }
      const me = res.rows.find((r) => r.me);
      out.pos = me.pos; out.prize = PRIZES[me.pos - 1] || 0; s.money += out.prize;
      cur().dmg = clamp(res.dmg || 0, 0, 1); out.dmg = cur().dmg;
      s.season.results.push({ track: ev.track, pos: me.pos, pts: out.rows.find((r) => r.me).pts });
      s.season.idx++;
      if (s.season.idx >= SEASON.length) {
        const st = this.standings();
        out.champion = st[0].name;
        if (out.champion === 'Tú') { s.titles++; s.money += TITLE_BONUS; out.bonus = TITLE_BONUS; }
      }
      save();
      return out;
    },
    standings() {
      return Object.entries(s.season.points).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts || (a.name === 'Tú' ? -1 : 1));
    },
    nextSeason() { s.season = newSeason(s.season.n + 1); save(); },
    resetAll() { s = fresh(); save(); },
  };
}
