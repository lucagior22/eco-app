// Accesibilidad: muestra las seis notas de guitarra (E A D G B E) en fila.
// La nota activa se anuncia via aria-live="polite" en la región de estado.
// El estado textual ("Afinado", "Un poco alto", "Un poco bajo") también
// va en esa región para que el lector de pantalla lo lea junto con la nota.

// TODO: implementar en la fase Afinador

export default function TunerDisplay() {
  return (
    <div>
      {/* Placeholder: notas de guitarra con nota activa resaltada */}
      <div aria-live="polite" aria-atomic="true">
        <p className="text-[var(--color-text-secondary)]">Notas: E A D G B E</p>
      </div>
    </div>
  )
}
