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
| [`lib/tts.ts`](../lib/tts.ts) | Wrapper de Web Speech API (`speak`, `cancelSpeech`). |
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

| Índice | Cuerda | Frecuencia |
| --- | --- | --- |
| 0 | E2 (Mi grave) | 82,41 Hz |
| 1 | A2 (La) | 110,00 Hz |
| 2 | D3 (Re) | 146,83 Hz |
| 3 | G3 (Sol) | 196,00 Hz |
| 4 | B3 (Si) | 246,94 Hz |
| 5 | E4 (Mi agudo) | 329,63 Hz |

## Suavizado y estado de afinación (`useTuner.ts`)

| Constante | Valor | Uso |
| --- | --- | --- |
| `FFT_SIZE` | 4096 | Tamaño del frame de análisis (~93 ms). |
| `MEDIAN_WINDOW` | 5 | Ventana del filtro de mediana sobre el historial de frecuencias. |
| `EMA_ALPHA` | 0.4 | Suavizado exponencial sobre la mediana. |
| `JUMP_THRESHOLD_CENTS` | 200 | Salto > 200 cents → reinicia historial (cambio de cuerda / error de octava). |
| `CENTS_THRESHOLD_ENTER` | 10 | Para **entrar** en estado "afinado" (±10 cents). |
| `CENTS_THRESHOLD_STAY` | 20 | Histéresis: una vez afinado, se mantiene hasta ±20 cents (evita parpadeo). |
| `HOLD_MS` | 2000 | Tiempo que se sostiene la última nota antes de pasar a "silencio" sin señal. |
| `TTS_COOLDOWN_MS` | 3000 | Mínimo entre anuncios de voz. |
| `HIGHPASS_HZ` / `LOWPASS_HZ` | 65 / 1000 | Cortes del band-pass. |

**Estados** (`TuningStatus`): `tuned` | `high` | `low` | `silent`. El estado alimenta el
texto, el color del `PitchIndicator` y el tinte de fondo (verde→rojo según `|cents|`).

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

Qué se anuncia (con cooldown de 3 s y solo ante cambios): al fijar cuerda, `"Afinando <nota>"`;
en automático, `"Modo automático"`; y por cambio de estado, `"<nota>. Afinado/Un poco alto/Un poco bajo."`.

**Excepciones al cooldown/repetición** (para no perder el resultado más importante):
- La transición a `tuned` **ignora el cooldown** de 3 s: al afinar se llega a "Afinado"
  enseguida del aviso previo, y el cooldown lo descartaría. Sigue gateado por el cambio de
  estado, así que no se repite mientras se sostiene afinado.
- Cuando se deja de detectar y vence `HOLD_MS`, se reinicia el seguimiento de anuncios
  (`committedStatusRef`, `lastStatusRef`, `lastNoteKeyRef` a estado "silencio"): así, al
  retomar una cuerda ya afinada tras una pausa, se vuelve a anunciar el resultado.

## Limitaciones conocidas

- La granularidad fina (cents exactos) no se narra; ver hallazgos en
  [`EVAL-AFINADOR.md`](./EVAL-AFINADOR.md).
- Posible conflicto entre el TTS propio y la región `aria-live` del display (ídem informe).
