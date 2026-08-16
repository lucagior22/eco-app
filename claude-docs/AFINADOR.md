# Afinador (`/afinador`) — funcionamiento técnico

Documentación del pipeline de detección de tono, suavizado, conversión a nota y narración
del afinador. Refleja el estado actual del código.

## Archivos

| Archivo | Rol |
| --- | --- |
| [`app/afinador/AfinadorScreen.tsx`](../app/afinador/AfinadorScreen.tsx) | UI: display, indicador de cents, botones (pausar, narrador), selector de micrófono, tinte de fondo por desviación. |
| [`hooks/useMicrophone.ts`](../hooks/useMicrophone.ts) | Acceso a `getUserMedia`, enumeración y selección de micrófonos, manejo de errores de permiso. |
| [`hooks/useTuner.ts`](../hooks/useTuner.ts) | Loop de análisis (grafo de audio), suavizado, máquina de estados de afinación y narración TTS. |
| [`lib/pitch.ts`](../lib/pitch.ts) | YIN, gate de RMS, conversión frecuencia→nota, corrección de octava, helpers de cuerdas. |
| [`lib/tts.ts`](../lib/tts.ts) | Wrapper de Web Speech API (`speak`, `cancelSpeech`), con retención de la locución hasta el primer gesto del usuario. |
| [`components/tuner/TunerDisplay.tsx`](../components/tuner/TunerDisplay.tsx) | Nota detectada + selección de cuerda. |
| [`components/tuner/PitchIndicator.tsx`](../components/tuner/PitchIndicator.tsx) | Visualización de la desviación en cents. |

## Stack

| Función | Tecnología |
| --- | --- |
| Captura de audio | Web Audio API (`AudioContext`, `MediaStreamAudioSourceNode`, `AnalyserNode`) |
| Detección de tono | `pitchfinder` → algoritmo **YIN** (dominio temporal) |
| Filtrado | `BiquadFilterNode` (highpass + lowpass) |
| Narración | Web Speech API (`SpeechSynthesisUtterance`), voz `es-AR` |

## Pipeline de audio

```
getUserMedia → source → highpass(65 Hz) → lowpass(1000 Hz) → analyser → silentGain(0) → destination
```

- **Constraints de `getUserMedia`** (`useMicrophone.ts`): `echoCancellation`, `noiseSuppression`
  y `autoGainControl` en **`false`**. El procesamiento del navegador deforma el tono y el
  volumen; para afinar se necesita la señal cruda.
- **Band-pass** (`useTuner.ts`): las fundamentales de cuerda al aire van de E2 (82 Hz) a
  E4 (330 Hz). El highpass a **65 Hz** corta rumble/DC por debajo de E2; el lowpass a
  **1000 Hz** atenúa armónicos y siseo para que YIN bloquee mejor la fundamental (deja
  margen para notas con traste).
- **`silentGain` a 0**: el `AnalyserNode` necesita estar conectado al destino para que el
  grafo procese audio, pero no queremos reproducir el micrófono; la ganancia 0 lo silencia.
- **Frame**: `analyser.fftSize = 4096` → buffer de 4096 muestras de dominio temporal
  (`getFloatTimeDomainData`), ≈ 93 ms a 44,1 kHz. El loop corre por `requestAnimationFrame`.

## Detección de tono (`lib/pitch.ts`)

- **Gate de volumen**: si `rms(buffer) < 0.003` se descarta el frame (silencio/ruido bajo).
- **YIN** con `threshold: 0.15` (más permisivo que el default 0.1 de pitchfinder; mejora la
  captación de E2, cuya señal es débil). **No se aplica ventana (Hann)**: YIN es un método
  de dominio temporal basado en la función de diferencia; enventanar rompe la periodicidad
  del frame y hace que la diferencia nunca baje del umbral (devolvería `null` siempre).
