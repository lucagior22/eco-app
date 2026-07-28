'use client'

// Accesibilidad: el elemento de video tiene aria-label="Vista de cámara para
// detección de pedal". El botón de detección tiene aria-label explícito que
// cambia según el estado, y aria-busy mientras se analiza la foto capturada.
// El botón de flash (si el dispositivo lo soporta) usa aria-pressed para
// indicar su estado. El resultado de la detección lo anuncia PedalScreen por su
// canal único (TTS primario + aria-live de fallback), no este componente.
// El error de cámara sí usa role="alert" acá porque no viaja por ese canal:
// si la cámara no arranca, `onReady` nunca se dispara y nadie más lo anuncia.

import { useEffect, useRef } from 'react'
import { useCamera } from '@/hooks/useCamera'

export type DetectStatus = 'idle' | 'loading' | 'done' | 'error'

interface CameraViewProps {
  status: DetectStatus
  onCapture: (file: File) => void
  onReady?: (torchSupported: boolean) => void
}

export default function CameraView({ status, onCapture, onReady }: CameraViewProps) {
  const { videoRef, isActive, error, torchSupported, torchOn, toggleTorch } = useCamera()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isActive) {
      onReady?.(torchSupported)
      // Mover el foco al botón para que el usuario solo tenga que doble-tapear
      buttonRef.current?.focus()
    }
  }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  function captureFrame() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `pedal_${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <p className="font-semibold text-[var(--color-text-primary)]">
          No se puede acceder a la cámara
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{error}</p>
      </div>
    )
  }

  const detected = status === 'done'

  return (
    <div className="flex flex-col gap-4">
      {/* Sin aspect-ratio fijo y con object-contain: se ve el cuadro completo
          que captura la cámara, sin recortar, para poder encuadrar pedales
          altos (la mayoría de los pedales son más altos que anchos). */}
      <div className="relative h-[60vh] max-h-160 w-full overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Vista de cámara para detección de pedal"
          className="h-full w-full object-contain"
        />

        {!isActive && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="text-sm text-white">Iniciando cámara...</p>
          </div>
        )}
      </div>

      {torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!isActive}
          aria-pressed={torchOn}
          aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}
          className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-6 py-3 font-semibold text-(--color-text-primary) focus:outline-2 focus:outline-offset-2 focus:outline-(--color-accent) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {torchOn ? 'Apagar flash' : 'Encender flash'}
        </button>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={captureFrame}
        disabled={!isActive || status === 'loading'}
        aria-busy={status === 'loading'}
        aria-label={
          status === 'loading'
            ? 'Analizando perillas del pedal'
            : detected
              ? 'Detectar pedal de nuevo con la cámara'
              : 'Detectar pedal con la cámara'
        }
        className="w-full rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-white focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? 'Analizando…' : detected ? 'Detectar de nuevo' : 'Detectar pedal'}
      </button>
    </div>
  )
}
