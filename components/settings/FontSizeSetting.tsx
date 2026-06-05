'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { EcoSettings } from '@/lib/settings'

const FONT_SIZE_ORDER: EcoSettings['fontSize'][] = ['sm', 'md', 'lg', 'xl']

const FONT_SIZE_LABELS: Record<EcoSettings['fontSize'], string> = {
  sm: 'Pequeño',
  md: 'Mediano',
  lg: 'Grande',
  xl: 'Muy grande',
}

export function FontSizeSetting() {
  const { settings, setFontSize } = useSettings()
  const currentIndex = FONT_SIZE_ORDER.indexOf(settings.fontSize)

  return (
    <SettingCarousel
      label="Tamaño de fuente"
      options={FONT_SIZE_ORDER.map((s) => FONT_SIZE_LABELS[s])}
      currentIndex={currentIndex}
      onChange={(index) => setFontSize(FONT_SIZE_ORDER[index])}
    />
  )
}
