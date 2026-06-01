'use client'

// Accesibilidad: el display de BPM usa aria-live="polite" para anunciar
// cambios al presionar +/-. El botón Play tiene aria-pressed="true/false"
// y cambia su label entre "Iniciar metrónomo" y "Detener metrónomo".
// Los botones +/- tienen aria-label="Incrementar BPM" y "Decrementar BPM".
// El rango válido es 40–220 BPM (§6.3 SPECIFICATION.md).

// TODO: implementar en la fase Metrónomo

export default function Metronome() {
  return (
    <div>
      {/* Placeholder: display BPM + controles */}
      <p className="text-[var(--color-text-secondary)]">Metrónomo (en desarrollo)</p>
    </div>
  )
}
