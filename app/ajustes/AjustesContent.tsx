'use client'

// Accesibilidad — canal único de audio (useAnnouncer): una sola región de anuncios para las cinco
// preferencias. Cada setting narra su nuevo valor por el TTS de la app y apaga la región del
// carrusel; con las dos, el lector de pantalla leería el valor dos veces.

import LiveRegion from '@/components/a11y/LiveRegion'
import { ThemeSetting } from '@/components/settings/ThemeSetting'
import { FontSizeSetting } from '@/components/settings/FontSizeSetting'
import { FontFamilySetting } from '@/components/settings/FontFamilySetting'
import { TtsSpeedSetting } from '@/components/settings/TtsSpeedSetting'
import { VibrationSetting } from '@/components/settings/VibrationSetting'
import { useAnnouncer } from '@/hooks/useAnnouncer'

export default function AjustesContent() {
  const { announce, announcement, liveMode } = useAnnouncer()

  return (
    <div className="flex flex-col gap-4 p-4">
      <LiveRegion announcement={announcement} liveMode={liveMode} />

      <ThemeSetting announce={announce} />
      <FontSizeSetting announce={announce} />
      <FontFamilySetting announce={announce} />
      <TtsSpeedSetting announce={announce} />
      <VibrationSetting announce={announce} />
    </div>
  )
}
