// Persistencia de preferencias de accesibilidad en localStorage (§6.5 SPECIFICATION.md).

export interface EcoSettings {
  theme: 'light' | 'dark' | 'high-contrast'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  ttsSpeed: 'slow' | 'normal' | 'fast' | 'very-fast'
}

export const SETTINGS_KEY = 'eco-settings'

export const DEFAULT_SETTINGS: EcoSettings = {
  theme: 'light',
  fontSize: 'md',
  ttsSpeed: 'normal',
}

// Mapeo de velocidad TTS a SpeechSynthesis.rate (§6.5)
export const TTS_SPEED_RATES: Record<EcoSettings['ttsSpeed'], number> = {
  slow: 0.75,
  normal: 1,
  fast: 1.25,
  'very-fast': 1.5,
}

export function loadSettings(): EcoSettings {
  // Guard SSR: localStorage solo existe en el browser
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed = JSON.parse(raw) as Partial<EcoSettings>

    // Merge con defaults para tolerar keys faltantes (ej. settings guardados
    // con una versión anterior de la app que no tenía algún campo)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    // JSON inválido: ignorar y usar defaults
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: EcoSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
