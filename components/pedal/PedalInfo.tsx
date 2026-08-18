// Accesibilidad: las perillas detectadas se presentan en una <dl> semántica.
// El nombre de cada perilla es la etiqueta impresa en el pedal ("TONE", "LEVEL")
// cuando el modelo la lee, y la posición en el panel ("Arriba izquierda") cuando
// no: "Tone al medio" es más útil que "Arriba izquierda al medio" para quien no
// ve el pedal.
//
// La posición se expresa con una escala verbal de cinco escalones —la misma idea
// que usa /afinador— y la hora de reloj queda como detalle secundario: un error
// de 15° cambia la hora pero rara vez el escalón.
//
// Una perilla con value null es una que el modelo no leyó con confianza. Se
// muestra igual, con texto explícito: omitirla haría que el usuario contara mal
// las perillas del pedal, y darle un número inventado sería peor todavía,
// porque no tiene cómo verificarlo.

import { clockHourToSpanish, clockHourToScale } from '@/lib/clock'

export interface Knob {
  label: string
  printedLabel: string | null
  value: number | null
  confidence: 'alta' | 'baja'
}

interface PedalInfoProps {
  knobs: Knob[]
}

/** Nombre visible y hablado de la perilla: etiqueta impresa si se leyó, si no la posición. */
export function knobName(knob: Knob): string {
  return knob.printedLabel ?? knob.label
}

/** Texto de la lectura: escala verbal y, entre paréntesis, la hora de reloj. */
export function knobReading(hour: number): string {
  const scale = clockHourToScale(hour)
  const clock = `a ${clockHourToSpanish(hour)}`
  return scale ? `${scale} (${clock})` : clock
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
        {knobs.map((knob) => (
          <div key={`${knob.label}-${knob.printedLabel ?? ''}`}>
            <dt className="text-sm text-[var(--color-text-secondary)]">{knobName(knob)}</dt>
            {knob.value === null ? (
              <dd className="text-lg font-bold text-[var(--color-text-secondary)]">
                Sin lectura confiable
              </dd>
            ) : (
              <dd className="text-2xl font-bold text-[var(--color-text-primary)]">
                {knobReading(knob.value)}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}
