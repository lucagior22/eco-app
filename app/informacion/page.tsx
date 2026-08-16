import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import InformacionContent from '@/app/informacion/InformacionContent'

export const metadata: Metadata = {
  title: 'Información — Eco',
}

// Accesibilidad: la pantalla no está en la barra de navegación, así que necesita su propia
// salida. El ícono es decorativo — el nombre accesible lo da el aria-label. Va dentro del
// header (slot `back`) y es el primer elemento focusable de la página después del skip link.
function BackLink() {
  return (
    <Link
      href="/ajustes"
      aria-label="Volver a Ajustes"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </Link>
  )
}

export default function InformacionPage() {
  return (
    <>
      <PageHeader
        title="Información"
        subtitle="Qué hace cada pantalla y respuestas a las dudas más frecuentes"
        back={<BackLink />}
      />
      <InformacionContent />
    </>
  )
}
