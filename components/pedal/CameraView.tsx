'use client'

// Accesibilidad: el elemento de video tiene aria-label="Vista de cámara para
// detección de pedal". El botón de detección tiene aria-label explícito que
// cambia según el estado. El overlay de bounding box es aria-hidden="true"
// (decorativo; el resultado se anuncia via aria-live en PedalScreen).

import { useEffect, useRef } from 'react'
import { useCamera } from '@/hooks/useCamera'

interface CameraViewProps {
  detected: boolean
  onDetect: () => void
  onReady?: () => void
}

export default function CameraView({ detected, onDetect, onReady }: CameraViewProps) {
  const { videoRef, isActive, error } = useCamera()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isActive) {
      onReady?.()
      // Mover el foco al botón para que el usuario solo tenga que doble-tapear
      buttonRef.current?.focus()
    }
  }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Vista de cámara para detección de pedal"
          className="h-full w-full object-cover"
        />

        {detected && (
          <div
            aria-hidden="true"
            className="absolute rounded border-4 border-red-500"
            style={{ top: '20%', left: '15%', width: '70%', height: '60%' }}
          />
        )}

        {!isActive && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="text-sm text-white">Iniciando cámara...</p>
          </div>
        )}
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={onDetect}
        disabled={!isActive}
        aria-label={
          detected
            ? 'Detectar pedal de nuevo con la cámara'
            : 'Detectar pedal con la cámara'
        }
        className="w-full rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-white focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {detected ? 'Detectar de nuevo' : 'Detectar pedal'}
      </button>
    </div>
  )
}
