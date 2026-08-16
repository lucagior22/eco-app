'use client'

// Accesibilidad: el input file está oculto visualmente y activado por un <label>
// asociado con htmlFor/id — así el botón visible es el nombre accesible del input.
// El stream de cámara tiene aria-label descriptivo.
// El error de cámara viaja por el canal único de PartituraContent (onError), no por un
// role="alert" propio: así se escucha también sin lector de pantalla.
// Durante la captura, "Cancelar" cierra la cámara y vuelve al estado inicial.

import { useRef, useState } from 'react'

interface ScoreUploadProps {
  onFile: (file: File) => void
  onError: (message: string) => void
  isLoading: boolean
}

type CameraStatus = 'idle' | 'active'

export default function ScoreUpload({ onFile, onError, isLoading }: ScoreUploadProps) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    // Reset input para permitir subir el mismo archivo dos veces
    e.target.value = ''
  }

  async function startCamera() {
    setCameraError(null)
    try {
      // Se pide resolución alta explícita, igual que hooks/useCamera.ts: sin esto el navegador
      // entrega un stream de baja resolución (ej. 640x480) y `captureFrame` manda ese frame tal
      // cual al OCR. Una hoja A4 a 640x480 deja cada letra del cifrado en 6-8 px de alto, muy por
      // debajo de los ~20-30 px que Tesseract necesita: el camino de foto no puede funcionar.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
      })
      streamRef.current = stream
      setCameraStatus('active')
      // Asignar stream al video en el próximo tick (después del render)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
    } catch {
      const msg = 'No se pudo acceder a la cámara. Verificá los permisos.'
      setCameraError(msg)
      onError(msg)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraStatus('idle')
    setCameraError(null)
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `foto_partitura_${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      onFile(file)
    }, 'image/jpeg', 0.92)
  }

  if (cameraStatus === 'active') {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          aria-label="Vista de cámara para fotografiar la partitura"
          className="w-full rounded-lg bg-black"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={captureFrame}
            aria-label="Capturar foto de la partitura"
            className="flex-1 rounded-lg bg-(--color-accent) py-3 font-medium text-white focus:outline-2 focus:outline-(--color-accent) focus:outline-offset-2"
          >
            Capturar
          </button>
          <button
            type="button"
            onClick={stopCamera}
            aria-label="Cancelar y cerrar cámara"
            className="flex-1 rounded-lg border border-(--color-border) bg-(--color-surface) py-3 font-medium text-(--color-text-primary) focus:outline-2 focus:outline-(--color-accent) focus:outline-offset-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Sin role="alert": el texto ya viaja por el canal único del padre. */}
      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      {/* "Tomar foto" va primero en el DOM y con el doble de ancho: es el camino primario en
          móvil. Los dos cambios se reparten por breakpoint — abajo de `sm` el contenedor es
          columna y la jerarquía la da el orden vertical; en `sm:flex-row` la da el ancho.
          El orden importa además para el teclado: el elemento focusable de "Subir archivo" es
          el <input class="sr-only">, no el <label>, así que input y label viajan juntos. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={startCamera}
          disabled={isLoading}
          aria-label="Abrir cámara para fotografiar la partitura"
          className={`flex flex-2 items-center justify-center gap-2 rounded-lg bg-(--color-accent) px-4 py-3 font-medium text-white transition-opacity focus:outline-2 focus:outline-(--color-accent) focus:outline-offset-2 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Tomar foto
        </button>

        {/* Input file oculto — activado por el label de al lado */}
        <input
          ref={fileInputRef}
          id="score-file-input"
          type="file"
          accept="image/*,.pdf"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isLoading}
          aria-label="Seleccionar archivo de partitura"
        />
        <label
          htmlFor="score-file-input"
          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 font-medium text-(--color-text-primary) transition-opacity focus-within:outline-2 focus-within:outline-(--color-accent) focus-within:outline-offset-2 ${isLoading ? 'cursor-not-allowed opacity-50' : 'hover:bg-(--color-bg)'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Subir archivo
        </label>
      </div>
    </div>
  )
}
