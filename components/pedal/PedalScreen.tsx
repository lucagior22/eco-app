'use client'

// Componente cliente que orquesta el flujo de detección de pedal:
// captura un frame de la cámara, lo envía a /api/pedal/detect, gestiona
// el estado de carga/error/resultado, anuncia el resultado y compone
// CameraView + PedalInfo. Separado de page.tsx para mantener la página
// como Server Component y poder exportar metadata.
//
// Accesibilidad — canal único de audio (useAnnouncer): `announce` es la fuente única del texto a
// anunciar y alimenta los dos canales posibles, TTS primario y región aria-live de fallback.
// Los bloques visuales (error, PedalInfo) no son live regions: si lo fueran, el lector de pantalla
// vocalizaría el mismo texto que el narrador y el usuario escucharía todo dos veces.

import { useCallback, useState } from 'react'
import CameraView, { type DetectStatus } from '@/components/pedal/CameraView'
import PedalInfo, { type Knob } from '@/components/pedal/PedalInfo'
import LiveRegion from '@/components/a11y/LiveRegion'
import { useAnnouncer } from '@/hooks/useAnnouncer'
import { clockHourToSpanish } from '@/lib/clock'

const TTS_READY =
  'Cámara lista. Presioná el botón Detectar pedal para identificar las perillas.'
const TTS_READY_WITH_TORCH =
  'Cámara lista. Si hay poca luz, presioná el botón Encender flash para mejorar la detección. Presioná el botón Detectar pedal para identificar las perillas.'

// Las perillas sin lectura confiable se anuncian como tales en vez de omitirse:
// si se callaran, el usuario contaría mal las perillas del pedal.
function buildResultSpeech(knobs: Knob[]): string {
  const parts = knobs.map((k) =>
    k.value === null
      ? `${k.label}, no pude leerla con confianza`
      : `${k.label} a ${clockHourToSpanish(k.value)}`
  )
  const unread = knobs.filter((k) => k.value === null).length
  const retry =
    unread > 0
      ? 'Probá de nuevo con más luz o acercando la cámara.'
      : 'Presioná Detectar de nuevo para volver a analizar.'
  return `Detección completa. ${parts.join('. ')}. ${retry}`
}

export default function PedalScreen() {
  const [status, setStatus] = useState<DetectStatus>('idle')
  const [knobs, setKnobs] = useState<Knob[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { announce, announcement, liveMode } = useAnnouncer()

  const handleReady = useCallback(
    (torchSupported: boolean) => {
      announce(torchSupported ? TTS_READY_WITH_TORCH : TTS_READY)
    },
    [announce]
  )

  const handleBurstStart = useCallback(() => {
    setStatus('capturing')
    announce('Tomando fotos. Mantené la cámara apuntando al pedal.')
  }, [announce])

  const handleCapture = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        const msg = 'No se pudo capturar la imagen de la cámara.'
        setStatus('error')
        setErrorMessage(msg)
        announce(msg, 'assertive')
        return
      }

      setStatus('loading')
      setErrorMessage(null)

      const formData = new FormData()
      files.forEach((file) => formData.append('image', file))

      try {
        const res = await fetch('/api/pedal/detect', { method: 'POST', body: formData })
        const data = (await res.json()) as { knobs?: Knob[]; error?: string }

        if (!res.ok || data.error || !data.knobs) {
          const msg = data.error ?? 'No se pudieron detectar perillas en la imagen.'
          setStatus('error')
          setErrorMessage(msg)
          announce(msg, 'assertive')
          return
        }

        setKnobs(data.knobs)
        setStatus('done')
        announce(buildResultSpeech(data.knobs))
      } catch {
        const msg = 'No se pudo conectar con el servidor. Verificá tu conexión.'
        setStatus('error')
        setErrorMessage(msg)
        announce(msg, 'assertive')
      }
    },
    [announce]
  )

  // Si la cámara no arranca, `onReady` nunca se dispara: el error de CameraView entra al canal
  // único acá para que el usuario lo escuche aunque no use lector de pantalla.
  const handleCameraError = useCallback(
    (message: string) => announce(message, 'assertive'),
    [announce]
  )

  return (
    <div className="flex flex-col gap-6 p-4">
      <LiveRegion announcement={announcement} liveMode={liveMode} />

      <CameraView
        status={status}
        onCapture={handleCapture}
        onBurstStart={handleBurstStart}
        onReady={handleReady}
        onError={handleCameraError}
      />

      {/* Sin role="alert": el texto del error ya viaja por el canal único de arriba.
          Acá queda solo como información visual. */}
      {status === 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}

      {status === 'done' && <PedalInfo knobs={knobs} />}
    </div>
  )
}
