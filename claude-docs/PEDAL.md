# Detección de perillas — `/pedal` y `/api/pedal/detect`

Funcionamiento técnico de la detección y, sobre todo, sus límites. Complementa las entradas de `DECISIONS.md`.

**Estado:** desde el 2026-08-18 la detección la hace **Gemini** (modelo multimodal), no el detector OpenCV. El apéndice al final conserva el detector anterior y sus mediciones, porque son la evidencia que justificó el cambio.

---

## Qué hace y qué no

Identifica las perillas (potenciómetros giratorios) de un pedal de efectos en una foto y, para cada una, informa:

- **La etiqueta impresa** en el panel cuando se lee ("TONE", "LEVEL", "SUB"). Es lo más útil para quien no ve el pedal, y algo que el detector anterior no podía dar.
- **La posición**, en una escala verbal de cinco escalones (al mínimo / bajo / al medio / alto / al máximo), con la hora de reloj entre paréntesis.
- **La confianza**: si el modelo no está seguro, la perilla se reporta como "sin lectura confiable" en vez de arriesgar un número.

No identifica marca ni modelo de pedal, y no lee el estado del LED.

---

## Pipeline

```
Cliente (CameraView)
  └─ una captura del stream
       └─ POST /api/pedal/detect (multipart, clave "image")
            └─ @google/genai → GEMINI_MODEL (default gemini-3.5-flash-lite)
                 ├─ la foto como inlineData base64 + prompt en español
                 ├─ temperature 0, responseSchema (JSON estructurado garantizado)
                 └─ por perilla: position, printedLabel, clockHour, confidence
            └─ normalize(): confidence "baja" o hora inválida → value: null
            └─ NextResponse.json({ knobs, framesUsed })
  └─ PedalInfo + narración TTS
```

---

## Decisiones de diseño

### Por qué hora de reloj y no porcentaje

No requiere saber dónde está el 0 % y el 100 % de cada perilla, que varía según el modelo de pedal. Es además la jerga con la que un músico describe una perilla ("está a las 3").

### Por qué encima una escala verbal de cinco escalones

La cuantización a 12 horas es demasiado fina para lo que cualquier sistema de visión puede sostener: un error de 15° cambia la hora reportada. La medición del detector anterior lo mostró con números — con tolerancia de ±1 hora la consistencia saltaba del 67 % al 85 %, es decir que buena parte del error era de exactamente una hora.

El recorrido de una perilla de pedal no es la vuelta completa: va de las 7 (mínimo) a las 5 (máximo) pasando por las 12, unos 300°. Cinco escalones sobre ese recorrido toleran ~30° cada uno: el doble del error que cambiaba la hora. La conversión está en `clockHourToScale` (`lib/clock.ts`); las 6 devuelven `null` porque quedan fuera del recorrido, y en ese caso se reporta solo la hora.

La hora no se descarta: se muestra entre paréntesis y quien la quiera precisa la tiene.

### Por qué una sola foto

El detector OpenCV mandaba 5 capturas y votaba entre ellas. Al migrar a Gemini se bajó a 3 con la idea de que el modelo contrastara entre tomas y bajara la confianza al leer distinto. **Medido, no lo hace**: funde las fotos y responde `confidence: "alta"` igual.

El costo de esa redundancia sí es real y está medido: 3.288 tokens de entrada con 3 fotos contra 1.110 con una — el triple de cuota consumida por detección, con la misma cantidad de perillas detectadas, las mismas etiquetas y la misma latencia (~3 s). Se bajó a una sola foto.

Esto no cierra el problema de la confianza, solo deja de pagar por una solución que no funcionaba. El camino para recuperar la abstención sigue abierto y está descrito abajo.

### Por qué la abstención es más importante que antes, no menos

El detector clásico se abstenía por construcción: si las capturas no coincidían, no había moda que reportar. Un modelo de lenguaje **no se abstiene solo**: ante una foto borrosa produce un número con total aplomo. Por eso:

- El schema tiene un campo `confidence` obligatorio con valores `"alta"` / `"baja"`.
- El prompt dice explícitamente que el usuario no puede ver la pantalla ni verificar la respuesta, y que una lectura equivocada dicha con seguridad es peor que admitir que no se pudo leer.
- `normalize()` en la route **fuerza `value: null`** cuando la confianza es baja o la hora está fuera de 1-12. La UI y el TTS no ven la diferencia entre "el modelo no supo" y "el modelo dudó": las dos son "no pude leerla con confianza".

Para un usuario que no ve, esto no es un detalle. Quien ve descarta una lectura absurda de un vistazo; quien no ve, no tiene cómo.

### Identidad estable de las perillas

El nombre de una perilla es su etiqueta impresa cuando se lee, y su posición en el panel ("Arriba izquierda") cuando no. Nunca un índice: "Perilla 2" pasa a referirse a otra perilla física según cuántas se detecten, y el usuario que no ve no tiene forma de notarlo. Solo se cae a "Perilla N" cuando el layout no encaja en ninguna posición nombrable — menos útil, pero nunca ambiguo dentro de una misma respuesta.

---

## Manejo de errores

Cada fallo tiene un mensaje propio, narrado por el canal único de `PedalScreen`. Un "error 429" no le dice nada al usuario sobre qué hacer:

