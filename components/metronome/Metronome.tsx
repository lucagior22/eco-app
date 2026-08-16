'use client'

// Accesibilidad — canal único de audio (useAnnouncer): BPM, compás e inicio/detención se narran
// por el TTS de la app, con la región aria-live como fallback. El display grande de BPM y el
// carrusel de compás no son live regions para no duplicar la voz. El BPM se narra al soltar el
// botón, no en cada paso: con auto-repeat cada 150ms sería inusable.
// El botón Play tiene aria-pressed y alterna su label entre "Iniciar metrónomo" y "Detener
// metrónomo". Los botones +/- tienen aria-label "Incrementar/Decrementar BPM". El indicador
// visual de pulso es aria-hidden: es redundante con el audio y distingue el acento por tamaño,
// no solo por color. Rango válido 40–220 BPM (§6.3 SPECIFICATION.md).

import { useCallback, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import { useSettings } from '@/contexts/SettingsContext'
import { useMetronome } from '@/hooks/useMetronome'
import LiveRegion from '@/components/a11y/LiveRegion'
import SettingCarousel from '@/components/settings/SettingCarousel'
import { useAnnouncer } from '@/hooks/useAnnouncer'
import {
  BPM_MIN,
  BPM_MAX,
  DEFAULT_BPM,
  TIME_SIGNATURES,
  clampBpm,
  timeSignatureToSpanish,
} from '@/lib/metronome'

const HOLD_REPEAT_MS = 150

const BTN =
  'flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-medium text-[var(--color-text-primary)] pressed:opacity-70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]'

const STEP_BTN =
  'flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-3xl font-semibold text-[var(--color-text-primary)] pressed:opacity-70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]'

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

const TIME_SIGNATURE_LABELS = TIME_SIGNATURES.map((b) => `${b}/4`)

export default function Metronome() {
  const { settings } = useSettings()
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [signatureIndex, setSignatureIndex] = useState(TIME_SIGNATURES.indexOf(4))
  const [isPlaying, setIsPlaying] = useState(false)
  const { announce, announcement, liveMode } = useAnnouncer()

  const beatsPerMeasure = TIME_SIGNATURES[signatureIndex]

  const vibration = settings.vibration
  const onBeat = useCallback(
    (_beat: number, accent: boolean) => {
      if (vibration) navigator.vibrate?.(accent ? 80 : 50)
    },
    [vibration],
  )

  const { currentBeat } = useMetronome({ bpm, beatsPerMeasure, isPlaying, onBeat })

  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // El valor vive también en un ref para poder narrarlo al soltar el botón: el intervalo de
  // auto-repeat no ve el estado actualizado de React.
  const bpmRef = useRef(DEFAULT_BPM)

  const startHold = useCallback((delta: number) => {
    const step = () => {
      bpmRef.current = clampBpm(bpmRef.current + delta)
      setBpm(bpmRef.current)
    }
    step()
    holdRef.current = setInterval(step, HOLD_REPEAT_MS)
  }, [])

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current)
      holdRef.current = null
      announce(`${bpmRef.current} pulsos por minuto`)
    }
  }, [announce])

  function handleSignatureChange(index: number) {
    setSignatureIndex(index)
    announce(`Compás de ${timeSignatureToSpanish(TIME_SIGNATURES[index])}`)
  }

  function togglePlay() {
    const next = !isPlaying
    setIsPlaying(next)
    announce(
      next
        ? `${bpm} pulsos por minuto, compás de ${timeSignatureToSpanish(beatsPerMeasure)}`
        : 'Metrónomo detenido',
    )
  }

  return (
    <div className="flex flex-col items-center gap-10 py-8">
      <LiveRegion announcement={announcement} liveMode={liveMode} />

      <div className="flex flex-col items-center gap-1">
        {/* Solo visual: el valor se anuncia por el canal único al soltar +/-. */}
        <p className="text-7xl font-bold tabular-nums text-[var(--color-text-primary)]">
          {bpm}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">pulsos por minuto</p>
      </div>

      <div className="flex items-center gap-6">
        <Button
          aria-label="Decrementar BPM"
          isDisabled={bpm <= BPM_MIN}
          onPressStart={() => startHold(-1)}
          onPressEnd={stopHold}
          className={`${STEP_BTN} disabled:opacity-40`}
        >
          −
        </Button>
        <Button
          aria-label="Incrementar BPM"
          isDisabled={bpm >= BPM_MAX}
          onPressStart={() => startHold(1)}
          onPressEnd={stopHold}
          className={`${STEP_BTN} disabled:opacity-40`}
        >
          +
        </Button>
      </div>

      <div aria-hidden="true" className="flex items-center justify-center gap-3" style={{ minHeight: 28 }}>
        {Array.from({ length: beatsPerMeasure }, (_, i) => {
          const active = isPlaying && currentBeat === i
          const isAccent = i === 0
          const size = isAccent ? 'h-6 w-6' : 'h-4 w-4'
          const color = active
            ? 'bg-[var(--color-accent-blue)]'
            : 'bg-[var(--color-border)]'
          return <span key={i} className={`rounded-full transition-colors ${size} ${color}`} />
        })}
      </div>

      <div className="w-full max-w-xs">
        <SettingCarousel
          label="Compás"
          options={TIME_SIGNATURE_LABELS}
          currentIndex={signatureIndex}
          onChange={handleSignatureChange}
          liveMode="off"
        />
      </div>

      <Button
        onPress={togglePlay}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Detener metrónomo' : 'Iniciar metrónomo'}
        className={`${BTN} min-w-[160px]`}
      >
        {isPlaying ? <StopIcon /> : <PlayIcon />}
        {isPlaying ? 'Detener' : 'Iniciar'}
      </Button>
    </div>
  )
}
