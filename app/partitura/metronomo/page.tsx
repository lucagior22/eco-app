import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Metrónomo — Eco',
}

export default function MetronomoPage() {
  return (
    <>
      <PageHeader title="Metrónomo" subtitle="Ajustá el tempo y practicá con ritmo" />
      <div className="p-4">
        {/* TODO: implementar en la fase Metrónomo */}
        <p className="text-[var(--color-text-secondary)]">Pantalla de metrónomo (en desarrollo)</p>
      </div>
    </>
  )
}
