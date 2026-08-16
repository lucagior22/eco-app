import { YIN } from 'pitchfinder'
import type { PitchDetector } from 'pitchfinder/lib/detectors/types'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const NOTE_NAMES_ES: Record<string, string> = {
  C: 'Do',
  'C#': 'Do sostenido',
  D: 'Re',
  'D#': 'Re sostenido',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa sostenido',
  G: 'Sol',
  'G#': 'Sol sostenido',
  A: 'La',
  'A#': 'La sostenido',
  B: 'Si',
}

export interface DetectedNote {
  note: string
  octave: number
  frequency: number
  cents: number
}

export const GUITAR_STRINGS = [
  { label: 'E', frequency: 82.41 },
  { label: 'A', frequency: 110.0 },
  { label: 'D', frequency: 146.83 },
  { label: 'G', frequency: 196.0 },
  { label: 'B', frequency: 246.94 },
  { label: 'E', frequency: 329.63 },
] as const

let yinDetector: PitchDetector | null = null
let lastSampleRate = 0

function rms(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / buffer.length)
}

export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  if (rms(buffer) < 0.003) return null
  if (sampleRate !== lastSampleRate || !yinDetector) {
    // threshold 0.15: más permisivo que el default (0.1), mejora la detección
    // de E2 (82 Hz) cuya señal es más débil y tiene más ruido de arco.
    // No se aplica ventana (Hann): YIN es un método de dominio temporal basado en la
    // función de diferencia; enventanar atenúa los bordes y rompe la periodicidad,
    // impidiendo que la diferencia baje del umbral (devolvería null en cada frame).
    yinDetector = YIN({ sampleRate, threshold: 0.15 })
    lastSampleRate = sampleRate
  }
  const freq = yinDetector(buffer)
  if (!freq || freq < 50 || freq > 1600) return null
  return freq
}

/**
 * Corrige errores de octava de YIN: a veces detecta un subarmónico (freq/2) o el primer
 * armónico (freq×2) en lugar de la fundamental. Evalúa {÷2, ×1, ×2} contra las cuerdas
 * de la guitarra y devuelve el candidato más cercano a alguna cuerda. Se compara contra
 * las cuerdas (no contra la escala cromática) porque las octavas son cromáticamente
 * equivalentes: una nota afinada tendría sus octavas igual de "afinadas" y el criterio
 * cromático elegiría siempre la más grave. Las 6 cuerdas no están espaciadas en octavas,
 * así que una octava errónea cae lejos de todas y se descarta.
 */
export function correctOctave(freq: number): number {
  const candidates = [freq / 2, freq, freq * 2].filter((f) => f >= 50 && f <= 1600)
  let best = freq
  let bestCents = Infinity
  for (const f of candidates) {
    const idx = closestStringIndex(f)
    const cents = Math.abs(1200 * Math.log2(f / GUITAR_STRINGS[idx].frequency))
    if (cents < bestCents) {
      bestCents = cents
      best = f
    }
  }
  return best
}

export function frequencyToNote(frequency: number): DetectedNote {
  const midiExact = 12 * Math.log2(frequency / 440) + 69
  const midiRounded = Math.round(midiExact)
  const cents = Math.round((midiExact - midiRounded) * 100)
  const octave = Math.floor(midiRounded / 12) - 1
  const noteIndex = ((midiRounded % 12) + 12) % 12
  return { note: NOTE_NAMES[noteIndex], octave, frequency, cents }
}

/**
 * Devuelve los cents de desviación de `freq` respecto a la octava más cercana
 * de `targetFreq`. Permite comparar E3 detectado contra un target E2.
 * Retorna null si la desviación supera el umbral (no es esta cuerda).
 *
 * `maxCents` 200 es la ventana de *enganche*, deliberadamente ancha para que una cuerda muy
 * floja registre igual. El filtrado fino de lecturas espurias lo hace el seguimiento en
 * useTuner, no esta función: estrechar la ventana acá dejaba muda la cuerda destemplada,
 * que es justo cuando más se necesita el afinador.
 */
export function centsToTarget(freq: number, targetFreq: number, maxCents = 200): number | null {
  const raw = 1200 * Math.log2(freq / targetFreq)
  const octaves = Math.round(raw / 1200)
  const cents = raw - octaves * 1200
  return Math.abs(cents) < maxCents ? cents : null
}

/**
 * Lleva `freq` a la octava de `targetFreq`. Permite promediar lecturas entre frames en
 * modo cuerda fija: sin esto, si YIN alterna entre la fundamental y un subarmónico, la
 * mediana caería en un punto intermedio que no corresponde a ninguna de las dos.
 */
export function foldToOctaveOf(freq: number, targetFreq: number): number {
  const octaves = Math.round(Math.log2(freq / targetFreq))
  return freq / 2 ** octaves
}

export function closestStringIndex(frequency: number): number {
  let closestIdx = 0
  let minDiff = Infinity
  for (let i = 0; i < GUITAR_STRINGS.length; i++) {
    const diff = Math.abs(1200 * Math.log2(frequency / GUITAR_STRINGS[i].frequency))
    if (diff < minDiff) {
      minDiff = diff
      closestIdx = i
    }
  }
  return closestIdx
}

export type TuningStep = 'tuned' | 'almost' | 'slight' | 'off' | 'far'
export type TuningDirection = 'high' | 'low' | 'none'

const STEP_ALMOST_CENTS = 12
const STEP_SLIGHT_CENTS = 25
const STEP_OFF_CENTS = 45

/**
 * Escalón verbal de afinación. `isTuned` viene del status con histéresis de useTuner y manda:
 * entre 5 y 10 cents la histéresis sostiene "afinada", y sin este parámetro la escala diría
 * "casi afinada" contradiciendo a la pantalla.
 */
export function tuningStep(cents: number, isTuned: boolean): TuningStep {
  if (isTuned) return 'tuned'
  const abs = Math.abs(cents)
  if (abs < STEP_ALMOST_CENTS) return 'almost'
  if (abs < STEP_SLIGHT_CENTS) return 'slight'
  if (abs < STEP_OFF_CENTS) return 'off'
  return 'far'
}

export function tuningDirection(cents: number, isTuned: boolean): TuningDirection {
  if (isTuned) return 'none'
  return cents > 0 ? 'high' : 'low'
}

/**
 * Etiqueta de la escala verbal, compartida por la locución y la pantalla para que no se
 * contradigan. El escalón "casi afinada" es el que avisa que se está llegando: sin él, quien
 * gira la clavija escucha "un poco baja" durante todo el trayecto y se pasa de largo.
 * Género femenino: el sujeto siempre es la cuerda.
 */
export function tuningStepLabel(step: TuningStep, direction: TuningDirection): string {
  if (step === 'tuned' || direction === 'none') return 'Afinada'
  const side = direction === 'high' ? 'alta' : 'baja'
  switch (step) {
    case 'almost':
      return `Casi afinada, un poco ${side}`
    case 'slight':
      return `Un poco ${side}`
    case 'off':
      return `Bastante ${side}`
    case 'far':
      return `Muy ${side}`
  }
}

// GUITAR_STRINGS[0] es Mi grave, que para quien toca es la 6ª cuerda: el índice va al revés.
export function stringNumber(index: number): number {
  return GUITAR_STRINGS.length - index
}
