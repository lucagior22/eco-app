import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Afinador — Eco',
}

export default function AfinadorPage() {
  return (
    <>
      <PageHeader title="Afinador" subtitle="Tocá tu instrumento para detectar la nota" />
      <div className="p-4">
        {/* TODO: implementar en la fase Afinador */}
        <p className="text-[var(--color-text-secondary)]">Pantalla de afinador (en desarrollo)</p>
      </div>
    </>
  )
}
