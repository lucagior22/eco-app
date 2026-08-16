'use client'

// Accesibilidad — canal único de audio (useAnnouncer, mismo patrón que /afinador y /pedal):
// esta pantalla es la dueña del texto de cada estado y lo emite por el TTS de la app, con la
// región aria-live como fallback. HarmonyList y ScoreUpload no anuncian por su cuenta.

import { useState, useCallback, useRef, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import LiveRegion from '@/components/a11y/LiveRegion'
import ScoreUpload from '@/components/score/ScoreUpload'
import ScorePreview from '@/components/score/ScorePreview'
import HarmonyList from '@/components/score/HarmonyList'
import { useAnnouncer } from '@/hooks/useAnnouncer'
import { chordToSpanish } from '@/lib/chords'
import { cancelSpeech } from '@/lib/tts'

type OcrStatus = 'idle' | 'loading' | 'done' | 'error'

interface OcrResult {
  chords: string[]
  rawText: string
}

// El OCR puede tardar decenas de segundos y una sola frase al arrancar deja al usuario en
// silencio el resto de la espera: en el test de usabilidad eso se leyó como que la app se había
// colgado. El recordatorio vuelve a dar señal de vida sin depender de la pantalla.
const REMINDER_MS = 10_000

// Por encima del timeout de Tesseract (30 s en /api/ocr) a propósito: así el servidor gana en el
// caso normal y el usuario escucha su mensaje de error real. Este corte cubre solo lo que queda
// colgado más allá de eso — red lenta o subida trabada.
const ABORT_MS = 35_000

// Cuántos acordes entran en el anuncio automático. La lista completa puede tener decenas y no hay
// forma de cortar una locución larga salvo saliendo de la pantalla; el resto queda a pedido en el
// botón "Narrar acordes".
const SPOKEN_CHORDS = 3

// La lectura del OCR se enuncia siempre como aproximada. Sobre partituras reales confunde acordes
// y omite otros, y los participantes sin formación musical dieron por completa una lista que no lo
// estaba. La confianza de Tesseract no cubre este caso: un acorde que nunca se detectó no tiene
// confianza baja que reportar, simplemente no aparece.
const APPROX_NOTICE = 'La lectura puede tener errores u omisiones.'

/** Anuncio automático del resultado: conteo, aviso de aproximación y los primeros acordes. */
function buildResultSpeech(chords: string[]): string {
  if (chords.length === 0) {
    return 'No se detectaron acordes en la imagen. Probá con una foto más nítida o con el cifrado bien visible.'
  }

  const count =
    chords.length === 1 ? 'Detecté 1 acorde.' : `Detecté ${chords.length} acordes.`
  const spoken = chords.slice(0, SPOKEN_CHORDS).map(chordToSpanish).join(', ')
  const remaining = chords.length - SPOKEN_CHORDS
  const rest =
    remaining <= 0 ? '' : remaining === 1 ? ', y 1 acorde más' : `, y ${remaining} acordes más`

  return `${count} ${APPROX_NOTICE} ${spoken}${rest}.`
}

export default function PartituraContent() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [result, setResult] = useState<OcrResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { announce, announcement, liveMode } = useAnnouncer()
  const reminderRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (reminderRef.current) clearTimeout(reminderRef.current)
  }, [])

  const processFile = useCallback(async (file: File) => {
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setFileName(file.name)
    setStatus('loading')
    setResult(null)
    setErrorMessage(null)
    announce('Analizando la partitura, esto puede tardar unos segundos.', 'assertive')

    // No hace falta coordinar el recordatorio con el anuncio del resultado: `emit` cancela la
    // locución en curso antes de cada nueva, así que el canal único ya resuelve el solapamiento.
    // El timer se guarda además en una local: si el usuario manda una segunda imagen antes de que
    // vuelva la primera, cada llamada limpia el suyo y no el de la otra.
    if (reminderRef.current) clearTimeout(reminderRef.current)
    const reminderTimer = setTimeout(
      () => announce('Seguimos analizando la partitura.'),
      REMINDER_MS,
    )
    reminderRef.current = reminderTimer

    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), ABORT_MS)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      const data = (await res.json()) as OcrResult & { error?: string }

      if (!res.ok || data.error) {
        const msg = data.error ?? 'Error desconocido al analizar la partitura.'
        setStatus('error')
        setErrorMessage(msg)
        announce(msg, 'assertive')
        return
      }

      setResult(data)
      setStatus('done')
      announce(buildResultSpeech(data.chords))
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'El análisis tardó demasiado. Probá de nuevo con una foto más nítida.'
          : 'No se pudo conectar con el servidor. Verificá tu conexión.'
      setStatus('error')
      setErrorMessage(msg)
      announce(msg, 'assertive')
    } finally {
      clearTimeout(abortTimer)
      clearTimeout(reminderTimer)
      if (reminderRef.current === reminderTimer) reminderRef.current = null
    }
  }, [announce])

  // Repetición a pedido: acá sí va la lista completa, porque el usuario la pidió. El aviso de
  // aproximación se mantiene, en versión corta para que no canse al repetir — quien no ve la
  // pantalla no tiene otra forma de recibirlo.
  //
  // Pasa por `announce` y no por `speak` directo para que en un navegador sin Web Speech
  // el botón no sea un no-op: el texto cae en la región aria-live.
  const handleNarrate = useCallback(() => {
    cancelSpeech()
    const chords = result?.chords ?? []
    const header = chords.length === 1 ? '1 acorde' : `${chords.length} acordes`
    announce(`${header}, lectura aproximada. ${chords.map(chordToSpanish).join(', ')}.`)
  }, [announce, result])

  const handleUploadError = useCallback(
    (message: string) => announce(message, 'assertive'),
    [announce],
  )

  return (
    <>
      <PageHeader
        title="Leer partitura"
        subtitle="Subí o fotografiá una partitura para detectar los acordes"
      />

      <div className="space-y-4 p-4">
        <LiveRegion announcement={announcement} liveMode={liveMode} />

        <ScorePreview imageUrl={imageUrl} fileName={fileName} />

        <ScoreUpload
          onFile={processFile}
          onError={handleUploadError}
          isLoading={status === 'loading'}
        />

        <HarmonyList
          chords={result?.chords ?? []}
          status={status}
          errorMessage={errorMessage}
          onNarrate={handleNarrate}
        />
      </div>
    </>
  )
}
