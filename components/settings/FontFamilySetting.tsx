'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { EcoSettings } from '@/lib/settings'

const FONT_FAMILY_ORDER: EcoSettings['fontFamily'][] = ['hyperlegible', 'inter', 'lexend', 'system']

const FONT_FAMILY_LABELS: Record<EcoSettings['fontFamily'], string> = {
  hyperlegible: 'Atkinson Hyperlegible',
  inter: 'Inter',
  lexend: 'Lexend',
  system: 'Sistema',
}

export function FontFamilySetting() {
  const { settings, setFontFamily } = useSettings()
  const currentIndex = FONT_FAMILY_ORDER.indexOf(settings.fontFamily)

  return (
    <SettingCarousel
      label="Fuente"
      options={FONT_FAMILY_ORDER.map((f) => FONT_FAMILY_LABELS[f])}
      currentIndex={currentIndex}
      onChange={(index) => setFontFamily(FONT_FAMILY_ORDER[index])}
    />
  )
}
