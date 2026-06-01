'use client'

// Accesibilidad: el control carrusel tiene rol "group" con aria-labelledby
// apuntando al id del título. Los botones < y > tienen aria-label dinámico
// ("Tema anterior" / "Siguiente tema"). El valor actual usa aria-live="polite"
// para anunciar el cambio al navegar. Las teclas Izquierda/Derecha también
// cambian el valor (§6.5 SPECIFICATION.md).

// TODO: implementar en la fase Ajustes

interface SettingCarouselProps {
  label: string
  value: string
  options: string[]
}

export default function SettingCarousel({ label, value, options }: SettingCarouselProps) {
  // options se usará en la implementación real para navegar entre valores
  void options
  const labelId = `carousel-label-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="font-medium text-[var(--color-text-primary)]">
        {label}
      </p>
      {/* Placeholder: control < valor > */}
      <div aria-live="polite" aria-atomic="true">
        <p className="text-[var(--color-text-secondary)]">{value}</p>
      </div>
    </div>
  )
}
