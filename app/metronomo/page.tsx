import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import Metronome from '@/components/metronome/Metronome'

export const metadata: Metadata = {
  title: 'Metrónomo — Eco',
}

export default function MetronomoPage() {
  return (
    <>
      <PageHeader title="Metrónomo" subtitle="Ajustá el tempo y practicá con ritmo" />
      <div className="p-4">
        <Metronome />
      </div>
    </>
  )
}
