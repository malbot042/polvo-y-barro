// Parámetros de juego: superficies, entornos, objetos y física.
// grip: agarre lateral (más alto = menos derrape) · max: multiplicador de velocidad punta · acc: de aceleración

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
};

// r: radio de colisión. solid: los coches chocan con él.
export const OBJ = {
  pino:    { r: 10, solid: true },
  arbol:   { r: 12, solid: true },
  roca:    { r: 11, solid: true },
  cactus:  { r: 7,  solid: true },
  paja:    { r: 10, solid: true },
  arbusto: { r: 0,  solid: false },
  cono:    { r: 5 },
  rampa:   {},
  nitro:   {},
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
  keep: 0.4,     // parte de la velocidad lateral que el derrape convierte en avance en vez de perderla
  yaw: 0.3,      // giro extra (máx.) mientras el coche va cruzado
};

// ---------- Coches, mejoras y condiciones (fase 2) ----------

// max/acc/grip: multiplicadores. off: aguante fuera de pista (barro, arena, nieve honda…).
// mass: peso en los choques. armor: resistencia a los daños. r: radio de colisión.
export const CAR_MODELS = {
  compacto: { label: 'Compacto turbo 4x4', desc: 'Equilibrado y ágil: tracción total y buen agarre en cualquier superficie.', price: 0,
    max: 1.0, acc: 1.0, grip: 1.0, off: 1.0, mass: 1.0, armor: 1.0, r: 10 },
  coupe: { label: 'Coupé turbo 4x4', desc: 'El más rápido en asfalto y tierra firme. Nervioso de atrás y sufre con los golpes.', price: 3500,
    max: 1.08, acc: 1.06, grip: 0.86, off: 0.85, mass: 0.95, armor: 0.85, r: 10 },
  berlina: { label: 'Berlina turbo 4x4', desc: 'Pesada y robusta: algo menos rápida, pero pierde menos en barro, arena o nieve y aguanta mejor los golpes.', price: 3000,
    max: 0.96, acc: 0.94, grip: 1.06, off: 1.3, mass: 1.25, armor: 1.35, r: 10.5 },
};

export const UPGRADES = {
  motor:      { label: 'Motor',      desc: '+3 % de velocidad punta y +6 % de aceleración por nivel' },
  neumaticos: { label: 'Neumáticos', desc: '+6 % de agarre por nivel' },
  suspension: { label: 'Suspensión', desc: 'Pierde menos fuera de pista y aterriza más suave' },
  nitro:      { label: 'Nitro',      desc: 'Una carga más de capacidad por nivel' },
  blindaje:   { label: 'Blindaje',   desc: '−15 % de daños por nivel' },
};
export const UP_PRICES = [500, 900, 1500, 2400];   // coste de los niveles 1 a 4
export const REPAIR_PER_PCT = 12;                  // dólares por cada 1 % de daños

export const CONDITIONS = {
  seco:           { label: 'Seco, de día',     grip: 1.0, night: false, rain: false },
  lluvia:         { label: 'Lluvia',           grip: 0.8, night: false, rain: true },
  noche:          { label: 'Noche',            grip: 1.0, night: true,  rain: false },
  'lluvia-noche': { label: 'Lluvia de noche',  grip: 0.8, night: true,  rain: true },
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

// Efecto de monitor de recreativa (sin curvatura): barras horizontales, rejilla de fósforo y viñeta
export const CRT = {
  period: 3,       // separación entre barras, en px de pantalla
  lines: 0.22,     // opacidad de las barras oscuras
  mask: 0.05,      // intensidad de las franjas verticales rojo, verde y azul
  vignette: 0.35,  // oscurecimiento de las esquinas
};

export function carSpec(id, up = {}) {
  const M = CAR_MODELS[id] || CAR_MODELS.compacto, l = (k) => up[k] || 0;
  return {
    model: CAR_MODELS[id] ? id : 'compacto',
    max: M.max * (1 + 0.03 * l('motor')),
    acc: M.acc * (1 + 0.06 * l('motor')),
    grip: M.grip * (1 + 0.06 * l('neumaticos')),
    off: M.off * (1 + 0.08 * l('suspension')),
    land: 1 - 0.15 * l('suspension'),
    mass: M.mass,
    armor: M.armor * (1 + 0.15 * l('blindaje')),
    nitroCap: 3 + l('nitro'),
    nitroStart: 2 + Math.ceil(l('nitro') / 2),
    r: M.r,
  };
}
