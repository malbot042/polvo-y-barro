// Parámetros de juego: superficies, entornos, objetos y física.
// grip: agarre lateral (más alto = menos derrape) · max: multiplicador de velocidad punta · acc: de aceleración

import { M_PER_PX } from './util.js';
export const SURF = {
  asfalto: { label: 'Asfalto', grip: 9.0, max: 1.00, acc: 1.00, col: '#4b4f56', dust: '#a3a8ad', skid: 'rgba(18,18,20,.40)' },
  tierra:  { label: 'Tierra',  grip: 4.3, max: 0.90, acc: 0.92, col: '#a5794d', dust: '#c9a476', skid: 'rgba(70,45,22,.32)' },
  nieve:   { label: 'Nieve',   grip: 2.6, max: 0.82, acc: 0.85, col: '#dfe6ed', dust: '#ffffff', skid: 'rgba(110,130,160,.42)' },
  barro:   { label: 'Barro',   grip: 2.4, max: 0.55, acc: 0.60, col: '#5b3c22', dust: '#4a2f19', skid: 'rgba(40,24,10,.45)' },
  agua:    { label: 'Agua',    grip: 3.0, max: 0.62, acc: 0.70, col: '#4f7fa3', dust: '#d8ecf7', skid: 'rgba(255,255,255,.14)' },
};

// Superficies que se pueden asignar a un tramo del trazado
export const ROAD_SURFACES = ['asfalto', 'tierra', 'nieve'];

// Arcén: franja estrecha junto a la pista
export const VERGE = { label: 'Arcén', grip: 4.2, max: 0.72, acc: 0.80 };

export const THEME = {
  pradera: {
    label: 'Pradera', ground: '#6c9748', ground2: '#5e883c', verge: '#8d8a5b', bush: '#4b7832',
    off: { label: 'Hierba', grip: 3.4, max: 0.55, acc: 0.60, dust: '#5d7f36', skid: 'rgba(45,65,22,.38)' },
    decor: [['pino', 0.45], ['arbol', 0.35], ['arbusto', 0.2]],
  },
  desierto: {
    label: 'Desierto', ground: '#d8b277', ground2: '#cca468', verge: '#c39463', bush: '#9a8a50',
    off: { label: 'Arena', grip: 3.0, max: 0.50, acc: 0.55, dust: '#e6c792', skid: 'rgba(120,80,40,.30)' },
    decor: [['roca', 0.4], ['cactus', 0.3], ['arbusto', 0.3]],
  },
  nieve: {
    label: 'Montaña nevada', ground: '#f1f4f7', ground2: '#e2e9ef', verge: '#cbd6e0', bush: '#b9c8d2',
    off: { label: 'Nieve honda', grip: 2.0, max: 0.45, acc: 0.50, dust: '#ffffff', skid: 'rgba(120,140,170,.42)' },
    decor: [['pino', 0.65], ['roca', 0.25], ['arbusto', 0.1]],
  },
  selva: {
    label: 'Selva', ground: '#3f7a3a', ground2: '#356d31', verge: '#7a6a3f', bush: '#2f5f2a',
    off: { label: 'Maleza', grip: 3.0, max: 0.50, acc: 0.55, dust: '#4f6e2c', skid: 'rgba(40,55,20,.40)' },
    decor: [['palmera', 0.4], ['arbol', 0.4], ['arbusto', 0.2]],
  },
  sabana: {
    label: 'Sabana', ground: '#c9b264', ground2: '#bba356', verge: '#b08a55', bush: '#8d8a42',
    off: { label: 'Hierba seca', grip: 3.2, max: 0.55, acc: 0.60, dust: '#d8c48a', skid: 'rgba(110,85,40,.32)' },
    decor: [['acacia', 0.35], ['roca', 0.2], ['arbusto', 0.45]],
  },
  outback: {
    label: 'Tierra roja', ground: '#b8643a', ground2: '#a85a33', verge: '#9c5a36', bush: '#7d7a45',
    off: { label: 'Arena roja', grip: 3.0, max: 0.50, acc: 0.55, dust: '#d58a5a', skid: 'rgba(110,50,25,.35)' },
    decor: [['roca', 0.35], ['arbol', 0.15], ['acacia', 0.15], ['arbusto', 0.35]],
  },
};

