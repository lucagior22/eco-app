// Accesibilidad: botones "Subir archivo" y "Tomar foto" con labels descriptivos
// y roles semánticos. El input file está asociado a su label via htmlFor/id.
// Los mensajes de error de carga usan aria-live="assertive".
// El estado de carga usa aria-busy="true" en el contenedor del formulario.

// TODO: implementar en la fase Partitura

export default function ScoreUpload() {
  return (
    <div>
      {/* Placeholder: botones de carga de partitura */}
      <p className="text-[var(--color-text-secondary)]">Carga de partitura (en desarrollo)</p>
    </div>
  )
}
