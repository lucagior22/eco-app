'use client'

// Región de anuncios de una pantalla: canal de fallback del patrón de useAnnouncer.
// Se monta siempre, vacía desde el primer render — un lector de pantalla no anuncia de forma
// confiable una región live que aparece en el DOM junto con su contenido.

import type { LiveMode } from '@/hooks/useAnnouncer'

interface LiveRegionProps {
  announcement: string
  liveMode: LiveMode
}

export default function LiveRegion({ announcement, liveMode }: LiveRegionProps) {
  return (
    <p className="sr-only" role="status" aria-live={liveMode} aria-atomic="true">
      {announcement}
    </p>
  )
}
