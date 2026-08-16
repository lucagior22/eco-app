'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectPitch,
  frequencyToNote,
  closestStringIndex,
  centsToTarget,
  correctOctave,
  foldToOctaveOf,
  tuningStep,
  tuningDirection,
  tuningStepLabel,
  stringNumber,
  GUITAR_STRINGS,
  NOTE_NAMES_ES,
} from '@/lib/pitch'
import type { DetectedNote, TuningStep } from '@/lib/pitch'
import { speak, cancelSpeech } from '@/lib/tts'
import type { EcoSettings } from '@/lib/settings'

// 'waiting' = todavía no se detectó ninguna señal; 'silent' = había señal y se perdió.
// Son dos situaciones distintas para quien no ve: "tocá algo" vs "dejé de oírte".
export type TuningStatus = 'tuned' | 'high' | 'low' | 'silent' | 'waiting'

export interface TunerState {
  detectedNote: DetectedNote | null
  status: TuningStatus
  activeStringIndex: number | null
  isListening: boolean
  announcement: string
  toggle: () => void
}

// 15-20 cents son claramente audibles: con los umbrales anteriores (10/20) la app decía
// "afinado" con la cuerda todavía baja al oído. La histéresis se conserva para evitar el
// parpadeo entre estados, pero dentro de un rango que ya no se escucha.
const CENTS_THRESHOLD_ENTER = 5
const CENTS_THRESHOLD_STAY = 10
const TTS_COOLDOWN_MS = 3000
// pitchfinder descarta la mitad del buffer y usa la mitad de eso como lags (ver yin.js):
// con 4096 quedan 1024 lags, apenas ~1,8 períodos de Mi grave (82 Hz) para correlacionar,
// que es donde el detector se vuelve inestable. Con 8192 son ~3,5 períodos.
const FFT_SIZE = 8192
// YIN es O(lags²): a 8192 no entra en cada frame de animación en un teléfono. 50 ms da
// 20 lecturas por segundo, suficiente para llenar la ventana de mediana en 250 ms.
const DETECT_INTERVAL_MS = 50
const HOLD_MS = 2000
const MEDIAN_WINDOW = 5
// Band-pass: las fundamentales de cuerda al aire van de E2 (82 Hz) a E4 (330 Hz).
// Highpass corta rumble/DC por debajo de E2; lowpass atenúa armónicos y siseo para que
// YIN bloquee mejor la fundamental (deja margen para notas con traste).
const HIGHPASS_HZ = 65
const LOWPASS_HZ = 1000
const JUMP_THRESHOLD_CENTS = 200
const EMA_ALPHA = 0.4

// Ventana de seguimiento. Con una estimación ya establecida, una lectura que se aleje más de
// esto no es la cuerda moviéndose —girando la clavija el tono se mueve unos pocos cents entre
// lecturas— sino un frame en que YIN enganchó un período equivocado. Es lo que evita el
// "muy baja" súbito sin que nadie toque nada. Por encima de JUMP_THRESHOLD_CENTS sí se acepta
// de una: ahí es otra cuerda, no un error.
const TRACK_WINDOW_CENTS = 60
// Si el rechazo persiste, la estimación es la que quedó vieja: re-enganchar (~400 ms).
const TRACK_LOST_FRAMES = 8

// Un escalón nuevo debe sostenerse estos frames antes de locutarse: evita la metralleta
// cuando la desviación oscila justo sobre el borde entre dos escalones.
const STEP_STABLE_FRAMES = 3

// Cercanía a afinado. Sirve para detectar que el escalón mejora y saltear el cooldown:
// avisar del acercamiento en el momento es lo que evita pasarse de largo con la clavija.
const STEP_RANK: Record<TuningStep, number> = { tuned: 0, almost: 1, slight: 2, off: 3, far: 4 }