- **Rango válido**: se descartan frecuencias `< 50 Hz` o `> 1600 Hz`.
- **Corrección de octava** (`correctOctave`): YIN a veces detecta un subarmónico (`÷2`) o el
  primer armónico (`×2`) en lugar de la fundamental. Se evalúan `{÷2, ×1, ×2}` y se elige el
  candidato más cercano a **alguna cuerda de la guitarra** (no a la escala cromática: las
  octavas son cromáticamente equivalentes y el criterio cromático elegiría siempre la más
  grave; las 6 cuerdas no están espaciadas en octavas, así que una octava errónea cae lejos
  de todas).

### Conversión a nota
- `frequencyToNote(freq)`: MIDI/cents respecto a A4 = 440 Hz (afinación estándar).
- `centsToTarget(freq, targetFreq, maxCents=200)`: cents de desviación respecto a la octava
  más cercana del target; `null` si supera ±200 cents (no es esa cuerda). Permite comparar,
  p. ej., un E3 detectado contra un target E2.
- `closestStringIndex(freq)`: cuerda más cercana en cents.

### Cuerdas de referencia (`GUITAR_STRINGS`) — afinación estándar EADGBE

| Índice | N.º de cuerda | Cuerda | Frecuencia |
| --- | --- | --- | --- |
| 0 | 6ª | E2 (Mi grave) | 82,41 Hz |
| 1 | 5ª | A2 (La) | 110,00 Hz |
| 2 | 4ª | D3 (Re) | 146,83 Hz |
| 3 | 3ª | G3 (Sol) | 196,00 Hz |
| 4 | 2ª | B3 (Si) | 246,94 Hz |
| 5 | 1ª | E4 (Mi agudo) | 329,63 Hz |

El índice del array y el número de cuerda que usa quien toca **van al revés**: `stringNumber(i)`
(`GUITAR_STRINGS.length - i`) hace la conversión y es la única forma en que el número debe llegar
a la UI o a la locución. Hasta la prueba con usuarios la app decía "Cuerda 1" para el Mi grave, y
los participantes tuvieron que ser corregidos por el moderador.

## Suavizado y estado de afinación (`useTuner.ts`)

| Constante | Valor | Uso |
| --- | --- | --- |
| `FFT_SIZE` | 8192 | Tamaño del frame de análisis (~170 ms a 48 kHz). |
| `DETECT_INTERVAL_MS` | 50 | Intervalo entre detecciones (20 por segundo). |
| `MEDIAN_WINDOW` | 5 | Ventana del filtro de mediana sobre el historial de frecuencias. |
| `EMA_ALPHA` | 0.4 | Suavizado exponencial sobre la mediana. |
| `TRACK_WINDOW_CENTS` | 60 | Con estimación establecida, se descarta la lectura que se aleje más. |
| `TRACK_LOST_FRAMES` | 8 | Rechazos consecutivos antes de re-enganchar (~400 ms). |
| `JUMP_THRESHOLD_CENTS` | 200 | Por encima es otra cuerda, no un error: se acepta de una. |
| `CENTS_THRESHOLD_ENTER` | 5 | Para **entrar** en estado "afinado" (±5 cents). |
| `CENTS_THRESHOLD_STAY` | 10 | Histéresis: una vez afinado, se mantiene hasta ±10 cents (evita parpadeo). |
| `HOLD_MS` | 2000 | Tiempo que se sostiene la última nota antes de pasar a "sin señal". |
| `TTS_COOLDOWN_MS` | 3000 | Mínimo entre anuncios de voz (con excepciones, ver abajo). |
| `STEP_STABLE_FRAMES` | 3 | Frames que un escalón nuevo debe sostenerse antes de locutarse. |
| `HIGHPASS_HZ` / `LOWPASS_HZ` | 65 / 1000 | Cortes del band-pass. |

Los umbrales eran 10/20 hasta la prueba con usuarios: dos participantes con oído entrenado
detectaron que la app decía "afinado" con la cuerda audiblemente baja. 15-20 cents se escuchan;
5-10 no. La histéresis se conserva —evita el parpadeo entre estados— pero dentro de un rango
que ya no es audible.

