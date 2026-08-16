'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { AnnounceFn } from '@/hooks/useAnnouncer'
import type { EcoSettings } from '@/lib/settings'

const FONT_SIZE_ORDER: EcoSettings['fontSize'][] = ['sm', 'md', 'lg', 'xl']

const FONT_SIZE_LABELS: Record<EcoSettings['fontSize'], string> = {
  sm: 'Pequeño',
  md: 'Mediano',
  lg: 'Grande',
  xl: 'Muy grande',
}

export function FontSizeSetting({ announce }: { announce: AnnounceFn }) {
  const { settings, setFontSize } = useSettings()
  const currentIndex = FONT_SIZE_ORDER.indexOf(settings.fontSize)

  function handleChange(index: number) {
    setFontSize(FONT_SIZE_ORDER[index])
    announce(`Tamaño de fuente ${FONT_SIZE_LABELS[FONT_SIZE_ORDER[index]].toLowerCase()}`)
  }

  return (
    <SettingCarousel
      label="Tamaño de fuente"
      options={FONT_SIZE_ORDER.map((s) => FONT_SIZE_LABELS[s])}
      currentIndex={currentIndex}
      onChange={handleChange}
      liveMode="off"
    />
  )
}
