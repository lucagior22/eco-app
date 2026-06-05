import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeSetting } from '@/components/settings/ThemeSetting'

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
        <ThemeSetting />
      </div>
    </>
  )
}
