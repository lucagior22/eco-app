'use client'

// Accesibilidad: la imagen cargada tiene alt con el nombre del archivo.
// El placeholder es aria-hidden porque no aporta información al usuario ciego;
// el estado de "sin partitura" lo describe el texto visible adyacente.

interface ScorePreviewProps {
  imageUrl: string | null
  fileName: string | null
}

export default function ScorePreview({ imageUrl, fileName }: ScorePreviewProps) {
  if (!imageUrl) {
    return (
      <div
        aria-hidden="true"
        className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-text-secondary)]"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="13" y2="16" />
        </svg>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={fileName ? `Partitura: ${fileName}` : 'Partitura cargada'}
        className="h-auto max-h-72 w-full object-contain"
      />
    </div>
  )
}
