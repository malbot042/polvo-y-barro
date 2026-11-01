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

// Vuelta al mundo: dos circuitos por continente. Las vueltas están elegidas para que la carrera
// dure unos 1:20 con el piloto de referencia de la IA (un Grupo A de serie, en seco).
BUILTIN_RAW.push(
  // Europa
  mkTrack('Circuito de los Pirineos', 'circuito', 3, 'pradera',
    [[2006, 755, 'a'], [1868, 873, 'a'], [1882, 1009, 'a'], [1637, 1051, 'a'], [1609, 1240, 'a'], [1352, 1363, 'a'],
     [1110, 1253, 'a'], [786, 1319, 'a'], [668, 1102, 'a'], [618, 955, 'a'], [270, 937, 'a'], [218, 747, 'a'],
     [255, 612, 'a'], [512, 472, 'a'], [731, 398, 'a'], [773, 199, 'a'], [1120, 272, 'a'], [1315, 324, 'a'],
     [1498, 367, 'a'], [1686, 420, 'a'], [2025, 411, 'a'], [2197, 574, 'a']],
    [{ k: 'rampa', f: 0.564, o: 0 }, { k: 'nitro', f: 0.76, o: -1 }, { k: 'paja', f: 0.06, o: -76 }, { k: 'paja', f: 0.064, o: -76 }, { k: 'paja', f: 0.66, o: -76 }, { k: 'paja', f: 0.664, o: -76 }, { k: 'cono', f: 0.7, o: 30 }, { k: 'cono', f: 0.708, o: 30 }, { k: 'cono', f: 0.716, o: 30 }],
    [{ k: 'agua', f: 0.173, o: 4, r: 39 }, { k: 'barro', f: 0.432, o: 5, r: 36 }]),

  // Europa
  mkTrack('Lagos de Finlandia', 'circuito', 3, 'pradera',
    [[1949, 727, 't'], [1820, 892, 't'], [1872, 1127, 't'], [1606, 1321, 't'], [1159, 1114, 't'], [907, 1147, 't'],
     [566, 1134, 't'], [323, 966, 't'], [435, 746, 't'], [362, 567, 't'], [537, 343, 't'], [844, 192, 't'],
     [1164, 366, 't'], [1444, 354, 't'], [1754, 396, 't'], [1977, 584, 't']],
    [{ k: 'rampa', f: 0.605, o: 0 }, { k: 'nitro', f: 0.189, o: -14 }, { k: 'nitro', f: 0.815, o: 13 }, { k: 'paja', f: 0.471, o: -71 }, { k: 'paja', f: 0.476, o: -71 }, { k: 'paja', f: 0.976, o: -71 }, { k: 'paja', f: 0.981, o: -71 }, { k: 'cono', f: 0.352, o: 30 }, { k: 'cono', f: 0.36, o: 30 }, { k: 'cono', f: 0.368, o: 30 }],
    [{ k: 'agua', f: 0.2, o: 8, r: 43 }, { k: 'barro', f: 0.439, o: -7, r: 41 }]),

  // África
  mkTrack('Sabana de Kenia', 'circuito', 2, 'sabana',
    [[1763, 764, 't'], [1916, 889, 't'], [1738, 1001, 't'], [1786, 1262, 't'], [1421, 1356, 't'], [1098, 1367, 't'],
     [982, 1038, 't'], [957, 924, 't'], [648, 949, 't'], [457, 833, 't'], [177, 639, 't'], [304, 484, 't'],
     [902, 539, 't'], [1066, 582, 't'], [1162, 130, 't'], [1502, 157, 't'], [1761, 228, 't'], [1660, 510, 't'],
     [1494, 688, 't']],
    [{ k: 'rampa', f: 0.418, o: 0 }, { k: 'nitro', f: 0.272, o: 4 }, { k: 'nitro', f: 0.785, o: -7 }, { k: 'paja', f: 0.95, o: 71 }, { k: 'paja', f: 0.954, o: 71 }, { k: 'paja', f: 0.66, o: 71 }, { k: 'paja', f: 0.664, o: 71 }, { k: 'cono', f: 0.577, o: 30 }, { k: 'cono', f: 0.585, o: 30 }, { k: 'cono', f: 0.593, o: 30 }],
    [{ k: 'barro', f: 0.215, o: -6, r: 38 }]),

  // África
  mkTrack('Pistas del Atlas', 'circuito', 2, 'desierto',
    [[2240, 743, 't'], [1952, 933, 't'], [1519, 897, 't'], [1632, 1165, 't'], [1385, 1360, 't'], [1128, 1075, 'a'],
     [879, 1047, 'a'], [395, 1143, 'a'], [223, 962, 'a'], [501, 751, 't'], [390, 546, 't'], [398, 366, 't'],
     [829, 411, 't'], [997, 142, 't'], [1392, 208, 'a'], [1464, 439, 'a'], [1868, 409, 'a'], [1879, 603, 'a']],
    [{ k: 'rampa', f: 0.613, o: 0 }, { k: 'nitro', f: 0.07, o: 12 }, { k: 'nitro', f: 0.749, o: -13 }, { k: 'paja', f: 0.133, o: 71 }, { k: 'paja', f: 0.136, o: 71 }, { k: 'paja', f: 0.903, o: -76 }, { k: 'paja', f: 0.907, o: -76 }, { k: 'cono', f: 0.329, o: 30 }, { k: 'cono', f: 0.337, o: 30 }, { k: 'cono', f: 0.345, o: 30 }],
    [{ k: 'barro', f: 0.215, o: -5, r: 40 }]),

  // Asia
  mkTrack('Selva de Borneo', 'circuito', 2, 'selva',
    [[1876, 754, 't'], [1968, 914, 't'], [1661, 969, 't'], [1581, 1058, 't'], [1506, 1343, 't'], [1189, 1233, 't'],
     [933, 1253, 't'], [774, 1113, 't'], [344, 1094, 't'], [204, 928, 't'], [594, 765, 't'], [465, 607, 't'],
     [360, 384, 't'], [756, 386, 't'], [918, 184, 't'], [1179, 380, 't'], [1456, 341, 't'], [1772, 232, 't'],
     [2051, 394, 't'], [2099, 562, 't']],
    [{ k: 'rampa', f: 0.327, o: 0 }, { k: 'nitro', f: 0.783, o: 15 }, { k: 'paja', f: 0.033, o: -71 }, { k: 'paja', f: 0.037, o: -71 }, { k: 'paja', f: 0.499, o: 71 }, { k: 'paja', f: 0.503, o: 71 }, { k: 'cono', f: 0.439, o: 30 }, { k: 'cono', f: 0.447, o: 30 }, { k: 'cono', f: 0.455, o: 30 }],
    [{ k: 'barro', f: 0.202, o: 5, r: 42 }, { k: 'agua', f: 0.426, o: 1, r: 42 }, { k: 'barro', f: 0.756, o: 5, r: 38 }]),

  // Asia
  mkTrack('Bosques de Hokkaido', 'circuito', 2, 'nieve',
    [[2073, 738, 'n'], [1947, 899, 'n'], [1871, 1093, 'n'], [1527, 1042, 'n'], [1420, 1201, 'n'], [1065, 1365, 'n'],
     [756, 1287, 'n'], [524, 1190, 'n'], [275, 1034, 'n'], [370, 848, 'n'], [602, 711, 'n'], [523, 508, 'n'],
     [655, 420, 'n'], [987, 492, 'n'], [1109, 266, 'n'], [1465, 150, 'n'], [1750, 224, 'n'], [2039, 384, 'n'],
     [1997, 560, 'n']],
    [{ k: 'rampa', f: 0.328, o: 0 }, { k: 'nitro', f: 0.215, o: -2 }, { k: 'nitro', f: 0.872, o: -6 }, { k: 'paja', f: 0.534, o: 69 }, { k: 'paja', f: 0.538, o: 69 }, { k: 'paja', f: 0.154, o: 69 }, { k: 'paja', f: 0.159, o: 69 }, { k: 'cono', f: 0.749, o: 30 }, { k: 'cono', f: 0.757, o: 30 }, { k: 'cono', f: 0.765, o: 30 }],
    [{ k: 'agua', f: 0.153, o: 8, r: 40 }]),

  // América
  mkTrack('Altiplano Andino', 'circuito', 2, 'desierto',
    [[1952, 753, 't'], [2028, 943, 't'], [1907, 1204, 't'], [1434, 1310, 't'], [1094, 1367, 't'], [950, 988, 't'],
     [886, 896, 't'], [199, 917, 't'], [383, 634, 't'], [800, 574, 't'], [639, 228, 't'], [1027, 139, 't'],
     [1340, 539, 't'], [1678, 450, 't'], [2164, 528, 't']],
    [{ k: 'rampa', f: 0.332, o: 0 }, { k: 'nitro', f: 0.152, o: 14 }, { k: 'nitro', f: 0.75, o: 3 }, { k: 'paja', f: 0.947, o: -71 }, { k: 'paja', f: 0.951, o: -71 }, { k: 'paja', f: 0.317, o: 71 }, { k: 'paja', f: 0.321, o: 71 }, { k: 'cono', f: 0.11, o: 30 }, { k: 'cono', f: 0.118, o: 30 }, { k: 'cono', f: 0.126, o: 30 }],
    [{ k: 'barro', f: 0.189, o: -2, r: 41 }]),

  // América
  mkTrack('Selva de Yucatán', 'circuito', 2, 'selva',
    [[2202, 729, 't'], [2161, 914, 't'], [1709, 936, 't'], [1747, 1125, 't'], [1573, 1316, 't'], [1274, 1246, 't'],
     [1099, 1022, 'a'], [730, 1252, 'a'], [433, 1169, 'a'], [640, 908, 'a'], [451, 796, 'a'], [173, 653, 't'],
     [354, 540, 't'], [869, 548, 't'], [706, 204, 't'], [957, 147, 't'], [1258, 131, 'a'], [1436, 432, 'a'],
     [1612, 429, 'a'], [1812, 525, 'a'], [1941, 621, 'a']],
    [{ k: 'rampa', f: 0.595, o: 0 }, { k: 'nitro', f: 0.059, o: 2 }, { k: 'nitro', f: 0.909, o: 7 }, { k: 'paja', f: 0.54, o: -71 }, { k: 'paja', f: 0.544, o: -71 }, { k: 'paja', f: 0.11, o: 71 }, { k: 'paja', f: 0.114, o: 71 }, { k: 'cono', f: 0.295, o: 30 }, { k: 'cono', f: 0.303, o: 30 }, { k: 'cono', f: 0.311, o: 30 }],
    [{ k: 'barro', f: 0.219, o: -11, r: 42 }, { k: 'agua', f: 0.442, o: -6, r: 40 }, { k: 'barro', f: 0.767, o: 3, r: 38 }]),

  // Oceanía
  mkTrack('Desierto Rojo de Australia', 'circuito', 3, 'outback',
    [[1624, 742, 't'], [1503, 847, 't'], [1620, 1100, 't'], [1442, 1353, 't'], [1007, 1359, 't'], [510, 1214, 't'],
     [399, 1017, 't'], [720, 767, 't'], [823, 638, 't'], [749, 458, 't'], [912, 154, 't'], [1412, 143, 't'],
     [1791, 240, 't'], [1856, 596, 't']],
    [{ k: 'rampa', f: 0.464, o: 0 }, { k: 'nitro', f: 0.192, o: -9 }, { k: 'nitro', f: 0.774, o: -11 }, { k: 'paja', f: 0.033, o: 71 }, { k: 'paja', f: 0.038, o: 71 }, { k: 'paja', f: 0.546, o: 71 }, { k: 'paja', f: 0.551, o: 71 }, { k: 'cono', f: 0.779, o: 30 }, { k: 'cono', f: 0.787, o: 30 }, { k: 'cono', f: 0.795, o: 30 }],
    [{ k: 'barro', f: 0.193, o: 12, r: 43 }, { k: 'agua', f: 0.47, o: 7, r: 39 }]),

  // Oceanía
  mkTrack('Bosques de Nueva Zelanda', 'circuito', 2, 'pradera',
    [[2113, 770, 't'], [1823, 892, 't'], [1997, 1148, 't'], [1635, 1253, 't'], [1279, 1081, 't'], [1049, 1205, 'n'],
     [823, 1128, 'n'], [717, 1010, 'n'], [237, 985, 'n'], [160, 751, 't'], [448, 593, 't'], [489, 399, 't'],
     [869, 434, 't'], [1101, 464, 't'], [1401, 225, 'n'], [1524, 439, 'n'], [1728, 451, 'n'], [2160, 511, 'n']],
    [{ k: 'rampa', f: 0.638, o: 0 }, { k: 'nitro', f: 0.201, o: -5 }, { k: 'nitro', f: 0.86, o: 10 }, { k: 'paja', f: 0.057, o: 71 }, { k: 'paja', f: 0.061, o: 71 }, { k: 'paja', f: 0.79, o: -69 }, { k: 'paja', f: 0.795, o: -69 }, { k: 'cono', f: 0.877, o: 30 }, { k: 'cono', f: 0.885, o: 30 }, { k: 'cono', f: 0.893, o: 30 }],
    [{ k: 'agua', f: 0.192, o: 3, r: 41 }, { k: 'barro', f: 0.481, o: 10, r: 42 }]),
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

// Recreativa: tramos encadenados, más cortos (como mucho dos vueltas) y con menos margen
// de tiempo en cada uno (slack: tiempo que da cada control frente a un piloto de referencia)
export const ARCADE_STAGES = [
  { track: 'Circuito del Pinar', laps: 2, cond: 'seco', slack: 1.45 },
  { track: 'Tramo Puerto Blanco', laps: 1, cond: 'seco', slack: 1.38 },
  { track: 'Dunas Rojas', laps: 2, cond: 'seco', slack: 1.32 },
  { track: 'Bosque de Lluvia', laps: 1, cond: 'lluvia', slack: 1.28 },
  { track: 'Ocho de la Fábrica', laps: 2, cond: 'noche', slack: 1.24 },
  { track: 'Circuito del Embalse', laps: 2, cond: 'lluvia-noche', slack: 1.2 },
];
