'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { AnnounceFn } from '@/hooks/useAnnouncer'
import type { EcoSettings } from '@/lib/settings'

const FONT_FAMILY_ORDER: EcoSettings['fontFamily'][] = ['hyperlegible', 'inter', 'lexend', 'system']

const FONT_FAMILY_LABELS: Record<EcoSettings['fontFamily'], string> = {
  hyperlegible: 'Atkinson Hyperlegible',
  inter: 'Inter',
  lexend: 'Lexend',
  system: 'Sistema',
}

export function FontFamilySetting({ announce }: { announce: AnnounceFn }) {
  const { settings, setFontFamily } = useSettings()
  const currentIndex = FONT_FAMILY_ORDER.indexOf(settings.fontFamily)

  function handleChange(index: number) {
    setFontFamily(FONT_FAMILY_ORDER[index])
    announce(`Fuente ${FONT_FAMILY_LABELS[FONT_FAMILY_ORDER[index]]}`)
  }

  return (
    <SettingCarousel
      label="Fuente"
      options={FONT_FAMILY_ORDER.map((f) => FONT_FAMILY_LABELS[f])}
      currentIndex={currentIndex}
      onChange={handleChange}
      liveMode="off"
    />
  )
}
