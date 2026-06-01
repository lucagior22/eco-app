// Wrapper de pitchfinder + detección de nota musical (§6.1 SPECIFICATION.md).
// Algoritmo YIN con buffer de potencia de 2; 2048 da ~46ms de latencia a 44100 Hz.
// A4 = 440 Hz como referencia para el cálculo de nota y centavos.

// TODO: implementar en la fase Afinador

export interface DetectedNote {
  note: string
  octave: number
  frequency: number
  cents: number
}

/**
 * Detecta el pitch dominante en un buffer de audio Float32Array.
 * Devuelve la frecuencia en Hz o null si no se detecta pitch confiable.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  // TODO: implementar en la fase Afinador
  void buffer
  void sampleRate
  return null
}

/**
 * Convierte una frecuencia en Hz a la nota musical más cercana,
 * con la desviación en centavos respecto a esa nota.
 */
export function frequencyToNote(frequency: number): DetectedNote {
  // TODO: implementar en la fase Afinador
  void frequency
  return { note: 'A', octave: 4, frequency: 440, cents: 0 }
}
