import type { MetadataRoute } from 'next'

// Manifest PWA exacto de §7 SPECIFICATION.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eco — Asistente musical accesible',
    short_name: 'Eco',
    start_url: '/afinador',
    display: 'standalone',
    background_color: '#F2F2F7',
    theme_color: '#F2F2F7',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
