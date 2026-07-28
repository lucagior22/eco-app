'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { EcoSettings } from '@/lib/settings'
import { speak } from '@/lib/tts'

const TTS_SPEED_ORDER: EcoSettings['ttsSpeed'][] = ['slow', 'normal', 'fast', 'very-fast']

const TTS_SPEED_LABELS: Record<EcoSettings['ttsSpeed'], string> = {
  slow: 'Lenta',
  normal: 'Normal',
  fast: 'Rápida',
  'very-fast': 'Muy rápida',
}

export function TtsSpeedSetting() {
  const { settings, setTtsSpeed } = useSettings()
  const currentIndex = TTS_SPEED_ORDER.indexOf(settings.ttsSpeed)

  function handleChange(index: number) {
    const speed = TTS_SPEED_ORDER[index]
    setTtsSpeed(speed)
    // Demostración audible: el usuario no vidente percibe el cambio de velocidad
    // únicamente al escucharlo, por eso se narra una muestra a la velocidad elegida.
    speak(`Velocidad ${TTS_SPEED_LABELS[speed].toLowerCase()}`, speed)
  }

  return (
    <SettingCarousel
      label="Velocidad del narrador"
      options={TTS_SPEED_ORDER.map((s) => TTS_SPEED_LABELS[s])}
      currentIndex={currentIndex}
      onChange={handleChange}
    />
  )
}