**Estados** (`TuningStatus`): `tuned` | `high` | `low` | `silent` | `waiting`. El estado alimenta
el texto, el color del `PitchIndicator` y el tinte de fondo (verde→rojo según `|cents|`).
`waiting` y `silent` son ambos "sin señal" pero significan cosas distintas: `waiting` es que
todavía no se detectó nada ("Tocá una cuerda"), `silent` es que había señal y se perdió tras
`HOLD_MS` ("Sin señal"). Antes compartían el rótulo "Escuchando…", y quien no ve no podía
distinguir "estoy esperando que toques" de "dejé de oírte".

### Estabilidad de la lectura — qué se midió y por qué está así

El afinador daba lecturas que saltaban entre "muy baja" y "afinada" sin que nadie tocara la
guitarra. Se midió el detector contra señales sintéticas de frecuencia exacta conocida en vez de
suponer la causa; los resultados descartaron la hipótesis más obvia y cambiaron el diseño:

- **No hay sesgo hacia abajo en YIN.** Con señal limpia el error medio es **+0,7 cents** (lee
  ligeramente *alto*, no bajo), y ese medio cent viene íntegro de la **inarmonicidad** de la cuerda
  real: con armónicos perfectos el sesgo es +0,01 cents, y sube a +2,2 con un coeficiente de
  rigidez alto. Es física de la cuerda, no error del algoritmo, y queda dentro de los ±5 cents
  del umbral de afinado.
- **La dirección del error sí es asimétrica, y por el algoritmo.** En `yin.js`, una vez que la
  función de diferencia baja del umbral, el descenso al mínimo **solo avanza hacia lags mayores**
  (`while (yinBuffer[tau+1] < yinBuffer[tau]) tau++`). Nunca retrocede. Con un mínimo poco profundo
  —señal débil, cuerda apagándose, otra cuerda sonando por simpatía— se pasa de largo y devuelve un
  período más largo, es decir una frecuencia **más baja**. De ahí el "muy baja" súbito.
- **`pitchfinder` descarta la mitad del buffer.** `yin.js` redondea hacia abajo a potencia de dos y
  después divide por dos, y usa la mitad de eso como lags. Con `FFT_SIZE` 4096 quedaban 1024 lags:
  apenas ~1,8 períodos de Mi grave para correlacionar. Con 8192 son ~3,5.
- **El costo real era la falta de suavizado en modo cuerda fija.** Ese modo usaba `rawFreq` directo,
  sin mediana ni EMA — cada frame de YIN llegaba crudo al estado y a la locución.

Sobre seis cuerdas con vecinas sonando por simpatía y ruido de ambiente, comparando el pipeline
anterior con el actual:

| Escenario | Métrica | Antes | Ahora |
| --- | --- | --- | --- |
| Cuerda 8 cents baja | dice "afinada" sin estarlo | 73 | **0** |
| Cuerda 8 cents baja | saltos de escalón | 29 | **1** |
| Cuerda 8 cents baja | lecturas equivocadas | 54 % | **13 %** |
| Cuerda 20 cents baja | saltos de escalón | 25 | **1** |

Las cuatro medidas que lo producen:

1. **Mediana + EMA también en modo cuerda fija**, compartiendo `smoothFrequency` con el automático.
   Es la que más pesa. En modo fijo la lectura se pliega antes a la octava del target
   (`foldToOctaveOf`) para que una detección de la octava vecina promedie con las demás en lugar de
   arrastrar la mediana a un punto intermedio.
2. **`FFT_SIZE` 4096 → 8192**, con `DETECT_INTERVAL_MS` de 50 ms. YIN es O(lags²): a 8192 correrlo
   en cada frame de animación cuadruplica el costo y satura la CPU de un teléfono. A 20 lecturas por
   segundo la ventana de mediana se llena en 250 ms y el costo queda cerca del anterior.
3. **Ventana de seguimiento adaptativa.** Se midieron ventanas fijas de ±60 a ±200: ninguna sirve
   para los dos casos a la vez. Angosta acierta con la cuerda casi afinada pero deja **muda** la
   cuerda muy floja —justo cuando más se necesita el afinador—; ancha la detecta pero deja pasar la
   basura. La solución es enganche ancho (±200, en `centsToTarget`) y seguimiento angosto (±60,
   `TRACK_WINDOW_CENTS`): con una estimación ya establecida, girando la clavija el tono se mueve
   unos pocos cents entre lecturas, así que un salto de 60 es un error de YIN y se descarta. Por
   encima de ±200 es otra cuerda y se acepta de una. Si el rechazo persiste `TRACK_LOST_FRAMES`, se
   re-engancha.
