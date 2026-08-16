# DECISIONS.md — Eco

Registro de decisiones de arquitectura que no quedan evidentes en el código.
Formato: fecha + decisión + razones.

Una entrada encabezada `Pendiente` es una decisión ya tomada pero todavía no implementada. Al escribirla en
el código se reemplaza `Pendiente` por la fecha y se elimina la línea de estado.

---

## 2026-08-16 — Ventana adaptativa de enganche y seguimiento en el afinador

**Decisión:** el filtrado de lecturas espurias del afinador deja de ser una ventana fija de aceptación y pasa a tener dos regímenes. `centsToTarget` conserva su ventana ancha de ±200 cents para **enganchar**, y `useTuner` agrega un **seguimiento** angosto de ±60 cents: con una estimación ya establecida, se descarta la lectura que se aleje más de eso, y si el rechazo persiste ocho lecturas se vuelve a enganchar. Por encima de ±200 no se descarta nada: ahí es otra cuerda, no un error.

Acompañan tres cambios del mismo diagnóstico: mediana y EMA también en modo cuerda fija (compartiendo `smoothFrequency` con el automático, que ya los tenía), `FFT_SIZE` de 4096 a 8192, y un intervalo de detección de 50 ms que compensa el costo de que YIN sea O(lags²).

**Razones:**
La lectura saltaba entre "muy baja" y "afinada" sin que nadie tocara el instrumento, lo que hacía insostenible el umbral de afinado de ±5 cents que pedía el test de usabilidad. Se midió el detector contra señales sintéticas de frecuencia exacta conocida en vez de suponer la causa, y la hipótesis de trabajo —un sesgo del algoritmo hacia frecuencias bajas— resultó falsa: el error medio es de +0,7 cents, es decir ligeramente alto, y proviene íntegro de la inarmonicidad física de la cuerda real. La causa estaba en el código propio: el modo de cuerda fija usaba la lectura cruda de cada frame.

La ventana adaptativa, en cambio, no salió de un diagnóstico sino de una medición que mostró que **ninguna ventana fija sirve**. Se probaron ±60, ±80, ±100, ±120 y ±200 sobre cuatro grados de desafinación. Las angostas aciertan con la cuerda casi afinada pero dejan **muda** la cuerda muy floja —a 150 cents del target no registra ninguna lectura—, que es justo cuando más se necesita el afinador; las anchas la detectan pero dejan pasar lecturas espurias de hasta 260 cents de error. Separar enganche de seguimiento es lo único que cubre los dos extremos, y se apoya en un hecho del dominio: girando una clavija el tono se mueve unos pocos cents entre lecturas consecutivas, nunca sesenta.

**Por qué no basta con subir el buffer:** se midió 16384 y no corrige el caso problemático (una lectura ~66 cents alta en la cuerda Si con las vecinas sonando por simpatía). No es un problema de resolución sino de aceptación, y por eso la corrección va en la ventana y no en el tamaño del frame. El paso a 8192 se justifica por otra razón: `pitchfinder` descarta la mitad del buffer y usa la mitad de eso como lags, así que con 4096 quedaban apenas ~1,8 períodos de Mi grave para correlacionar.

---

## 2026-08-16 — Desbloqueo del TTS por gesto del usuario

**Decisión:** `lib/tts.ts` deja de asumir que `speechSynthesis.speak()` se ejecuta siempre. La locución se intenta y se **verifica**: si 250 ms después la síntesis quedó ociosa —no habla ni tiene nada encolado— y ningún `onstart` marcó que arrancó, se da por descartada y el texto se retiene como locución pendiente. Un listener global de `pointerdown`/`keydown`, registrado una sola vez, la emite al primer gesto. Solo se conserva la última pendiente: si hubo varios anuncios antes del gesto, el único vigente es el más reciente.

Verificar en vez de bloquear preventivamente es lo que hace correcto el caso del permiso denegado: el click en "Bloquear" ocurre en el diálogo del navegador, no en la página, así que bajo un candado previo al intento el usuario tenía que tocar la pantalla para enterarse de que el permiso había fallado. Los navegadores de escritorio, además, hablan sin gesto previo; retener ahí sería silencio autoinfligido.

**Dos detalles del wrapper que salieron del mismo problema:** `speak()` se emite un tick después de `cancel()` —en el mismo tick Chrome puede perder la locución nueva, que es lo que dejaba mudo el aviso de permiso denegado cuando pisaba al anterior— y se llama `resume()` antes de hablar, porque el diálogo de permisos le saca el foco a la página y puede dejar la síntesis en pausa.

**Razones:**
Los navegadores móviles descartan la síntesis de voz que no proviene de un gesto del usuario. El primer anuncio del afinador sale del efecto de montaje de `useTuner`, es decir, antes de cualquier interacción, así que se perdía siempre — y `speak()` no tenía forma de detectarlo, porque la API no reporta el descarte.

El efecto medido en el test es desproporcionado respecto de la causa: tres de los cinco participantes concluyeron que el narrador estaba roto. Francisco lo anotó como falla ("no anda el narrador") y Thiago y Mónica lo resolvieron por casualidad, tocando la pantalla. Para una app cuyo canal principal de salida es la voz, arrancar en silencio equivale a arrancar rota.

Retener y reemitir, en lugar de simplemente reintentar, preserva el contenido del anuncio: lo que el usuario escucha al primer toque es el estado real de la pantalla en ese momento, no un mensaje genérico de bienvenida.

**Detalle de implementación:** el `onEnd` de una locución retenida no corre hasta el gesto. Es el callback que en `useTuner` apaga el guard de auto-escucha, así que retenerlo también podría, en teoría, dejar la detección de pitch bloqueada. No ocurre: para llegar a `useTuner` hay que haber tocado el botón de activar micrófono, con lo cual ya hubo gesto. Preservar el `onEnd` en vez de dispararlo al retener mantiene el guard intacto para cuando la locución sí se emite. Reemplazar una locución pendiente por otra sí dispara el `onEnd` de la reemplazada, con la misma semántica que hoy tiene `speechSynthesis.cancel()` sobre una locución en curso.

---

