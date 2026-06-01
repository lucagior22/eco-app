'use client'

// Accesibilidad: nav con aria-label, aria-current="page" en ítem activo.
// Los emojis son decorativos (aria-hidden) — el texto del label es el nombre accesible.
// El estado activo se indica con aria-current + subrayado visual, nunca solo color.
// Completamente operable por teclado (usa <Link> de Next que es un <a> nativo).

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/partitura', label: 'Partitura', emoji: '📄' },
  { href: '/pedal', label: 'Pedal', emoji: '🎛️' },
  { href: '/afinador', label: 'Afinador', emoji: '🎵' },
  { href: '/ajustes', label: 'Ajustes', emoji: '⚙️' },
] as const

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegación principal">
      <ul className="fixed right-0 bottom-0 left-0 z-40 flex h-[72px] items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] md:top-0 md:right-auto md:bottom-auto md:h-full md:w-20 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:pt-4">
        {NAV_ITEMS.map(({ href, label, emoji }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] ${
                  isActive
                    ? 'border-b-2 border-[var(--color-accent-blue)] text-[var(--color-accent-blue)]'
                    : ''
                } md:w-full md:flex-col md:items-center md:rounded-none md:border-b-0 md:py-3 ${isActive ? 'md:border-b-0 md:border-l-2 md:border-[var(--color-accent-blue)]' : ''} `}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {emoji}
                </span>
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
