'use client'

import SettingCarousel from '@/components/settings/SettingCarousel'
import { useSettings } from '@/contexts/SettingsContext'
import type { EcoSettings } from '@/lib/settings'

const THEME_ORDER: EcoSettings['theme'][] = ['light', 'dark', 'hc-light', 'hc-dark']

const THEME_LABELS: Record<EcoSettings['theme'], string> = {
  light: 'Claro',
  dark: 'Oscuro',
  'hc-light': 'Alto contraste claro',
  'hc-dark': 'Alto contraste oscuro',
}

export function ThemeSetting() {
  const { settings, setTheme } = useSettings()
  const currentIndex = THEME_ORDER.indexOf(settings.theme)

  return (
    <SettingCarousel
      label="Color"
      options={THEME_ORDER.map((t) => THEME_LABELS[t])}
      currentIndex={currentIndex}
      onChange={(index) => setTheme(THEME_ORDER[index])}
    />
  )
}