## 2026-08-16 — Canal único de audio en toda la app

**Decisión:** el patrón que se había aplicado a `/afinador`, `/pedal` y (parcialmente) `/partitura` pasa a regir en las cinco pantallas, extraído a dos piezas: el hook `useAnnouncer` —`announce(texto, politeness?, speed?)` como fuente única, que alimenta el TTS propio y publica el mismo texto para la región de fallback— y el componente `LiveRegion`, la única región `aria-live` de cada pantalla. `liveMode` queda en `off` mientras el navegador soporte Web Speech y el narrador esté activo.

Se aplicó donde faltaba: `/partitura` (que anunciaba solo por `aria-live`), el metrónomo (BPM, compás e inicio/detención), `/ajustes` (las cinco preferencias) y los tres errores de cámara y micrófono, que existían únicamente como `role="alert"`.

**Razones:**
La auditoría posterior al test mostró que el hallazgo de `/partitura` no era un caso aislado sino la forma visible de un defecto repetido: donde el único canal era `aria-live`, la app quedaba muda para quien no usa lector de pantalla —los cinco participantes del test—, y donde convivían TTS y región live sin coordinar, se escuchaba todo dos veces. Los dos síntomas tienen la misma causa y la misma corrección.

La abstracción se justifica por cantidad de usos: cinco pantallas repitiendo el estado de anuncio, la resolución diferida de `isTtsSupported()` y el cálculo de `liveMode` es peor que un hook de treinta líneas. `PedalScreen`, que tenía el patrón inline, se reescribió sobre las piezas nuevas sin cambiar su comportamiento.

**Dos detalles nuevos:**

1. **El BPM se narra al soltar, no en cada paso.** Los botones +/− auto-repiten cada 150 ms; narrar cada incremento produciría veinte anuncios para bajar veinte pulsos, exactamente lo que reportó una participante. El valor se lleva en un ref porque el intervalo de auto-repeat no ve el estado actualizado de React.
2. **`announce` acepta una velocidad explícita.** Solo la necesita `/ajustes`: la muestra hablada al elegir velocidad tiene que sonar a la velocidad recién elegida, que en ese render todavía no está en `settings`.

**Caso pendiente que se cierra:** la duplicación de `TtsSpeedSetting` anotada en la entrada del 2026-07-28. `SettingCarousel` recibe ahora una prop `liveMode` (default `polite`, que preserva su comportamiento para cualquier uso que no narre) y las cinco preferencias la ponen en `off`, porque el texto viaja por la región única de la pantalla. La prop que entonces se evitó agregar se justifica cuando los cinco usos la necesitan.

---

## 2026-08-16 — El metrónomo pasa a pantalla de primer nivel

**Estado:** implementado. Deriva del test de usabilidad (INFORME.md §1.4).

**Decisión:** el metrónomo se mueve de `/partitura/metronomo` a `/metronomo`, con ícono propio en la barra de navegación y redirect permanente desde la ruta anterior. Se eliminan el enlace "Ir al metrónomo" dentro de `/partitura` y el botón "Volver a partitura" de la pantalla del metrónomo. El control de vibración se expone también dentro del metrónomo, además de en `/ajustes`.

**Razones:**
La jerarquía original tenía una lógica de dominio: se marca el tempo de la partitura que se está leyendo. Pero ninguno de los cinco participantes del test la reconstruyó. Los cinco buscaron el metrónomo en la barra inferior; Thiago recorrió además Ajustes antes de encontrarlo y Fernanda no lo encontró nunca. Mónica lo dijo con precisión: "para mí es una herramienta aparte". Un metrónomo se usa para practicar escalas o mantener el pulso, no solo para leer una partitura, y el modelo mental de los usuarios refleja ese uso.

El mismo criterio explica la duplicación del control de vibración. Es la misma preferencia de `SettingsContext` —no hay estado duplicado ni que sincronizar— expuesta donde el usuario la busca: los cinco la buscaron dentro del metrónomo, y una de ellas abandonó esa parte de la tarea al no encontrarla. Que un ajuste sea global no obliga a que exista en un solo lugar.

Como efecto secundario se corrige un `aria-current` incorrecto: al evaluarse con `pathname.startsWith('/partitura/')`, la navegación marcaba "Partitura" como página actual mientras el usuario estaba en el metrónomo. Con las rutas al mismo nivel, el problema desaparece sin lógica adicional.

**El quinto ítem y el tamaño de fuente.** El label de cada ítem es su nombre accesible, así que no puede truncarse. Con la fuente en tamaño muy grande el `font-size` raíz es 20 px y el label del nav mide 15 px: cinco palabras de hasta nueve letras no entran en una línea de 375 px, y no es un caso borde sino aritmética. Achicar el texto solo en el nav era la salida fácil, pero contradice la preferencia que el usuario eligió justamente para poder leer. Se optó por lo contrario: cada ítem toma un quinto del ancho (`flex-1 min-w-0`) y el label se parte en dos líneas con `hyphens-auto`, que con `lang="es"` corta por sílaba ("Me-trónomo") en lugar de por carácter arbitrario. El alto de la barra se volvió la variable `--nav-height` —72 px, 88 px en tamaño muy grande— que el `<main>` usa como `padding-bottom`, para que la barra más alta no tape el final del contenido. La solución es correcta por construcción y no depende de medir el ancho exacto de cada palabra en cada tipografía.

---

## 2026-06-01 — Next.js 15 (no 16)

**Decisión:** Se pineó Next.js en la versión 15.x (15.5.19).

**Razones:**
`@serwist/next` (el plugin PWA elegido) depende de `@serwist/webpack-plugin`, que requiere webpack como bundler. Next.js 16 hace Turbopack el bundler por defecto para `next build`, y Turbopack no soporta plugins de webpack. Un build con Serwist en Next 16 falla a menos de forzar `--webpack` en cada comando. Para evitar esa fricción y garantizar compatibilidad, se usa Next 15 hasta que Serwist declare soporte oficial para Next 16 / Turbopack.

---

## 2026-06-01 — react-aria-components (no react-aria)

