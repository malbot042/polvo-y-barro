# Polvo y Barro

Juego de rally y off-road en vista isométrica, para jugar en el navegador. Mezcla dos estilos de recreativa: el rally contra la cuenta atrás con cámara que sigue al coche, y el off-road de circuito cerrado con cuatro coches y saltos. Incluye un campeonato y un editor de circuitos.

Está hecho con HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Jugar

Los módulos ES necesitan un servidor local, así que no basta con abrir `index.html` con doble clic:

```bash
python3 -m http.server 8000
# o bien
npx serve .
```

Después abre http://localhost:8000.

Para publicarlo con GitHub Pages: en **Settings → Pages**, elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.

### Pantalla

El juego ocupa toda la ventana. Arriba hay un menú que abre ventanas por encima: *Carrera rápida* (circuito, coche, decoración, condiciones y modo), *Recreativa*, *Campeonato*, *Editor*, *Opciones* (sonido, copiloto, música, efecto CRT y paleta) y *Ayuda*. Mientras hay una ventana abierta el juego queda en pausa; se cierra con la ✕, con `Esc` o pulsando fuera. *Reiniciar* y pantalla completa están en el marcador.

### Controles

| Acción | Teclado | Móvil |
|---|---|---|
| Girar | ← → o A D | ◀ ▶ |
| Acelerar | ↑ o W | Gas |
| Frenar / marcha atrás | ↓ o S | Freno |
| Freno de mano (derrape) | Espacio | Mano |
| Empezar | Enter | Empezar |
| Silenciar | M | Sonido |
| Pantalla completa | F (Esc para salir) | botón del marcador |
| Cerrar una ventana | Esc | ✕ o tocar fuera |

### Modos

- **Recreativa** (menú *Recreativa*): seis tramos encadenados contra la cuenta atrás. Sales con los segundos justos para llegar al primer control, y cada control te da los del siguiente. El tiempo que sobra en meta pasa al tramo siguiente y suma 100 puntos por segundo. Cada control da 250 puntos, y los derrapes sobre la pista suman según lo cruzado que vayas, con un multiplicador que sube hasta ×5 si encadenas el derrape. Un golpe o una salida de pista te hacen perder el derrape en curso. Si se acaba el tiempo tienes 9 segundos para continuar (tres veces por partida); al continuar repites el tramo con los puntos que traías. Las diez mejores puntuaciones se guardan con tus iniciales.
- **Rally**: tú solo contra el reloj. El copiloto canta la próxima curva (grado 1 = muy cerrada … 6 = casi recta, H = horquilla). Ves los parciales frente a tu récord y un fantasma repite tu mejor pasada.
- **Carrera**: tú contra tres rivales controlados por la IA.

### Circuitos

Hay 20 circuitos, cuatro por continente, con vueltas de 1,15 a 1,55 km. Las formas varían: contornos en L, U, T o escalera, manchas alargadas en distintas direcciones y cuatro ochos con puente. La mitad se recorren en sentido horario y la otra mitad en antihorario, y cada uno sale desde un punto distinto. Las carreras son de dos vueltas (tres en Córcega).

| Continente | Circuitos |
|---|---|
| Europa | Circuito de los Pirineos (asfalto) · Lagos de Finlandia (tierra rápida) · Montañas de Córcega (asfalto) · Bosques de Gales (tierra) |
| África | Sabana de Kenia · Pistas del Atlas (desierto) · Llanuras del Serengeti (sabana rápida) · Dunas del Sáhara (desierto) |
| Asia | Selva de Borneo · Bosques de Hokkaido (nieve) · Caminos de Rajastán (tierra roja) · Arrozales de Yunnan (selva) |
| América | Altiplano Andino (desierto) · Selva de Yucatán · Bosques de la Patagonia (nieve) · Sierra de Guanajuato (desierto) |
| Oceanía | Desierto Rojo de Australia · Bosques de Nueva Zelanda · Costa de Tasmania · Islas Fiyi (selva) |

Los trazados están generados para no solaparse (salvo el cruce de los ochos) y combinar curvas largas y abiertas con dos o tres cerradas por vuelta. La temporada del campeonato y los seis tramos de la recreativa recorren varios continentes.

