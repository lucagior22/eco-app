// Accesibilidad: provee el único <h1> de la página. El componente no puede
// usarse dos veces en la misma página (violaría la jerarquía semántica).
// `back` y `action` son slots opcionales para controles de la página (links o botones).
// Viven dentro del header para no empujar el título fuera de su lugar; `back` va primero
// en el DOM porque es la salida de la pantalla y tiene que ser lo primero que alcanza el Tab.

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, subtitle, back, action }: PageHeaderProps) {
  return (
    <header className="flex items-start gap-3 bg-[var(--color-header-bg)] px-4 py-4">
      {back}
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.75rem] leading-tight font-bold text-[var(--color-text-primary)]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
