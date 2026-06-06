'use client'

import { useState } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import { useMicrophone } from '@/hooks/useMicrophone'
import { useTuner } from '@/hooks/useTuner'
import TunerDisplay from '@/components/tuner/TunerDisplay'
import PitchIndicator from '@/components/tuner/PitchIndicator'
import { Button } from 'react-aria-components'

const BTN = 'flex min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-medium text-[var(--color-text-primary)] pressed:opacity-70 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]'

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function SpeakerOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function SpeakerOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

export default function AfinadorScreen() {
  const { settings } = useSettings()
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [selectedStringIndex, setSelectedStringIndex] = useState<number | null>(null)
  const { stream, error, devices, selectedDeviceId, selectDevice } = useMicrophone()
  const { detectedNote, status, activeStringIndex, isListening, toggle } = useTuner(
    stream,
    settings.ttsSpeed,
    ttsEnabled,
    selectedStringIndex,
  )

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        <p role="alert" aria-live="assertive" className="text-[var(--color-error)]">
          {error}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Activá el permiso de micrófono en la configuración del navegador.
        </p>
      </div>
    )
  }

  if (!stream) {
    return (
      <div
        className="flex items-center justify-center px-4 py-16"
        aria-busy="true"
        aria-label="Solicitando permiso de micrófono"
      >
        <p className="text-[var(--color-text-secondary)]">Solicitando permiso de micrófono...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-10 px-4 py-8">
      <TunerDisplay
        detectedNote={detectedNote}
        status={status}
        activeStringIndex={activeStringIndex}
        selectedStringIndex={selectedStringIndex}
        onSelectString={setSelectedStringIndex}
      />

      <PitchIndicator cents={detectedNote?.cents ?? 0} status={status} />

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onPress={toggle}
          aria-pressed={!isListening}
          aria-label={isListening ? 'Pausar micrófono' : 'Reanudar micrófono'}
          className={BTN}
        >
          {isListening ? <PauseIcon /> : <PlayIcon />}
          {isListening ? 'Pausar' : 'Reanudar'}
        </Button>

        <Button
          onPress={() => setTtsEnabled((v) => !v)}
          aria-pressed={!ttsEnabled}
          aria-label={ttsEnabled ? 'Silenciar narrador' : 'Activar narrador'}
          className={BTN}
        >
          {ttsEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
          Narrador
        </Button>
      </div>

      {devices.length > 1 && (
        <div className="hidden w-full max-w-xs flex-col gap-1 md:flex">
          <label htmlFor="mic-select" className="text-sm text-[var(--color-text-secondary)]">
            Micrófono
          </label>
          <select
            id="mic-select"
            value={selectedDeviceId}
            onChange={(e) => selectDevice(e.target.value)}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[var(--color-focus)]"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