**Decisión:** Se usa `react-aria-components` (la API de componentes de alto nivel de Adobe).

**Razones:**
La spec §2 lo especifica explícitamente. `react-aria-components` provee componentes accesibles listos para usar (Button, Select, Dialog, etc.) que cumplen WCAG sin construir primitivos a mano. `react-aria` (hooks de bajo nivel) requeriría implementar toda la lógica ARIA manualmente, lo que contradice el principio de simplicidad del proyecto y aumenta el riesgo de errores de accesibilidad.

---

## 2026-06-01 — pitchfinder con algoritmo YIN

**Decisión:** Se usa `pitchfinder` con el algoritmo YIN para detección de pitch client-side.

**Razones:**
YIN es robusto en señales monofónicas de instrumentos (guitarra, bajo, viento) y tiene baja tasa de error comparado con ACF o MPM. `pitchfinder` incluye tipos TypeScript propios (sin `@types/pitchfinder`), es liviano y corre íntegramente en el browser vía Web Audio API, sin enviar audio a servidores. Buffer de 2048 muestras da ~46 ms de latencia a 44100 Hz, aceptable para afinación en vivo.

---

## 2026-06-01 — oemer vía child_process (no API externa)

> **Revertida el 2026-07-28.** oemer no reconoce cifrado de acordes, así que nunca pudo cumplir el requisito de `/partitura`. Ver la entrada "Tesseract con whitelist de cifrado".

**Decisión:** El OCR/OMR (reconocimiento óptico de partituras) se invoca localmente como proceso Python desde `/api/ocr/route.ts` usando `child_process`.

**Razones:**
Mantiene el procesamiento local sin dependencias de servicios externos ni costos por uso. oemer es la herramienta de OMR open source más madura para Python; invocarlo vía `child_process` es la integración más simple posible desde un API route de Next.js. No hay API REST oficial de oemer que simplificaría este approach.

---

## 2026-07-28 — Votación entre capturas y abstención explícita en /pedal

**Decisión:** `/pedal` deja de detectar sobre una sola foto. El cliente toma una ráfaga de **5 capturas separadas 400 ms**, `detect_knobs.py` corre la detección sobre cada una y vota por posición. Una perilla se reporta solo si **al menos 3 capturas coinciden**; si no, se devuelve `value: null` y la UI dice "no pude leerla con confianza". Además se corrigieron tres defectos del detector y las etiquetas pasaron de índices a posiciones del panel.

**Razones:**
Medido sobre las 92 fotos reales de `tmp/debug_captures/`, la detección de una sola foto acertaba ~68% de las veces y **nunca se abstenía**: el 32% restante eran errores dichos con total seguridad. Fotografiando el pedal quieto, la misma perilla se leía distinto entre tomas consecutivas.

Con 5 capturas y mayoría de 3, el sistema responde en el 80% de las perillas y acierta el 93% de las veces que responde. Se evaluaron otras combinaciones (2 de 5 → 87% de acierto; 4 de 5 → 98% pero solo responde el 44%; 5 de 7 → 99% respondiendo el 51%). Se eligió 3 de 5 como el mejor equilibrio entre cobertura y confiabilidad.

**Por qué la abstención es lo más importante del cambio:** un usuario que ve descarta una lectura absurda de un vistazo; uno que no ve, no. Una respuesta incorrecta presentada con seguridad no es solo un error de precisión, es un problema de accesibilidad — le quita a esa persona la posibilidad de detectar el error que cualquier otra corregiría con una mirada. Por eso se prefirió bajar la cobertura al 80% antes que seguir contestando siempre.

**Las capturas van separadas en el tiempo** (400 ms, no cuadros consecutivos del stream) porque dos cuadros seguidos son casi idénticos y votar entre ellos no aportaría nada: hacen falta puntos de vista ligeramente distintos, y el micromovimiento natural de la mano los provee.

**Los tres defectos corregidos en el detector** (detalle y mediciones en `claude-docs/PEDAL.md`):

1. **La banda de búsqueda de la marca miraba fuera de la perilla.** Era absoluta (30-115 px) contra radios reales de 45-110 px: excedía el radio de la propia perilla en las 280 detecciones, así que el algoritmo medía la dirección de lo más brillante alrededor —serigrafía, cuerpo del pedal, la mesa de madera— y no la marca. Ahora es relativa al radio (0.60-1.15 r).
2. **Puntuar por brillo absoluto no distingue la marca de un reflejo.** La marca es una línea fina, un reflejo especular es una mancha ancha. El puntaje pasó a ser el brillo del rayo menos el de sus vecinos angulares a ±20°, que premia estructuras finas y cancela manchas anchas. Consistencia: 59% → 67%.
3. **`MERGE_DIST_MIN_PX` era 150 px, más del doble de `HOUGH_MIN_DIST`**, así que fusionaba perillas vecinas distintas en una sola. Bajado a 110 px: las detecciones correctas de 4 perillas suben del 46% al 58%.

**Etiquetas por posición, no por índice:** antes eran "Perilla 1", "Perilla 2". Como el conteo variaba entre fotos, "Perilla 2" pasaba a referirse a otra perilla física y el usuario no tenía forma de notarlo. Ahora es "Arriba izquierda". Por el mismo motivo, la votación solo compara fotos con el mismo layout: mezclar una foto de 3 perillas con una de 4 produciría justo ese corrimiento.

**Se removió el bloque de debug** que guardaba cada foto capturada en `tmp/debug_captures/` (y su volumen en `docker-compose.yml`). Ya estaba marcado como temporal en el código, y con ráfagas de 5 habría quintuplicado lo que escribe a disco.

**Limitación conocida:** queda un sesgo sistemático por perspectiva —la cara superior de la perilla se ve como elipse, no como círculo— que la votación no corrige porque no es ruido aleatorio. Los umbrales están calibrados contra un solo modelo de pedal. Y la ganancia de la votación se midió sobre fotos separadas por segundos con el usuario reencuadrando; con 400 ms la decorrelación es menor, así que la mejora real va a estar por debajo del 93% simulado.

---

## 2026-07-28 — Canal único de audio extendido a /pedal y /partitura

