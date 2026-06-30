// Accesibilidad: las perillas detectadas se presentan en una <dl> semántica.
// v2 no identifica modelo de pedal ni estado de LED (fuera de alcance) —
// solo reporta la posición de cada perilla detectada genéricamente, expresada
// como hora de reloj (1-12, jerga común entre músicos) en vez de porcentaje:
// no requiere saber dónde está el "mínimo" o "máximo" de cada perilla.

import { clockHourToSpanish } from '@/lib/clock'

export interface Knob {
  label: string
  value: number
}

interface PedalInfoProps {
  knobs: Knob[]
}

export default function PedalInfo({ knobs }: PedalInfoProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-4 text-xl font-bold text-[var(--color-text-primary)]">
        {knobs.length} {knobs.length === 1 ? 'perilla detectada' : 'perillas detectadas'}
      </h2>
      <dl className="grid grid-cols-2 gap-4">
        {knobs.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="text-2xl font-bold text-[var(--color-text-primary)] capitalize">
              {clockHourToSpanish(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
