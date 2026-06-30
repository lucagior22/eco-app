// Lógica de metrónomo: click via AudioContext.createOscillator() y vibración
// háptica en cada beat (§6.3 SPECIFICATION.md). El scheduling con BPM en vivo
// vive en hooks/useMetronome.ts; acá solo helpers puros sin estado.

export const BPM_MIN = 40
export const BPM_MAX = 220
export const DEFAULT_BPM = 120

// Compases soportados: tiempos por compás. El acento cae en el tiempo 1.
export const TIME_SIGNATURES = [2, 3, 4] as const
export type TimeSignature = (typeof TIME_SIGNATURES)[number]

const TIME_SIGNATURE_NAMES: Record<TimeSignature, string> = {
  2: 'dos cuartos',
  3: 'tres cuartos',
  4: 'cuatro cuartos',
}

/** Limita un BPM al rango válido 40–220. */
export function clampBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
}

/** Texto hablado del compás para TTS (ej. 4 → "cuatro cuartos"). */
export function timeSignatureToSpanish(beats: TimeSignature): string {
  return TIME_SIGNATURE_NAMES[beats]
}

const ACCENT_FREQ = 1500
const BEAT_FREQ = 1000
const ATTACK_S = 0.001
const DECAY_S = 0.05

/**
 * Programa un click en `time` (segundos en el reloj de `ctx`). El acento del
 * tiempo 1 usa una frecuencia más alta para distinguirse al oído.
 */
export function scheduleClick(ctx: AudioContext, time: number, accent: boolean): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.frequency.value = accent ? ACCENT_FREQ : BEAT_FREQ

  // Envolvente percusiva: ataque casi instantáneo y decay corto para un "tick"
  // seco sin cola que enmascare el siguiente beat a tempos altos.
  const peak = accent ? 1 : 0.7
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(peak, time + ATTACK_S)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + DECAY_S)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + DECAY_S)
}
