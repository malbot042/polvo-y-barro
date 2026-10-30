// Circuitos incluidos. Los objetos se colocan con f (fracción del recorrido, 0–1)
// y o (desplazamiento lateral en px); resolveDef() los convierte a coordenadas.
import { DEFAULT_W } from './config.js';

const SURF_CODE = { a: 'asfalto', t: 'tierra', n: 'nieve' };

function mkTrack(name, type, laps, theme, pts, objs, patches) {
  return {
    name, type, laps, theme,
    pts: pts.map(([x, y, s, w]) => ({ x, y, s: SURF_CODE[s], w: w || DEFAULT_W[SURF_CODE[s]] })),
    objs, patches,
  };
}

export const BUILTIN_RAW = [
  mkTrack('Circuito del Pinar', 'circuito', 3, 'pradera',
    [[400, 1250, 'a'], [380, 820, 'a'], [480, 430, 'a'], [800, 250, 'a'], [1150, 300, 't'],
     [1300, 560, 't'], [1180, 820, 't'], [1350, 1010, 't'], [1700, 980, 't'], [1900, 720, 't'],
     [2050, 420, 'a'], [2230, 620, 'a'], [2150, 1060, 'a'], [1900, 1300, 'a'], [1300, 1340, 'a'], [800, 1360, 'a']],
    [{ k: 'rampa', f: 0.43, o: 0 },
     { k: 'nitro', f: 0.10, o: -22 }, { k: 'nitro', f: 0.52, o: 20 }, { k: 'nitro', f: 0.86, o: 0 },
     { k: 'paja', f: 0.185, o: 72 }, { k: 'paja', f: 0.20, o: 72 }, { k: 'paja', f: 0.215, o: 72 },
     { k: 'paja', f: 0.70, o: -72 }, { k: 'paja', f: 0.715, o: -72 },
     { k: 'cono', f: 0.65, o: -34 }, { k: 'cono', f: 0.66, o: -34 }, { k: 'cono', f: 0.67, o: -34 }],
    [{ k: 'barro', f: 0.35, o: 10, r: 40 }, { k: 'agua', f: 0.56, o: -12, r: 36 }]),

  mkTrack('Tramo Puerto Blanco', 'tramo', 1, 'nieve',
    [[200, 260, 'n'], [620, 200, 'n'], [930, 380, 'n'], [760, 650, 'n'], [420, 780, 'n'], [480, 1080, 'n'],
     [880, 1240, 'a'], [1300, 1120, 'a'], [1480, 820, 'n'], [1840, 700, 'n'], [2160, 880, 'n'],
     [2030, 1200, 'n'], [2260, 1380, 'n']],
    [{ k: 'rampa', f: 0.58, o: 0 }, { k: 'nitro', f: 0.30, o: 0 }, { k: 'nitro', f: 0.72, o: 14 },
     { k: 'paja', f: 0.25, o: 64 }, { k: 'paja', f: 0.265, o: 64 },
     { k: 'cono', f: 0.50, o: 30 }, { k: 'cono', f: 0.51, o: 30 }],
    []),

  mkTrack('Dunas Rojas', 'circuito', 4, 'desierto',
    [[520, 950, 't', 96], [470, 560, 't', 96], [700, 330, 't', 96], [1010, 430, 't', 96], [960, 720, 't', 96],
     [1260, 830, 't', 96], [1520, 560, 't', 96], [1820, 420, 't', 96], [2000, 760, 't', 96],
     [1790, 1110, 't', 96], [1230, 1170, 't', 96], [820, 1180, 't', 96]],
    [{ k: 'rampa', f: 0.15, o: 0 }, { k: 'rampa', f: 0.62, o: 0 },
     { k: 'nitro', f: 0.05, o: 18 }, { k: 'nitro', f: 0.38, o: -18 }, { k: 'nitro', f: 0.72, o: 0 },
     { k: 'cono', f: 0.88, o: 32 }, { k: 'cono', f: 0.89, o: 32 }, { k: 'cono', f: 0.90, o: 32 }],
    [{ k: 'barro', f: 0.30, o: 0, r: 46 }, { k: 'barro', f: 0.80, o: 15, r: 40 }, { k: 'agua', f: 0.50, o: -10, r: 40 }]),
];

