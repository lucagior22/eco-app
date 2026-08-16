'use client'

// Accesibilidad: la lista de acordes es un <ul> semántico con aria-label. El botón
// "Narrar acordes" delega en el canal único de PartituraContent (onNarrate) — nunca dice
// "Sim" porque chordToSpanish convierte antes de hablar.
//
// Este componente no anuncia nada por su cuenta: no tiene live region propia y el bloque
// visual de error no lleva role="alert". El nombre en español de cada acorde vive en un
// único nodo, visible y accesible a la vez. Duplicar cualquiera de los dos hace que el
// lector de pantalla lea todo dos veces.

import { chordToSpanish } from '@/lib/chords'

interface HarmonyListProps {
  chords: string[]
  status: 'idle' | 'loading' | 'done' | 'error'
  errorMessage: string | null
  onNarrate: () => void
}

export default function HarmonyList({ chords, status, errorMessage, onNarrate }: HarmonyListProps) {
  return (
    <>
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

          {/* Sin role="alert": el canal único de PartituraContent ya anuncia este mismo
              texto. Con los dos, el lector de pantalla lo lee dos veces. */}
          {status === 'error' && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
              {errorMessage ?? 'Error al analizar la partitura. Intentá de nuevo.'}
            </div>
          )}

          {status === 'done' && chords.length === 0 && (
            <p className="text-[var(--color-text-secondary)]">
              No se detectaron acordes en la imagen. Probá con una foto más nítida o con el
              cifrado bien visible.
            </p>
          )}

          {status === 'done' && chords.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Acordes detectados
                  </h2>
                  {/* Mismo texto que la locución del resultado. Sin role="alert" ni live region:
                      el canal único ya lo dijo y duplicarlo lo hace sonar dos veces. */}
                  <p className="text-sm text-(--color-text-secondary)">
                    La lectura puede tener errores u omisiones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNarrate}
                  aria-label="Narrar todos los acordes detectados"
                  className="shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white focus:outline-2 focus:outline-[var(--color-accent)] focus:outline-offset-2"
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
