// Accesibilidad: la barra de centavos tiene aria-label dinámico con el valor
// exacto, por ejemplo "Desviación: 2 centavos alto". Si hay texto visible que
// describe el estado, la barra puede ser aria-hidden para evitar duplicación.
// El elemento raíz no debe ser el único indicador de estado (requiere texto).

// TODO: implementar en la fase Afinador

export default function PitchIndicator() {
  return (
    <div aria-label="Desviación: 0 centavos">
      {/* Placeholder: barra de centavos */}
      <p className="text-[var(--color-text-secondary)]">Indicador de afinación (en desarrollo)</p>
    </div>
  )
}
