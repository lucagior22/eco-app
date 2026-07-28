# Detección de perillas — `/pedal` y `/api/pedal/detect`

Funcionamiento técnico y, sobre todo, los límites medidos de la detección. Complementa las entradas de `DECISIONS.md`.

---

## Qué hace y qué no

No identifica marca ni modelo de pedal. Ubica círculos oscuros (perillas) y estima hacia qué hora del reloj apunta la marca de cada una, que es como un músico describe la posición de una perilla ("está a las 3"). Esa elección evita tener que saber dónde está el 0% y el 100% de cada perilla, que varía según el modelo.

---

## Pipeline

```
5 capturas (ráfaga del cliente, 400 ms entre cada una)
  └─ por cada foto:
       ├─ resize a 1000 px de ancho (parámetros de Hough independientes de la resolución)
       ├─ HoughCircles ×3 (sin ecualizar, equalizeHist, CLAHE) → unión
       ├─ merge de duplicados (piso 110 px)
       ├─ descarte por brillo medio (KNOB_MAX_MEAN) → saca footswitch, jacks, fondo
       ├─ detect_pointer_angle → contraste lateral, banda 0.60-1.15 r
       └─ descarte de outliers espaciales + agrupamiento en filas
  └─ vote(): se quedan solo las fotos con el mismo layout y se vota por posición
       └─ value = moda si ≥3 fotos coinciden, si no null
```

---

## Los tres arreglos y qué aportó cada uno

Todo lo de abajo está medido sobre las **92 fotografías reales** de un mismo pedal que quedaron en `tmp/debug_captures/` durante el desarrollo. Como el pedal estaba quieto entre disparos dentro de cada sesión, la consistencia de las lecturas es una medida objetiva de calidad.

### 1. La banda de búsqueda de la marca miraba fuera de la perilla

Era una banda **absoluta** de 30 a 115 px. Los radios detectados van de 45 a 110 px (mediana 63): la banda excedía el radio de la propia perilla en **las 280 detecciones**. El algoritmo terminaba mirando el panel del pedal, la serigrafía blanca ("SUB", "SUB 2") y hasta la mesa de madera del fondo. Dibujando el resultado sobre la foto se ve que las direcciones elegidas apuntan literalmente a la madera.

El síntoma delator eran los puntajes de contraste: iban de 87 a 229 contra un umbral de 15 que **nunca rechazaba nada**. Un fondo brillante siempre gana por goleada contra una marca fina.

Ahora la banda es **relativa al radio detectado**, de 0.60 a 1.15 r. La marca vive cerca del borde de la cara superior, no en el centro: la perilla se ve en perspectiva y su cara superior queda desplazada respecto de la silueta.

### 2. Puntuar por brillo no distingue la marca de un reflejo

La marca es una **línea fina**; un reflejo especular sobre el plástico glossy es una **mancha ancha**. Por brillo absoluto son indistinguibles, y el reflejo suele ganar.

El puntaje ahora es el brillo del rayo **menos el de sus vecinos angulares** a ±20°. Una línea fina brilla mucho más que sus vecinos; una mancha ancha brilla parecido a sus vecinos y se cancela sola.

Consistencia de lectura por posición, sobre las mismas fotos:

| Configuración | Consistencia |
| --- | --- |
| Banda fija + brillo absoluto (original) | ~59 % |
| Banda relativa + brillo absoluto | 64 % |
| **Banda relativa + contraste lateral** | **67 %** |

Se probó además refinar el ángulo con un centroide ponderado en vez de quedarse con el rayo ganador: subió a 67.9 %, dentro del ruido. No se incorporó, porque agrega código sin comprar nada.

### 3. El umbral de fusión colapsaba perillas vecinas

`MERGE_DIST_MIN_PX` estaba en 150 px, **más del doble** de `HOUGH_MIN_DIST` (80). En una grilla 2×2 con perillas de ~60 px de radio, dos perillas vecinas caen dentro de esos 150 px y se fusionaban en una sola. Bajarlo a 110 px sube las detecciones correctas de 4 perillas del **46 % al 58 %**.

---

## Votación entre capturas: el cambio de fondo

Ninguno de los arreglos anteriores hace confiable la lectura de una sola foto. El techo medido es ~68 % de consistencia, y —lo más grave— **fotografiando el pedal quieto, la misma perilla puede leerse distinto entre tomas consecutivas**.

