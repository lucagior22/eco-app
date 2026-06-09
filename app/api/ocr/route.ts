import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { writeFile, unlink, readFile, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

const TIMEOUT_MS = 60_000

function parseChordsFromXml(xml: string): string[] {
  const chords: string[] = []

  for (const harmony of xml.matchAll(/<harmony[\s\S]*?<\/harmony>/g)) {
    const block = harmony[0]
    const rootStep  = block.match(/<root-step>([A-G])<\/root-step>/)?.[1]
    const rootAlter = block.match(/<root-alter>(-?\d+(?:\.\d+)?)<\/root-alter>/)?.[1]
    const kind      = block.match(/<kind[^>]*>([^<]+)<\/kind>/)?.[1]?.trim()

    if (!rootStep) continue

    const alter = rootAlter ? parseFloat(rootAlter) : 0
    const accidental = alter >= 1 ? '#' : alter <= -1 ? 'b' : ''
    const quality = xmlKindToQuality(kind ?? 'major')

    chords.push(`${rootStep}${accidental}${quality}`)
  }

  return [...new Set(chords)]
}

function xmlKindToQuality(kind: string): string {
  const map: Record<string, string> = {
    'major':              '',
    'minor':              'm',
    'dominant':           '7',
    'major-seventh':      'maj7',
    'minor-seventh':      'm7',
    'diminished':         'dim',
    'diminished-seventh': 'dim7',
    'augmented':          'aug',
    'suspended-second':   'sus2',
    'suspended-fourth':   'sus4',
    'major-ninth':        'maj9',
    'minor-ninth':        'm9',
  }
  return map[kind] ?? ''
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const imageFile = formData.get('image')

  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const ext = imageFile.name.split('.').pop() ?? 'jpg'
  const timestamp = Date.now()
  const baseName = `score_${timestamp}`
  const tmpPath = join('/tmp', `${baseName}.${ext}`)
  const outputDir = join('/tmp', baseName)

  const buffer = Buffer.from(await imageFile.arrayBuffer())
  await writeFile(tmpPath, buffer)

  try {
    const { stdout, stderr } = await execAsync(
      `oemer "${tmpPath}" -o /tmp`,
      { timeout: TIMEOUT_MS, cwd: '/tmp' }
    )

    const rawText = stdout || stderr

    const outFiles = await readdir(outputDir).catch(() => [] as string[])
    const xmlFile = outFiles.find(f => f.endsWith('.musicxml') || f.endsWith('.xml'))

    if (xmlFile) {
      const xml = await readFile(join(outputDir, xmlFile), 'utf-8')
      const chords = parseChordsFromXml(xml)
      return NextResponse.json({ chords, rawText: xml })
    }

    return NextResponse.json({ chords: [], rawText: stdout || stderr })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo analizar la partitura. Verificá que la imagen sea clara y contenga cifrado.' },
      { status: 500 }
    )
  } finally {
    await unlink(tmpPath).catch(() => {})
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  }
}
