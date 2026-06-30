'use client'

// Accesibilidad: el componente es puramente visual (aria-hidden).
// La magnitud de la desviación llega al usuario que no ve por el canal único de audio
// (incluida en `announcement` de useTuner: "Mi. 12 centavos alto."), no por esta barra.

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
      : cents === 0
        ? '0'
        : cents > 0
          ? `+${cents}`
          : `${cents}`

  return (
    <div className="w-full max-w-xs" aria-hidden="true">
      <div className="relative h-10 w-full">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--color-border)]" />
        <div className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--color-text-secondary)] opacity-50" />
        {status !== 'silent' && (
          <div
            className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-100"
            style={{
              left: `${positionPct}%`,
              backgroundColor: dotColor,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-base text-[var(--color-text-secondary)]">
        <span>-50</span>
        <span className="font-medium text-[var(--color-text-primary)]">{centsLabel}</span>
        <span>+50</span>
      </div>
    </div>
  )
}
