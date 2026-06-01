// Accesibilidad: la imagen de partitura tiene alt descriptivo con el nombre
// del archivo. Si no hay imagen cargada, el placeholder tiene aria-hidden="true".
// El contenedor no anuncia cambios automáticamente (el anuncio lo maneja
// ScoreUpload via aria-live cuando termina la carga).

// TODO: implementar en la fase Partitura

export default function ScorePreview() {
  return (
    <div>
      {/* Placeholder: preview de imagen de partitura */}
      <p className="text-[var(--color-text-secondary)]">
        Vista previa de partitura (en desarrollo)
      </p>
    </div>
  )
}
