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
