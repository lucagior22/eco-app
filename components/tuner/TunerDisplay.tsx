'use client'

// Accesibilidad: este display es puramente visual. El anuncio de nota + estado al usuario
// que no ve viaja por el canal único (TTS de la app + región aria-live en AfinadorScreen,
// alimentada por `announcement` de useTuner), no por este bloque, para evitar doble voz.
// El texto de estado sale de la misma escala compartida que la locución (lib/pitch), para que
// pantalla y voz nunca digan cosas distintas.
// La fila de cuerdas es una lista de toggle buttons: aria-pressed indica la cuerda seleccionada.
// El display de frecuencia tiene aria-label explícito para no leer el número sin unidad.

import { Button } from 'react-aria-components'
import {
  GUITAR_STRINGS,
  NOTE_NAMES_ES,
  stringNumber,
  tuningDirection,
  tuningStep,
  tuningStepLabel,
} from '@/lib/pitch'
import type { DetectedNote } from '@/lib/pitch'
import type { TuningStatus } from '@/hooks/useTuner'

// Solo los dos estados sin señal tienen texto fijo: "todavía no te oí" y "dejé de oírte" son
// situaciones distintas y antes compartían el mismo "Escuchando...".
const IDLE_LABELS = {
  waiting: 'Tocá una cuerda',
  silent: 'Sin señal',
} as const

interface TunerDisplayProps {
  detectedNote: DetectedNote | null
  status: TuningStatus
  activeStringIndex: number | null
  selectedStringIndex: number | null
  onSelectString: (index: number | null) => void
}

export default function TunerDisplay({
  detectedNote,
  status,
  activeStringIndex,
  selectedStringIndex,
  onSelectString,
}: TunerDisplayProps) {
  const noteLabel = detectedNote ? (NOTE_NAMES_ES[detectedNote.note] ?? detectedNote.note) : '—'
  const isTuned = status === 'tuned'
  const cents = detectedNote?.cents ?? 0
  const statusLabel =
    status === 'silent'
      ? IDLE_LABELS.silent
      : status === 'waiting'
        ? IDLE_LABELS.waiting
        : tuningStepLabel(tuningStep(cents, isTuned), tuningDirection(cents, isTuned))

  return (
    <div className="flex flex-col items-center gap-6">
      {/* flex-wrap + tamaños mínimos: con la fuente en xl las seis pastillas no entran en una
          fila de 375 px, y antes se recortaban contra el borde en vez de bajar de línea. */}
      <div role="group" aria-label="Seleccionar cuerda" className="flex flex-wrap justify-center gap-2">
        {GUITAR_STRINGS.map((s, i) => {
          const isSelected = selectedStringIndex === i
          const isActive = activeStringIndex === i && selectedStringIndex === null
          const num = stringNumber(i)
          const name = NOTE_NAMES_ES[s.label] ?? s.label

          return (
            <Button
              key={i}
              aria-pressed={isSelected}
              aria-label={`Cuerda ${num}: ${name}${isSelected ? ', seleccionada' : ''}`}
              onPress={() => onSelectString(isSelected ? null : i)}
              className={[
                'flex min-h-12 min-w-12 items-center justify-center rounded-full px-3 py-2 text-base font-bold transition-colors duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]',
                isSelected
                  ? 'bg-[var(--color-accent)] text-white'
                  : isActive
                    ? 'bg-[var(--color-success)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {num} · {name}
            </Button>
          )
        })}
      </div>

      {selectedStringIndex === null && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Seleccioná una cuerda o afiná en modo automático
        </p>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <span
          className={[
            'text-[clamp(3.5rem,20vw,6rem)] font-bold leading-none',
            isTuned ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {noteLabel}
        </span>
        <span
          className={[
            'text-xl font-semibold',
            isTuned ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {statusLabel}
        </span>
      </div>

      {detectedNote && (
        <p
          aria-label={`Frecuencia: ${detectedNote.frequency.toFixed(2)} hertz`}
          className="text-sm tabular-nums text-[var(--color-text-secondary)]"
        >
          {detectedNote.frequency.toFixed(2)} Hz
        </p>
      )}
    </div>
  )
}
