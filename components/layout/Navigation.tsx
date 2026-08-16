'use client'

// Accesibilidad: nav con aria-label, aria-current="page" en ítem activo.
// Los íconos son decorativos (aria-hidden) — el texto del label es el nombre accesible.
// El estado activo se indica con aria-current + subrayado visual, nunca solo color.
// Completamente operable por teclado (usa <Link> de Next que es un <a> nativo).

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function PartituraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <circle cx="13.5" cy="18" r="1.5" />
      <line x1="15" y1="15" x2="15" y2="18" />
    </svg>
  )
}

function MetronomoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3h4l4 18H6z" />
      <line x1="7" y1="16" x2="17" y2="16" />
      <line x1="12" y1="16" x2="16" y2="6" />
    </svg>
  )
}

function PedalIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <circle cx="8.5" cy="14" r="2.5" />
      <circle cx="15.5" cy="14" r="2.5" />
      <line x1="7" y1="8" x2="5" y2="4" />
      <line x1="17" y1="8" x2="19" y2="4" />
    </svg>
  )
}

function AfinadorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 15a7 7 0 0 1 14 0" />
      <line x1="5" y1="15" x2="7" y2="15" />
      <line x1="19" y1="15" x2="17" y2="15" />
      <line x1="12" y1="8" x2="12" y2="10" />
      <line x1="12" y1="15" x2="15.5" y2="9.5" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function AjustesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/partitura', label: 'Partitura', icon: <PartituraIcon /> },
  { href: '/metronomo', label: 'Metrónomo', icon: <MetronomoIcon /> },
  { href: '/pedal', label: 'Pedal', icon: <PedalIcon /> },
  { href: '/afinador', label: 'Afinador', icon: <AfinadorIcon /> },
  { href: '/ajustes', label: 'Ajustes', icon: <AjustesIcon /> },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegación principal">
      <ul className="fixed right-0 bottom-0 left-0 z-40 flex min-h-(--nav-height) items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] md:top-0 md:right-auto md:bottom-auto md:h-full md:w-20 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:pt-4">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href} className="min-w-0 flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded px-1 py-1 text-center text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] ${
                  isActive
                    ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                    : ''
                } md:w-full md:flex-col md:items-center md:rounded-none md:border-b-0 md:py-3 ${isActive ? 'md:border-b-0 md:border-l-2 md:border-[var(--color-accent)]' : ''} `}
              >
                {icon}
                {/* El label es el nombre accesible del ítem: con cinco ítems y la fuente en xl
                    se parte en dos líneas (hyphens-auto corta por sílaba en es), nunca se trunca. */}
                <span className="leading-tight wrap-break-word hyphens-auto">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