**Decisión:** El patrón de canal único que se había aplicado solo a `/afinador` (ver entrada del 2026-06-30) pasa a regir en toda la app. En `/pedal`, una función `announce` centraliza el texto y alimenta los dos canales posibles: el TTS de la app como primario y una única región `aria-live` como fallback, que queda en `off` mientras el navegador soporte Web Speech. En `/partitura`, la región `sr-only` es la única live region de la pantalla. Se removieron el `role="alert"` del error de `/pedal`, el `aria-live` que envolvía a `PedalInfo`, y el `role="alert"` del error de `HarmonyList`.

**Razones:**
Las dos pantallas anunciaban cada mensaje dos veces. En `/pedal` el solapamiento era entre el TTS y la región `aria-live` —exactamente el problema que ya se había corregido en el afinador—, y en `/partitura` entre dos live regions que contenían el mismo texto de error. Para un usuario con VoiceOver o NVDA el efecto es el mismo en ambos casos: escuchar todo repetido.

Se encontró además una tercera duplicación de la misma familia en la lista de acordes: el nombre en español estaba en un `span` con `sr-only` **y** en un `span` visible sin `aria-hidden`, con lo cual el lector de pantalla leía "La menor. La menor." en cada ítem. Ahora vive en un único nodo, visible y accesible a la vez.

**Dos detalles que el caso del afinador no había expuesto:**

1. **Hidratación.** `isTtsSupported()` no se puede evaluar durante el render: en el servidor no existe `window`, así que devuelve "no soportado" y el cliente diría lo contrario, rompiendo la hidratación del atributo `aria-live`. En `/afinador` el problema no aparecía porque su región live vive detrás del estado de carga del micrófono y nunca se renderiza en SSR. En `/pedal` la región existe desde el primer render, así que el soporte se resuelve después de montar. El valor inicial (`polite`) es además el correcto para el HTML servido sin JS, donde no hay narrador posible.

2. **Momento de montaje de la live region.** En `/partitura` la región `sr-only` estaba dentro del `return null` del estado `idle`, es decir, aparecía en el DOM al mismo tiempo que su contenido. Los lectores de pantalla no anuncian de forma confiable una región live que se monta junto con su texto: hay que tenerla presente y vacía desde el primer render. Sin este arreglo, consolidar el canal único habría dejado a la pantalla con un solo canal que además podía no sonar nunca.

**Caso conocido que NO se cambió:** en `/ajustes`, `TtsSpeedSetting` narra una muestra ("Velocidad rápida") al cambiar la velocidad, mientras `SettingCarousel` anuncia el valor ("Rápida") por su propia región `aria-live`. Es una duplicación real, pero la muestra hablada es funcionalmente necesaria —un usuario que no ve percibe el cambio de velocidad únicamente al escucharlo— y silenciar la región del carrusel exigiría agregarle una prop a un componente compartido por las cinco preferencias, de las cuales las otras cuatro dependen de esa región como único canal. Queda pendiente de decisión.

**Verificado:** el HTML servido por SSR (equivalente a la validación "sin JavaScript") tiene exactamente una live region en `/pedal` y una en `/partitura`, y ningún `role="alert"` remanente en ninguna de las dos.

---

## 2026-07-28 — Tesseract con whitelist de cifrado (reemplaza a oemer)

**Decisión:** `/api/ocr` deja de usar oemer y pasa a usar Tesseract OCR con una whitelist de caracteres (`tessedit_char_whitelist`) y modo `--psm 4` (single column of text of variable sizes). Esto reemplaza la entrada del 2026-06-01 "oemer vía child_process". Se removieron oemer y onnxruntime del Dockerfile; se agregaron `tesseract-ocr` y `poppler-utils`.

**Razones:**
oemer es un OMR (Optical **Music** Recognition): reconoce cabezas de nota, claves, silencios y barras de compás. Su propia documentación aclara que **no reconoce cifrado de acordes, armonía, letra ni texto**. El parser de `/api/ocr` buscaba elementos `<harmony>` en el MusicXML de salida, que oemer no emite nunca — por lo que la lista de acordes venía vacía con cualquier imagen. La herramienta no resolvía la tarea planteada: en una partitura los acordes están impresos como **texto** ("Am", "F", "G7") sobre el pentagrama, así que detectarlos es un problema de OCR de texto, no de OMR.

Además de no funcionar, oemer era inviable en el entorno de deployment: su documentación indica 3–5 minutos por partitura *con GPU* (el `TIMEOUT_MS` del route era de 60 s), hasta 10 minutos la primera vez porque descarga los checkpoints en runtime, y los modelos ONNX no entran cómodos en la memoria del plan free de Railway. Tesseract no tiene modelos pesados, responde en segundos y el paquete de Debian pesa unos pocos MB.

Se eligió el binario de Tesseract vía `child_process` y no `tesseract.js` (WASM) para mantener el patrón que ya usa `/api/pedal/detect`, evitar una dependencia npm pesada, y no pagar el costo de arranque de WASM ni la descarga de los datos de idioma en runtime.

**`--psm 4`, no `--psm 11`:** el modo *sparse text* (11) parecía el natural, porque el cifrado son símbolos sueltos flotando sobre los pentagramas. Medido contra una hoja de prueba con 16 acordes resultó al revés: PSM 4 detecta los 16 sin basura, mientras que PSM 11 detecta 11 y pierde justamente los acordes de **una sola letra** (`F`, `C`, `G`) — los más frecuentes en guitarra. PSM 3 dio el mismo resultado que PSM 4 en la prueba; se prefirió el 4 porque asumir "una sola columna" es una hipótesis más restringida y estable frente a fotos con inclinación que dejar la segmentación totalmente automática.

