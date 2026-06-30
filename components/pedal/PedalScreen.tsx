'use client'

// Componente cliente que orquesta el flujo de detección de pedal:
// captura un frame de la cámara, lo envía a /api/pedal/detect, gestiona
// el estado de carga/error/resultado, dispara TTS y compone
// CameraView + PedalInfo. Separado de page.tsx para mantener la página
// como Server Component y poder exportar metadata.

import { useCallback, useState } from 'react'
import CameraView, { type DetectStatus } from '@/components/pedal/CameraView'
import PedalInfo, { type Knob } from '@/components/pedal/PedalInfo'
import { speak } from '@/lib/tts'
import { clockHourToSpanish } from '@/lib/clock'
import { useSettings } from '@/contexts/SettingsContext'

const TTS_READY =
  'Cámara lista. Presioná el botón Detectar pedal para identificar las perillas.'
const TTS_READY_WITH_TORCH =
  'Cámara lista. Si hay poca luz, presioná el botón Encender flash para mejorar la detección. Presioná el botón Detectar pedal para identificar las perillas.'

function buildResultSpeech(knobs: Knob[]): string {
  const parts = knobs.map((k) => `${k.label} a ${clockHourToSpanish(k.value)}`)
  return `Detección completa. ${parts.join('. ')}. Presioná Detectar de nuevo para volver a analizar.`
}

export default function PedalScreen() {
  const { settings } = useSettings()
  const [status, setStatus] = useState<DetectStatus>('idle')
  const [knobs, setKnobs] = useState<Knob[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleReady(torchSupported: boolean) {
    speak(torchSupported ? TTS_READY_WITH_TORCH : TTS_READY, settings.ttsSpeed)
  }

  const handleCapture = useCallback(
    async (file: File) => {
      setStatus('loading')
      setErrorMessage(null)

      const formData = new FormData()
      formData.append('image', file)

      try {
        const res = await fetch('/api/pedal/detect', { method: 'POST', body: formData })
        const data = (await res.json()) as { knobs?: Knob[]; error?: string }

        if (!res.ok || data.error || !data.knobs) {
          const msg = data.error ?? 'No se pudieron detectar perillas en la imagen.'
          setStatus('error')
          setErrorMessage(msg)
          speak(msg, settings.ttsSpeed)
          return
        }

        setKnobs(data.knobs)
        setStatus('done')
        speak(buildResultSpeech(data.knobs), settings.ttsSpeed)
      } catch {
        const msg = 'No se pudo conectar con el servidor. Verificá tu conexión.'
        setStatus('error')
        setErrorMessage(msg)
        speak(msg, settings.ttsSpeed)
      }
    },
    [settings.ttsSpeed]
  )

  return (
    <div className="flex flex-col gap-6 p-4">
      <CameraView status={status} onCapture={handleCapture} onReady={handleReady} />

      {status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div aria-live="polite" aria-atomic="true">
        {status === 'done' && <PedalInfo knobs={knobs} />}
      </div>
    </div>
  )
}
