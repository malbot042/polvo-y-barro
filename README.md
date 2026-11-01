# Polvo y Barro

Juego de rally y off-road en vista isométrica, para jugar en el navegador. Mezcla dos estilos de recreativa: el rally contra la cuenta atrás con cámara que sigue al coche, y el off-road de circuito cerrado con cuatro coches, saltos y nitro. Incluye un campeonato y un editor de circuitos.

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

### Controles

| Acción | Teclado | Móvil |
|---|---|---|
| Girar | ← → o A D | ◀ ▶ |
| Acelerar | ↑ o W | Gas |
| Frenar / marcha atrás | ↓ o S | Freno |
| Freno de mano (derrape) | Espacio | Mano |
| Nitro | Shift o N | N2O |
| Empezar | Enter | Empezar |
| Silenciar | M | Sonido |
| Pantalla completa | F (Esc para salir) | botón del marcador |

### Modos

- **Recreativa** (pestaña propia): seis tramos encadenados contra la cuenta atrás. Sales con los segundos justos para llegar al primer control, y cada control te da los del siguiente. El tiempo que sobra en meta pasa al tramo siguiente y suma 100 puntos por segundo. Cada control da 250 puntos, y los derrapes sobre la pista suman según lo cruzado que vayas, con un multiplicador que sube hasta ×5 si encadenas el derrape. Un golpe o una salida de pista te hacen perder el derrape en curso. Si se acaba el tiempo tienes 9 segundos para continuar (tres veces por partida); al continuar repites el tramo con los puntos que traías. Las diez mejores puntuaciones se guardan con tus iniciales.
- **Rally**: tú solo contra el reloj. El copiloto canta la próxima curva (grado 1 = muy cerrada … 6 = casi recta, H = horquilla). Ves los parciales frente a tu récord y un fantasma repite tu mejor pasada.
- **Carrera**: tú contra tres rivales controlados por la IA.

### Campeonato

Una temporada tiene seis pruebas que mezclan carreras y rallies, con lluvia, noche o ambas. En las carreras compites contra tres rivales en pista. En los rallies corres solo y te comparas con los tiempos de los rivales, que se calculan simulando su pasada por el mismo tramo.

- **Puntos**: 10 / 6 / 4 / 2. **Premios**: $1.500 / $900 / $550 / $300. Ganar la temporada da un bonus de $3.000.
- **Garaje**: tres coches.

  | Coche | Precio | Carácter |
  |---|---|---|
  | Compacto 4x4 | de serie | equilibrado |
  | Coupé clásico | $3.500 | el más rápido en firme, poco agarre, frágil |
  | Pick-up de raid | $3.000 | lento, pero apenas pierde fuera de pista y aguanta golpes |

- **Mejoras** por coche, con 4 niveles cada una ($500, $900, $1.500 y $2.400): motor, neumáticos, suspensión, nitro y blindaje.
- **Daños**: los golpes contra obstáculos y coches, y los aterrizajes duros, quitan velocidad punta, desvían la dirección y hacen que el coche eche humo. En el campeonato se arrastran de una prueba a otra hasta que pagas el taller ($12 por punto).
- Cada temporada nueva, los rivales llevan más mejoras. El progreso se guarda en el navegador.

### Condiciones

Seco, lluvia, noche y lluvia de noche. La lluvia quita un 20 % de agarre en asfalto y tierra, alarga la frenada y levanta agua al pasar. De noche solo se ve lo que alumbran los faros (más lejos con faros auxiliares) y las farolas de la salida y los controles. Con lluvia de noche hay relámpagos y truenos.

### Puentes

Si el trazado se cruza consigo mismo, el segundo paso por el cruce se convierte automáticamente en un puente. Los coches de arriba y los de abajo no chocan entre sí, y el puente tapa a los que pasan por debajo. Funciona igual en los circuitos del editor. El circuito *Ocho de la Fábrica* tiene uno.

### Sonido

Todo el audio se genera en el navegador con Web Audio, sin archivos:

- **Motor** con caja de seis marchas: sube de vueltas, cambia de marcha con un chasquido, petardea al soltar el gas y se revoluciona en el aire, al patinar o con el freno de mano. Durante la cuenta atrás puedes acelerar en parado.
- **Rodadura** distinta en asfalto, grava, nieve, barro, agua, hierba y arena, más un chirrido de neumáticos al derrapar sobre asfalto y viento con la velocidad.
- **Rivales** con su propio motor, que suena según la distancia y a izquierda o derecha.
- **Efectos**: golpes, conos, saltos y aterrizajes, nitro, latas, salpicaduras, cuenta atrás, parciales, vueltas, meta y récord.
- **Lluvia y truenos**, y **música** sintetizada en los menús (botón *Música*).
- **Copiloto por voz**: canta las notas en español (por ejemplo «izquierda tres y derecha cuatro larga») con la voz del sistema. Si el navegador no tiene voz en español, no suena.

`M` silencia el sonido. Los botones *Sonido* y *Copiloto* recuerdan la elección.

### Vista y conducción

El mundo se dibuja en isométrico (proyección 2:1): árboles, rocas, cactus, pacas, conos, latas, farolas, rampas, arcos de salida, control y meta, y puentes tienen volumen y se ordenan por profundidad con los coches. Los árboles que tapan tu coche se vuelven transparentes. La física sigue siendo 2D; solo cambia cómo se dibuja.