**Cómo se controlan los falsos positivos:** la whitelist no rechaza caracteres, solo restringe el alfabeto entre el que Tesseract elige — una cabeza de nota igual sale como *alguna* letra permitida. El filtrado real son dos capas: confianza mínima por palabra (`CONF_MIN = 40`, de la columna `conf` de la salida TSV) y validación de cada token contra un regex construido a partir de `CHORD_QUALITIES` en `lib/chords.ts`. Derivar el regex de `CHORD_QUALITIES` garantiza que el OCR solo acepte acordes que `chordToSpanish` sabe narrar, de modo que nunca llegue a la voz un sufijo sin traducción al español. El umbral de 40 sale de la medición: en la hoja de prueba el cifrado legítimo entró entre 73 y 97 de confianza y la basura del pentagrama entre 0 y 9. No conviene subirlo, porque los acordes de una sola letra son los que menos confianza sacan (`C` entró con 73).

**No se deduplica la lista.** La implementación con oemer devolvía un `Set`, que perdía tanto el orden como las repeticiones. Para un guitarrista la secuencia *es* la información, y un `Am Am F F` se toca así. Tesseract emite cada palabra una sola vez en el TSV, con lo cual no hay detecciones duplicadas que limpiar (a diferencia de `detect_knobs.py`, donde varias pasadas de Hough sí producen duplicados).

**Verificación:** probado de punta a punta dentro del contenedor. Hoja de prueba en PNG: 16 de 16 acordes, en orden correcto, incluyendo repeticiones (`Am Am`), bajo invertido (`D/F#`), sostenido (`A#m7`), bemol (`Bb`), `sus4` y `maj7`. La misma hoja en PDF: 16 de 16. Una foto sin partitura (una de las capturas de pedal) devuelve lista vacía, sin falsos positivos. Un archivo corrupto devuelve HTTP 500 con mensaje descriptivo.

**Limitación conocida:** solo detecta acordes escritos como cifrado alfabético sobre el pentagrama (lead sheets, cancioneros, real books) — que es el formato que usa un guitarrista. Una partitura de música clásica sin cifrado, donde la armonía está implícita en las notas, no devuelve nada: eso requeriría OMR más análisis armónico, y es justamente lo que se descartó por costo e inviabilidad en el entorno de deployment. De los PDF se procesa únicamente la primera página, rasterizada a 300 dpi (se probaron 400 y 600 dpi y el reconocimiento empeoró).

---

## 2026-06-01 — Imagen base Debian Bookworm (no Alpine)

**Decisión:** El Dockerfile usa `node:20-bookworm-slim` en lugar de `node:20-alpine` como especifica la spec §8.

**Razones:**
oemer depende de `onnxruntime-gpu`, cuyos wheels en PyPI son exclusivamente manylinux (glibc 2.27+). Alpine Linux usa musl libc: pip no puede instalar esos wheels. La alternativa de Alpine (`py3-onnxruntime` en el repo edge/community) es el paquete CPU sin la variante `-gpu`, y no garantiza compatibilidad de API con lo que oemer importa. Compilar onnxruntime desde fuente en Alpine es factible pero agrega horas al build y complejidad de mantenimiento. Debian bookworm tiene glibc → los wheels manylinux instalan sin problemas. La diferencia de tamaño de imagen (bookworm-slim vs alpine) es aceptable dado que la imagen ya es pesada por Python + oemer + sus dependencias ML.

---

## 2026-06-01 — onnxruntime CPU-only (no onnxruntime-gpu)

> **Sin efecto desde el 2026-07-28.** onnxruntime entraba solo como dependencia de oemer; al removerse oemer, ya no se instala. La decisión de imagen base sigue en pie por los wheels manylinux de OpenCV.

**Decisión:** Se instala `onnxruntime` (CPU) antes de `oemer` en el Dockerfile para evitar que pip instale `onnxruntime-gpu`.

**Razones:**
El servidor de deployment (Ubuntu local) no tiene GPU NVIDIA ni CUDA. `onnxruntime-gpu` instalaría dependencias CUDA innecesarias y agregaría cientos de MB a la imagen. `onnxruntime` (CPU) expone la misma API que usa oemer internamente; al estar ya satisfecha la dependencia cuando pip procesa oemer, no intenta instalar la variante `-gpu`. El OMR corre más lento en CPU (~3–5 min por partitura según la doc de oemer) pero es funcional para el caso de uso académico.

---

## 2026-06-01 — Serwist (@serwist/next) para PWA

**Decisión:** Se usa `@serwist/next` como capa de service worker y PWA manifest.

**Razones:**
Es el sucesor mantenido de `next-pwa` (deprecado). Integra service worker con precache vía Workbox y tiene soporte para App Router de Next.js. Alternativas como `next-pwa` están sin mantenimiento activo; construir el service worker a mano sería innecesariamente complejo para los requisitos del proyecto.

---

## 2026-06-01 — React Context para estado global (no Redux / Zustand)

**Decisión:** El estado global (preferencias de accesibilidad) se maneja con React Context.

**Razones:**
El estado es mínimo: un objeto `EcoSettings` con tres campos (tema, tamaño de fuente, velocidad TTS). No hay acciones asíncronas ni estado derivado complejo. Agregar Redux o Zustand sería sobre-ingeniería clara para este volumen de estado. Context con `localStorage` para persistencia resuelve el problema con el mínimo de dependencias.

---

## 2026-06-01 — Deployment local + Cloudflare Tunnel

**Decisión:** La app se despliega en Docker sobre Ubuntu Server local, expuesta a internet vía Cloudflare Tunnel apuntando al puerto 3000.

**Razones:**
Evita costos de nube (VPS, CDN). Cloudflare Tunnel provee HTTPS, protección DDoS y un dominio público sin abrir puertos en el router. El caso de uso es académico/demo con tráfico mínimo; la latencia extra del tunnel es aceptable. No se requiere orquestación compleja (Kubernetes, etc.).

---

## 2026-06-30 — Deployment en Railway (free) sobre el Dockerfile existente

**Decisión:** La app se hostea en Railway (plan free), que construye y corre el `Dockerfile` del repo directamente. Esto reemplaza, como entorno de hosting principal, el esquema previo de Docker sobre Ubuntu Server local + Cloudflare Tunnel (ver entrada del 2026-06-01).