Por eso el cliente manda una **ráfaga de 5 capturas** y el servidor vota. Simulado sobre las fotos reales:

| Capturas | Mínimo acuerdo | Responde en | Acierta si responde |
| --- | --- | --- | --- |
| 1 | — | 100 % | 68 % |
| 5 | 2 de 5 | 99.7 % | 86.7 % |
| **5** | **3 de 5** | **80.2 %** | **93.4 %** |
| 5 | 4 de 5 | 43.5 % | 98.2 % |
| 7 | 5 de 7 | 50.6 % | 98.8 % |

Se eligió **5 capturas con mayoría de 3**. Responder el 80 % de las veces con 93 % de acierto es mejor trato que responder siempre con 68 %, sobre todo porque el 32 % restante eran errores dichos con total seguridad.

Cuando no hay acuerdo, `value` viene en `null` y la UI dice "no pude leerla con confianza". **Para un usuario que no ve, esto no es un detalle**: quien ve descarta una lectura absurda de un vistazo, quien no ve no tiene cómo. Una respuesta incorrecta presentada con seguridad es peor que la ausencia de respuesta.

### Por qué las capturas van separadas en el tiempo

400 ms entre tomas, no cuadros consecutivos del stream. Dos cuadros consecutivos son casi idénticos y votar entre ellos no aporta nada: se necesitan puntos de vista ligeramente distintos, y el micromovimiento natural de la mano entre una toma y la siguiente los provee. La ráfaga completa dura ~1.6 s.

---

## Identidad estable de las perillas

Antes las etiquetas eran índices ("Perilla 1", "Perilla 2"). Como el conteo variaba entre fotos, **"Perilla 2" pasaba a referirse a otra perilla física** según cuántas se hubieran detectado, y el usuario que no ve no tenía forma de notarlo.

Ahora la etiqueta es la posición en el panel ("Arriba izquierda"), que sí es estable. Se cubren layouts de 1-2 filas × 1-3 columnas, que abarcan los pedales habituales; fuera de eso se cae a "Perilla N", menos útil pero nunca ambiguo dentro de una misma respuesta.

La votación además **solo compara fotos con el mismo layout**: si una foto detectó 3 perillas y otra 4, sus posiciones no son comparables y mezclarlas produciría exactamente el corrimiento de identidad que se quiere evitar.

---

## Limitaciones que siguen abiertas

- **Sesgo sistemático por perspectiva.** La cara superior de la perilla se ve como una elipse, no como un círculo, y eso corre el ángulo medido. La votación no lo corrige porque no es ruido aleatorio: en varias sesiones las cuatro perillas se leen consistentemente una hora corrida. Corregirlo exigiría estimar el plano del pedal y rectificar la perspectiva.
- **La cuantización a 12 horas es brutal.** Un error de 15° cambia la hora reportada. Con tolerancia de ±1 hora la consistencia sube de 67 % a 85 %, lo que muestra que buena parte del error restante es de una hora.
- **Los umbrales están calibrados contra un solo modelo de pedal** (TC Electronic Sub'n'Up: cuerpo rojo, perillas negras con marca blanca, grilla 2×2). Un pedal con perillas claras, marca grabada en vez de pintada, o sin marca visible, va a andar peor.
- **La ganancia de la votación está medida sobre fotos separadas por segundos**, con el usuario reencuadrando. Con capturas separadas 400 ms la decorrelación es menor, así que la mejora real va a estar por debajo del 93 % simulado.

---

## Parámetros y dónde tocarlos

Todos en `scripts/detect_knobs.py`, con el razonamiento al lado:

| Constante | Valor | Rol |
| --- | --- | --- |
| `MERGE_DIST_MIN_PX` | 110 | Piso de fusión de detecciones duplicadas |
| `POINTER_INNER_FRAC` / `POINTER_OUTER_FRAC` | 0.60 / 1.15 | Banda de búsqueda de la marca, relativa al radio |
| `POINTER_LATERAL_DELTA_DEG` | 20 | Separación angular del contraste lateral |
| `MIN_POINTER_CONTRAST` | 30 | Percentil 1 de las detecciones reales (mediana: 122) |
| `MIN_AGREEMENT` | 3 | Capturas que deben coincidir para reportar |
| `KNOB_MAX_MEAN` | 70 | Brillo medio máximo para aceptar un círculo como perilla |

En el cliente, `BURST_FRAMES` (5) y `BURST_INTERVAL_MS` (400) están en `components/pedal/CameraView.tsx`.
