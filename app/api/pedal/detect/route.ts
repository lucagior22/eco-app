import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Con 5 capturas el script corre la detección 5 veces; el timeout acompaña.
const TIMEOUT_MS = 45_000

const MAX_IMAGES = 8

interface Knob {
  label: string
  value: number | null
  agreement: number
}

function safeParseErrorMessage(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as { error?: string }
    return parsed.error ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // formData() tira si el request no viene como multipart; sin este guard, una
  // petición malformada saldría como 500 en vez del 400 que corresponde.
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  // El cliente manda una ráfaga de capturas bajo la misma clave: una sola foto
  // no alcanza para una lectura confiable, el script vota entre todas.
  const files = formData.getAll('image').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const batch = files.slice(0, MAX_IMAGES)
  const stamp = Date.now()
  const paths = batch.map((_, i) => join('/tmp', `pedal_${stamp}_${i}.jpg`))

  await Promise.all(
    batch.map(async (file, i) =>
      writeFile(paths[i], Buffer.from(await file.arrayBuffer()))
    )
  )

  const fallbackMessage =
    'No se pudieron detectar perillas en la imagen. Verificá el encuadre, la distancia y la iluminación.'

  try {
    const { stdout } = await execFileAsync(
      'python3',
      ['scripts/detect_knobs.py', ...paths],
      { timeout: TIMEOUT_MS, cwd: process.cwd() }
    )

    const data = JSON.parse(stdout) as {
      knobs: Knob[]
      framesCaptured: number
      framesUsed: number
    }
    return NextResponse.json(data)
  } catch (err) {
    // El script sale con exit code 1 en sus errores controlados, lo que hace
    // que execFileAsync rechace la promesa; el JSON {"error": "..."} del script
    // queda en err.stdout en vez de en el resultado exitoso.
    const stdout = (err as { stdout?: string }).stdout
    const message = stdout ? safeParseErrorMessage(stdout) : null
    return NextResponse.json({ error: message ?? fallbackMessage }, { status: 500 })
  } finally {
    await Promise.all(paths.map((p) => unlink(p).catch(() => {})))
  }
}
