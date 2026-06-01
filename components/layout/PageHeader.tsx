// Accesibilidad: provee el único <h1> de la página. El componente no puede
// usarse dos veces en la misma página (violaría la jerarquía semántica).

interface PageHeaderProps {
  title: string
  subtitle?: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="bg-[var(--color-header-bg)] px-4 py-4">
      <h1 className="text-[1.75rem] leading-tight font-bold text-[var(--color-text-primary)]">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
    </header>
  )
}
