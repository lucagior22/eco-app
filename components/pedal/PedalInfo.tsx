// Accesibilidad: las perillas detectadas se presentan en una <dl> semántica.
// v2 no identifica modelo de pedal ni estado de LED (fuera de alcance) —
// solo reporta la posición de cada perilla detectada genéricamente, expresada
// como hora de reloj (1-12, jerga común entre músicos) en vez de porcentaje:
// no requiere saber dónde está el "mínimo" o "máximo" de cada perilla.
//
// Una perilla con value null es una que el detector no pudo leer con acuerdo
// entre las capturas. Se muestra igual, con texto explícito: omitirla haría
// que el usuario contara mal las perillas del pedal, y darle un número
// inventado sería peor todavía, porque no tiene cómo verificarlo.

import { clockHourToSpanish } from '@/lib/clock'

export interface Knob {
  label: string
  value: number | null
  agreement: number
}

interface PedalInfoProps {
  knobs: Knob[]
}

export default function PedalInfo({ knobs }: PedalInfoProps) {
  const unread = knobs.filter((k) => k.value === null).length

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-1 text-xl font-bold text-[var(--color-text-primary)]">
        {knobs.length} {knobs.length === 1 ? 'perilla detectada' : 'perillas detectadas'}
      </h2>

      {unread > 0 && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {unread === 1
            ? 'Una no se pudo leer con confianza. Probá de nuevo con más luz o acercando la cámara.'
            : `${unread} no se pudieron leer con confianza. Probá de nuevo con más luz o acercando la cámara.`}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4">
        {knobs.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
            {value === null ? (
              <dd className="text-lg font-bold text-[var(--color-text-secondary)]">
                Sin lectura confiable
              </dd>
            ) : (
              <dd className="text-2xl font-bold text-[var(--color-text-primary)] capitalize">
                {clockHourToSpanish(value)}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}
