import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { writeFile, unlink, mkdir, copyFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

const TIMEOUT_MS = 20_000

interface Knob {
  label: string
  value: number
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
  const formData = await req.formData()
  const imageFile = formData.get('image')

  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const ext = imageFile.name.split('.').pop() ?? 'jpg'
  const tmpPath = join('/tmp', `pedal_${Date.now()}.${ext}`)
  const buffer = Buffer.from(await imageFile.arrayBuffer())
  await writeFile(tmpPath, buffer)

  // DEBUG TEMPORAL: copia cada foto capturada en vivo para poder inspeccionar
  // qué está enviando realmente la cámara del celular (resolución, foco,
  // encuadre) y diagnosticar resultados inconsistentes en /pedal. Sacar
  // este bloque y la entrada de volumes en docker-compose.yml una vez resuelto.
  const debugDir = join(process.cwd(), 'tmp', 'debug_captures')
  await mkdir(debugDir, { recursive: true })
  await copyFile(tmpPath, join(debugDir, `${Date.now()}.${ext}`)).catch(() => {})

  const fallbackMessage =
    'No se pudieron detectar perillas en la imagen. Verificá el encuadre, la distancia y la iluminación.'

  try {
    const { stdout } = await execAsync(
      `python3 scripts/detect_knobs.py "${tmpPath}"`,
      { timeout: TIMEOUT_MS, cwd: process.cwd() }
    )

    const data = JSON.parse(stdout) as { knobs: Knob[] }
    return NextResponse.json({ knobs: data.knobs })
  } catch (err) {
    // El script sale con exit code 1 en sus errores controlados, lo que hace
    // que execAsync rechace la promesa; el JSON {"error": "..."} del script
    // queda en err.stdout en vez de en el resultado exitoso.
    const stdout = (err as { stdout?: string }).stdout
    const message = stdout ? safeParseErrorMessage(stdout) : null
    return NextResponse.json({ error: message ?? fallbackMessage }, { status: 500 })
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
