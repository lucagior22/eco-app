import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import PedalScreen from '@/components/pedal/PedalScreen'

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
      <PedalScreen />
    </>
  )
}
