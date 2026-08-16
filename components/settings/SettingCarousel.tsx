'use client'

// Accesibilidad: rol "group" con aria-labelledby apuntando al label.
// Botones prev/next tienen aria-label dinámico basado en la prop label.
// El valor actual usa aria-live para anunciar cambios al navegar. `liveMode` permite apagarla
// cuando el padre ya narra el cambio por el TTS de la app (canal único): con las dos, el lector
// de pantalla lee el valor dos veces.
// Teclas ← → cambian el valor cuando el foco está en el grupo (§6.5).

import type { LiveMode } from '@/hooks/useAnnouncer'

interface SettingCarouselProps {
  label: string
  options: readonly string[]
  currentIndex: number
  onChange: (index: number) => void
  liveMode?: LiveMode
}

export default function SettingCarousel({
  label,
  options,
  currentIndex,
  onChange,
  liveMode = 'polite',
}: SettingCarouselProps) {
  const labelId = `carousel-label-${label.toLowerCase().replace(/\s+/g, '-')}`
  const count = options.length

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange((currentIndex - 1 + count) % count)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange((currentIndex + 1) % count)
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <p
        id={labelId}
        className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
      >
        {label}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange((currentIndex - 1 + count) % count)}
          onKeyDown={handleKeyDown}
          aria-label={`${label} anterior`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-2xl text-[var(--color-text-primary)] hover:bg-[var(--color-header-bg)]"
        >
          ‹
        </button>
        <div
          aria-live={liveMode}
          aria-atomic="true"
          className="flex-1 text-center text-base font-semibold text-[var(--color-text-primary)]"
        >
          {options[currentIndex]}
        </div>
        <button
          type="button"
          onClick={() => onChange((currentIndex + 1) % count)}
          onKeyDown={handleKeyDown}
          aria-label={`Siguiente ${label.toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-2xl text-[var(--color-text-primary)] hover:bg-[var(--color-header-bg)]"
        >
          ›
        </button>
      </div>
    </div>
  )
}
