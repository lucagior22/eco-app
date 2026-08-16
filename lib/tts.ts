import type { EcoSettings } from '@/lib/settings'
import { TTS_SPEED_RATES } from '@/lib/settings'

interface PendingSpeech {
  text: string
  speed: EcoSettings['ttsSpeed']
  onEnd?: () => void
}

// Los navegadores descartan la síntesis de voz que no proviene de un gesto del usuario y la API no
// reporta el descarte. La locución se intenta siempre y solo se retiene si se comprueba que no
// arrancó: dar por perdida la voz antes de intentarla dejaría muda a la pantalla en los casos en
// que el navegador sí habla —escritorio, o después de un permiso resuelto en el diálogo del
// navegador, que no cuenta como gesto de la página—. Lo retenido sale con el primer
// pointerdown/keydown. Solo se conserva la última: si hubo varios anuncios antes del gesto, el
// único vigente es el más reciente.
let unlocked = false
let pending: PendingSpeech | null = null
let listenerAttached = false

// Identifica la locución vigente: si se cancela o se pide otra antes de que salga, la anterior se
// descarta en vez de sonar tarde.
let emitToken = 0

// Ventana para comprobar que la locución arrancó. Basta con que la síntesis no esté ociosa; una
// locución muy corta que ya terminó no se confunde con una descartada porque `onstart` la marcó.
const VERIFY_MS = 250

function emit(text: string, speed: EcoSettings['ttsSpeed'], onEnd?: () => void): void {
  const token = ++emitToken

  // Una locución retenida que quedó atrás se descarta con la misma semántica que tiene
  // `speechSynthesis.cancel()` sobre una en curso: se dispara su onEnd.
  const superseded = pending
  pending = null
  superseded?.onEnd?.()

  window.speechSynthesis.cancel()

  // `speak()` en el mismo tick que `cancel()` puede perderse, y el diálogo de permisos —que le
  // saca el foco a la página— puede dejar la síntesis en pausa. El tick de separación y `resume()`
  // cubren las dos cosas.
  setTimeout(() => {
    if (token !== emitToken) {
      onEnd?.()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = TTS_SPEED_RATES[speed]
    utterance.lang = 'es-AR'
    utterance.onstart = () => {
      unlocked = true
    }
    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = onEnd
    }
    window.speechSynthesis.resume()
    window.speechSynthesis.speak(utterance)

    // El descarte por falta de gesto no emite ningún evento: la síntesis simplemente queda ociosa.
    // Se detecta por ausencia y recién ahí se retiene el texto para el primer gesto.
    setTimeout(() => {
      if (unlocked || token !== emitToken) return
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return
      pending = { text, speed, onEnd }
      ensureUnlockListener()
    }, VERIFY_MS)
  }, 0)
}

function ensureUnlockListener(): void {
  if (listenerAttached) return
  listenerAttached = true

  const onGesture = () => {
    unlocked = true
    window.removeEventListener('pointerdown', onGesture, true)
    window.removeEventListener('keydown', onGesture, true)
    if (pending) {
      const { text, speed, onEnd } = pending
      pending = null
      emit(text, speed, onEnd)
    }
  }

  window.addEventListener('pointerdown', onGesture, true)
  window.addEventListener('keydown', onGesture, true)
}

export function speak(
  text: string,
  speed: EcoSettings['ttsSpeed'] = 'normal',
  onEnd?: () => void,
): void {
  if (!isTtsSupported()) {
    onEnd?.()
    return
  }
  emit(text, speed, onEnd)
}

export function cancelSpeech(): void {
  if (!isTtsSupported()) return
  emitToken++
  window.speechSynthesis.cancel()
  const canceled = pending
  pending = null
  canceled?.onEnd?.()
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
