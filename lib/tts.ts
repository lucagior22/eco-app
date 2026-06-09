// Wrapper de Web Speech API para narración por voz (§6.1 SPECIFICATION.md).
// Usa SpeechSynthesis nativo del browser; sin dependencias externas.
// La velocidad (rate) mapea desde EcoSettings.ttsSpeed via TTS_SPEED_RATES (lib/settings.ts).

import type { EcoSettings } from '@/lib/settings'
import { TTS_SPEED_RATES } from '@/lib/settings'

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Narra el texto dado con la velocidad especificada.
 * Cancela cualquier narración en curso antes de empezar.
 */
export function speak(text: string, speed: EcoSettings['ttsSpeed'] = 'normal'): void {
  if (!isTtsSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = TTS_SPEED_RATES[speed]
  utterance.lang = 'es-AR'
  window.speechSynthesis.speak(utterance)
}

/**
 * Cancela la narración en curso si la hay.
 */
export function cancelSpeech(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel()
}