**Razones:**
Railway detecta y usa el `Dockerfile` del proyecto sin configuración extra, así que toda la imagen que ya teníamos (Debian bookworm + Python + oemer + OpenCV) corre tal cual en la plataforma. Esto es precisamente lo que hace viable el deployment: el trabajo ya invertido en que la app funcione dentro de Docker se aprovecha directamente, sin reescribir el empaquetado para un buildpack ni para un runtime específico de la nube. El plan free evita costos para el caso de uso académico/demo y provee HTTPS y dominio público sin necesidad de mantener un túnel ni un servidor propio encendido.

---

## 2026-06-05 — Afinador: AnalyserNode + requestAnimationFrame (no ScriptProcessorNode)

**Decisión:** La captura de audio usa `AnalyserNode` + `getFloatTimeDomainData` en un loop `requestAnimationFrame`, no `ScriptProcessorNode` ni `AudioWorklet`.

**Razones:**
`ScriptProcessorNode` entrega buffers zerizados de forma intermitente en Chromium/Windows (bug conocido del scheduler). `AudioWorklet` requiere un archivo worker separado y más boilerplate. El patrón `AnalyserNode + rAF` es el canónico de la implementación de referencia cwilso/PitchDetect: funciona en todos los browsers modernos, no tiene el bug de Chromium, y es significativamente más simple. Se agrega un `GainNode` con `gain=0` conectado al `destination` para forzar el procesamiento del grafo de audio (sin él, Chrome puede no enviar muestras al `AnalyserNode`).

---

## 2026-06-05 — Afinador: nota basada en cuerda más cercana (no MIDI cromático)

**Decisión:** En modo automático, la nota mostrada y narrada se deriva de la cuerda de guitarra más cercana en frecuencia (`closestStringIndex`), no del cálculo MIDI cromático estándar.

**Razones:**
`frequencyToNote` (MIDI) redondea al semitono más cercano en la escala cromática. Si la cuerda B (246.94 Hz) está 50+ cents sostenida, el cálculo MIDI devuelve C (261.63 Hz) y el afinador anunciaría "Do". Un afinador de guitarra debe decir "Si: un poco alto", no "Do". Usando la cuerda como referencia, el nombre siempre corresponde a la cuerda que el usuario está afinando, y los cents expresan la desviación respecto a la afinación estándar de esa cuerda.

---

## 2026-06-05 — Afinador: histéresis en umbral de afinado

**Decisión:** El estado "afinado" usa dos umbrales distintos: entra en "afinado" con ≤10 cents de desviación, pero permanece en "afinado" hasta superar los 20 cents (histéresis).

**Razones:**
Un umbral único de 10 cents provoca flip-flop cuando la cuerda está en el borde: una detección en 8 cents → "afinado", la siguiente en 12 cents → "bajo", alternando entre dos estados en tocadas consecutivas. La histéresis elimina esta oscilación sin sacrificar precisión: el usuario entra en "afinado" con ±10 cents y la narración se mantiene estable hasta que la cuerda se desafine claramente.

---

## 2026-06-05 — Afinador: modo cuerda-a-cuerda

**Decisión:** Se agregó un modo de selección de cuerda individual: el usuario elige una cuerda (E A D G B E) y la detección se filtra a esa frecuencia con normalización de octava.

**Razones:**
En modo automático, el algoritmo YIN puede confundir cuerdas adyacentes o detectar armónicos. La normalización de octava en `centsToTarget` permite que tanto E2 detectado como E3 (armónico) computen la misma desviación en cents respecto a la cuerda seleccionada. Esto mejora significativamente la consistencia de detección, en particular para la 6ª cuerda (E2 = 82 Hz, señal débil).

---

## 2026-06-05 — Afinador: pausa durante TTS para evitar feedback

**Decisión:** La detección de pitch se pausa mientras el sintetizador de voz está activo (`isSpeakingRef`), y se reanuda 300 ms después del evento `onend`.

**Razones:**
Sin pausa, el audio del TTS es captado por el micrófono. YIN interpreta la señal de voz como una nota musical, generando detecciones espurias que a su vez disparan más locuciones TTS. El ciclo de retroalimentación hace la pantalla inutilizable. La pausa de 300 ms post-`onend` da tiempo al sistema de audio a drenar antes de retomar la captura.

---

## 2026-06-01 — Tailwind CSS v4

**Decisión:** Se usa Tailwind CSS v4 (config CSS-first, sin `tailwind.config.js`).

**Razones:**
Es la versión scaffoldeada por `create-next-app` al momento de inicializar el proyecto. La configuración CSS-first de v4 (`@import "tailwindcss"` en globals.css) elimina el archivo de configuración JS y reduce fricción. No hay razón para degradar a v3.

---

## 2026-06-30 — Detección genérica de perillas (no identificación de modelo de pedal)

**Decisión:** `/pedal` v2 detecta únicamente la posición de las perillas (knobs) circulares en la foto, vía OpenCV (`HoughCircles` + análisis de contraste angular en `scripts/detect_knobs.py`), sin intentar identificar la marca/modelo del pedal ni leer texto o logos en la imagen. La detección del estado del LED también queda fuera de esta iteración.

**Razones:**
Identificar el modelo de un pedal a partir de una foto requeriría clasificación de imágenes (un modelo entrenado contra un dataset de pedales conocidos) u OCR de logos, ninguno de los cuales está disponible en el stack actual (OpenCV solo da operaciones clásicas de visión, no clasificación). Construir o entrenar un clasificador está fuera del alcance de tiempo del TFI y requeriría un dataset que no existe. La detección genérica de círculos + ángulo es resoluble con OpenCV puro, no requiere modelos pre-entrenados ni conexión a internet, y resuelve el problema real del usuario ciego: saber en qué posición están las perillas de SU pedal, sin necesitar que el sistema sepa qué pedal es. La detección del LED se excluyó de esta iteración por ser un problema de visión distinto (brillo/color puntual bajo iluminación variable, con alta tasa de falsos positivos) que merece su propio diseño y validación posterior con el pedal físico antes de comprometerse a una implementación.

OpenCV (`opencv-python-headless`) se instala explícito en el Dockerfile en vez de depender de que llegue transitivamente vía `oemer` — ver comentario en el Dockerfile.

---

## 2026-06-30 — Calibración de `detect_knobs.py`: múltiples pasadas de Hough + filtros de brillo y de outliers espaciales

