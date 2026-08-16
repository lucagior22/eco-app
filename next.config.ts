import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// Serwist genera el service worker en build; lo deshabilitamos en dev
// para evitar que el SW cachee respuestas durante el desarrollo.
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.100.4'],
  // El metrónomo dejó de ser una pantalla anidada de /partitura (ver DECISIONS.md).
  // 308 para no romper enlaces guardados ni las referencias de la documentación anterior.
  async redirects() {
    return [{ source: '/partitura/metronomo', destination: '/metronomo', permanent: true }]
  },
}

export default withSerwist(nextConfig)
