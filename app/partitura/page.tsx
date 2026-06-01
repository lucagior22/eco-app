import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Leer partitura — Eco',
}

export default function PartiturPage() {
  return (
    <>
      <PageHeader
        title="Leer partitura"
        subtitle="Subí o fotografiá una partitura para detectar los acordes"
      />
      <div className="p-4">
        {/* TODO: implementar en la fase Partitura */}
        <p className="text-[var(--color-text-secondary)]">Pantalla de partitura (en desarrollo)</p>
      </div>
    </>
  )
}
