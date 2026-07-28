'use client'

// Accesibilidad: el estado de carga usa aria-live="assertive" para anunciarse
// inmediatamente. La lista de acordes es un <ul> semántico con aria-label.
// El botón "Narrar acordes" lee todos los acordes en español via TTS —
// nunca dice "Sim" porque chordToSpanish convierte antes de hablar.
//
// Canal único (mismo criterio que /afinador y /pedal): cada texto se anuncia
// por un solo camino. La región sr-only de abajo es la única live region de la
// pantalla — el bloque visual de error no lleva role="alert", y el nombre en
// español de cada acorde vive en un único nodo, visible y accesible a la vez.
// Duplicar cualquiera de los dos hace que el lector de pantalla lea todo dos veces.

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

  return (
    <>
      {/* Región de anuncios de carga y error — assertive para respuesta inmediata.
          Se renderiza SIEMPRE, incluso en estado idle: un lector de pantalla no
          anuncia una región live que aparece en el DOM al mismo tiempo que su
          contenido. Tiene que existir vacía desde el primer render para que el
          cambio a "Analizando partitura" se escuche. */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {status === 'loading' && 'Analizando partitura'}
        {status === 'error' && (errorMessage ?? 'Error al analizar la partitura')}
        {status === 'done' && chords.length === 0 && 'No se detectaron acordes'}
        {status === 'done' && chords.length > 0 && `Se detectaron ${chords.length} acordes`}
      </div>

      {status !== 'idle' && (
        <section aria-label="Resultado del análisis" className="mt-4">
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

          {/* Sin role="alert": la región aria-live de arriba ya anuncia este mismo
              texto. Con los dos, el lector de pantalla lo lee dos veces. */}
          {status === 'error' && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
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
                    {/* Notación estándar: solo visual. aria-hidden porque hablada
                        ("a eme") no significa nada; el nombre en español de al lado
                        es el que lee el lector de pantalla. */}
                    <span
                      className="font-mono text-lg font-bold text-[var(--color-text-primary)]"
                      aria-hidden="true"
                    >
                      {chord}
                    </span>
                    {/* Nombre en español: visible y accesible con el mismo nodo. Antes
                        estaba duplicado en un span sr-only, lo que hacía que el lector
                        de pantalla leyera "La menor" dos veces por acorde. */}
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {chordToSpanish(chord)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </>
  )
}
