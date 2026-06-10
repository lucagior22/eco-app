'use client'

// Accesibilidad: la región aria-live anuncia nota + estado cuando cambian.
// La fila de cuerdas es una lista de toggle buttons: aria-pressed indica la cuerda seleccionada.
// El display de frecuencia tiene aria-label explícito para no leer el número sin unidad.

import { Button } from 'react-aria-components'
import { GUITAR_STRINGS, NOTE_NAMES_ES } from '@/lib/pitch'
import type { DetectedNote } from '@/lib/pitch'
import type { TuningStatus } from '@/hooks/useTuner'

const STATUS_LABELS: Record<TuningStatus, string> = {
  tuned: 'Afinado',
  high: 'Un poco alto',
  low: 'Un poco bajo',
  silent: 'Escuchando...',
}

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

  return (
    <div className="flex flex-col items-center gap-6">
      <div role="group" aria-label="Seleccionar cuerda" className="flex gap-2">
        {GUITAR_STRINGS.map((s, i) => {
          const isSelected = selectedStringIndex === i
          const isActive = activeStringIndex === i && selectedStringIndex === null

          return (
            <Button
              key={i}
              aria-pressed={isSelected}
              aria-label={`Cuerda ${i + 1}: ${NOTE_NAMES_ES[s.label] ?? s.label}${isSelected ? ', seleccionada' : ''}`}
              onPress={() => onSelectString(isSelected ? null : i)}
              className={[
                'flex h-12 w-12 items-center justify-center rounded-full text-base font-bold transition-colors duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]',
                isSelected
                  ? 'bg-[var(--color-accent)] text-white'
                  : isActive
                    ? 'bg-[var(--color-success)] text-white'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {NOTE_NAMES_ES[s.label] ?? s.label}
            </Button>
          )
        })}
      </div>

      {selectedStringIndex === null && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Tocá una cuerda para modo automático, o seleccioná una
        </p>
      )}

      <div aria-live="polite" aria-atomic="true" className="flex flex-col items-center gap-2 text-center">
        <span
          className={[
            'text-8xl font-bold leading-none',
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
          {STATUS_LABELS[status]}
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