// r: radio de colisión. solid: los coches chocan con él.
export const OBJ = {
  pino:    { r: 10, solid: true },
  arbol:   { r: 12, solid: true },
  roca:    { r: 11, solid: true },
  cactus:  { r: 7,  solid: true },
  palmera: { r: 7,  solid: true },
  acacia:  { r: 9,  solid: true },
  paja:    { r: 10, solid: true },
  arbusto: { r: 0,  solid: false },
  cono:    { r: 5 },
  rampa:   {},
};

export const WIDTHS = { estrecho: 72, normal: 92, ancho: 120 };
export const DEFAULT_W = { asfalto: 100, tierra: 90, nieve: 86 };

export const PHYS = {
  acc: 250,      // aceleración base (px/s²)
  max: 300,      // velocidad punta base (px/s) ≈ 162 km/h
  brake: 430,
  reverse: 160,
  revMax: 80,
  steer: 3.2,    // giro (rad/s) a plena dirección
  carR: 10,      // radio de colisión del coche
  // conducción arcade
  drift: 0.5,    // agarre que se pierde girando a fondo con gas a velocidad (derrape de potencia)
  counter: 1.9,  // multiplicador de agarre al contravolantear: el coche se endereza enseguida
  yaw: 0.3,      // giro extra (máx.) mientras el coche va cruzado
  // caja de seis marchas largas: cada una llega hasta ratio × velocidad punta del coche (luego corta
  // la inyección) y las cortas empujan más. El par depende de las vueltas (rpm de 0 a 1).
  gears: [0.36, 0.52, 0.66, 0.78, 0.89, 1],
  gearAcc: [0.58, 0.52, 0.46, 0.41, 0.36, 0.33],
  drag: 0.15,               // resistencia del aire (× acc) a la velocidad punta; crece con el cuadrado
  shiftT: 0.16,             // segundos sin empuje mientras se cambia
  autoUp: 0.97, autoDown: 0.72,   // automático: sube al llegar a esas rpm; baja si cabe en la inferior por debajo de esas
};
// Curva de par: flojo abajo, máximo hacia el 85 % de vueltas y algo menos en el corte
export const torque = (r) => 0.35 + 1.3 * r - 0.75 * r * r;

// ---------- Coches, mejoras y condiciones ----------

