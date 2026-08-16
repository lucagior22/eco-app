import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { CHORD_QUALITIES } from '@/lib/chords'

const execFileAsync = promisify(execFile)

// Tesseract sobre una imagen ya binarizada internamente es cuestión de
// segundos, no de minutos (oemer pedía 3-5 min y no detectaba cifrado).
const TIMEOUT_MS = 30_000

// Caracteres que Tesseract tiene permitido emitir. El cifrado de acordes usa
// un alfabeto chico y cerrado: fundamentales A-G, alteraciones # y b, las
// letras de los sufijos de calidad (maj, min, dim, aug, sus, add, m, M),
// dígitos de las tensiones y "/" del bajo invertido.
// La whitelist no rechaza: fuerza a Tesseract a elegir SIEMPRE dentro de este
// conjunto, así que una cabeza de nota o un resto de pentagrama igual sale
// como alguna letra. Por eso el filtro real son CONF_MIN + CHORD_RE de abajo.
const CHAR_WHITELIST = 'ABCDEFGMabdgijmnsu#/0123456789'

// PSM 4 = "single column of text of variable sizes". Medido contra una hoja de
// prueba con 16 acordes: PSM 4 los detecta los 16 sin basura; PSM 11 ("sparse
// text", que parecía el modo natural para símbolos sueltos) detecta 11 y pierde
// justamente los acordes de UNA letra —F, C, G—, que son los más frecuentes en
// guitarra. Ver claude-docs/OCR-PARTITURA.md.
const PSM_SINGLE_COLUMN = '4'

// Confianza mínima por palabra (columna conf del TSV). En la hoja de prueba el
// cifrado legítimo entró entre 73 y 97, y la basura que genera el pentagrama
// entre 0 y 9: 40 deja margen cómodo de los dos lados. No conviene subirlo —
// los acordes de una sola letra son los que menos confianza sacan.
const CONF_MIN = 40

// Los sufijos más largos van primero para que la alternancia del regex
// prefiera "maj7" sobre "m" al matchear.
const QUALITY_PATTERN = [...CHORD_QUALITIES]
  .sort((a, b) => b.length - a.length)
  .join('|')

// Un token solo cuenta como acorde si es exactamente fundamental + alteración
// opcional + calidad conocida opcional + bajo invertido opcional.
const CHORD_RE = new RegExp(
  `^([A-G])([#b]?)(${QUALITY_PATTERN})?(/[A-G][#b]?)?$`
)

interface Word {
  text: string
  left: number
  top: number
  height: number
}

/** Parsea el TSV de Tesseract y descarta las palabras de baja confianza. */
function parseTsv(tsv: string): Word[] {
  const words: Word[] = []

  // La primera línea es el encabezado de columnas.
  for (const line of tsv.split('\n').slice(1)) {
    const cols = line.split('\t')
    if (cols.length < 12) continue

    const conf = Number(cols[10])
    const text = cols[11]?.trim()
    if (!text || !Number.isFinite(conf) || conf < CONF_MIN) continue

    words.push({
      text,
      left: Number(cols[6]),
      top: Number(cols[7]),
      height: Number(cols[9]),
    })
  }

  return words
}

/**
 * Ordena las palabras en orden de lectura: por renglón (arriba->abajo) y,
 * dentro de cada renglón, de izquierda a derecha.
 *
 * Hace falta porque con PSM 11 Tesseract entrega los bloques dispersos en un
 * orden que no respeta la secuencia musical, y para un guitarrista el orden
 * de los acordes ES la información. La tolerancia de renglón se deriva de la
 * altura mediana de las palabras para no depender de la resolución de la foto.
 */
function sortByReadingOrder(words: Word[]): Word[] {
  if (words.length === 0) return []

  const heights = words.map((w) => w.height).sort((a, b) => a - b)
  const rowTolerance = heights[Math.floor(heights.length / 2)] || 1

  const rows: Word[][] = []
  for (const word of [...words].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(word.top - r[0].top) < rowTolerance)
    if (row) row.push(word)
    else rows.push([word])
  }

  return rows.flatMap((row) => row.sort((a, b) => a.left - b.left))
}

/**
 * Corrige el "7" leído como "/" al final del token, confusión observada en
 * imágenes de baja definición ("E7" → "E/", "A#m7" → "A#m/").
 *
 * Es seguro: un "/" final sin nota de bajo detrás nunca es un acorde válido,
 * así que la reescritura no puede corromper una lectura correcta — solo
 * recupera una que de otro modo se descartaría.
 */
function fixTrailingSlash(token: string): string {
  return token.endsWith('/') ? `${token.slice(0, -1)}7` : token
}

/**
 * Extrae los acordes válidos, en orden de lectura.
 *
 * No se deduplica: las repeticiones son parte real de la progresión (un
 * "Am Am F F" se toca así), y Tesseract emite cada palabra una sola vez en
 * el TSV, con lo cual no hay detecciones duplicadas que limpiar.
 */
function extractChords(words: Word[]): string[] {
  return sortByReadingOrder(words)
    .map((word) => fixTrailingSlash(word.text))
    .filter((token) => CHORD_RE.test(token))
}

/** Convierte la primera página de un PDF a PNG a 300 dpi para poder pasarla a OCR. */
async function pdfToImage(pdfPath: string, prefix: string): Promise<string> {
  await execFileAsync(
    'pdftoppm',
    ['-png', '-r', '300', '-singlefile', '-f', '1', '-l', '1', pdfPath, prefix],
    { timeout: TIMEOUT_MS }
  )
  return `${prefix}.png`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const imageFile = formData.get('image')

  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const isPdf =
    imageFile.type === 'application/pdf' ||
    imageFile.name.toLowerCase().endsWith('.pdf')

  const baseName = `score_${Date.now()}`
  // La extensión de la imagen es irrelevante: Tesseract detecta el formato por
  // la cabecera del archivo, no por el nombre. Se usa una fija en vez de la del
  // archivo subido para no meter texto controlado por el usuario en una ruta.
  // tmpdir() y no '/tmp' fijo: en Windows esa ruta no existe y el write falla con ENOENT.
  const tmp = tmpdir()
  const sourcePath = join(tmp, `${baseName}.${isPdf ? 'pdf' : 'img'}`)
  const tsvPath = join(tmp, `${baseName}.tsv`)
  // Tesseract agrega la extensión según el formato de salida pedido.
  const tsvBase = join(tmp, baseName)
  const cleanup = [sourcePath, tsvPath]

  await writeFile(sourcePath, Buffer.from(await imageFile.arrayBuffer()))

  try {
    let ocrInput = sourcePath
    if (isPdf) {
      ocrInput = await pdfToImage(sourcePath, join(tmp, `${baseName}_page`))
      cleanup.push(ocrInput)
    }

    await execFileAsync(
      'tesseract',
      [
        ocrInput,
        tsvBase,
        '--psm', PSM_SINGLE_COLUMN,
        '-c', `tessedit_char_whitelist=${CHAR_WHITELIST}`,
        'tsv',
      ],
      { timeout: TIMEOUT_MS }
    )

    const tsv = await readFile(tsvPath, 'utf-8')
    const words = parseTsv(tsv)
    const chords = extractChords(words)

    return NextResponse.json({
      chords,
      rawText: words.map((w) => w.text).join(' '),
    })
  } catch {
    return NextResponse.json(
      {
        error:
          'No se pudo analizar la partitura. Verificá que la imagen sea clara y que el cifrado de acordes esté visible sobre los pentagramas.',
      },
      { status: 500 }
    )
  } finally {
    await Promise.all(cleanup.map((p) => unlink(p).catch(() => {})))
  }
}
