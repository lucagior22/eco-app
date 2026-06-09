'use client'

// Accesibilidad: el estado de carga usa aria-live="assertive" para anunciarse
// inmediatamente. La lista de acordes es un <ul> semántico con aria-label.
// El botón "Narrar acordes" lee todos los acordes en español via TTS —
// nunca dice "Sim" porque chordToSpanish convierte antes de hablar.

import { useSettings } from '@/contexts/SettingsContext'
import { chordToSpanish } from '@/lib/chords'
import { speak, cancelSpeech } from '@/lib/tts'

interface HarmonyListProps {
  chords: string[]
  status: 'idle' | 'loading' | 'done' | 'error'
  errorMessage: string | null
}

export default function HarmonyList({ chords, status, errorMessage }: HarmonyListProps) {
  const { settings } = useSettings()

  function handleNarrate() {
    cancelSpeech()
    const text = chords.map(chordToSpanish).join('. ')
    speak(text, settings.ttsSpeed)
  }

  if (status === 'idle') return null

  return (
    <section aria-label="Resultado del análisis" className="mt-4">
      {/* Región de anuncios de carga y error — assertive para respuesta inmediata */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {status === 'loading' && 'Analizando partitura'}
        {status === 'error' && (errorMessage ?? 'Error al analizar la partitura')}
        {status === 'done' && chords.length === 0 && 'No se detectaron acordes'}
        {status === 'done' && chords.length > 0 && `Se detectaron ${chords.length} acordes`}
      </div>

      {status === 'loading' && (
        <div
          aria-busy="true"
          className="flex items-center gap-3 rounded-lg bg-[var(--color-surface)] p-4"
        >
          <svg
            className="h-5 w-5 animate-spin text-[var(--color-accent)]"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-[var(--color-text-primary)]">Analizando partitura...</span>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {errorMessage ?? 'Error al analizar la partitura. Intentá de nuevo.'}
        </div>
      )}

      {status === 'done' && chords.length === 0 && (
        <p className="text-[var(--color-text-secondary)]">
          No se detectaron acordes en la partitura.
        </p>
      )}

      {status === 'done' && chords.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Acordes detectados
            </h2>
            <button
              type="button"
              onClick={handleNarrate}
              aria-label="Narrar todos los acordes detectados"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white focus:outline-2 focus:outline-[var(--color-accent)] focus:outline-offset-2"
            >
              Narrar acordes
            </button>
          </div>

          <ul
            aria-label="Acordes detectados"
            className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            {chords.map((chord, i) => (
              <li
                key={`${chord}-${i}`}
                className="flex items-center justify-between px-4 py-3"
              >
                {/* Nombre en notación estándar (visual) */}
                <span
                  className="font-mono text-lg font-bold text-[var(--color-text-primary)]"
                  aria-hidden="true"
                >
                  {chord}
                </span>
                {/* Nombre en español (para screen reader) */}
                <span className="sr-only">{chordToSpanish(chord)}</span>
                {/* Nombre en español visible también */}
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {chordToSpanish(chord)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
