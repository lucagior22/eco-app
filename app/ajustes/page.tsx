import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import AjustesContent from '@/app/ajustes/AjustesContent'

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
      <AjustesContent />
    </>
  )
}