export function useTuner(
  stream: MediaStream | null,
  ttsSpeed: EcoSettings['ttsSpeed'],
  ttsEnabled: boolean,
  targetStringIndex: number | null,
): TunerState {
  const [detectedNote, setDetectedNote] = useState<DetectedNote | null>(null)
  const [status, setStatus] = useState<TuningStatus>('waiting')
  const [activeStringIndex, setActiveStringIndex] = useState<number | null>(null)
  const [isListening, setIsListening] = useState(true)
  const [announcement, setAnnouncement] = useState('')

  const isListeningRef = useRef(true)
  const ttsEnabledRef = useRef(ttsEnabled)
  const ttsSpeedRef = useRef(ttsSpeed)
  const targetStringIndexRef = useRef(targetStringIndex)
  const lastTtsTimeRef = useRef(0)
  const committedStatusRef = useRef<TuningStatus>('waiting')
  const lastSpokenKeyRef = useRef('')
  const lastSpokenRankRef = useRef(STEP_RANK.far)
  const spokenDirectionRef = useRef<'high' | 'low' | null>(null)
  const lastStringIdxRef = useRef<number | null>(null)
  const pendingStepKeyRef = useRef('')
  const pendingCountRef = useRef(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const freqHistoryRef = useRef<number[]>([])
  const isSpeakingRef = useRef(false)
  const nullCountRef = useRef(0)
  const smoothedFreqRef = useRef<number | null>(null)
  const speechGenRef = useRef(0)
  const lastDetectAtRef = useRef(0)
  const trackLostRef = useRef(0)

  // Locución por el TTS propio de la app (canal primario). El texto a anunciar se decide
  // antes y se publica también en `announcement` (canal de fallback aria-live); `announce`
  // solo habla cuando el narrador está activo. Resuelve el bug del narrador auto-escuchado:
  // cada locución toma un `gen`; el onEnd solo apaga el guard si sigue siendo la vigente,
  // así un callback de una locución cancelada (al cambiar de modo) no reactiva la
  // detección en medio de la siguiente. El colchón de 300 ms absorbe la cola acústica.
  const announce = useCallback((text: string) => {
    const gen = ++speechGenRef.current
    isSpeakingRef.current = true
    speak(text, ttsSpeedRef.current, () => {
      setTimeout(() => {
        if (gen !== speechGenRef.current) return
        isSpeakingRef.current = false
        freqHistoryRef.current = []
      }, 300)
    })
  }, [])

  // Cierra el episodio de feedback: lo que sigue se trata como situación nueva y se vuelve
  // a anunciar con verbo, aunque el escalón coincida con el último dicho.
  const resetFeedback = useCallback(() => {
    // También el cooldown: al abrir un episodio nuevo no hay locución previa que espaciar, y
    // ahora que el nombre de la cuerda no se repite es la primera frase la que más importa.
    lastTtsTimeRef.current = 0
    lastSpokenKeyRef.current = ''
    lastSpokenRankRef.current = STEP_RANK.far
    spokenDirectionRef.current = null
    lastStringIdxRef.current = null
    pendingStepKeyRef.current = ''
    pendingCountRef.current = 0
  }, [])

  // Toda la política de repetición vive acá para que los dos modos (cuerda fija y automático)
  // no divergan.
  const speakFeedback = useCallback(
    (stringIdx: number, cents: number, isTuned: boolean) => {
      const step = tuningStep(cents, isTuned)
      const direction = tuningDirection(cents, isTuned)
      const key = `${stringIdx}|${step}|${direction}`

      if (key !== pendingStepKeyRef.current) {
        pendingStepKeyRef.current = key
        pendingCountRef.current = 1
        return
      }
      if (++pendingCountRef.current < STEP_STABLE_FRAMES) return
      if (key === lastSpokenKeyRef.current) return

      const changedString = stringIdx !== lastStringIdxRef.current
      if (changedString) spokenDirectionRef.current = null

      const rank = STEP_RANK[step]
      const improved = rank < lastSpokenRankRef.current
      const reversed =
        direction !== 'none' &&
        spokenDirectionRef.current !== null &&
        direction !== spokenDirectionRef.current

      // El cooldown frena la repetición del mismo problema, pero no debe tapar lo que cambió:
      // acercarse a afinado, pasarse de largo o saltar a otra cuerda hay que avisarlo al instante.
      const now = Date.now()
      if (
        now - lastTtsTimeRef.current <= TTS_COOLDOWN_MS &&
        !improved &&
        !reversed &&
        !changedString
      ) {
        return
      }

      spokenDirectionRef.current = direction === 'none' ? null : direction

      // Mientras se sigue la misma cuerda, nombrarla en cada locución solo alarga la espera:
      // el usuario está girando la clavija y lo único nuevo es qué tan cerca está. El nombre
      // vuelve cuando cambia la cuerda o cuando se cierra el episodio (silencio, pausa).
      let prefix = ''
      if (changedString) {
        const label = GUITAR_STRINGS[stringIdx].label
        prefix = `Cuerda ${stringNumber(stringIdx)}, ${NOTE_NAMES_ES[label] ?? label}. `
      }

      const text = `${prefix}${tuningStepLabel(step, direction)}.`
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      setAnnouncement(text)
      if (ttsEnabledRef.current) announce(text)

      lastTtsTimeRef.current = now
      lastSpokenKeyRef.current = key
      lastSpokenRankRef.current = rank
      lastStringIdxRef.current = stringIdx
    },
    [announce],
  )

  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])
  useEffect(() => { ttsSpeedRef.current = ttsSpeed }, [ttsSpeed])
  useEffect(() => {
    targetStringIndexRef.current = targetStringIndex
    freqHistoryRef.current = []
    smoothedFreqRef.current = null
    nullCountRef.current = 0
    committedStatusRef.current = 'waiting'
    resetFeedback()

    // Sin stream todavía no hay afinador: anunciar el modo mientras el navegador pide el permiso
    // pisaría el aviso del permiso, que es lo único accionable en ese momento. Con `stream` en las
    // dependencias, el modo se anuncia recién cuando el micrófono está activo.
    if (!stream) return

    let text: string
    if (targetStringIndex === null) {
      text = 'Modo automático. Tocá una cuerda.'
    } else {
      const label = GUITAR_STRINGS[targetStringIndex].label
      text = `Afinando cuerda ${stringNumber(targetStringIndex)}, ${NOTE_NAMES_ES[label] ?? label}.`
      // Este anuncio ya presentó la cuerda: la primera locución de feedback no tiene que repetirla.
      lastStringIdxRef.current = targetStringIndex
    }
    setAnnouncement(text)
    if (ttsEnabledRef.current) announce(text)
  }, [targetStringIndex, stream, announce, resetFeedback])

  useEffect(() => {
    isListeningRef.current = isListening
    if (!isListening) {
      cancelSpeech()
      setDetectedNote(null)
      setStatus('waiting')
      setActiveStringIndex(null)
      setAnnouncement('')
      committedStatusRef.current = 'waiting'
      resetFeedback()
    }
  }, [isListening, resetFeedback])

  useEffect(() => {
    if (!stream) return

    let active = true
    let rafId = 0

    const ctx = new AudioContext()
    void ctx.resume()

    const source = ctx.createMediaStreamSource(stream)

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = HIGHPASS_HZ
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = LOWPASS_HZ

    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE

    const silentGain = ctx.createGain()
    silentGain.gain.value = 0
    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(analyser)
    analyser.connect(silentGain)
    silentGain.connect(ctx.destination)

    const buffer = new Float32Array(FFT_SIZE)

    // Seguimiento + mediana + EMA, en los dos modos. La mediana descarta los frames en que YIN
    // falla (el descenso al mínimo de la función de diferencia solo avanza hacia lags mayores,
    // así que con un mínimo poco profundo se pasa de largo y devuelve una frecuencia baja) y la
    // EMA quita el temblor de los frames buenos. Devuelve null si la lectura se descarta.
    const smoothFrequency = (freq: number): number | null => {
      const smoothed = smoothedFreqRef.current
      if (smoothed !== null) {
        const drift = Math.abs(1200 * Math.log2(freq / smoothed))
        if (drift > TRACK_WINDOW_CENTS && drift <= JUMP_THRESHOLD_CENTS) {
          if (++trackLostRef.current < TRACK_LOST_FRAMES) return null
        }
      }
      trackLostRef.current = 0

      const history = freqHistoryRef.current
      if (history.length > 0) {
        const jumpCents = Math.abs(1200 * Math.log2(freq / history[history.length - 1]))
        if (jumpCents > TRACK_WINDOW_CENTS) {
          freqHistoryRef.current = []
          smoothedFreqRef.current = null
        }
      }
      freqHistoryRef.current.push(freq)
      if (freqHistoryRef.current.length > MEDIAN_WINDOW) freqHistoryRef.current.shift()

      const sorted = [...freqHistoryRef.current].sort((a, b) => a - b)
      const medianFreq = sorted[Math.floor(sorted.length / 2)]
      smoothedFreqRef.current =
        smoothedFreqRef.current === null
          ? medianFreq
          : EMA_ALPHA * medianFreq + (1 - EMA_ALPHA) * smoothedFreqRef.current
      return smoothedFreqRef.current
    }

    const loop = () => {
      if (!active) return
      rafId = requestAnimationFrame(loop)
      if (!isListeningRef.current || isSpeakingRef.current) return

      // YIN es O(n²) sobre el buffer. Con FFT_SIZE 8192 correrlo en cada frame de animación
      // satura la CPU de un teléfono, y para afinar no aporta: la mediana necesita 5 lecturas,
      // que a este intervalo son 250 ms.
      const now = performance.now()
      if (now - lastDetectAtRef.current < DETECT_INTERVAL_MS) return
      lastDetectAtRef.current = now

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
            smoothedFreqRef.current = null
            holdTimerRef.current = null
            // Estado fresco tras el silencio: si se retoma una cuerda ya afinada, debe
            // tratarse como evento nuevo y volver a anunciar el resultado.
            committedStatusRef.current = 'silent'
            resetFeedback()
          }, HOLD_MS)
        }
        return
      }

      // En modo cuerda específica: filtrar frecuencias fuera del target
      const targetIdx = targetStringIndexRef.current
      if (targetIdx !== null) {
        const targetFreq = GUITAR_STRINGS[targetIdx].frequency
        // Descartar el frame antes de suavizar: una lectura fuera de la ventana no es esta
        // cuerda y contaminaría la mediana.
        if (centsToTarget(rawFreq, targetFreq) === null) return

        // Plegar a la octava del target antes de suavizar, para que una lectura de la octava
        // vecina promedie con las demás en vez de arrastrar la mediana a un punto intermedio.
        const freq = smoothFrequency(foldToOctaveOf(rawFreq, targetFreq))
        if (freq === null) return
        const cents = 1200 * Math.log2(freq / targetFreq)

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
        const displayNote: DetectedNote = { ...targetNote, frequency: freq, cents: Math.round(cents) }

        committedStatusRef.current = newStatus
        setDetectedNote(displayNote)
        setStatus(newStatus)
        setActiveStringIndex(targetIdx)

        speakFeedback(targetIdx, cents, newStatus === 'tuned')
        return
      }

      // Modo automático: corrección de octava (subarmónico/armónico) + mediana sobre historial.
      const freq = smoothFrequency(correctOctave(rawFreq))
      if (freq === null) return
      nullCountRef.current = 0

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

      speakFeedback(closestIdx, centsFromString, newStatus === 'tuned')
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      active = false
      cancelAnimationFrame(rafId)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      silentGain.disconnect()
      analyser.disconnect()
      lowpass.disconnect()
      highpass.disconnect()
      source.disconnect()
      void ctx.close()
    }
  }, [stream, speakFeedback, resetFeedback])

  const toggle = useCallback(() => {
    setIsListening((prev) => !prev)
  }, [])

  return { detectedNote, status, activeStringIndex, isListening, announcement, toggle }
}
