import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import AjustesContent from '@/app/ajustes/AjustesContent'

export const metadata: Metadata = {
  title: 'Ajustes — Eco',
}

// Accesibilidad: el ícono es decorativo (aria-hidden) — el nombre accesible del link
// lo da el aria-label, nunca la letra dibujada. Target de 44×44, igual que los
// controles de los carruseles de ajustes.
function InfoLink() {
  return (
    <Link
      href="/informacion"
      aria-label="Información y preguntas frecuentes"
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
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="8" x2="12" y2="8" />
      </svg>
    </Link>
  )
}

export default function AjustesPage() {
  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Personalizá el tema, el tamaño de fuente y la velocidad del narrador"
        action={<InfoLink />}
      />
      <AjustesContent />
    </>
  )
}
