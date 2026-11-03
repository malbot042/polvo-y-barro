// Circuitos incluidos: una vuelta al mundo con cuatro circuitos por continente. Son grandes (vueltas
// de 1,2 a 1,45 km), con curvas largas y abiertas y solo dos o tres cerradas por vuelta; sobre la
// pista solo hay barro, charcos y algún salto natural en las rectas. Los objetos se colocan con f
// (fracción del recorrido, 0–1) y o (desplazamiento lateral en px); resolveDef() los convierte.
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
  // ---- Europa ----
  mkTrack('Circuito de los Pirineos', 'circuito', 2, 'pradera',
    [[3154, 1172, 'a', 106], [3053, 1694, 'a', 106], [2526, 2053, 'a', 106], [1769, 1574, 'a', 106], [1094, 2080, 'a', 106],
     [457, 1754, 'a', 106], [1236, 1180, 'a', 106], [702, 829, 'a', 106], [1145, 372, 'a', 106], [1858, 181, 'a', 106],
     [2572, 307, 'a', 106], [3041, 802, 'a', 106]],
    [{ k: 'rampa', f: 0.724, o: 0 }],
    [{ k: 'agua', f: 0.227, o: 10, r: 45 }, { k: 'barro', f: 0.405, o: 1, r: 47 }, { k: 'agua', f: 0.77, o: -3, r: 41 }]),
  mkTrack('Lagos de Finlandia', 'circuito', 2, 'pradera',
    [[3327, 1182, 't', 96], [3071, 1617, 't', 96], [2679, 1903, 't', 96], [2184, 2086, 't', 96], [1467, 2197, 't', 96],
     [855, 1901, 't', 96], [375, 1627, 't', 96], [969, 1188, 't', 96], [366, 822, 't', 96], [926, 449, 't', 96],
     [1659, 764, 't', 96], [2076, 353, 't', 96], [2821, 451, 't', 96], [3268, 795, 't', 96]],
    [{ k: 'rampa', f: 0.305, o: 0 }],
    [{ k: 'agua', f: 0.125, o: 14, r: 42 }, { k: 'barro', f: 0.466, o: -10, r: 48 }, { k: 'agua', f: 0.724, o: -5, r: 47 }]),
  mkTrack('Montañas de Córcega', 'circuito', 2, 'pradera',
    [[3182, 1228, 'a', 106], [3258, 1621, 'a', 106], [2627, 2073, 'a', 106], [1969, 2094, 'a', 106], [1381, 2038, 'a', 106],
     [591, 1836, 'a', 106], [1088, 1319, 'a', 106], [327, 957, 'a', 106], [697, 580, 'a', 106], [1541, 751, 'a', 106],
     [1977, 186, 'a', 106], [2614, 354, 'a', 106], [2953, 831, 'a', 106]],
    [{ k: 'rampa', f: 0.202, o: 0 }, { k: 'rampa', f: 0.497, o: 0 }],
    [{ k: 'agua', f: 0.168, o: 10, r: 41 }, { k: 'barro', f: 0.372, o: 0, r: 43 }, { k: 'agua', f: 0.66, o: 14, r: 41 }]),
  mkTrack('Bosques de Gales', 'circuito', 2, 'pradera',
    [[3204, 1183, 't', 96], [3149, 1713, 't', 96], [2611, 1981, 't', 96], [2045, 2113, 't', 96], [1221, 2083, 't', 96],
     [708, 1861, 't', 96], [338, 1469, 't', 96], [1220, 1111, 't', 96], [669, 491, 't', 96], [1280, 283, 't', 96],
     [1897, 720, 't', 96], [2598, 484, 't', 96], [3124, 729, 't', 96]],
    [{ k: 'rampa', f: 0.465, o: 0 }],
    [{ k: 'agua', f: 0.118, o: 2, r: 51 }, { k: 'barro', f: 0.499, o: -10, r: 48 }, { k: 'agua', f: 0.721, o: 2, r: 47 }]),

  // ---- África ----
  mkTrack('Sabana de Kenia', 'circuito', 2, 'sabana',
    [[3316, 1147, 't', 96], [3107, 1695, 't', 96], [2605, 2013, 't', 96], [1994, 2164, 't', 96], [1291, 2091, 't', 96],
     [811, 1818, 't', 96], [488, 1435, 't', 96], [1170, 1107, 't', 96], [603, 523, 't', 96], [1209, 338, 't', 96],
     [1882, 785, 't', 96], [2668, 346, 't', 96], [3244, 761, 't', 96]],
    [{ k: 'rampa', f: 0.326, o: 0 }],
    [{ k: 'barro', f: 0.204, o: -15, r: 49 }, { k: 'agua', f: 0.55, o: 7, r: 46 }]),
  mkTrack('Pistas del Atlas', 'circuito', 2, 'desierto',
    [[3373, 1156, 't', 96], [3059, 1642, 't', 96], [2099, 1558, 't', 96], [1716, 2176, 'a', 106], [1041, 1999, 'a', 106],
     [540, 1660, 'a', 106], [1227, 1189, 't', 96], [410, 757, 't', 96], [924, 346, 't', 96], [1889, 251, 'a', 106],
     [2127, 847, 'a', 106], [3124, 678, 'a', 106]],
    [{ k: 'rampa', f: 0.683, o: 0 }],
    [{ k: 'barro', f: 0.206, o: -8, r: 44 }, { k: 'barro', f: 0.614, o: -12, r: 51 }]),
  mkTrack('Llanuras del Serengeti', 'circuito', 2, 'sabana',
    [[3223, 1166, 't', 96], [3154, 1625, 't', 96], [2157, 1602, 't', 96], [1730, 2128, 't', 96], [1174, 1939, 't', 96],
     [461, 1653, 't', 96], [1166, 1196, 't', 96], [395, 723, 't', 96], [1099, 352, 't', 96], [1789, 770, 't', 96],
     [2634, 374, 't', 96], [3056, 715, 't', 96]],
    [{ k: 'rampa', f: 0.323, o: 0 }],
    [{ k: 'barro', f: 0.122, o: 0, r: 42 }, { k: 'agua', f: 0.549, o: 4, r: 48 }]),
  mkTrack('Dunas del Sáhara', 'circuito', 2, 'desierto',
    [[3202, 1254, 't', 96], [3029, 1642, 't', 96], [2589, 1966, 't', 96], [1903, 2172, 't', 96], [1561, 1603, 't', 96],
     [701, 1805, 't', 96], [359, 1473, 't', 96], [1208, 1130, 't', 96], [834, 606, 't', 96], [1367, 334, 't', 96],
     [2046, 244, 't', 96], [2271, 796, 't', 96], [3151, 745, 't', 96]],
    [{ k: 'rampa', f: 0.471, o: 0 }, { k: 'rampa', f: 0.878, o: 0 }],
    [{ k: 'barro', f: 0.174, o: 3, r: 49 }, { k: 'barro', f: 0.54, o: 1, r: 51 }]),

  // ---- Asia ----
  mkTrack('Selva de Borneo', 'circuito', 2, 'selva',
    [[3399, 1161, 't', 96], [3235, 1628, 't', 96], [2544, 1964, 't', 96], [1960, 2073, 't', 96], [1245, 2110, 't', 96],
     [663, 1901, 't', 96], [1028, 1296, 't', 96], [262, 1016, 't', 96], [663, 618, 't', 96], [1228, 379, 't', 96],
     [1893, 790, 't', 96], [2581, 441, 't', 96], [3220, 730, 't', 96]],
    [{ k: 'rampa', f: 0.597, o: 0 }, { k: 'rampa', f: 0.175, o: 0 }],
    [{ k: 'barro', f: 0.113, o: 2, r: 52 }, { k: 'agua', f: 0.463, o: -11, r: 49 }, { k: 'barro', f: 0.783, o: -6, r: 45 }]),
  mkTrack('Bosques de Hokkaido', 'circuito', 2, 'nieve',
    [[3399, 1231, 'n', 92], [3145, 1727, 'n', 92], [2128, 1540, 'n', 92], [1752, 2031, 'n', 92], [1017, 2002, 'n', 92],
     [506, 1637, 'n', 92], [1207, 1212, 'n', 92], [417, 687, 'n', 92], [965, 400, 'n', 92], [1774, 309, 'n', 92],
     [2533, 490, 'n', 92], [3066, 674, 'n', 92]],
    [{ k: 'rampa', f: 0.741, o: 0 }, { k: 'rampa', f: 0.318, o: 0 }],
    [{ k: 'agua', f: 0.191, o: 4, r: 41 }, { k: 'barro', f: 0.539, o: -13, r: 43 }]),
  mkTrack('Caminos de Rajastán', 'circuito', 2, 'outback',
    [[3338, 1187, 't', 96], [2281, 1371, 't', 96], [2600, 1976, 't', 96], [2048, 2195, 't', 96], [1149, 2132, 'a', 106],
     [610, 1875, 'a', 106], [1132, 1317, 'a', 106], [339, 969, 't', 96], [586, 535, 't', 96], [1472, 735, 't', 96],
     [1890, 243, 'a', 106], [2633, 367, 'a', 106], [3079, 704, 'a', 106]],
    [{ k: 'rampa', f: 0.282, o: 0 }, { k: 'rampa', f: 0.675, o: 0 }],
    [{ k: 'barro', f: 0.189, o: -2, r: 51 }, { k: 'agua', f: 0.562, o: 4, r: 46 }]),
  mkTrack('Arrozales de Yunnan', 'circuito', 2, 'selva',
    [[3229, 1221, 't', 96], [3123, 1565, 't', 96], [2677, 1908, 't', 96], [1948, 1557, 't', 96], [1459, 2082, 't', 96],
     [770, 1966, 't', 96], [1265, 1372, 't', 96], [313, 1176, 't', 96], [351, 767, 't', 96], [953, 472, 't', 96],
     [1459, 295, 't', 96], [2201, 235, 't', 96], [2700, 431, 't', 96], [3268, 795, 't', 96]],
    [{ k: 'rampa', f: 0.709, o: 0 }],
    [{ k: 'barro', f: 0.234, o: 7, r: 45 }, { k: 'agua', f: 0.406, o: -10, r: 50 }, { k: 'barro', f: 0.76, o: -11, r: 51 }]),

  // ---- América ----
  mkTrack('Altiplano Andino', 'circuito', 2, 'desierto',
    [[3236, 1169, 't', 96], [2370, 1399, 't', 96], [2784, 2004, 't', 96], [2197, 2136, 't', 96], [1587, 1991, 't', 96],
     [946, 1932, 't', 96], [358, 1628, 't', 96], [201, 1165, 't', 96], [374, 814, 't', 96], [980, 503, 't', 96],
     [1495, 443, 't', 96], [2134, 278, 't', 96], [2219, 862, 't', 96], [3125, 750, 't', 96]],
    [{ k: 'rampa', f: 0.295, o: 0 }],
    [{ k: 'barro', f: 0.192, o: 7, r: 42 }, { k: 'barro', f: 0.575, o: 7, r: 43 }]),
  mkTrack('Selva de Yucatán', 'circuito', 2, 'selva',
    [[3367, 1255, 't', 96], [2333, 1446, 't', 96], [2484, 2011, 't', 96], [1679, 2100, 'a', 106], [727, 1956, 'a', 106],
     [1101, 1312, 'a', 106], [503, 922, 't', 96], [907, 611, 't', 96], [1629, 186, 't', 96], [2086, 827, 'a', 106],
     [3157, 685, 'a', 106]],
    [{ k: 'rampa', f: 0.244, o: 0 }, { k: 'rampa', f: 0.607, o: 0 }],
    [{ k: 'barro', f: 0.18, o: 1, r: 42 }, { k: 'agua', f: 0.413, o: 0, r: 49 }, { k: 'barro', f: 0.696, o: -5, r: 45 }]),
  mkTrack('Bosques de la Patagonia', 'circuito', 2, 'nieve',
    [[3181, 1212, 't', 96], [2921, 1697, 't', 96], [2066, 1589, 't', 96], [1548, 2207, 'n', 92], [900, 1869, 'n', 92],
     [537, 1395, 'n', 92], [1212, 1071, 't', 96], [787, 410, 't', 96], [1656, 277, 't', 96], [2397, 405, 'n', 92],
     [3102, 708, 'n', 92]],
    [{ k: 'rampa', f: 0.689, o: 0 }],
    [{ k: 'agua', f: 0.132, o: 11, r: 50 }, { k: 'barro', f: 0.538, o: 10, r: 49 }]),
  mkTrack('Sierra de Guanajuato', 'circuito', 2, 'desierto',
    [[3270, 1139, 't', 96], [2978, 1643, 't', 96], [2124, 1520, 't', 96], [1801, 2146, 'a', 106], [1121, 2062, 'a', 106],
     [455, 1753, 'a', 106], [1170, 1203, 't', 96], [557, 713, 't', 96], [1201, 557, 't', 96], [1858, 308, 'a', 106],
     [2216, 793, 'a', 106], [3165, 668, 'a', 106]],
    [{ k: 'rampa', f: 0.302, o: 0 }, { k: 'rampa', f: 0.877, o: 0 }],
    [{ k: 'barro', f: 0.235, o: -12, r: 51 }, { k: 'barro', f: 0.604, o: -5, r: 52 }]),

  // ---- Oceanía ----
  mkTrack('Desierto Rojo de Australia', 'circuito', 2, 'outback',
    [[3188, 1157, 't', 96], [3189, 1707, 't', 96], [2628, 2073, 't', 96], [1766, 2131, 't', 96], [1021, 1997, 't', 96],
     [479, 1636, 't', 96], [1129, 1209, 't', 96], [459, 643, 't', 96], [1050, 417, 't', 96], [1759, 282, 't', 96],
     [2121, 820, 't', 96], [3091, 707, 't', 96]],
    [{ k: 'rampa', f: 0.253, o: 0 }, { k: 'rampa', f: 0.685, o: 0 }],
    [{ k: 'barro', f: 0.164, o: 5, r: 43 }, { k: 'agua', f: 0.509, o: -10, r: 42 }]),
  mkTrack('Bosques de Nueva Zelanda', 'circuito', 2, 'pradera',
    [[3262, 1192, 't', 96], [3170, 1696, 't', 96], [2291, 1644, 't', 96], [1985, 2103, 't', 96], [1319, 2078, 'n', 92],
     [731, 1842, 'n', 92], [320, 1477, 'n', 92], [1042, 1066, 't', 96], [785, 657, 't', 96], [1342, 282, 't', 96],
     [2053, 193, 'n', 92], [2633, 329, 'n', 92], [3001, 827, 'n', 92]],
    [{ k: 'rampa', f: 0.364, o: 0 }, { k: 'rampa', f: 0.766, o: 0 }],
    [{ k: 'agua', f: 0.167, o: 7, r: 51 }, { k: 'barro', f: 0.479, o: 12, r: 45 }, { k: 'agua', f: 0.733, o: -3, r: 42 }]),
  mkTrack('Costa de Tasmania', 'circuito', 2, 'pradera',
    [[3250, 1207, 't', 96], [2293, 1388, 't', 96], [2578, 1884, 't', 96], [2011, 2093, 't', 96], [1164, 2136, 'a', 106],
     [554, 1840, 'a', 106], [243, 1407, 'a', 106], [556, 968, 't', 96], [805, 620, 't', 96], [1317, 374, 't', 96],
     [1899, 186, 'a', 106], [2163, 850, 'a', 106], [3212, 720, 'a', 106]],
    [{ k: 'rampa', f: 0.874, o: 0 }, { k: 'rampa', f: 0.31, o: 0 }],
    [{ k: 'agua', f: 0.207, o: 10, r: 43 }, { k: 'barro', f: 0.474, o: -11, r: 50 }, { k: 'agua', f: 0.647, o: 9, r: 46 }]),
  mkTrack('Islas Fiyi', 'circuito', 2, 'selva',
    [[3274, 1148, 't', 96], [3172, 1721, 't', 96], [2690, 1983, 't', 96], [2030, 2118, 't', 96], [1294, 2031, 't', 96],
     [640, 1823, 't', 96], [1086, 1329, 't', 96], [232, 998, 't', 96], [671, 494, 't', 96], [1220, 382, 't', 96],
     [1843, 860, 't', 96], [2666, 400, 't', 96], [3143, 706, 't', 96]],
    [{ k: 'rampa', f: 0.248, o: 0 }, { k: 'rampa', f: 0.591, o: 0 }],
    [{ k: 'barro', f: 0.18, o: -9, r: 45 }, { k: 'agua', f: 0.466, o: 12, r: 45 }, { k: 'barro', f: 0.654, o: -9, r: 42 }]),
];

