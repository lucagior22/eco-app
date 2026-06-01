import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Detectar pedal — Eco',
}

export default function PedalPage() {
  return (
    <>
      <PageHeader
        title="Detectar pedal"
        subtitle="Apuntá la cámara a un pedal de guitarra para identificarlo"
      />
      <div className="p-4">
        {/* TODO: implementar en la fase Pedal */}
        <p className="text-[var(--color-text-secondary)]">
          Pantalla de detección de pedal (en desarrollo)
        </p>
      </div>
    </>
  )
}
