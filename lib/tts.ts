// Wrapper de Web Speech API para narración por voz (§6.1 SPECIFICATION.md).
// Usa SpeechSynthesis nativo del browser; sin dependencias externas.
// La velocidad (rate) mapea desde EcoSettings.ttsSpeed via TTS_SPEED_RATES (lib/settings.ts).

// TODO: implementar en la fase Afinador

import type { EcoSettings } from '@/lib/settings'
import { TTS_SPEED_RATES } from '@/lib/settings'

/**
 * Narra el texto dado con la velocidad especificada.
 * Cancela cualquier narración en curso antes de empezar.
 */
export function speak(text: string, speed: EcoSettings['ttsSpeed'] = 'normal'): void {
  // TODO: implementar en la fase Afinador
  void text
  void TTS_SPEED_RATES[speed]
}

/**
 * Cancela la narración en curso si la hay.
 */
export function cancelSpeech(): void {
  // TODO: implementar en la fase Afinador
}

/**
 * Devuelve true si el browser soporta Web Speech API.
 */
export function isTtsSupported(): boolean {
  // TODO: implementar en la fase Afinador
  return false
}
