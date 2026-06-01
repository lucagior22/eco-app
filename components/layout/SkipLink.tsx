// Accesibilidad: primer elemento focusable de cada página. Permite a usuarios
// de teclado y lectores de pantalla saltar la navegación repetitiva e ir
// directamente al contenido principal. Visualmente oculto hasta recibir foco.

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-[var(--color-accent-blue)] focus:px-4 focus:py-2 focus:text-white focus:no-underline"
    >
      Ir al contenido principal
    </a>
  )
}