// Temporada del campeonato: circuito, modo y condiciones de cada prueba
export const SEASON = [
  { track: 'Lagos de Finlandia', mode: 'carrera', cond: 'seco' },
  { track: 'Sabana de Kenia', mode: 'rally', cond: 'seco' },
  { track: 'Selva de Borneo', mode: 'rally', cond: 'lluvia' },
  { track: 'Altiplano Andino', mode: 'carrera', cond: 'seco' },
  { track: 'Bosques de Hokkaido', mode: 'carrera', cond: 'noche' },
  { track: 'Bosques de Nueva Zelanda', mode: 'carrera', cond: 'lluvia-noche' },
];

// Recreativa: tramos encadenados, de una vuelta y con menos margen de tiempo
// en cada uno (slack: tiempo que da cada control frente a un piloto de referencia)
export const ARCADE_STAGES = [
  { track: 'Circuito de los Pirineos', laps: 1, cond: 'seco', slack: 1.45 },
  { track: 'Llanuras del Serengeti', laps: 1, cond: 'seco', slack: 1.38 },
  { track: 'Caminos de Rajastán', laps: 1, cond: 'seco', slack: 1.32 },
  { track: 'Sierra de Guanajuato', laps: 1, cond: 'lluvia', slack: 1.28 },
  { track: 'Bosques de Gales', laps: 1, cond: 'noche', slack: 1.24 },
  { track: 'Islas Fiyi', laps: 1, cond: 'lluvia-noche', slack: 1.2 },
];
