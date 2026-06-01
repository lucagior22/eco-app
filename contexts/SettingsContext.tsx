'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, EcoSettings, loadSettings, saveSettings } from '@/lib/settings'

interface SettingsContextValue {
  settings: EcoSettings
  setTheme: (theme: EcoSettings['theme']) => void
  setFontSize: (fontSize: EcoSettings['fontSize']) => void
  setTtsSpeed: (ttsSpeed: EcoSettings['ttsSpeed']) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<EcoSettings>(DEFAULT_SETTINGS)

  // Leer settings del localStorage al montar (solo en browser)
  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  // Sincronizar localStorage y atributos del DOM al cambiar settings.
  // Se usa effect porque son side effects sobre objetos externos (localStorage, DOM).
  useEffect(() => {
    saveSettings(settings)
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-font-size', settings.fontSize)
  }, [settings])

  function setTheme(theme: EcoSettings['theme']) {
    setSettings((prev) => ({ ...prev, theme }))
  }

  function setFontSize(fontSize: EcoSettings['fontSize']) {
    setSettings((prev) => ({ ...prev, fontSize }))
  }

  function setTtsSpeed(ttsSpeed: EcoSettings['ttsSpeed']) {
    setSettings((prev) => ({ ...prev, ttsSpeed }))
  }

  return (
    <SettingsContext.Provider value={{ settings, setTheme, setFontSize, setTtsSpeed }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings debe usarse dentro de <SettingsProvider>')
  }
  return ctx
}