4. **Umbral de afinado a ±5 cents** (ver arriba), que solo es sostenible con las tres anteriores.

Los scripts de medición no se versionan: son de diagnóstico, no del producto.

### Escala verbal (`lib/pitch.ts`)

`tuningStep(cents, isTuned)` → `tuningStepLabel(step, direction)` es la **única** fuente del texto
de estado: la consumen tanto la locución (`useTuner`) como la pantalla (`TunerDisplay`), que antes
divergían.

| Desviación | Locución |
| --- | --- |
| `isTuned` | Afinada |
| < 12 cents | Casi afinada, un poco baja/alta |
| < 25 cents | Un poco baja/alta |
| < 45 cents | Bastante baja/alta |
| resto | Muy baja/alta |

`isTuned` entra como parámetro en vez de derivarse de `|cents|` porque la histéresis vive en
`useTuner`: entre 5 y 10 cents el status puede sostener "afinada", y sin ese dato la escala diría
"casi afinada" contradiciendo a la pantalla.

El escalón **"casi afinada"** es el que resuelve el hallazgo de la prueba: con la escala anterior
(Un poco / Medianamente / Muy) el escalón más fino cubría de 5 a 25 cents, así que se entraba en
"un poco baja" y se seguía escuchando lo mismo mientras se giraba la clavija, sin señal de
acercamiento. Tres participantes se pasaron de largo.

### Dos modos
- **Automático** (`targetStringIndex === null`): detecta qué cuerda se toca. Aplica
  corrección de octava, filtro de mediana + EMA, y reporta la cuerda más cercana con sus
  cents de desviación.
- **Cuerda específica** (`targetStringIndex` 0–5): filtra con `centsToTarget` (ignora
  frecuencias fuera de ±200 cents del target) y muestra siempre esa cuerda.

## Narración (TTS) y bug de auto-escucha

El loop se pausa mientras la app habla: `if (!isListeningRef.current || isSpeakingRef.current) return`.
La narración pasa por un único helper `announce(text)` que usa un **token de generación**
(`speechGenRef`): cada locución toma un `gen`; el `onEnd` solo apaga el guard
`isSpeakingRef` si su `gen` sigue siendo el vigente.

> **Por qué**: antes, al cambiar de modo, `cancelSpeech()` disparaba el `onEnd` de la
> locución *cancelada*, que igual agendaba el reset del guard (con un `setTimeout` de
> 300 ms). Ese reset caía en medio de la siguiente locución (p. ej. "Modo automático"),
> reactivaba la detección y el micrófono captaba la propia voz del narrador como si fuera
> una nota. El token descarta los callbacks de locuciones obsoletas. El colchón de 300 ms
> tras el `onEnd` absorbe la cola acústica antes de reanudar.

El anuncio de modo espera al stream: mientras el navegador pide el permiso, lo único accionable es
aceptarlo, así que ese aviso lo hace `AfinadorScreen` y el `"Modo automático"` sale recién cuando el
micrófono está activo.

Qué se anuncia: al fijar cuerda, `"Afinando cuerda 4, Re."`; en automático,
`"Modo automático. Tocá una cuerda."`; y como feedback,
`"Cuerda 6, Mi. Casi afinada, un poco baja."`.

**La cuerda se nombra al presentarla, no en cada locución.** Que la cuerda apareciera era un
hallazgo del test —antes se decía solo la nota, y las dos cuerdas Mi eran indistinguibles al oído,
así que un participante de espaldas a la pantalla no sabía si el "afinado" era de la cuerda que
había tocado o de otra—, pero repetirla en cada frase estorba el flujo de afinar: quien está
girando la clavija ya sabe en qué cuerda está y lo único nuevo es qué tan cerca quedó. Con la voz
como único canal, cada palabra de más es tiempo en que no se puede escuchar la cuerda ni volver a
medirla, porque el loop no analiza mientras la app habla.

