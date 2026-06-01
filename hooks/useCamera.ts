'use client'

// Hook para acceso a la cámara via getUserMedia (§6.4 SPECIFICATION.md).
// Usa facingMode: "environment" para cámara trasera en móvil.
// Devuelve el MediaStream activo o null si no hay permiso.

// TODO: implementar en la fase Pedal

export interface UseCameraResult {
  stream: MediaStream | null
  isActive: boolean
  error: string | null
}

/**
 * Solicita acceso a la cámara trasera (environment) y devuelve el stream de video.
 */
export function useCamera(): UseCameraResult {
  // TODO: implementar en la fase Pedal
  return { stream: null, isActive: false, error: null }
}