**Decisión:** El algoritmo de `scripts/detect_knobs.py` no usa una sola pasada de `cv2.HoughCircles`, sino tres (sobre la imagen sin ecualizar, con `equalizeHist` y con CLAHE) cuyos resultados se combinan y deduplican por cercanía. Además, cada círculo candidato se filtra por brillo medio (`KNOB_MAX_MEAN`) para descartar partes metálicas/reflectantes, y por distancia al resto del grupo (`drop_spatial_outliers`) para descartar ruido de fondo aislado. El orden de las perillas se calcula por fila (arriba→abajo) y luego columna (izquierda→derecha) en vez de solo por coordenada x.

**Razones:**
Calibrado contra 9 fotos reales de un pedal físico (TC Electronic Sub'n'up, layout de perillas en grilla 2x2, no en una sola fila). Una sola pasada de Hough con cualquiera de los tres preprocesamientos detecta como máximo 3 de las 4 perillas reales: el contraste de cada perilla varía según el reflejo de luz ambiente en cada foto (glare diagonal sobre el cuerpo del pedal), y ninguna técnica de realce de contraste sola recupera el contraste perdido en todas las zonas a la vez — la unión de las tres sí, en 8 de las 9 fotos de prueba. El footswitch metálico y los jacks producían falsos positivos en la detección de círculos (mismo rango de tamaño que una perilla); el filtro de brillo los descarta porque las perillas de pedal son consistentemente de plástico oscuro. La grilla 2x2 real del pedal de prueba invalidó el supuesto original de "una sola fila, ordenar por x" — ordenar por fila y luego columna es necesario para que la app reporte las perillas en un orden predecible y navegable para un usuario ciego, independientemente del layout físico del pedal fotografiado.

**Limitación conocida:** en 1 de 9 fotos de prueba (encuadre más cercano, mayor parte de la perilla "DRY" fuera del rango de contraste esperado) el algoritmo detectó solo 3 de las 4 perillas reales — degrada de forma controlada (reporta 3 perillas reales, no inventa la cuarta) pero no es 100% confiable en todos los encuadres. Recomendación para el usuario: fotografiar el pedal de frente, con luz pareja y sin reflejos directos sobre las perillas.

---

## 2026-06-30 — Fix: el detector de ángulo enganchaba la sombra de la base del knob en vez de la marca blanca

**Decisión:** `detect_pointer_angle` busca solo excursiones hacia el BRILLO respecto al promedio del knob (`mean(samples) - knob_mean`), no la diferencia absoluta (`abs(mean(samples) - knob_mean)`). Además, la búsqueda recorre una banda de radio ABSOLUTA en píxeles (`POINTER_INNER_R_PX`–`POINTER_OUTER_R_PX`, con una ventana deslizante de `POINTER_WINDOW_PX`) en vez de una fracción del radio que devuelve `cv2.HoughCircles`. El umbral de fusión de detecciones duplicadas (`merge_candidates`) ahora tiene un piso absoluto (`MERGE_DIST_MIN_PX`) además del relativo al radio.

**Razones:**
Probando con fotos capturadas en vivo desde el celular (no las fotos HDR de calibración original), se detectó que la MISMA perilla física, sin tocar entre tomas consecutivas, daba lecturas de ángulo completamente distintas (ej. 81% vs 25%) — confirmado visualmente comparando crops de la marca blanca en varias fotos: la marca no se había movido. Investigando con visualización de overlay sobre la imagen real, se encontró la causa: estas perillas (cilíndricas, con tope plástico anguloso) tienen una sombra oscura marcada donde la base se junta con el panel del pedal. Esa sombra es, en términos de contraste absoluto contra el brillo medio del knob, tan "saliente" como la marca blanca real — con `abs(diff)` el algoritmo a veces enganchaba la sombra (en la dirección opuesta a la marca real) en vez de la marca, de forma intermitente entre fotos sin patrón aparente. Restringir la búsqueda a solo excursiones de BRILLO (no de oscuridad) resolvió esto, porque la marca indicadora es siempre blanca/clara y la sombra nunca lo es.

Además se confirmó que el radio que entrega `cv2.HoughCircles` para estas perillas es poco confiable (varió de 60 a 102px para la misma perilla física en fotos consecutivas), y como la búsqueda original ataba el anillo de muestreo a ese radio (`r * POINTER_INNER_RATIO` a `r * POINTER_OUTER_RATIO`), un radio mal estimado hacía que la búsqueda mirara la zona equivocada del knob. Usar una banda absoluta en píxeles (calibrada contra el rango real de radios observado en WORK_WIDTH=1000, ~46-110px) hace la detección de ángulo independiente de la precisión del radio de Hough.

**Resultado tras el fix:** de 6 fotos capturadas en vivo (cámara del celular, no las HDR de calibración), 5 dan exactamente 4 perillas detectadas con valores consistentes entre sí; 1 sigue dando una lectura distinta para una perilla (causa: una detección duplicada de Hough que el merge no fusionó correctamente, el más probable próximo punto a mejorar). Sigue siendo una heurística de visión clásica, no perfecta en el 100% de las fotos — la recomendación de fotografiar con buena luz y encuadre derecho sigue aplicando.

---

## 2026-06-30 — Posición de perilla como hora de reloj (1-12), no porcentaje 0-100%

**Decisión:** `scripts/detect_knobs.py` ya no convierte el ángulo medido a un porcentaje 0-100%. En cambio, lo redondea directamente a la hora de reloj más cercana (1 a 12, con 12 = arriba de la imagen) y reporta eso (`angle_to_clock_hour`). Se eliminaron las constantes `SWEEP_START_DEG` y `SWEEP_DEGREES` y toda la lógica de "zona muerta" asociada. El frontend (`PedalInfo`, TTS en `PedalScreen`) narra "a las 3", "a la una", etc. en vez de "al 60 por ciento".

