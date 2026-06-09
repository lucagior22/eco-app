'use client'

// Accesibilidad: el componente es puramente visual (aria-hidden).
// El estado de afinación ya se anuncia via aria-live en TunerDisplay.
// El cents label textual debajo de la barra es visible para todos los usuarios.

import type { TuningStatus } from '@/hooks/useTuner'

interface PitchIndicatorProps {
  cents: number
  status: TuningStatus
}

export default function PitchIndicator({ cents, status }: PitchIndicatorProps) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const positionPct = ((clamped + 50) / 100) * 100

  const dotColor =
    status === 'tuned' ? 'var(--color-success)' : 'var(--color-error)'

  const centsLabel =
    status === 'silent'
      ? ''
      : status === 'tuned'
        ? `${Math.abs(cents)} centavos`
        : `${Math.abs(cents)} centavos ${status === 'high' ? 'alto' : 'bajo'}`

  return (
    <div className="w-full max-w-xs" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-[var(--color-border)]">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--color-text-secondary)] opacity-50" />
        {status !== 'silent' && (
          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-[left] duration-100"
            style={{ left: `${positionPct}%`, backgroundColor: dotColor }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[var(--color-text-secondary)]">
        <span>-50</span>
        <span className="text-[var(--color-text-primary)]">{centsLabel}</span>
        <span>+50</span>
      </div>
    </div>
  )
}