// Coches: solo los que han ganado el Mundial de Rallies (categoría «World Rally Championship–winning
// cars» de la Wikipedia en inglés). Las prestaciones salen de su época y se retocan coche a coche.
// top: velocidad punta en km/h, la de su época con desarrollos de rally. acc/grip: multiplicadores. off: aguante fuera de pista (barro, arena, nieve honda…).
// mass: peso en los choques. armor: resistencia a los daños. r: radio de colisión.
export const ERAS = {
  clasico: 'Clásicos de los 70',
  grupoB: 'Grupo B',
  grupoA: 'Grupo A',
  kit: 'Kit Car',
  wrc: 'World Rally Car',
  rally1: 'Rally1 híbridos',
};
export const CAR_MODELS = {
  'alpine-a110': { label: 'Alpine A110', year: 1973, era: 'clasico', price: 600,
    desc: 'Ligero y con el motor detrás: muy ágil, pero nervioso de atrás.',
    top: 175, acc: 0.9, grip: 0.84, off: 0.9, mass: 0.85, armor: 0.8, r: 9.5 },
  'lancia-stratos': { label: 'Lancia Stratos', year: 1974, era: 'clasico', price: 1400,
    desc: 'Cuña de motor central: corta, rapidísima de reacciones y difícil de domar.',
    top: 190, acc: 0.95, grip: 0.84, off: 0.9, mass: 0.95, armor: 0.9, r: 9.5 },
  'fiat-131-abarth': { label: 'Fiat 131 Abarth', year: 1977, era: 'clasico', price: 0,
    desc: 'Berlina de propulsión noble y fácil de llevar. El coche con el que empiezas.',
    top: 180, acc: 0.9, grip: 0.88, off: 0.9, mass: 0.95, armor: 0.9, r: 10 },
  'ford-escort-rs1800': { label: 'Ford Escort RS1800', year: 1979, era: 'clasico', price: 800,
    desc: 'Propulsión clásica y ligera: derrapa con alegría.',
    top: 182, acc: 0.93, grip: 0.85, off: 0.9, mass: 0.95, armor: 0.9, r: 10 },
  'opel-ascona-400': { label: 'Opel Ascona 400', year: 1982, era: 'clasico', price: 1000,
    desc: 'El último campeón de propulsión del mundial: robusto y estable.',
    top: 185, acc: 0.9, grip: 0.88, off: 0.9, mass: 0.95, armor: 1, r: 10.5 },
  'audi-quattro': { label: 'Audi Quattro', year: 1982, era: 'grupoB', price: 4200,
    desc: 'Trajo la tracción total al mundial: tracciona en cualquier superficie.',
    top: 200, acc: 1.12, grip: 1, off: 1.1, mass: 1.1, armor: 0.8, r: 10.5 },
  'lancia-rally-037': { label: 'Lancia Rally 037', year: 1983, era: 'grupoB', price: 4400,
    desc: 'Motor central y propulsión: ligero y preciso en firme, delicado en barro.',
    top: 205, acc: 1.18, grip: 0.92, off: 0.9, mass: 1, armor: 0.8, r: 10 },
  'peugeot-205-t16': { label: 'Peugeot 205 Turbo 16', year: 1985, era: 'grupoB', price: 5000,
    desc: 'Compacto de motor central y tracción total: una bala en tierra.',
    top: 210, acc: 1.18, grip: 0.96, off: 1, mass: 1, armor: 0.8, r: 9.5 },
  'peugeot-205-t16-e2': { label: 'Peugeot 205 Turbo 16 E2', year: 1986, era: 'grupoB', price: 5600,
    desc: 'La evolución con gran alerón: lo más bestia del Grupo B.',
    top: 215, acc: 1.22, grip: 0.96, off: 1, mass: 1, armor: 0.8, r: 10 },
  'lancia-delta-hf': { label: 'Lancia Delta HF', year: 1987, era: 'grupoA', price: 2400,
    desc: 'Compacto turbo de tracción total con el que empezó una saga.',
    top: 190, acc: 1, grip: 1, off: 1, mass: 1.05, armor: 1, r: 10 },
  'lancia-delta-hf-4wd': { label: 'Lancia Delta HF 4WD', year: 1987, era: 'grupoA', price: 2600,
    desc: 'El primer campeón del Grupo A: equilibrado y fiable.',
    top: 192, acc: 1, grip: 1, off: 1, mass: 1.05, armor: 1, r: 10 },
  'lancia-delta-integrale': { label: 'Lancia Delta Integrale', year: 1988, era: 'grupoA', price: 3600,
    desc: 'Aletas anchas y muchos títulos: el rey del Grupo A.',
    top: 198, acc: 1.04, grip: 1.04, off: 1, mass: 1.05, armor: 1, r: 10 },
  'toyota-celica-gt-four': { label: 'Toyota Celica GT-Four', year: 1990, era: 'grupoA', price: 2900,
    desc: 'Coupé turbo 4x4, rápido en las rectas y algo pesado.',
    top: 196, acc: 1, grip: 1, off: 1, mass: 1.1, armor: 1, r: 10.5 },
  'toyota-celica-turbo-4wd': { label: 'Toyota Celica Turbo 4WD', year: 1992, era: 'grupoA', price: 3200,
    desc: 'La evolución del Celica: más ancho y más agarre.',
    top: 198, acc: 1, grip: 1.03, off: 1, mass: 1.1, armor: 1, r: 10.5 },
  'mitsubishi-lancer-evolution': { label: 'Mitsubishi Lancer Evolution', year: 1996, era: 'grupoA', price: 3400,
    desc: 'Berlina turbo 4x4 dura y eficaz fuera del asfalto.',
    top: 200, acc: 1, grip: 1.04, off: 1.08, mass: 1.05, armor: 1.1, r: 10.5 },
  'skoda-felicia-kit-car': { label: 'Škoda Felicia Kit Car', year: 1995, era: 'kit', price: 1200,
    desc: 'Kit Car de tracción delantera: ligero y noble.',
    top: 180, acc: 0.95, grip: 1.02, off: 0.9, mass: 0.85, armor: 0.85, r: 10 },
  'citroen-xsara-kit-car': { label: 'Citroën Xsara Kit Car', year: 1999, era: 'kit', price: 1600,
    desc: 'El Kit Car más rápido en asfalto, pero sufre en tierra.',
    top: 188, acc: 0.95, grip: 1.02, off: 0.85, mass: 0.85, armor: 0.85, r: 10 },
  'subaru-impreza-wrc': { label: 'Subaru Impreza WRC', year: 1997, era: 'wrc', price: 4800,
    desc: 'Berlina WRC de motor bóxer: tracción y estabilidad.',
    top: 203, acc: 1.08, grip: 1.08, off: 1.1, mass: 1, armor: 1.05, r: 10.5 },
  'ford-escort-wrc': { label: 'Ford Escort WRC', year: 1998, era: 'wrc', price: 4500,
    desc: 'El primer WRC de Ford, con su gran alerón de berlina.',
    top: 201, acc: 1.08, grip: 1.08, off: 1.1, mass: 1, armor: 1.05, r: 10.5 },
  'toyota-corolla-wrc': { label: 'Toyota Corolla WRC', year: 1999, era: 'wrc', price: 4600,
    desc: 'Compacto WRC muy equilibrado.',
    top: 203, acc: 1.08, grip: 1.08, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'peugeot-206-wrc': { label: 'Peugeot 206 WRC', year: 2000, era: 'wrc', price: 5200,
    desc: 'Corto y ágil: gira como ninguno en las curvas cerradas.',
    top: 205, acc: 1.08, grip: 1.1, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'citroen-xsara-wrc': { label: 'Citroën Xsara WRC', year: 2003, era: 'wrc', price: 5600,
    desc: 'Eficaz en cualquier superficie y muy resistente.',
    top: 206, acc: 1.08, grip: 1.08, off: 1.1, mass: 1, armor: 1.15, r: 10 },
  'ford-focus-rs-wrc': { label: 'Ford Focus RS WRC', year: 2006, era: 'wrc', price: 5800,
    desc: 'Rápido y robusto, muy fuerte en tierra.',
    top: 207, acc: 1.08, grip: 1.08, off: 1.15, mass: 1, armor: 1.1, r: 10 },
  'citroen-c4-wrc': { label: 'Citroën C4 WRC', year: 2008, era: 'wrc', price: 6200,
    desc: 'Coupé WRC muy preciso: el más eficaz de su época.',
    top: 208, acc: 1.08, grip: 1.1, off: 1.1, mass: 1, armor: 1.05, r: 10.5 },
  'citroen-ds3-wrc': { label: 'Citroën DS3 WRC', year: 2011, era: 'wrc', price: 6500,
    desc: 'Compacto de nueva generación, ágil y rapidísimo.',
    top: 206, acc: 1.08, grip: 1.1, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'vw-polo-r-wrc': { label: 'Volkswagen Polo R WRC', year: 2013, era: 'wrc', price: 6800,
    desc: 'Dominador de su época: rápido en todas partes.',
    top: 208, acc: 1.08, grip: 1.11, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'ford-fiesta-wrc': { label: 'Ford Fiesta WRC', year: 2017, era: 'wrc', price: 6600,
    desc: 'WRC de la era de los grandes alerones, muy estable.',
    top: 212, acc: 1.08, grip: 1.12, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'toyota-yaris-wrc': { label: 'Toyota Yaris WRC', year: 2018, era: 'wrc', price: 7200,
    desc: 'Mucha carga aerodinámica: pegado al suelo.',
    top: 213, acc: 1.08, grip: 1.13, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'hyundai-i20-coupe-wrc': { label: 'Hyundai i20 Coupe WRC', year: 2019, era: 'wrc', price: 7000,
    desc: 'Coupé WRC de última generación, rápido y nervioso.',
    top: 212, acc: 1.08, grip: 1.11, off: 1.1, mass: 1, armor: 1.05, r: 10 },
  'toyota-gr-yaris-rally1': { label: 'Toyota GR Yaris Rally1', year: 2022, era: 'rally1', price: 9400,
    desc: 'Rally1 híbrido: empuje eléctrico a la salida de las curvas.',
    top: 210, acc: 1.18, grip: 1.12, off: 1.15, mass: 1.05, armor: 1.1, r: 10 },
  'hyundai-i20-n-rally1': { label: 'Hyundai i20 N Rally1', year: 2024, era: 'rally1', price: 8800,
    desc: 'Rally1 híbrido, muy rápido en asfalto.',
    top: 211, acc: 1.14, grip: 1.12, off: 1.15, mass: 1.05, armor: 1.1, r: 10 },
};
export const DEFAULT_CAR = 'lancia-delta-integrale';   // juego libre y recreativa
export const START_CAR = 'fiat-131-abarth';            // con el que empieza el campeonato
// Identificadores de la versión anterior (coches genéricos) a su equivalente
export const OLD_CARS = { compacto: 'lancia-delta-hf-4wd', coupe: 'toyota-celica-gt-four', berlina: 'mitsubishi-lancer-evolution', raid: 'mitsubishi-lancer-evolution' };
// Coches en orden de época y año, agrupados para los desplegables y el garaje
export function carsByEra() {
  return Object.keys(ERAS).map((era) => [era, Object.keys(CAR_MODELS).filter((id) => CAR_MODELS[id].era === era).sort((x, y) => CAR_MODELS[x].year - CAR_MODELS[y].year)]);
}

export const UPGRADES = {
  motor:      { label: 'Motor',      desc: '+3 % de velocidad punta y +6 % de aceleración por nivel' },
  neumaticos: { label: 'Neumáticos', desc: '+6 % de agarre por nivel' },
  suspension: { label: 'Suspensión', desc: 'Pierde menos fuera de pista y aterriza más suave' },
  blindaje:   { label: 'Blindaje',   desc: '−15 % de daños por nivel' },
};
export const UP_PRICES = [500, 900, 1500, 2400];   // coste de los niveles 1 a 4
export const REPAIR_PER_PCT = 12;                  // dólares por cada 1 % de daños

export const CONDITIONS = {
  // grip: agarre en asfalto y tierra; acc/max: empuje y punta (el agua frena y las ruedas patinan)
  seco:           { label: 'Seco, de día',     grip: 1.0, acc: 1,    max: 1,    night: false, rain: false },
  lluvia:         { label: 'Lluvia',           grip: 0.8, acc: 0.9,  max: 0.95, night: false, rain: true },
  noche:          { label: 'Noche',            grip: 1.0, acc: 1,    max: 1,    night: true,  rain: false },
  'lluvia-noche': { label: 'Lluvia de noche',  grip: 0.8, acc: 0.9,  max: 0.95, night: true,  rain: true },
};

// Modo recreativa: cuenta atrás, controles que dan tiempo y puntos
export const ARCADE = {
  gatePts: 250,      // puntos por pasar un control
  secPts: 100,       // puntos por cada segundo que sobra al llegar a meta
  carry: 1,          // parte del tiempo sobrante que pasa al tramo siguiente
  driftSpeed: 110,   // velocidad mínima (px/s) para que un derrape puntúe
  driftSlide: 45,    // deslizamiento lateral mínimo (px/s)
  driftPts: 1.6,     // puntos por px/s de deslizamiento y segundo
  multEvery: 1.2,    // cada tantos segundos de derrape seguido sube el multiplicador
  maxMult: 5,
  continues: 3,      // continuaciones por partida
  countdown: 9,      // segundos para decidir si continúas
};

// Noche: luz de luna azulada y faros que alumbran lejos y con bordes suaves
export const NIGHT = {
  dark: 0.6,           // oscuridad general (0 = de día, 1 = negro)
  tint: '12,22,52',    // color de la noche (RGB)
  beam: 340,           // alcance de los faros (px)
  beamPod: 440,        // con faros auxiliares
  spread: 0.55,        // apertura del haz
  aura: 70,            // luz alrededor del coche
  lamp: 120,           // radio de las farolas
};

// Efecto de monitor de recreativa (sin curvatura): barras horizontales, rejilla de fósforo y viñeta
export const CRT = {
  period: 3,       // separación entre barras, en px de pantalla
  lines: 0.22,     // opacidad de las barras oscuras
  mask: 0.05,      // intensidad de las franjas verticales rojo, verde y azul
  vignette: 0.35,  // oscurecimiento de las esquinas
};

// km/h que corresponden a PHYS.max (px/s) con la escala del mundo
const TOP_BASE = PHYS.max * M_PER_PX * 3.6;
export function carSpec(id, up = {}) {
  const M = CAR_MODELS[id] || CAR_MODELS[DEFAULT_CAR], l = (k) => up[k] || 0;
  return {
    model: CAR_MODELS[id] ? id : DEFAULT_CAR,
    era: M.era,
    max: (M.top / TOP_BASE) * (1 + 0.03 * l('motor')),   // multiplicador de PHYS.max
    top: Math.round(M.top * (1 + 0.03 * l('motor'))),
    acc: M.acc * (1 + 0.06 * l('motor')),
    grip: M.grip * (1 + 0.06 * l('neumaticos')),
    off: M.off * (1 + 0.08 * l('suspension')),
    land: 1 - 0.15 * l('suspension'),
    mass: M.mass,
    armor: M.armor * (1 + 0.15 * l('blindaje')),
    r: M.r,
  };
}
