'use client'

// Hook para acceso al micrófono via getUserMedia (§6.1 SPECIFICATION.md).
// Solicita permiso de audio al montar. Devuelve el MediaStream activo
// o null si no hay permiso / no está disponible.

// TODO: implementar en la fase Afinador

export interface UseMicrophoneResult {
  stream: MediaStream | null
  isActive: boolean
  error: string | null
}

/**
 * Solicita acceso al micrófono y devuelve el stream de audio.
 */
export function useMicrophone(): UseMicrophoneResult {
  // TODO: implementar en la fase Afinador
  return { stream: null, isActive: false, error: null }
}