### Campeonato

Una temporada tiene seis pruebas que mezclan carreras y rallies, con lluvia, noche o ambas. En las carreras compites contra tres rivales en pista. En los rallies corres solo y te comparas con los tiempos de los rivales, que se calculan simulando su pasada por el mismo tramo.

- **Puntos**: 10 / 6 / 4 / 2. **Premios**: $1.500 / $900 / $550 / $300. Ganar la temporada da un bonus de $3.000.
- **Garaje**: los 31 coches campeones del mundo (ver *Coches*). Empiezas con el Fiat 131 Abarth y $1.200; los precios van de $600 por un clásico a $9.400 por un Rally1. Los rivales cambian de coche cada temporada: clásicos de los 70, luego Grupo A, WRC y, al final, Rally1.

- **Mejoras** por coche, con 4 niveles cada una ($500, $900, $1.500 y $2.400): motor, neumáticos, suspensión y blindaje.
- **Daños**: los golpes contra obstáculos y coches, y los aterrizajes duros, quitan velocidad punta, desvían la dirección y hacen que el coche eche humo. En el campeonato se arrastran de una prueba a otra hasta que pagas el taller ($12 por punto).
- Cada temporada nueva, los rivales llevan más mejoras. El progreso se guarda en el navegador.

### Condiciones

Seco, lluvia, noche y lluvia de noche. La lluvia quita un 20 % de agarre en asfalto y tierra, alarga la frenada y levanta agua al pasar. De noche hay luz de luna azulada: se ve la pista, y los faros (más lejos con faros auxiliares) y las farolas de la salida y los controles alumbran con bordes suaves. La intensidad se ajusta en `NIGHT` dentro de `js/config.js`. Con lluvia de noche hay relámpagos y truenos.

### Puentes

Si el trazado se cruza consigo mismo, el segundo paso por el cruce se convierte automáticamente en un puente. Los coches de arriba y los de abajo no chocan entre sí, y el puente tapa a los que pasan por debajo. Los ochos de Córcega, el Sáhara, Yucatán y Tasmania tienen uno, y funciona igual en los circuitos del editor.

### Sonido

Todo el audio se genera en el navegador con Web Audio, sin archivos:

- **Motor** de cuatro cilindros hecho con explosiones: cada muestra en bucle guarda decenas de explosiones (golpe grave, resonancia del escape y chasquido) con pequeñas diferencias entre cilindros, y se reproduce más rápida o más lenta según las vueltas de la caja. Hay muestras para bajas y altas vueltas y para con gas (más áspera) y sin gas (apagada), que se mezclan sin cortes. Además: golpe sordo al cambiar, petardeo al soltar el gas, silbido y soplido del turbo (de los Grupo B en adelante), y se revoluciona en el aire, al patinar o con el freno de mano. En la cuenta atrás puedes acelerar en parado. Los rivales usan el mismo motor.
- **Rodadura** distinta en asfalto, grava, nieve, barro, agua, hierba y arena, más un chirrido de neumáticos al derrapar sobre asfalto y viento con la velocidad.
- **Rivales** con su propio motor, que suena según la distancia y a izquierda o derecha.
- **Efectos**: golpes, conos, saltos y aterrizajes, salpicaduras, cuenta atrás, parciales, vueltas, meta y récord.
- **Lluvia y truenos**, y **música** sintetizada en los menús (botón *Música*).
- **Copiloto por voz**: canta las notas en español (por ejemplo «izquierda tres y derecha cuatro larga») con la voz del sistema. Si el navegador no tiene voz en español, no suena.

`M` silencia el sonido. Los botones *Sonido* y *Copiloto* recuerdan la elección.

### Vista y conducción

El mundo se dibuja en isométrico (proyección 2:1): árboles, rocas, cactus, pacas, conos, farolas, arcos de salida, control y meta, y puentes tienen volumen y se ordenan por profundidad con los coches. Los árboles que tapan tu coche se vuelven transparentes. La física sigue siendo 2D; solo cambia cómo se dibuja.

