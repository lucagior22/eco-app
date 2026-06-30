// Conversión de hora de reloj (1-12) a texto en español hablado para TTS y UI.
// La 1 es singular ("la una"); el resto es plural ("las dos", "las tres"...).

const HOUR_NAMES: Record<number, string> = {
  1: 'la una',
  2: 'las dos',
  3: 'las tres',
  4: 'las cuatro',
  5: 'las cinco',
  6: 'las seis',
  7: 'las siete',
  8: 'las ocho',
  9: 'las nueve',
  10: 'las diez',
  11: 'las once',
  12: 'las doce',
}

/**
 * Convierte una hora de reloj (1-12) a texto hablado en español.
 * Ejemplos: 1 → "la una", 3 → "las tres", 12 → "las doce"
 */
export function clockHourToSpanish(hour: number): string {
  return HOUR_NAMES[hour] ?? `las ${hour}`
}
