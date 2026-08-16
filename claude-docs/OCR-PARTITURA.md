# OCR de partitura — `/partitura` y `/api/ocr`

Funcionamiento técnico de la detección de acordes. Complementa la entrada de `DECISIONS.md` del 2026-07-28.

---

## Qué problema resuelve

Un guitarrista ciego necesita saber qué acordes tiene que tocar. En los formatos que usa un guitarrista —lead sheets, cancioneros, real books— esos acordes están impresos como **texto** sobre el pentagrama: `Am`, `F`, `C`, `G7`. Leerlos es reconocimiento de texto.

Esto es importante porque la implementación anterior usaba **oemer**, un OMR (Optical *Music* Recognition) que reconoce cabezas de nota, claves, silencios y barras de compás, pero explícitamente **no** reconoce cifrado, armonía, letra ni texto. El parser buscaba elementos `<harmony>` en el MusicXML de salida, que oemer no emite nunca: la lista de acordes venía vacía con cualquier imagen.

---

## Pipeline

```
captura de cámara (1920 ideal) o archivo subido
  └─ imagen o PDF (FormData "image")
  └─ si es PDF: pdftoppm -png -r 300 -singlefile (solo página 1)
       └─ tesseract <img> <base> --psm 4 -c tessedit_char_whitelist=... tsv
            └─ parseTsv           → descarta palabras con conf < 40
                 └─ sortByReadingOrder → renglón (arriba→abajo), luego x (izq→der)
                      └─ fixTrailingSlash  → "E/" → "E7"
                           └─ CHORD_RE      → valida contra CHORD_QUALITIES
                                → { chords: string[], rawText: string }
```

---

## Decisiones de configuración

### `--psm 4`, no `--psm 11`

PSM 11 (*sparse text*) parecía el modo natural: el cifrado son símbolos sueltos flotando sobre los pentagramas, no un bloque de prosa. La medición dijo lo contrario.

Sobre una hoja de prueba con 16 acordes (4 sistemas × 4 acordes, con pentagramas, plicas y cabezas de nota como ruido):

| Modo | Acordes detectados | Observaciones |
| --- | --- | --- |
| PSM 11 (sparse text) | 11 / 16 | Pierde `F`, `C`, `F`, `G` — todos de **una sola letra** |
| PSM 6 (bloque uniforme) | 16 / 16 | Agrega tokens basura (`a`, conf 9) |
| **PSM 4 (columna única)** | **16 / 16** | Sin basura. Confianzas 73–97 |
| PSM 3 (automático, default) | 16 / 16 | Idéntico a PSM 4 en esta prueba |

Los acordes de una sola letra (`C`, `F`, `G`, `A`, `D`, `E`) son los más frecuentes en guitarra, así que perderlos vaciaba la feature de contenido. Entre PSM 4 y PSM 3 se eligió el 4 porque asumir "una sola columna" es una hipótesis más restringida y estable frente a fotos con inclinación que dejar la segmentación totalmente automática.

### Whitelist de caracteres

```
ABCDEFGMabdgijmnsu#/0123456789
```

Cubre exactamente el alfabeto del cifrado: fundamentales `A`-`G`, la `M` de `M7`, alteraciones `#` y `b`, las letras que componen los sufijos de calidad (`maj`, `min`, `dim`, `aug`, `sus`, `add`, `m`), los dígitos de las tensiones y la `/` del bajo invertido.

**La whitelist no rechaza nada.** Restringe el conjunto entre el que Tesseract elige, así que una cabeza de nota o un fragmento de pentagrama igual sale como *alguna* letra permitida. Es una ayuda al reconocimiento, no un filtro.

### Las dos capas que sí filtran

1. **Confianza mínima (`CONF_MIN = 40`).** La columna `conf` del TSV. En la hoja de prueba el cifrado legítimo entró entre 73 y 97, y la basura del pentagrama entre 0 y 9: 40 deja margen cómodo de los dos lados. **No conviene subirlo:** los acordes de una sola letra son los que menos confianza sacan (la `C` entró con 73, y en una prueba anterior con PSM 11 llegó a 49).
2. **Validación por regex.** Cada token tiene que ser exactamente `fundamental + alteración? + calidad conocida? + bajo invertido?`. El patrón de calidades se construye a partir de `CHORD_QUALITIES`, exportado por `lib/chords.ts` — la misma lista que usa `chordToSpanish` para narrar. Esa dependencia es deliberada: **garantiza que el OCR solo acepte acordes que el narrador sabe pronunciar en español**, así nunca llega a la voz un sufijo sin traducción.

### `fixTrailingSlash`

En imágenes de baja definición Tesseract lee el `7` final como `/` (`E7` → `E/`, `A#m7` → `A#m/`). La corrección es segura: un `/` final sin nota de bajo detrás **nunca** es un acorde válido, así que reescribirlo no puede corromper una lectura correcta — solo recupera una que el regex descartaría.

Es la única normalización que se aplica, y está respaldada por el caso observado. Se descartó una corrección especulativa de `#`→`8` y `b`→`6` porque no apareció en ninguna prueba y sí podía corromper tokens legítimos.

