// Lógica de metrónomo: beep via AudioContext.createOscillator() y
// vibración háptica via navigator.vibrate(50) en cada beat (§6.3 SPECIFICATION.md).
// BPM rango válido: 40–220.

// TODO: implementar en la fase Metrónomo

export interface MetronomeOptions {
  bpm: number
  onBeat?: () => void
}

/**
 * Inicia el metrónomo al BPM indicado.
 * Devuelve una función stop() para detenerlo.
 */
export function startMetronome(options: MetronomeOptions): () => void {
  // TODO: implementar en la fase Metrónomo
  void options
  return () => {}
}

/**
 * Genera un beep corto via AudioContext.
 */
export function playBeep(audioContext: AudioContext): void {
  // TODO: implementar en la fase Metrónomo
  void audioContext
}
