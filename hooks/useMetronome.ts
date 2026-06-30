'use client'

import { useEffect, useRef, useState } from 'react'
import { scheduleClick } from '@/lib/metronome'

interface UseMetronomeOptions {
  bpm: number
  beatsPerMeasure: number
  isPlaying: boolean
  // Se dispara alineado con cada click de audio. accent === true en el tiempo 1.
  onBeat?: (beatIndex: number, accent: boolean) => void
}

interface MetronomeState {
  // Tiempo actual dentro del compás (0-based), o null cuando está detenido.
  currentBeat: number | null
}

// Lookahead scheduler (Chris Wilson, "A Tale of Two Clocks"): un setInterval
// impreciso despierta cada SCHEDULER_INTERVAL_MS y programa con tiempo exacto de
// muestra todos los clicks que caen dentro de la ventana SCHEDULE_AHEAD_S. Así el
// tempo no deriva aunque el timer de JS se retrase.
const SCHEDULER_INTERVAL_MS = 25
const SCHEDULE_AHEAD_S = 0.1

export function useMetronome({ bpm, beatsPerMeasure, isPlaying, onBeat }: UseMetronomeOptions): MetronomeState {
  const [currentBeat, setCurrentBeat] = useState<number | null>(null)

  // Valores en vivo: el intervalo en curso los lee sin recrearse al cambiar BPM/compás.
  const bpmRef = useRef(bpm)
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  const onBeatRef = useRef(onBeat)

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { beatsPerMeasureRef.current = beatsPerMeasure }, [beatsPerMeasure])
  useEffect(() => { onBeatRef.current = onBeat }, [onBeat])

  useEffect(() => {
    if (!isPlaying) return

    // AudioContext nace del gesto de Play para cumplir la autoplay policy.
    const ctx = new AudioContext()
    void ctx.resume()

    let nextNoteTime = ctx.currentTime + 0.05
    let beatInMeasure = 0
    const beatTimeouts: ReturnType<typeof setTimeout>[] = []

    const scheduler = setInterval(() => {
      while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
        const accent = beatInMeasure === 0
        const beatIndex = beatInMeasure
        scheduleClick(ctx, nextNoteTime, accent)

        // Vibración y flash visual se alinean al audio diferiéndolos hasta el
        // instante programado del click.
        const delayMs = Math.max(0, (nextNoteTime - ctx.currentTime) * 1000)
        const t = setTimeout(() => {
          setCurrentBeat(beatIndex)
          onBeatRef.current?.(beatIndex, accent)
        }, delayMs)
        beatTimeouts.push(t)

        nextNoteTime += 60 / bpmRef.current
        beatInMeasure = (beatInMeasure + 1) % beatsPerMeasureRef.current
      }
    }, SCHEDULER_INTERVAL_MS)

    return () => {
      clearInterval(scheduler)
      beatTimeouts.forEach(clearTimeout)
      setCurrentBeat(null)
      void ctx.close()
    }
  }, [isPlaying])

  return { currentBeat }
}
