# Polvo y Barro

Juego de rally y off-road en 2D con vista cenital, para jugar en el navegador. Mezcla dos estilos de recreativa: el rally con cámara que sigue al coche, y el off-road de circuito cerrado con cuatro coches, saltos y nitro. Incluye un editor de circuitos.

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

### Modos

- **Rally**: tú solo contra el reloj. El copiloto canta la próxima curva (grado 1 = muy cerrada … 6 = casi recta, H = horquilla). Ves los parciales frente a tu récord y un fantasma repite tu mejor pasada.
- **Carrera**: tú contra tres rivales controlados por la IA.

### Coches

Cada coche es un compacto de rally visto desde arriba, con aletas ensanchadas, alerón, toma de aire en el techo, rejillas en el capó, faldillas, dorsal en el techo y, según la decoración, faros auxiliares. Hay cinco decoraciones para elegir. Se dibujan una vez en alta resolución y se ensucian con barro, polvo o nieve según la superficie. Las decoraciones se definen en `LIVERIES`, dentro de `js/car.js`.

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
js/tracks.js        circuitos incluidos
js/track.js         geometría del trazado, notas del copiloto y dibujo de la pista
js/car.js           coche de rally: sprite, decoraciones y suciedad
js/game.js          simulación, IA, cámara y HUD sobre el canvas
js/editor.js        editor de circuitos
js/main.js          interfaz, pestañas y bucle principal
tools/build-single.mjs  empaqueta todo en dist/polvo-y-barro.html (un solo archivo)
```

Para depurar desde la consola del navegador: `__pyb.game.cars`, `__pyb.game.track`, `__pyb.editor.def`.

## Cómo funciona

- El trazado es una curva Catmull-Rom que pasa por los puntos y se muestrea cada 8 px. Cada muestra guarda la posición, la normal, el ancho, la superficie y cuánto gira la pista en los siguientes ~100 px. De ahí salen las notas del copiloto y la velocidad de paso de la IA.
- La física funciona a paso fijo de 1/120 s. Cada superficie tiene su agarre lateral, su velocidad punta y su aceleración. El freno de mano reduce el agarre para derrapar.
- La pista se dibuja una sola vez en dos capas de 2400 × 1500: el suelo, y por encima las copas de los árboles. En cada fotograma solo se copia la parte visible.
- Los récords, los fantasmas y los circuitos guardados se quedan en el `localStorage` del navegador.