La conducción es arcade: con gas y el volante a fondo a buena velocidad, la trasera se suelta (derrape de potencia) y el coche gira más mientras va cruzado; derrapar nunca acelera el coche. Al contravolantear recupera el agarre enseguida. Los parámetros están en `PHYS` (`drift`, `counter`, `yaw`) dentro de `js/config.js`.

Hay una caja de seis marchas largas, siempre automática para todos. Cada coche tiene la velocidad punta de su época con desarrollos de rally (de los 175 km/h del Alpine A110 a los 215 del Peugeot 205 T16 E2; los WRC y Rally1 rondan los 205–213), que se ve en el garaje y en el selector de coche y sube un poco con las mejoras de motor. Cada marcha llega hasta una parte de esa punta y las cortas empujan más; el empuje sigue una curva de par según las vueltas y la resistencia del aire hace que los últimos km/h cuesten. Mientras pisas el gas el coche acelera hasta su punta, que depende del terreno (barro, agua, fuera de pista…), de la lluvia y de los daños. Abajo a la derecha hay un velocímetro de aguja con cuentavueltas en la corona, la marcha y un cuentakilómetros de rodillos con lo recorrido. Se ajusta en `top` de cada coche en `CAR_MODELS`, `PHYS.gears`, `PHYS.gearAcc`, `PHYS.drag` y `torque()` (`config.js`).

### Efecto de monitor

El botón *CRT* (en *Opciones*) simula una pantalla de recreativa sin curvarla: barras horizontales oscuras alineadas con los píxeles reales de la pantalla, franjas muy suaves de fósforo rojo, verde y azul, viñeta en las esquinas y un poco más de brillo para compensar. Viene encendido y se recuerda la elección. La intensidad se ajusta en `CRT` dentro de `js/config.js`. Las tarjetas de menú quedan por encima, nítidas.

### Coches