**Razones:**
Con datos reales aportados por el usuario (perillas en posiciones físicas conocidas: 60%, 55%, 0%, 65%), se confirmó que el algoritmo de ángulo (ya corregido, ver entrada anterior) estaba midiendo la dirección de la marca CORRECTAMENTE — pero la conversión a porcentaje requería saber `SWEEP_START_DEG`: en qué ángulo de la imagen está físicamente el "mínimo" (0%) de la perilla. Ese valor se había asumido de forma genérica (225°) sin calibrarlo contra el pedal real, y la calibración con los datos del usuario reveló que el verdadero punto de partida estaba a ~90-95° de distancia de lo asumido — explicando por qué una perilla en 0% se leía como ~99%, casi el extremo opuesto.

Calibrar `SWEEP_START_DEG`/`SWEEP_DEGREES` correctamente requeriría fotos de referencia con cada perilla en posiciones conocidas (mínimo, máximo, intermedio) — viable pero fragante a re-calibración por cada modelo de pedal distinto, porque cada perilla puede empezar y terminar en un punto distinto de la circunferencia según el fabricante. La hora de reloj evita el problema de raíz: no necesita saber dónde está el "mínimo" de nada, solo reporta hacia dónde apunta la marca, igual que ya hacen los músicos en la jerga real ("la perilla está a las 3"). Validado contra las fotos en vivo: la perilla que el usuario confirmó en 0% pasó a leerse consistentemente "a las 7" en 5 de 6 fotos (antes oscilaba entre 81% y 25% sin patrón); la perilla en 65% se leyó consistentemente "a las 4" o "a las 5" en 3 de 4 fotos disponibles.

**Limitación que persiste:** la hora de reloj sigue asumiendo que el celular se sostiene razonablemente derecho (sin inclinación/roll grande), porque "las 12" se define como "arriba de la imagen". Es un supuesto mucho más liviano que el anterior (no depende del modelo de pedal, solo de cómo se sostiene el teléfono), pero no corrige inclinación de cámara entre fotos — eso quedaría para una iteración futura si hace falta (ej. usando la orientación real del cuerpo del pedal en la foto, detectada por contorno, en vez de "arriba de la imagen").

---

## 2026-06-30 — Reintento a mayor resolución de trabajo si se detectan pocas perillas (en vez de bajar el radio mínimo de Hough)

**Decisión:** `scripts/detect_knobs.py` corre el pipeline de detección a `WORK_WIDTH_BASE=1000` primero; si detecta menos de 3 perillas, lo reintenta completo a `WORK_WIDTH_FALLBACK=1800` y usa ese resultado si encontró más. No se bajó `HOUGH_MIN_RADIUS` (quedó en 40) para cubrir fotos tomadas más lejos del pedal.

**Razones:**
El usuario reportó que, en un lote de fotos en vivo, varias daban 0-1 perillas detectadas (antes funcionaba mejor). Comparando esas fotos contra las anteriores, la diferencia no era el flash (recién agregado) sino que el pedal ocupaba una porción mucho más chica del cuadro — las perillas tenían un radio real de ~31px en WORK_WIDTH=1000, muy por debajo del rango calibrado (40-120px), así que Hough directamente no las encontraba. Bajar `HOUGH_MIN_RADIUS` a 18 para cubrirlas SÍ detectaba esas perillas, pero introdujo regresión en fotos de cerca ya validadas: el selector LED pequeño del pedal ("POLY/TONEPRINT/CLASSIC") y otros círculos chicos de ruido empezaban a pasar el filtro, dando 5-6 "perillas" en vez de 4 en fotos que antes daban exactamente 4. Mantener el radio mínimo fijo y en cambio agrandar la imagen de trabajo cuando hace falta logra el mismo efecto (las perillas lejanas "crecen" hasta el rango esperado) sin ensuciar el caso de cerca, que sigue corriendo con los parámetros ya validados sin tocar.

**Resultado:** sobre 55 fotos reales en vivo (3 sesiones de prueba distintas, incluyendo luz dura con sombras de persiana y encuadres lejanos), 53 detectan 3 o más perillas (96%), contra una proporción mucho menor antes del fallback. El set de calibración original (9 fotos de cerca) no tuvo regresión — siguen usando `WORK_WIDTH_BASE` sin activar el fallback.

---

## 2026-06-30 — Afinador: canal único de audio (TTS primario + aria-live fallback)

> **Corregida en parte el mismo día (commit `77b7f49`).** El anuncio no dice el número de cents: dice la magnitud con palabras ("Mi. Medianamente alto."), con tres escalones según la desviación. La decisión de fondo —que la magnitud tiene que ser audible— se mantiene; lo que cambió es la unidad. El número de cents no le sirve a quien no sabe qué es un cent, que es la mayoría de los usuarios. El ejemplo "Mi. 12 centavos alto." de más abajo describe una implementación que no llegó a quedar en el código.

**Decisión:** El feedback al usuario que no ve viaja por un solo canal coherente. `useTuner` es la fuente única del texto a anunciar (`announcement`), gobernada por la misma lógica de cambio-significativo + cooldown de 3 s que el TTS. El TTS propio de la app es el canal primario; la región `aria-live` (única, `role="status"` y `sr-only` en `AfinadorScreen`) actúa como fallback y queda en `off` cuando el narrador está activo y el navegador soporta Web Speech, o en `polite` en caso contrario. El bloque visual de `TunerDisplay` deja de ser `aria-live`. El anuncio incluye la magnitud de la desviación ("Mi. 12 centavos alto.").

**Razones:**
Antes la app hablaba dos veces en paralelo: el TTS de `useTuner` y la región `aria-live` de `TunerDisplay`, que el lector de pantalla también vocalizaba, sin coordinación ni throttling en la segunda (se actualizaba en cada frame). Para un usuario ciego con VoiceOver/NVDA esto producía eco y verborrea constante. Centralizar el texto en `announcement` y conmutar `aria-live` según `ttsEnabled`/`isTtsSupported` elimina el solapamiento, hereda el throttling del TTS, y garantiza que siempre haya exactamente un canal hablando (incluso si el narrador se silencia o el navegador no soporta Web Speech). Incluir el número de cents cumple la intención de `SPECIFICATION.md:220`: sin la magnitud audible, afinar fino sin ver es imposible.
