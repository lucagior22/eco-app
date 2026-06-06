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
}

export default withSerwist(nextConfig)
