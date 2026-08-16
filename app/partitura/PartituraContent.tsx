'use client'

// Accesibilidad — canal único de audio (useAnnouncer, mismo patrón que /afinador y /pedal):
// esta pantalla es la dueña del texto de cada estado y lo emite por el TTS de la app, con la
// región aria-live como fallback. HarmonyList y ScoreUpload no anuncian por su cuenta.

import { useState, useCallback } from 'react'
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

export default function PartituraContent() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [result, setResult] = useState<OcrResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { announce, announcement, liveMode } = useAnnouncer()

  const processFile = useCallback(async (file: File) => {
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setFileName(file.name)
    setStatus('loading')
    setResult(null)
    setErrorMessage(null)
    announce('Analizando partitura', 'assertive')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
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
      announce(
        data.chords.length === 0
          ? 'No se detectaron acordes'
          : `Se detectaron ${data.chords.length} acordes`,
      )
    } catch {
      const msg = 'No se pudo conectar con el servidor. Verificá tu conexión.'
      setStatus('error')
      setErrorMessage(msg)
      announce(msg, 'assertive')
    }
  }, [announce])

  // Pasa por `announce` y no por `speak` directo para que en un navegador sin Web Speech
  // el botón no sea un no-op: el texto cae en la región aria-live.
  const handleNarrate = useCallback(() => {
    cancelSpeech()
    announce((result?.chords ?? []).map(chordToSpanish).join('. '))
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
