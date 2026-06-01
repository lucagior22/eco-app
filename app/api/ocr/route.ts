// Endpoint OCR para análisis de partituras (§6.2 SPECIFICATION.md).
// Implementación real pendiente: recibir FormData con campo "image",
// escribir imagen a /tmp/score_[timestamp].[ext], ejecutar
// `python3 -m oemer [path]` via child_process con timeout de 60s,
// parsear output y devolver { chords: string[], rawText: string }.
// Limpiar el archivo temporal al finalizar.

import { NextResponse } from 'next/server'

export async function POST() {
  // TODO: implementar en la fase Partitura
  return NextResponse.json({ error: 'OCR no implementado todavía' }, { status: 501 })
}
