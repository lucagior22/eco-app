'use client'

// Accesibilidad: el elemento de video tiene aria-label="Vista de cámara para
// detección de pedal". El botón de detección tiene aria-label="Detectar pedal
// con la cámara". El overlay de bounding box es aria-hidden="true" (decorativo);
// el resultado se anuncia via aria-live en el componente padre.

// TODO: implementar en la fase Pedal

export default function CameraView() {
  return (
    <div>
      {/* Placeholder: stream de cámara */}
      <p
        aria-label="Vista de cámara para detección de pedal"
        className="text-[var(--color-text-secondary)]"
      >
        Vista de cámara (en desarrollo)
      </p>
    </div>
  )
}
