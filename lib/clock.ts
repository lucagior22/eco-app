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

// Recorrido típico de una perilla de pedal: no da la vuelta completa, va de las
// 7 (mínimo) a las 5 (máximo) pasando por las 12 (centro), unos 300°. Las 6 —
// apuntando derecho hacia abajo— queda fuera de ese recorrido.
const KNOB_SWEEP: number[] = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]

// Cinco escalones y no doce: un error de 15° cambia la hora reportada, y la
// medición del detector anterior mostró que buena parte del error era de
// exactamente una hora. La escala verbal absorbe ese error —cinco escalones
// sobre 300° toleran ~30° cada uno— y además es como se describe una perilla
// hablando. Es el mismo patrón que /afinador usa para la desviación.
const SCALE_STEPS = ['al mínimo', 'bajo', 'al medio', 'alto', 'al máximo']

/**
 * Convierte una hora de reloj (1-12) a la escala verbal de cinco escalones.
 * Devuelve null para las 6, que está fuera del recorrido de una perilla: es
 * preferible reportar solo la hora antes que forzarla a un escalón inventado.
 */
export function clockHourToScale(hour: number): string | null {
  const index = KNOB_SWEEP.indexOf(hour)
  if (index === -1) return null

  const fraction = index / (KNOB_SWEEP.length - 1)
  if (fraction < 0.1) return SCALE_STEPS[0]
  if (fraction < 0.35) return SCALE_STEPS[1]
  if (fraction < 0.65) return SCALE_STEPS[2]
  if (fraction < 0.92) return SCALE_STEPS[3]
  return SCALE_STEPS[4]
}
