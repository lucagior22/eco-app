'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import ScoreUpload from '@/components/score/ScoreUpload'
import ScorePreview from '@/components/score/ScorePreview'
import HarmonyList from '@/components/score/HarmonyList'

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

  const processFile = useCallback(async (file: File) => {
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setFileName(file.name)
    setStatus('loading')
    setResult(null)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = (await res.json()) as OcrResult & { error?: string }

      if (!res.ok || data.error) {
        setStatus('error')
        setErrorMessage(data.error ?? 'Error desconocido al analizar la partitura.')
        return
      }

      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
      setErrorMessage('No se pudo conectar con el servidor. Verificá tu conexión.')
    }
  }, [])

  return (
    <>
      <PageHeader
        title="Leer partitura"
        subtitle="Subí o fotografiá una partitura para detectar los acordes"
      />

      <div className="space-y-4 p-4">
        <ScorePreview imageUrl={imageUrl} fileName={fileName} />

        <ScoreUpload onFile={processFile} isLoading={status === 'loading'} />

        <HarmonyList
          chords={result?.chords ?? []}
          status={status}
          errorMessage={errorMessage}
        />

        <div className="pt-2">
          <Link
            href="/partitura/metronomo"
            aria-label="Ir al metrónomo"
            className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-(--color-text-primary) focus:outline-2 focus:outline-(--color-accent) focus:outline-offset-2"
          >
            <span className="font-medium">Metrónomo</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  )
}