Solo hay coches que han ganado el Mundial de Rallies, según la categoría [World Rally Championship–winning cars](https://en.wikipedia.org/wiki/Category:World_Rally_championship%E2%80%93winning_cars) de la Wikipedia en inglés: 31 coches, agrupados por épocas.

| Época | Coches |
|---|---|
| Clásicos de los 70 | Alpine A110, Lancia Stratos, Fiat 131 Abarth, Ford Escort RS1800, Opel Ascona 400 |
| Grupo B | Audi Quattro, Lancia Rally 037, Peugeot 205 Turbo 16, Peugeot 205 Turbo 16 E2 |
| Grupo A | Lancia Delta HF, Delta HF 4WD y Delta Integrale, Toyota Celica GT-Four y Celica Turbo 4WD, Mitsubishi Lancer Evolution |
| Kit Car | Škoda Felicia Kit Car, Citroën Xsara Kit Car |
| World Rally Car | Subaru Impreza WRC, Ford Escort WRC, Toyota Corolla WRC, Peugeot 206 WRC, Citroën Xsara WRC, Ford Focus RS WRC, Citroën C4 WRC, Citroën DS3 WRC, Volkswagen Polo R WRC, Ford Fiesta WRC, Toyota Yaris WRC, Hyundai i20 Coupe WRC |
| Rally1 híbridos | Toyota GR Yaris Rally1, Hyundai i20 N Rally1 |

Las prestaciones salen de la época (los clásicos son de propulsión y más lentos; los Grupo B, los que más aceleran; los WRC y Rally1, los de más agarre) con retoques por coche, en `CAR_MODELS` dentro de `js/config.js`. Las carrocerías se generan a partir de sus proporciones (largo, ancho, aletas, tipo de carrocería, alerón, faros y tomas de aire) en `BODIES`, dentro de `js/car.js`. Son aproximaciones dibujadas, no reproducciones exactas. Cada coche lleva sus colores de época, sin logotipos ni patrocinadores reales; también hay siete decoraciones genéricas para elegir. La decoración se ve también en los laterales.

## Editor de circuitos

- **Trazado**: pulsa fuera de la pista para añadir un punto al final y sobre la pista para insertar uno en medio. Arrastra los puntos para moverlos.
- Al seleccionar un punto puedes elegir la **superficie** (asfalto, tierra, nieve) y el **ancho** del tramo que empieza en él.
- **Objetos**: barro, agua, salto, árbol, roca, paja y cono. El salto es un cambio de rasante natural que se centra solo en la pista y la cruza de lado a lado; ponlo en una recta. Arrastra cualquier objeto para moverlo.
- **Tipo**: circuito cerrado con vueltas, o tramo de salida a meta.
- **Entorno**: pradera, desierto, montaña nevada, selva, sabana o tierra roja. Decide qué hay fuera de la pista y qué árboles y rocas lo decoran.
- *Probar* lo carga en el juego, *Guardar* lo guarda en el navegador y *Exportar* da un texto JSON para compartir.
- Deshacer: Ctrl/Cmd + Z. Quitar el punto seleccionado: Supr.

### Formato de circuito

```json
{
  "name": "Mi circuito", "type": "circuito", "laps": 3, "theme": "pradera",
  "pts":     [{ "x": 400, "y": 1250, "s": "asfalto", "w": 100 }],
  "objs":    [{ "k": "rampa", "x": 1500, "y": 990 }, { "k": "arbol", "x": 600, "y": 400 }],
  "patches": [{ "k": "barro", "x": 1250, "y": 900, "r": 40 }]
}
```

El mundo mide 3600 × 2400 px (los circuitos guardados con la versión anterior, de 2400 × 1500, siguen valiendo). `type` es `circuito` o `tramo`. `s` puede ser `asfalto`, `tierra` o `nieve`, y `w` es el ancho en px (60–140). `rampa` es un salto natural: se coloca en el punto de la pista más cercano y se orienta solo según la marcha.

## Versiones

La versión del juego sale junto al logo y en Ayuda, con la lista de novedades de cada una. Se numera `0.MENOR.PARCHE`: cada cambio de funcionalidad publicado sube la menor y cada arreglo sube el parche. El número y la lista están en `VERSION` y `CHANGES` (`js/config.js`); al cambiar de versión se añade arriba de `CHANGES` lo que trae.

## Estructura

```
index.html          página y controles
css/style.css       estilos y paletas (azul y naranja, bosque, noche)
js/config.js        superficies, entornos, objetos y física (ajusta aquí el manejo)
js/tracks.js        circuitos incluidos, temporada y tramos de la recreativa
js/track.js         geometría del trazado, notas del copiloto y dibujo de la pista
js/car.js           coche de rally: sprite, decoraciones, suciedad y montaje por capas en isométrico
js/iso.js           objetos del escenario en isométrico: árboles, rocas, arcos, puentes…
js/game.js          simulación, IA, daños, lluvia, noche, puentes, recreativa y HUD
js/career.js        campeonato: dinero, garaje, mejoras y puntos
js/audio.js         sonido sintetizado, música y voz del copiloto
js/editor.js        editor de circuitos
js/main.js          interfaz, ventanas y bucle principal
tools/build-single.mjs  empaqueta todo en dist/polvo-y-barro.html (un solo archivo)
```

Para depurar desde la consola del navegador: `__pyb.game.cars`, `__pyb.game.track`, `__pyb.editor.def`.

## Cómo funciona

- El trazado es una curva Catmull-Rom que pasa por los puntos y se muestrea cada 8 px. Cada muestra guarda la posición, la normal, el ancho, la superficie y cuánto gira la pista en los siguientes ~100 px. De ahí salen las notas del copiloto y la velocidad de paso de la IA.
- La física funciona a paso fijo de 1/120 s. Cada superficie tiene su agarre lateral, su velocidad punta y su aceleración. El freno de mano reduce el agarre para derrapar.
- El suelo de la pista (firme, arcén, manchas, sombras) se dibuja una sola vez en un canvas de 3600 × 2400 visto desde arriba, y en cada fotograma se copia la parte visible con la transformación isométrica. Lo que tiene altura se dibuja aparte, ordenado por `x + y`.
- En la recreativa, el tiempo que da cada control sale de simular a un piloto de referencia con tu coche por el mismo tramo y multiplicarlo por un margen (`slack` en `ARCADE_STAGES`) que se reduce en cada tramo.
- Los récords, los fantasmas y los circuitos guardados se quedan en el `localStorage` del navegador.
