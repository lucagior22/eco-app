import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import Metronome from '@/components/metronome/Metronome'

export const metadata: Metadata = {
  title: 'Metrónomo — Eco',
}

export default function MetronomoPage() {
  return (
    <>
      <PageHeader title="Metrónomo" subtitle="Ajustá el tempo y practicá con ritmo" />
      {/* Debajo del header: arriba empujaba el <h1> fuera del tope de la pantalla. */}
      <Link
        href="/partitura"
        aria-label="Volver a partitura"
        className="flex items-center gap-2 px-4 pt-4 text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver
      </Link>
      <div className="p-4">
        <Metronome />
      </div>
    </>
  )
}
