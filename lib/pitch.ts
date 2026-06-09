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
    yinDetector = YIN({ sampleRate, threshold: 0.15 })
    lastSampleRate = sampleRate
  }
  const freq = yinDetector(buffer)
  if (!freq || freq < 50 || freq > 1600) return null
  return freq
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
 */
export function centsToTarget(freq: number, targetFreq: number, maxCents = 200): number | null {
  const raw = 1200 * Math.log2(freq / targetFreq)
  const octaves = Math.round(raw / 1200)
  const cents = raw - octaves * 1200
  return Math.abs(cents) < maxCents ? cents : null
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
