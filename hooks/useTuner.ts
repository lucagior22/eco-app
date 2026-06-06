'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectPitch,
  frequencyToNote,
  closestStringIndex,
  centsToTarget,
  GUITAR_STRINGS,
  NOTE_NAMES_ES,
} from '@/lib/pitch'
import type { DetectedNote } from '@/lib/pitch'
import { speak, cancelSpeech } from '@/lib/tts'
import type { EcoSettings } from '@/lib/settings'

export type TuningStatus = 'tuned' | 'high' | 'low' | 'silent'

export interface TunerState {
  detectedNote: DetectedNote | null
  status: TuningStatus
  activeStringIndex: number | null
  isListening: boolean
  toggle: () => void
}

const CENTS_THRESHOLD_ENTER = 10
const CENTS_THRESHOLD_STAY = 20
const TTS_COOLDOWN_MS = 3000
const FFT_SIZE = 4096
const HOLD_MS = 2000
const MEDIAN_WINDOW = 5
const JUMP_THRESHOLD_CENTS = 200

export function useTuner(
  stream: MediaStream | null,
  ttsSpeed: EcoSettings['ttsSpeed'],
  ttsEnabled: boolean,
  targetStringIndex: number | null,
): TunerState {
  const [detectedNote, setDetectedNote] = useState<DetectedNote | null>(null)
  const [status, setStatus] = useState<TuningStatus>('silent')
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null)
  const [isListening, setIsListening] = useState(true)

  const isListeningRef = useRef(true)
  const ttsEnabledRef = useRef(ttsEnabled)
  const ttsSpeedRef = useRef(ttsSpeed)
  const targetStringIndexRef = useRef(targetStringIndex)
  const lastTtsTimeRef = useRef(0)
  const lastNoteKeyRef = useRef('')
  const lastStatusRef = useRef<TuningStatus>('silent')
  const committedStatusRef = useRef<TuningStatus>('silent')
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const freqHistoryRef = useRef<number[]>([])
  const isSpeakingRef = useRef(false)
  const nullCountRef = useRef(0)

  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])
  useEffect(() => { ttsSpeedRef.current = ttsSpeed }, [ttsSpeed])
  useEffect(() => {
    targetStringIndexRef.current = targetStringIndex
    freqHistoryRef.current = []
    nullCountRef.current = 0
    committedStatusRef.current = 'silent'
  }, [targetStringIndex])

  useEffect(() => {
    isListeningRef.current = isListening
    if (!isListening) {
      cancelSpeech()
      setDetectedNote(null)
      setStatus('silent')
      setActiveStringIndex(null)
      lastNoteKeyRef.current = ''
      lastStatusRef.current = 'silent'
      committedStatusRef.current = 'silent'
    }
  }, [isListening])

  useEffect(() => {
    if (!stream) return

    let active = true
    let rafId = 0

    const ctx = new AudioContext()
    void ctx.resume()

    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE

    const silentGain = ctx.createGain()
    silentGain.gain.value = 0
    source.connect(analyser)
    analyser.connect(silentGain)
    silentGain.connect(ctx.destination)

    const buffer = new Float32Array(FFT_SIZE)

    const loop = () => {
      if (!active) return
      rafId = requestAnimationFrame(loop)
      if (!isListeningRef.current || isSpeakingRef.current) return

      analyser.getFloatTimeDomainData(buffer)
      const rawFreq = detectPitch(buffer, ctx.sampleRate)

      if (!rawFreq) {
        nullCountRef.current++
        if (nullCountRef.current >= 5) freqHistoryRef.current = []
        if (!holdTimerRef.current) {
          holdTimerRef.current = setTimeout(() => {
            setDetectedNote(null)
            setStatus('silent')
            setActiveStringIndex(null)
            holdTimerRef.current = null
          }, HOLD_MS)
        }
        return
      }

      // En modo cuerda específica: filtrar frecuencias fuera del target
      const targetIdx = targetStringIndexRef.current
      if (targetIdx !== null) {
        const targetFreq = GUITAR_STRINGS[targetIdx].frequency
        const cents = centsToTarget(rawFreq, targetFreq)
        if (cents === null) return  // fuera de rango, ignorar

        nullCountRef.current = 0
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
        }

        const prevStatus = committedStatusRef.current
        const threshold = prevStatus === 'tuned' ? CENTS_THRESHOLD_STAY : CENTS_THRESHOLD_ENTER
        const newStatus: TuningStatus =
          Math.abs(cents) <= threshold ? 'tuned' : cents > 0 ? 'high' : 'low'

        const targetNote = frequencyToNote(targetFreq)
        const displayNote: DetectedNote = { ...targetNote, frequency: rawFreq, cents: Math.round(cents) }

        committedStatusRef.current = newStatus
        setDetectedNote(displayNote)
        setStatus(newStatus)
        setActiveStringIndex(targetIdx)

        const now = Date.now()
        const statusChanged = newStatus !== lastStatusRef.current
        const cooldownOk = now - lastTtsTimeRef.current > TTS_COOLDOWN_MS

        if (statusChanged && cooldownOk && ttsEnabledRef.current) {
          const nameEs = NOTE_NAMES_ES[targetNote.note] ?? targetNote.note
          const suffix =
            newStatus === 'tuned' ? 'Afinado.' : newStatus === 'high' ? 'Un poco alto.' : 'Un poco bajo.'
          isSpeakingRef.current = true
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
          speak(`${nameEs}. ${suffix}`, ttsSpeedRef.current, () => {
            setTimeout(() => {
              isSpeakingRef.current = false
              freqHistoryRef.current = []
            }, 300)
          })
          lastTtsTimeRef.current = now
          lastNoteKeyRef.current = `${targetNote.note}${targetNote.octave}`
          lastStatusRef.current = newStatus
        }
        return
      }

      // Modo automático: filtro de mediana sobre historial de frecuencias
      const history = freqHistoryRef.current
      if (history.length > 0) {
        const jumpCents = Math.abs(1200 * Math.log2(rawFreq / history[history.length - 1]))
        if (jumpCents > JUMP_THRESHOLD_CENTS) freqHistoryRef.current = []
      }
      freqHistoryRef.current.push(rawFreq)
      if (freqHistoryRef.current.length > MEDIAN_WINDOW) freqHistoryRef.current.shift()

      nullCountRef.current = 0
      const sorted = [...freqHistoryRef.current].sort((a, b) => a - b)
      const freq = sorted[Math.floor(sorted.length / 2)]

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }

      // Usar la cuerda más cercana como referencia: así "B ligeramente sostenida"
      // sigue mostrando "Si", no "Do" (que sería la nota cromática absoluta).
      const closestIdx = closestStringIndex(freq)
      const refString = GUITAR_STRINGS[closestIdx]
      const centsFromString = Math.round(1200 * Math.log2(freq / refString.frequency))
      const autoNote: DetectedNote = { note: refString.label, octave: 0, frequency: freq, cents: centsFromString }

      const prevStatus = committedStatusRef.current
      const threshold = prevStatus === 'tuned' ? CENTS_THRESHOLD_STAY : CENTS_THRESHOLD_ENTER
      const newStatus: TuningStatus =
        Math.abs(centsFromString) <= threshold ? 'tuned' : centsFromString > 0 ? 'high' : 'low'

      committedStatusRef.current = newStatus
      setDetectedNote(autoNote)
      setStatus(newStatus)
      setActiveStringIndex(closestIdx)

      const now = Date.now()
      const noteKey = String(closestIdx)
      const changed = noteKey !== lastNoteKeyRef.current || newStatus !== lastStatusRef.current
      const cooldownOk = now - lastTtsTimeRef.current > TTS_COOLDOWN_MS

      if (changed && cooldownOk && ttsEnabledRef.current) {
        const nameEs = NOTE_NAMES_ES[refString.label] ?? refString.label
        const suffix =
          newStatus === 'tuned' ? 'Afinado.' : newStatus === 'high' ? 'Un poco alto.' : 'Un poco bajo.'
        isSpeakingRef.current = true
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        speak(`${nameEs}. ${suffix}`, ttsSpeedRef.current, () => {
          setTimeout(() => {
            isSpeakingRef.current = false
            freqHistoryRef.current = []
          }, 300)
        })
        lastTtsTimeRef.current = now
        lastNoteKeyRef.current = noteKey
        lastStatusRef.current = newStatus
      }
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      active = false
      cancelAnimationFrame(rafId)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      silentGain.disconnect()
      analyser.disconnect()
      source.disconnect()
      void ctx.close()
    }
  }, [stream])

  const toggle = useCallback(() => {
    setIsListening((prev) => !prev)
  }, [])

  return { detectedNote, status, activeStringIndex, isListening, toggle }
}
