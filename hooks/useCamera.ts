'use client'

// Hook para acceso a la cámara via getUserMedia (§6.4 SPECIFICATION.md).
// Usa facingMode: "environment" para cámara trasera en móvil.
// Conecta el stream al videoRef para renderizado directo; libera el stream al desmontar.
//
// El flash (torch) no es parte del estándar W3C de MediaTrackConstraints —
// es una extensión soportada en Chromium/Android pero no en Safari/WebKit
// (iOS), por eso se detecta el soporte real vía getCapabilities() en vez de
// asumir que existe, y la UI lo oculta si el dispositivo no lo permite.

import { type RefObject, useEffect, useRef, useState } from 'react'

// torch no está en los tipos DOM estándar de TypeScript (extensión no W3C).
interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean
}
interface TorchConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean
}

export interface UseCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>
  isActive: boolean
  error: string | null
  torchSupported: boolean
  torchOn: boolean
  toggleTorch: () => Promise<void>
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

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
        // Se pide resolución alta explícita: sin esto el navegador puede
        // entregar un stream de baja resolución (ej. 640x480), insuficiente
        // para que la detección de perillas en /pedal distinga círculos chicos.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        const track = stream.getVideoTracks()[0]
        trackRef.current = track ?? null
        const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined
        setTorchSupported(Boolean(capabilities?.torch))

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

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as TorchConstraintSet],
      })
      setTorchOn(next)
    } catch {
      // Algunos navegadores reportan torch en getCapabilities() pero fallan
      // al aplicarlo (driver/dispositivo). Se ignora: el botón simplemente
      // no tiene efecto, no es un error que deba interrumpir la detección.
    }
  }

  return { videoRef, isActive, error, torchSupported, torchOn, toggleTorch }
}