| Situación | Respuesta |
| --- | --- |
| Sin `GEMINI_API_KEY` en el servidor | 503 — "La detección de pedal necesita conexión a internet y no está configurada en este servidor." |
| Cuota agotada (429 / `RESOURCE_EXHAUSTED`) | 500 — "Se alcanzó el límite de uso del servicio de detección. Probá de nuevo en unos minutos." |
| Clave inválida (401 / 403) | 500 — "El servicio de detección no está configurado correctamente en el servidor." |
| Sin conexión o timeout (30 s) | 500 — "No se pudo conectar con el servicio de detección. Verificá tu conexión a internet." |
| No se detectó ninguna perilla | 500 — mensaje sobre encuadre, distancia e iluminación |

El resto de la app funciona normalmente sin la clave: solo `/pedal` queda sin servicio.

---

## Configuración

| Variable | Default | Rol |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Clave del servidor. Se obtiene gratis en aistudio.google.com/apikey. **Nunca** con prefijo `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Modelo multimodal. Es variable porque los modelos del tier gratuito rotan y se deprecian: `gemini-2.5-flash`, el default original, dejó de estar disponible y devolvía 404. |

En la route, `MAX_IMAGES` (3, tope defensivo: el cliente manda una) y `TIMEOUT_MS` (30 s).

**Consumo por detección:** 1 request, ~1.110 tokens de entrada y ~186 de salida. Reescalar la imagen antes de mandarla **no reduce tokens** —Gemini la normaliza, 633 KB y 215 KB cuestan igual—; solo bajaría el ancho de banda de subida.

### Por qué la variante "lite"

Medido sobre una foto real del pedal, misma request y mismo schema:

| Modelo | Latencia | Perillas detectadas |
| --- | --- | --- |
| `gemini-3.7-flash` | 44,3 s | 4 |
| `gemini-3.6-flash` | 27,5 s | 4 |
| **`gemini-3.5-flash-lite`** | **3,7 s** | 4 |
| `gemini-3.1-flash-lite` | 7,0 s | 4 |

Los cuatro encuentran las 4 perillas y leen bien las etiquetas impresas. El acierto en el ángulo no mejora con los modelos grandes: el razonamiento extra no compra precisión angular. Para un usuario que espera escuchando, 4 segundos y 45 segundos no son lo mismo, y 44 s además excedía el `TIMEOUT_MS` de la route.

### Primer resultado medido, y el problema que expone

Sobre la única foto con ground truth cargado, la ráfaga completa de 3 capturas responde en **3,5 s**, detecta las **4 perillas** con sus etiquetas y posiciones correctas, y acierta **1 de 4 horas** — pero devuelve `confidence: "alta"` en las cuatro, incluida una que erraba por 3 horas.

Ese es el hallazgo importante, y no depende de cuán confiable sea el ground truth de una sola foto: **el modelo no usa el campo de confianza**. Todo el diseño de abstención descansa en que marque `"baja"` cuando duda, y en la práctica no lo hace. Con la instrumentación actual, la UI nunca va a decir "no pude leerla con confianza", que era precisamente la garantía que la hacía usable para alguien que no puede verificar.

Corregirlo exige atacar la calibración de la confianza, no el prompt de lectura: pedir una lectura por foto y marcar `"baja"` cuando difieran entre capturas, o pedir un rango en vez de un valor. Está sin resolver.

---

## Limitaciones abiertas

- **La precisión de ángulo no está medida.** Es la limitación más importante y es honesta: leer hacia dónde apunta una marca es una debilidad conocida de los modelos de visión (el mismo problema que leer un reloj analógico). La expectativa razonable es superar con comodidad el 68 % del detector anterior y sumar las etiquetas; el hecho verificado, todavía no existe. Hay 92 fotos reales en `tmp/debug_captures/` y un criterio de éxito propuesto en `PROPUESTA-DETECCION-PEDAL.md` para medirlo.
- **Las fotos salen del dispositivo.** Van a la API de Gemini. En el tier gratuito Google puede usarlas para mejorar sus modelos. La app lo declara en el README y en `/informacion`.
- **Sin internet no hay detección.** Con mensaje narrado, no con un error crudo. Afinador y metrónomo siguen 100 % locales.
- **No es determinista.** `temperature: 0` reduce la variación pero no la elimina, y el modelo puede cambiar por debajo sin aviso. Para reproducir una medición hay que anotar el identificador exacto del modelo.
- **Cuotas del tier gratuito.** Un test de usabilidad con varias personas seguidas puede agotarlas. El mensaje de cuota está previsto, pero la pantalla queda sin servicio hasta que se renueve.
- **Latencia mayor que antes.** ~1,2 s de ráfaga + varios segundos de red y análisis, contra los ~1,6 s totales del detector local. La espera se narra desde el arranque.

---

---

# Apéndice — el detector OpenCV anterior (v2/v3, hasta 2026-08-18)

Se conserva porque las mediciones de abajo son la evidencia que justificó abandonarlo, y porque `INFORME.md` §2.3 las cita. El script sigue en `scripts/detect_knobs.py` como material de proceso: **no lo invoca nadie**, y sus dependencias (Python, OpenCV, numpy) ya no están en la imagen Docker.

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
