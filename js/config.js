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
  steer: 2.9,    // giro (rad/s) a plena dirección
  carR: 9,       // radio de colisión del coche
};