La conducción es arcade: con gas y el volante a fondo a buena velocidad, la trasera se suelta (derrape de potencia), el coche gira más mientras va cruzado y apenas pierde velocidad. Al contravolantear recupera el agarre enseguida. Los parámetros están en `PHYS` (`drift`, `counter`, `keep`, `yaw`) dentro de `js/config.js`.

### Efecto de monitor

El botón *CRT* (junto a los de sonido) simula una pantalla de recreativa sin curvarla: barras horizontales oscuras alineadas con los píxeles reales de la pantalla, franjas muy suaves de fósforo rojo, verde y azul, viñeta en las esquinas y un poco más de brillo para compensar. Viene encendido y se recuerda la elección. La intensidad se ajusta en `CRT` dentro de `js/config.js`. Las tarjetas de menú quedan por encima, nítidas.

### Coches

Cada coche es un compacto de rally, con aletas ensanchadas, alerón, toma de aire en el techo, rejillas en el capó, faldillas, dorsal en el techo y, según la decoración, faros auxiliares. Hay cinco decoraciones para elegir. Se dibujan una vez en alta resolución vistos desde arriba y, en el juego, se montan por capas a distintas alturas (ruedas, laterales, capó, cabina acristalada y techo) para verlos en tres cuartos. Se ensucian con barro, polvo o nieve según la superficie. Las decoraciones se definen en `LIVERIES`, dentro de `js/car.js`.

## Editor de circuitos

- **Trazado**: pulsa fuera de la pista para añadir un punto al final y sobre la pista para insertar uno en medio. Arrastra los puntos para moverlos.
- Al seleccionar un punto puedes elegir la **superficie** (asfalto, tierra, nieve) y el **ancho** del tramo que empieza en él.
- **Objetos**: barro, agua, rampa, nitro, árbol, roca, paja y cono. Arrastra cualquier objeto para moverlo.
- **Tipo**: circuito cerrado con vueltas, o tramo de salida a meta.
- **Entorno**: pradera, desierto o montaña nevada. Decide qué hay fuera de la pista.
- *Probar* lo carga en el juego, *Guardar* lo guarda en el navegador y *Exportar* da un texto JSON para compartir.
- Deshacer: Ctrl/Cmd + Z. Quitar el punto seleccionado: Supr.

### Formato de circuito

```json
{
  "name": "Mi circuito", "type": "circuito", "laps": 3, "theme": "pradera",
  "pts":     [{ "x": 400, "y": 1250, "s": "asfalto", "w": 100 }],
  "objs":    [{ "k": "rampa", "x": 1500, "y": 990, "a": 0.05 }, { "k": "nitro", "x": 600, "y": 400 }],
  "patches": [{ "k": "barro", "x": 1250, "y": 900, "r": 40 }]
}
```

El mundo mide 2400 × 1500 px. `type` es `circuito` o `tramo`. `s` puede ser `asfalto`, `tierra` o `nieve`, y `w` es el ancho en px (60–140). En las rampas, `a` es el ángulo en radianes; si falta, se orienta según la pista.

## Estructura

```
index.html          página y controles
css/style.css       estilos y paletas (azul y naranja, bosque, noche)
js/config.js        superficies, entornos, objetos y física (ajusta aquí el manejo)
js/tracks.js        circuitos incluidos, temporada y tramos de la recreativa
js/track.js         geometría del trazado, notas del copiloto y dibujo de la pista
js/car.js           coche de rally: sprite, decoraciones, suciedad y montaje por capas en isométrico
js/iso.js           objetos del escenario en isométrico: árboles, rocas, rampas, arcos, puentes…
js/game.js          simulación, IA, daños, lluvia, noche, puentes, recreativa y HUD
js/career.js        campeonato: dinero, garaje, mejoras y puntos
js/audio.js         sonido sintetizado, música y voz del copiloto
js/editor.js        editor de circuitos
js/main.js          interfaz, pestañas y bucle principal
tools/build-single.mjs  empaqueta todo en dist/polvo-y-barro.html (un solo archivo)
```

Para depurar desde la consola del navegador: `__pyb.game.cars`, `__pyb.game.track`, `__pyb.editor.def`.

## Cómo funciona

- El trazado es una curva Catmull-Rom que pasa por los puntos y se muestrea cada 8 px. Cada muestra guarda la posición, la normal, el ancho, la superficie y cuánto gira la pista en los siguientes ~100 px. De ahí salen las notas del copiloto y la velocidad de paso de la IA.
- La física funciona a paso fijo de 1/120 s. Cada superficie tiene su agarre lateral, su velocidad punta y su aceleración. El freno de mano reduce el agarre para derrapar.
- El suelo de la pista (firme, arcén, manchas, sombras) se dibuja una sola vez en un canvas de 2400 × 1500 visto desde arriba, y en cada fotograma se copia la parte visible con la transformación isométrica. Lo que tiene altura se dibuja aparte, ordenado por `x + y`.
- En la recreativa, el tiempo que da cada control sale de simular a un piloto de referencia con tu coche por el mismo tramo y multiplicarlo por un margen (`slack` en `ARCADE_STAGES`) que se reduce en cada tramo.
- Los récords, los fantasmas y los circuitos guardados se quedan en el `localStorage` del navegador.
