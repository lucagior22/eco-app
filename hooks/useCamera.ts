'use client'

// Hook para acceso a la cámara via getUserMedia (§6.4 SPECIFICATION.md).
// Usa facingMode: "environment" para cámara trasera en móvil.
// Conecta el stream al videoRef para renderizado directo; libera el stream al desmontar.

import { type RefObject, useEffect, useRef, useState } from 'react'

export interface UseCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>
  isActive: boolean
  error: string | null
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Tu navegador no soporta acceso a la cámara. Usá un navegador moderno con HTTPS.'
        )
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setIsActive(true)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            setError(
              'Permiso de cámara denegado. Habilitá el acceso a la cámara en la configuración del navegador para usar esta función.'
            )
          } else if (err.name === 'NotFoundError') {
            setError('No se encontró ninguna cámara en este dispositivo.')
          } else {
            setError(
              'No se pudo acceder a la cámara. Verificá que no esté siendo usada por otra aplicación.'
            )
          }
        } else {
          setError('Ocurrió un error inesperado al acceder a la cámara.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  return { videoRef, isActive, error }
}
