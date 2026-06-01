// Accesibilidad: los parámetros del pedal (Tone, Level, Dist) se presentan
// en una <dl> semántica. El estado del LED incluye texto explícito además
// del color (ej. "LED: apagado") para no depender solo del color como
// diferenciador de estado (§ Accesibilidad CLAUDE.md).

// TODO: implementar en la fase Pedal

export default function PedalInfo() {
  return (
    <dl>
      {/* Placeholder: datos del pedal */}
      <dt className="text-[var(--color-text-secondary)]">Información del pedal (en desarrollo)</dt>
      <dd className="text-[var(--color-text-secondary)]">—</dd>
    </dl>
  )
}