La regla es una sola: **el prefijo sale cuando cambia la cuerda respecto de la última locución**
(`lastStringIdxRef`), y vuelve cuando se cierra el episodio (silencio de `HOLD_MS`, pausa, cambio
de selección). En modo cuerda fija el anuncio de selección cuenta como presentación, así que el
efecto de `targetStringIndex` fija `lastStringIdxRef` y el feedback siguiente arranca directo por
el estado, sin repetir lo que se acaba de decir.

```
"Afinando cuerda 6, Mi."   → "Muy baja." → "Bastante baja." → "Un poco baja."
                             → "Casi afinada, un poco baja." → "Afinada."
```

`resetFeedback` limpia también `lastTtsTimeRef`: al abrir un episodio no hay locución previa que
espaciar, y ahora que el nombre no se repite la primera frase es la que más importa.

### Política de repetición (`speakFeedback`)

Concentrada en un solo helper para que los dos modos no divergan.

1. **Dedupe** por `` `${stringIdx}|${step}|${direction}` ``. Dispara al cambiar de **escalón**, no
   solo de status: ese es el punto de la escala granular.
2. **Estabilidad**: un escalón nuevo debe sostenerse `STEP_STABLE_FRAMES` antes de valer, para no
   ametrallar cuando la desviación oscila sobre el borde entre dos escalones.
3. **Cooldown de 3 s con cuatro excepciones**, todas cosas que hay que avisar en el momento:
   - el escalón **mejora** (se acerca a afinado, según `STEP_RANK`) — sin esto, el aviso de "casi
     afinada" llegaría 2 s tarde, justo cuando ya te pasaste;
   - la **dirección se invierte** (se pasó de largo);
   - **cambia la cuerda**;
   - (llegar a `tuned` queda cubierto por "mejora", rango 0).

### Episodio de feedback

El episodio se cierra (`resetFeedback`) al vencer `HOLD_MS`, al cambiar de cuerda seleccionada y al
pausar, de modo que al retomar una cuerda ya afinada tras una pausa se vuelva a anunciar el
resultado. La dirección se sigue en `spokenDirectionRef` únicamente para detectar que el usuario se
pasó de largo y saltear el cooldown.

> Se probó agregar el verbo de acción `"Tensá"` / `"Aflojá"` al final de la locución, la primera vez
> que se entraba en una dirección. Se quitó: en uso real resulta molesto. El dato accionable ya está
> en "baja" / "alta".

`"Sin señal"` **no se locuta**, solo se muestra: el silencio entre púa y púa es constante y
anunciarlo cada 2 s sería insoportable.

## Limitaciones conocidas

- Los cents exactos no se narran: la escala verbal de 5 escalones los reemplaza. Es deliberado
  (un número de cents no le dice nada a un principiante), pero deja fuera al usuario avanzado que
  quisiera el dato. Ver [`EVAL-AFINADOR.md`](./EVAL-AFINADOR.md).
- `CENTS_THRESHOLD_ENTER = 5` es exigente: con el suavizado actual, una cuerda que decae puede
  costar que baje de 5 cents. Si en el uso real cuesta llegar a "Afinada", la palanca es subir
  `ENTER` a 6-7, no aflojar `STAY`.
- El loop no analiza mientras la app habla. La locución con prefijo
  (`"Cuerda 6, Mi. Casi afinada, un poco baja."`) dura ~2,5 s a velocidad normal; sin prefijo, que
  es el caso habitual mientras se afina una misma cuerda, baja a ~1,5 s.
- **Las cuerdas graves dejan de detectarse antes que las agudas al apagarse.** Medido: con la señal
  a ~1/4 de la amplitud inicial, Mi grave, La y Re dan cero lecturas mientras Si y Mi agudo siguen
  bien. Es el límite del detector a baja frecuencia, no del gate RMS. En la práctica hay que volver
  a pulsar la cuerda grave más seguido.
- El primer par de lecturas tras enganchar puede exagerar la desviación, hasta que la ventana de
  mediana se llena (250 ms). No llega a locutarse porque `speakFeedback` exige `STEP_STABLE_FRAMES`,
  pero sí puede verse un instante en pantalla.
