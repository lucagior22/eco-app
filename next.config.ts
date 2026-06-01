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
  /* opciones de Next.js */
}

export default withSerwist(nextConfig)
