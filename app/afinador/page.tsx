import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import AfinadorScreen from './AfinadorScreen'

export const metadata: Metadata = {
  title: 'Afinador — Eco',
}

export default function AfinadorPage() {
  return (
    <>
      <PageHeader title="Afinador" subtitle="Tocá tu instrumento para detectar la nota" />
      <AfinadorScreen />
    </>
  )
}
