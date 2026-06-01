// Accesibilidad: lista semántica con aria-label="Acordes detectados".
// Cada acorde es un <li> legible por screen reader.
// El estado de carga ("Analizando partitura...") usa aria-live="assertive"
// en el componente padre para anunciarlo al instante.

// TODO: implementar en la fase Partitura

export default function HarmonyList() {
  return (
    <ul aria-label="Acordes detectados">
      {/* Placeholder: lista de acordes */}
      <li className="text-[var(--color-text-secondary)]">Lista de acordes (en desarrollo)</li>
    </ul>
  )
}
