'use client'

// Componente cliente que orquesta el flujo de detección de pedal:
// captura un frame de la cámara, lo envía a /api/pedal/detect, gestiona
// el estado de carga/error/resultado, anuncia el resultado y compone
// CameraView + PedalInfo. Separado de page.tsx para mantener la página
// como Server Component y poder exportar metadata.
//
// Accesibilidad — canal único de audio (mismo patrón que /afinador): `announce`
// es la fuente única del texto a anunciar y alimenta los dos canales posibles.
// El TTS de la app es el primario; la región aria-live es fallback y queda en
// `off` mientras el navegador soporte Web Speech. Sin esto, el lector de pantalla
// vocaliza el mismo texto que el narrador y el usuario escucha todo dos veces.
// Los bloques visuales (error, PedalInfo) no son live regions por el mismo motivo.

import { useCallback, useEffect, useState } from 'react'
import CameraView, { type DetectStatus } from '@/components/pedal/CameraView'
import PedalInfo, { type Knob } from '@/components/pedal/PedalInfo'
import { speak, isTtsSupported } from '@/lib/tts'
import { clockHourToSpanish } from '@/lib/clock'
import { useSettings } from '@/contexts/SettingsContext'

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
  const { settings } = useSettings()
  const [status, setStatus] = useState<DetectStatus>('idle')
  const [knobs, setKnobs] = useState<Knob[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // Fuente única del texto a anunciar: todo lo que el usuario tiene que escuchar
  // pasa por acá, así el narrador de la app y la región aria-live de fallback
  // dicen siempre exactamente lo mismo y nunca se solapan.
  const announce = useCallback(
    (text: string) => {
      setAnnouncement(text)
      speak(text, settings.ttsSpeed)
    },
    [settings.ttsSpeed]
  )

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
        announce(msg)
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
          announce(msg)
          return
        }

        setKnobs(data.knobs)
        setStatus('done')
        announce(buildResultSpeech(data.knobs))
      } catch {
        const msg = 'No se pudo conectar con el servidor. Verificá tu conexión.'
        setStatus('error')
        setErrorMessage(msg)
        announce(msg)
      }
    },
    [announce]
  )

  // El soporte de Web Speech no se puede evaluar durante el render: en el servidor
  // no existe `window`, así que daría "no soportado" y el cliente diría lo contrario,
  // rompiendo la hidratación del atributo aria-live. Se resuelve tras montar. El valor
  // inicial (polite) es además el correcto para el HTML servido sin JS, donde no hay
  // narrador posible. A diferencia de /afinador, acá la región vive desde el primer
  // render —no detrás de un estado de carga—, así que la diferencia sí se nota.
  const [ttsSupported, setTtsSupported] = useState(false)
  useEffect(() => setTtsSupported(isTtsSupported()), [])

  // Canal único: cuando el narrador de la app vocaliza, la región aria-live queda
  // en off para no duplicar la voz. Si el navegador no soporta Web Speech, pasa a
  // ser el canal de fallback — assertive para errores, polite para el resultado.
  const liveMode = ttsSupported ? 'off' : status === 'error' ? 'assertive' : 'polite'

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="sr-only" role="status" aria-live={liveMode} aria-atomic="true">
        {announcement}
      </p>

      <CameraView
        status={status}
        onCapture={handleCapture}
        onBurstStart={handleBurstStart}
        onReady={handleReady}
      />

      {/* Sin role="alert": el texto del error ya viaja por el canal único de arriba.
          Acá queda solo como información visual. */}
      {status === 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}

      {status === 'done' && <PedalInfo knobs={knobs} />}
    </div>
  )
}