### Sin deduplicación

La implementación con oemer devolvía un `Set`, que perdía tanto el orden como las repeticiones. Para un guitarrista **la secuencia de acordes es la información**, y un `Am Am F F` se toca así. Tesseract emite cada palabra una sola vez en el TSV, con lo cual no hay detecciones duplicadas que limpiar — a diferencia de `detect_knobs.py`, donde varias pasadas de Hough sí producen duplicados que hay que fusionar.

### Orden de lectura

`sortByReadingOrder` reagrupa por renglón (tolerancia derivada de la altura mediana de las palabras, para no depender de la resolución de la foto) y ordena cada renglón de izquierda a derecha. Es seguro de red frente a fotos donde la segmentación devuelva los bloques desordenados.

### Resolución de captura

El OCR no puede compensar una captura insuficiente, y durante un tiempo la pantalla se la entregó sistemáticamente. `ScoreUpload` pedía la cámara con solo `facingMode: 'environment'`; sin constraint de resolución el navegador entrega típicamente **640×480**, y `captureFrame` manda ese frame tal cual al endpoint.

El orden de magnitud dice todo lo que hace falta: una hoja A4 completa a 640 px de ancho deja cada letra del cifrado en unos **6-8 px de alto**, contra los **~20-30 px** que Tesseract necesita para reconocer un glifo con fiabilidad. No es un caso de precisión degradada — es un caso donde no hay información suficiente que reconocer.

Por eso la cámara pide ahora `width`/`height: { ideal: 1920 }`, el mismo constraint que `hooks/useCamera.ts` ya aplicaba en `/pedal` por una razón análoga (distinguir círculos chicos). El camino de archivo subido nunca tuvo este problema: una foto de galería o un PDF llegan a resolución completa.

**Consecuencia para los umbrales de abajo:** las confianzas 73-97 de la tabla de validación se midieron sobre una hoja sintética a resolución completa. Las de fotos reales tomadas con la cámara de la app, antes de este cambio, no son comparables — y después del cambio tampoco están medidas todavía.

### Timeout de 30 s

Tesseract responde en segundos. Los 60 s originales estaban dimensionados para oemer, que según su documentación necesita 3–5 minutos *con GPU* — es decir, el timeout anterior tampoco alcanzaba para la herramienta para la que se había fijado.

---

## Verificación

Probado de punta a punta dentro del contenedor Docker, contra el endpoint real:

| Caso | Resultado |
| --- | --- |
| Hoja de prueba, PNG | 16 / 16 acordes, en orden, con `Am Am` (repetición), `D/F#`, `A#m7`, `Bb`, `Esus4`, `Cmaj7` |
| Misma hoja, PDF | 16 / 16 (`fixTrailingSlash` recupera `E7` y `A#m7`) |
| Foto sin partitura (captura de `/pedal`) | `chords: []` — sin falsos positivos |
| Archivo corrupto | HTTP 500 con mensaje descriptivo |

---

## Limitaciones conocidas

- **Solo detecta cifrado alfabético.** Una partitura de música clásica sin cifrado, donde la armonía está implícita en las notas, no devuelve nada. Resolver eso requeriría OMR más análisis armónico.
- **PDF: solo la primera página**, rasterizada a 300 dpi. Se probaron 400 y 600 dpi y el reconocimiento **empeoró** (a 600 dpi no detectó nada), así que 300 no es un default arbitrario.
- **Sin preprocesamiento de imagen.** Tesseract binariza internamente (Otsu), pero una foto con sombra fuerte, perspectiva marcada o poca resolución degrada el reconocimiento. Si hace falta, el próximo paso sería deskew y binarización adaptativa con OpenCV, que ya está instalado en la imagen para `/pedal`.
- **La validación se hizo con una hoja sintética**, no con partituras reales fotografiadas. Los umbrales están calibrados contra ese material y conviene revisarlos con fotos reales.
- **La confianza por palabra no sale del endpoint.** `parseTsv` la usa como compuerta (`CONF_MIN`) y descarta el número. La pantalla, por lo tanto, no puede distinguir un acorde leído con 95 de uno leído con 45, y presenta a los dos igual. La mitigación actual es un aviso fijo de lectura aproximada en `/partitura`; propagar `conf` para modularlo quedó pendiente hasta tener mediciones con fotos reales a la resolución nueva (ver `DECISIONS.md`, entrada del 2026-08-16).
- **La confianza no detecta omisiones.** Es el límite de fondo de cualquier mejora por confianza: un acorde que Tesseract nunca reconoció no aparece en el TSV, así que no hay valor bajo que reportar. Una lista incompleta y una lista completa se ven idénticas desde el lado del servidor.

---

## Dependencias de sistema

Instaladas en el `Dockerfile` vía apt:

| Paquete | Para qué |
| --- | --- |
| `tesseract-ocr` | El binario de OCR (incluye los datos de idioma en inglés). |
| `poppler-utils` | `pdftoppm`, para convertir partituras en PDF a imagen. |

Ninguno de los dos descarga modelos en runtime, a diferencia de oemer.
