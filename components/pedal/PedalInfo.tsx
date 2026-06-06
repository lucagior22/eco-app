// Accesibilidad: los parámetros del pedal (Tone, Level, Distorsión) se presentan
// en una <dl> semántica. El estado del LED incluye texto explícito además del
// color para no depender del color como único diferenciador de estado (§ CLAUDE.md).

interface PedalData {
  name: string
  params: { label: string; value: number }[]
  led: 'on' | 'off'
}

// Datos fijos para v1. La interfaz acepta datos dinámicos para facilitar v2.
const MOCK_PEDAL: PedalData = {
  name: 'BOSS DS-1',
  params: [
    { label: 'Tone', value: 50 },
    { label: 'Level', value: 50 },
    { label: 'Distorsión', value: 50 },
  ],
  led: 'off',
}

export default function PedalInfo() {
  const pedal = MOCK_PEDAL

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-4 text-xl font-bold text-[var(--color-text-primary)]">{pedal.name}</h2>
      <dl className="grid grid-cols-2 gap-4">
        {pedal.params.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="text-2xl font-bold text-[var(--color-text-primary)]">{value}%</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-[var(--color-text-secondary)]">LED</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-3 w-3 rounded-full ${pedal.led === 'on' ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="font-semibold text-[var(--color-text-primary)]">
              {pedal.led === 'on' ? 'Encendido' : 'Apagado'}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
