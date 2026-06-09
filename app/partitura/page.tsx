import type { Metadata } from 'next'
import PartituraContent from './PartituraContent'

export const metadata: Metadata = {
  title: 'Leer partitura — Eco',
}

export default function PartituraPage() {
  return <PartituraContent />
}
