'use client'

// Accesibilidad: control booleano implementado con Switch de react-aria
// (role="switch" + aria-checked), preferible a un carrusel para un on/off.
// El nombre accesible viene de aria-label="Vibración"; el rol del switch expone el estado al
// lector de pantalla y el cambio se narra además por el canal único, para quien no usa lector.
// El estilo del track/thumb se deriva de los render props (isSelected/isFocusVisible), sin
// depender de variantes de Tailwind.

import { Switch } from 'react-aria-components'
import { useSettings } from '@/contexts/SettingsContext'
import type { AnnounceFn } from '@/hooks/useAnnouncer'

export function VibrationSetting({ announce }: { announce: AnnounceFn }) {
  const { settings, setVibration } = useSettings()

  function handleChange(selected: boolean) {
    setVibration(selected)
    announce(selected ? 'Vibración activada' : 'Vibración desactivada')
    // Confirmación háptica al activar: el usuario siente que la vibración funciona.
    if (selected) navigator.vibrate?.(80)
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Vibración
      </p>
      <Switch
        isSelected={settings.vibration}
        onChange={handleChange}
        aria-label="Vibración"
        className="flex w-full cursor-pointer items-center justify-between gap-3"
      >
        {({ isSelected, isFocusVisible }) => (
          <>
            <span className="text-base font-semibold text-[var(--color-text-primary)]">
              {isSelected ? 'Activada' : 'Desactivada'}
            </span>
            <div
              className={`flex h-7 w-12 items-center rounded-full border border-[var(--color-border)] p-0.5 transition-colors ${
                isSelected ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg)]'
              } ${isFocusVisible ? 'outline outline-[3px] outline-offset-2 outline-[var(--color-focus)]' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`h-5 w-5 rounded-full transition-transform ${
                  isSelected ? 'translate-x-5 bg-white' : 'bg-[var(--color-text-secondary)]'
                }`}
              />
            </div>
          </>
        )}
      </Switch>
    </div>
  )
}
