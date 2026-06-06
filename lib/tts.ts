import type { EcoSettings } from '@/lib/settings'
import { TTS_SPEED_RATES } from '@/lib/settings'

export function speak(
  text: string,
  speed: EcoSettings['ttsSpeed'] = 'normal',
  onEnd?: () => void,
): void {
  if (!isTtsSupported()) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = TTS_SPEED_RATES[speed]
  utterance.lang = 'es-AR'
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel()
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
