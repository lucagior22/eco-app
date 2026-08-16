'use client'

// Canal único de audio de la app: `announce` es la fuente única del texto que el usuario tiene que
// escuchar y alimenta los dos canales posibles. El TTS propio es el primario; la región aria-live
// (ver components/a11y/LiveRegion) es fallback y queda en `off` mientras el navegador soporte Web
// Speech, para que el lector de pantalla no duplique la voz.

import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import type { EcoSettings } from '@/lib/settings'
import { isTtsSupported, speak } from '@/lib/tts'

export type LivePoliteness = 'polite' | 'assertive'
export type LiveMode = 'off' | LivePoliteness

interface Announcer {
  // `speed` solo hace falta para narrar a una velocidad distinta de la guardada — el caso de
  // /ajustes, que demuestra la velocidad elegida antes de que el estado la refleje.
  announce: (
    text: string,
    politeness?: LivePoliteness,
    speed?: EcoSettings['ttsSpeed'],
  ) => void
  announcement: string
  liveMode: LiveMode
}

export type AnnounceFn = Announcer['announce']

export function useAnnouncer(enabled = true): Announcer {
  const { settings } = useSettings()
  const [announcement, setAnnouncement] = useState('')
  const [politeness, setPoliteness] = useState<LivePoliteness>('polite')

  // El soporte de Web Speech no se puede evaluar durante el render: en el servidor no existe
  // `window`, así que daría "no soportado" y el cliente diría lo contrario, rompiendo la hidratación
  // del atributo aria-live. El valor inicial es además el correcto para el HTML servido sin JS,
  // donde no hay narrador posible.
  const [ttsSupported, setTtsSupported] = useState(false)
  useEffect(() => setTtsSupported(isTtsSupported()), [])

  const announce = useCallback(
    (
      text: string,
      nextPoliteness: LivePoliteness = 'polite',
      speed: EcoSettings['ttsSpeed'] = settings.ttsSpeed,
    ) => {
      setAnnouncement(text)
      setPoliteness(nextPoliteness)
      speak(text, speed)
    },
    [settings.ttsSpeed],
  )

  const liveMode: LiveMode = enabled && ttsSupported ? 'off' : politeness

  return { announce, announcement, liveMode }
}
