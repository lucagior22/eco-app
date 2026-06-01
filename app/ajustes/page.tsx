import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Ajustes — Eco',
}

export default function AjustesPage() {
  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Personalizá el tema, el tamaño de fuente y la velocidad del narrador"
      />
      <div className="p-4">
        {/* TODO: implementar en la fase Ajustes */}
        <p className="text-[var(--color-text-secondary)]">Pantalla de ajustes (en desarrollo)</p>
      </div>
    </>
  )
}
