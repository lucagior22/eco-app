'use client'

// Accesibilidad: el elemento de video tiene aria-label="Vista de cámara para
// detección de pedal". El botón de detección tiene aria-label explícito que
// cambia según el estado, y aria-busy mientras se analiza la foto capturada.
// El botón de flash (si el dispositivo lo soporta) usa aria-pressed para
// indicar su estado. El resultado de la detección lo anuncia PedalScreen por su
// canal único (TTS primario + aria-live de fallback), no este componente.
// El error de cámara también viaja por ese canal: se notifica al padre con `onError`
// en vez de anunciarse acá, así el usuario lo escucha sin lector de pantalla.

import { useEffect, useRef } from 'react'
import { useCamera } from '@/hooks/useCamera'

export type DetectStatus = 'idle' | 'capturing' | 'loading' | 'done' | 'error'

// Se toma una ráfaga en vez de una sola foto porque el detector vota entre las
// capturas para descartar lecturas inconsistentes. Van separadas en el tiempo a
// propósito: cuadros consecutivos del stream son casi idénticos y votar entre
// ellos no aportaría nada — es el micromovimiento natural de la mano entre una
// toma y la siguiente lo que da puntos de vista distintos de la misma perilla.
const BURST_FRAMES = 5
const BURST_INTERVAL_MS = 400

interface CameraViewProps {
  status: DetectStatus
  onCapture: (files: File[]) => void
  onBurstStart?: () => void
  onReady?: (torchSupported: boolean) => void
  onError?: (message: string) => void
}

export default function CameraView({
  status,
  onCapture,
  onBurstStart,
  onReady,
  onError,
}: CameraViewProps) {
  const { videoRef, isActive, error, torchSupported, torchOn, toggleTorch } = useCamera()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isActive) {
      onReady?.(torchSupported)
      // Mover el foco al botón para que el usuario solo tenga que doble-tapear
      buttonRef.current?.focus()
    }
  }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) onError?.(`No se puede acceder a la cámara. ${error}`)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  function grabFrame(): Promise<File | null> {
    const video = videoRef.current
    if (!video) return Promise.resolve(null)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(
            blob ? new File([blob], `pedal_${Date.now()}.jpg`, { type: 'image/jpeg' }) : null
          )
        },
        'image/jpeg',
        0.92
      )
    })
  }

  async function captureBurst() {
    onBurstStart?.()
    const files: File[] = []

    for (let i = 0; i < BURST_FRAMES; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS))
      const file = await grabFrame()
      if (file) files.push(file)
    }

    onCapture(files)
  }

  // Sin role="alert": el texto ya viaja por el canal único del padre (onError).
  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="font-semibold text-[var(--color-text-primary)]">
          No se puede acceder a la cámara
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{error}</p>
      </div>
    )
  }

  const detected = status === 'done'
  const busy = status === 'capturing' || status === 'loading'

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
          disabled={!isActive || busy}
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
        onClick={captureBurst}
        disabled={!isActive || busy}
        aria-busy={busy}
        aria-label={
          status === 'capturing'
            ? 'Tomando fotos del pedal, mantené la cámara apuntando'
            : status === 'loading'
              ? 'Analizando perillas del pedal'
              : detected
                ? 'Detectar pedal de nuevo con la cámara'
                : 'Detectar pedal con la cámara'
        }
        className="w-full rounded-lg bg-[var(--color-accent)] px-6 py-3 font-semibold text-white focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'capturing'
          ? 'Tomando fotos…'
          : status === 'loading'
            ? 'Analizando…'
            : detected
              ? 'Detectar de nuevo'
              : 'Detectar pedal'}
      </button>
    </div>
  )
}
