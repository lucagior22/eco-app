'use client'

// Componente cliente que orquesta el flujo de detección de pedal:
// gestiona el estado detected, dispara TTS al detectar, y compone
// CameraView + PedalInfo. Separado de page.tsx para mantener la página
// como Server Component y poder exportar metadata.

import { useState } from 'react'
import CameraView from '@/components/pedal/CameraView'
import PedalInfo from '@/components/pedal/PedalInfo'
import { speak } from '@/lib/tts'
import { useSettings } from '@/contexts/SettingsContext'

const TTS_RESULT =
  'Pedal BOSS DS-1 detectado. Tone al 50%. Level al 50%. Distorsión al 50%. LED apagado.'

export default function PedalScreen() {
  const { settings } = useSettings()
  const [detected, setDetected] = useState(false)

  function handleDetect() {
    if (detected) {
      setDetected(false)
      return
    }
    setDetected(true)
    speak(TTS_RESULT, settings.ttsSpeed)
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <CameraView detected={detected} onDetect={handleDetect} />
      <div aria-live="polite" aria-atomic="true">
        {detected && <PedalInfo />}
      </div>
    </div>
  )
}
