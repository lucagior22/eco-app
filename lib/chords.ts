// Conversión de notación de acordes estándar a texto en español legible para TTS.
// Garantiza que el lector de pantalla diga "Si menor" y nunca "Sim".

const NOTE_MAP: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

// Mapeo de sufijos de calidad a español.
// El orden importa: las claves más largas deben verificarse primero en el parser.
const QUALITY_MAP: Record<string, string> = {
  'maj7': 'mayor séptima',
  'maj9': 'mayor novena',
  'min7': 'menor séptima',
  'min9': 'menor novena',
  'dim7': 'disminuido séptima',
  'aug7': 'aumentado séptima',
  'sus4': 'suspendida cuarta',
  'sus2': 'suspendida segunda',
  'add9': 'con novena',
  'm7':   'menor séptima',
  'm9':   'menor novena',
  'M7':   'mayor séptima',
  'maj':  'mayor',
  'min':  'menor',
  'dim':  'disminuido',
  'aug':  'aumentado',
  'm':    'menor',
  'M':    'mayor',
  '7':    'séptima',
  '9':    'novena',
  '11':   'undécima',
  '13':   'decimotercera',
  '':     'mayor',
}

/**
 * Convierte un acorde en notación estándar a texto en español legible para TTS.
 * Ejemplos:
 *   "Am"     → "La menor"
 *   "Bm"     → "Si menor"
 *   "C#maj7" → "Do sostenido mayor séptima"
 *   "Gb"     → "Sol bemol mayor"
 *   "G"      → "Sol mayor"
 */
export function chordToSpanish(chord: string): string {
  const trimmed = chord.trim()
  const match = trimmed.match(/^([A-G])([#b]?)(.*)$/)
  if (!match) return trimmed

  const [, note, accidental, rest] = match

  const noteName = NOTE_MAP[note] ?? note
  const accidentalName =
    accidental === '#' ? ' sostenido' : accidental === 'b' ? ' bemol' : ''

  // Ignorar nota de bajo (ej. "Am/C" → calidad solo de "Am")
  const qualityRaw = rest.split('/')[0]

  // Buscar la calidad en el mapa, del sufijo más largo al más corto
  const qualityName =
    Object.entries(QUALITY_MAP).find(([key]) => qualityRaw === key)?.[1] ??
    QUALITY_MAP['']

  return `${noteName}${accidentalName} ${qualityName}`.trim()
}