// Circuitos nuevos de la fase 2
BUILTIN_RAW.push(
  mkTrack('Bosque de Lluvia', 'tramo', 1, 'pradera',
    [[150, 1350, 't'], [500, 1300, 't'], [700, 1050, 't'], [520, 800, 't'], [620, 520, 't'], [950, 420, 't'], [1150, 650, 't'],
     [1450, 700, 't'], [1600, 450, 't'], [1900, 300, 't'], [2200, 450, 't'], [2100, 800, 't'], [1800, 1000, 't'], [2050, 1250, 't'], [2300, 1350, 't']],
    [{ k: 'rampa', f: 0.36, o: 0 }, { k: 'nitro', f: 0.15, o: 0 }, { k: 'nitro', f: 0.62, o: -16 },
     { k: 'paja', f: 0.44, o: 66 }, { k: 'paja', f: 0.455, o: 66 }, { k: 'arbol', f: 0.27, o: -70 }, { k: 'arbol', f: 0.82, o: 72 }],
    [{ k: 'agua', f: 0.2, o: 8, r: 40 }, { k: 'barro', f: 0.55, o: 0, r: 44 }, { k: 'agua', f: 0.76, o: -12, r: 38 }]),

  mkTrack('Ocho de la Fábrica', 'circuito', 4, 'desierto',
    [[900, 1050, 'a', 92], [500, 1150, 't', 92], [300, 800, 't', 92], [500, 420, 't', 92], [900, 450, 'a', 92],
     [1500, 1050, 'a', 92], [1900, 1100, 'a', 92], [2100, 750, 'a', 92], [1900, 400, 'a', 92], [1500, 450, 'a', 92]],
    [{ k: 'nitro', f: 0.08, o: 0 }, { k: 'nitro', f: 0.6, o: 0 }, { k: 'rampa', f: 0.22, o: 0 },
     { k: 'cono', f: 0.7, o: 30 }, { k: 'cono', f: 0.71, o: 30 }, { k: 'cono', f: 0.72, o: 30 },
     { k: 'paja', f: 0.3, o: 70 }, { k: 'paja', f: 0.315, o: 70 }],
    [{ k: 'barro', f: 0.16, o: 0, r: 40 }]),

  mkTrack('Circuito del Embalse', 'circuito', 3, 'pradera',
    [[600, 1200, 'a'], [300, 1000, 'a'], [350, 600, 'a'], [650, 350, 't'], [1000, 250, 't'], [1300, 450, 't'], [1250, 750, 't'],
     [1500, 900, 'a'], [1850, 700, 'a'], [2150, 450, 'a'], [2250, 850, 'a'], [2050, 1250, 'a'], [1500, 1350, 't'], [1000, 1300, 't']],
    [{ k: 'rampa', f: 0.32, o: 0 }, { k: 'nitro', f: 0.05, o: 0 }, { k: 'nitro', f: 0.5, o: 18 }, { k: 'nitro', f: 0.85, o: -18 },
     { k: 'paja', f: 0.6, o: 70 }, { k: 'paja', f: 0.615, o: 70 }, { k: 'cono', f: 0.95, o: -30 }, { k: 'cono', f: 0.96, o: -30 }],
    [{ k: 'agua', f: 0.4, o: 0, r: 46 }, { k: 'agua', f: 0.88, o: 10, r: 38 }, { k: 'barro', f: 0.24, o: -10, r: 40 }]),
);

// Temporada del campeonato: circuito, modo y condiciones de cada prueba
export const SEASON = [
  { track: 'Circuito del Pinar', mode: 'carrera', cond: 'seco' },
  { track: 'Tramo Puerto Blanco', mode: 'rally', cond: 'seco' },
  { track: 'Bosque de Lluvia', mode: 'rally', cond: 'lluvia' },
  { track: 'Dunas Rojas', mode: 'carrera', cond: 'seco' },
  { track: 'Ocho de la Fábrica', mode: 'carrera', cond: 'noche' },
  { track: 'Circuito del Embalse', mode: 'carrera', cond: 'lluvia-noche' },
];
