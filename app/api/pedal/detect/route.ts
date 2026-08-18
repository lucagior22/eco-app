import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type, createPartFromBase64, type Part } from '@google/genai'

// La lectura de perillas la hace un modelo multimodal (Gemini) y no el detector
// OpenCV de scripts/detect_knobs.py, que quedó en el repo como evidencia del
// proceso pero ya no se invoca. Ver DECISIONS.md (2026-08-18) y
// claude-docs/PEDAL.md para las razones y las limitaciones que esto introduce.

// Modelo por variable de entorno: los modelos del tier gratuito rotan y se
// deprecian, y no queremos que eso obligue a tocar código para cambiarlo. Ya
// pasó una vez: gemini-2.5-flash dejó de estar disponible y el endpoint entero
// respondía 404.
//
// Se usa la variante "lite" y no el flash grande por una medición propia sobre
// una foto real: 3,7 s contra 27-44 s de gemini-3.6/3.7-flash, con la misma
// cantidad de perillas detectadas y sin peor acierto en el ángulo. El
// razonamiento extra de los modelos grandes no compra precisión angular, y para
// un usuario que espera escuchando, 4 segundos y 45 segundos no son lo mismo.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'

// Una llamada con 3 imágenes responde en segundos; 30 s deja margen para
// reintentos internos del SDK sin dejar al usuario esperando indefinidamente.
const TIMEOUT_MS = 30_000

// El cliente manda una sola foto. El tope existe igual como defensa: una
// petición con muchas imágenes multiplicaría el consumo de la cuota gratuita.
const MAX_IMAGES = 3

// Se pide la hora de reloj y no un porcentaje porque no requiere saber dónde
// está el mínimo y el máximo de cada modelo de perilla; la escala verbal se
// deriva en el cliente con clockHourToScale.
const PROMPT = `Sos un asistente para músicos ciegos. La imagen es la foto de un pedal de efectos.

Identificá cada perilla (potenciómetro giratorio) del pedal y, para cada una, informá:

1. "position": su ubicación en el panel, en español, con esta forma exacta cuando aplique: "Arriba izquierda", "Arriba centro", "Arriba derecha", "Abajo izquierda", "Abajo centro", "Abajo derecha", "Izquierda", "Centro", "Derecha". Si el layout no encaja en ninguna, usá "Perilla N" numerando de arriba a abajo y de izquierda a derecha.
2. "printedLabel": el texto impreso en el panel que nombra a esa perilla (por ejemplo "TONE", "LEVEL", "DRIVE", "SUB"), tal como aparece. Si no se lee con claridad, null.
3. "clockHour": hacia qué hora de un reloj apunta la marca indicadora de la perilla, como número entero de 1 a 12. Las 12 es arriba, las 3 es a la derecha, las 6 abajo, las 9 a la izquierda.
4. "confidence": "alta" solo si estás seguro de la hora; "baja" si la marca está borrosa, tapada, con reflejo, o si las distintas fotos te dan lecturas diferentes.

REGLAS CRÍTICAS:
- El usuario NO PUEDE VER la pantalla ni verificar si tu respuesta es correcta. Una lectura equivocada dicha con seguridad es MUCHO PEOR que admitir que no se puede leer. Ante la menor duda sobre la hora, poné "confidence": "baja".
- No inventes perillas que no ves ni omitas perillas que sí ves: el usuario cuenta las perillas de su pedal por lo que vos le decís.
- No incluyas footswitches, jacks, tornillos, LEDs ni logos: solo perillas giratorias.
- Si en las imágenes no hay ningún pedal de efectos, devolvé la lista vacía.`

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    knobs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          position: { type: Type.STRING },
          printedLabel: { type: Type.STRING, nullable: true },
          clockHour: { type: Type.INTEGER, nullable: true },
          confidence: { type: Type.STRING, enum: ['alta', 'baja'] },
        },
        required: ['position', 'printedLabel', 'clockHour', 'confidence'],
      },
    },
  },
  required: ['knobs'],
}

interface ModelKnob {
  position: string
  printedLabel: string | null
  clockHour: number | null
  confidence: 'alta' | 'baja'
}

interface Knob {
  label: string
  printedLabel: string | null
  value: number | null
  confidence: 'alta' | 'baja'
}

const NO_KNOBS_MESSAGE =
  'No se detectaron perillas en la imagen. Verificá el encuadre, la distancia y la iluminación.'

// Un fallo del servicio no es lo mismo que una foto sin perillas. Devolver el
// mensaje de encuadre ante un error de la API manda al usuario a repetir la foto
// por algo que no tiene arreglo de su lado — y si no ve la pantalla, puede
// quedarse intentándolo indefinidamente.
const SERVICE_ERROR_MESSAGE = 'El servicio de detección falló. Probá de nuevo en unos minutos.'

/**
 * Normaliza lo que devuelve el modelo al contrato que consume la UI.
 * Una hora fuera de 1-12 o una confianza "baja" se convierten en value: null —
 * la abstención explícita se mantiene igual que en el detector anterior, porque
 * el usuario no tiene cómo verificar visualmente una lectura equivocada.
 */
function normalize(knobs: ModelKnob[]): Knob[] {
  return knobs.map((knob, i) => {
    const hour = knob.clockHour
    const valid = knob.confidence === 'alta' && typeof hour === 'number' && hour >= 1 && hour <= 12

    return {
      label: knob.position?.trim() || `Perilla ${i + 1}`,
      printedLabel: knob.printedLabel?.trim() || null,
      value: valid ? hour : null,
      confidence: knob.confidence === 'alta' ? 'alta' : 'baja',
    }
  })
}

/**
 * Traduce el fallo de la API a un mensaje que el TTS pueda narrar tal cual.
 * Sin esto el usuario escucharía un "error 429" que no le dice qué hacer.
 */
function messageForError(err: unknown): string {
  const status = (err as { status?: number }).status
  const text = err instanceof Error ? err.message : String(err)

  if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(text)) {
    return 'Se alcanzó el límite de uso del servicio de detección. Probá de nuevo en unos minutos.'
  }
  if (status === 401 || status === 403 || /API key/i.test(text)) {
    return 'El servicio de detección no está configurado correctamente en el servidor.'
  }
  if (/abort|timeout|ETIMEDOUT|fetch failed|ENOTFOUND/i.test(text)) {
    return 'No se pudo conectar con el servicio de detección. Verificá tu conexión a internet.'
  }
  // 404 = el modelo configurado ya no existe. Es un fallo de configuración del
  // servidor, no algo que el usuario pueda resolver reencuadrando.
  if (status === 404 || /not available|NOT_FOUND/i.test(text)) {
    return 'El modelo de detección configurado ya no está disponible. Hay que actualizarlo en el servidor.'
  }
  return SERVICE_ERROR_MESSAGE
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'La detección de pedal necesita conexión a internet y no está configurada en este servidor.',
      },
      { status: 503 }
    )
  }

  // formData() tira si el request no viene como multipart; sin este guard, una
  // petición malformada saldría como 500 en vez del 400 que corresponde.
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const files = formData.getAll('image').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Imagen no recibida' }, { status: 400 })
  }

  const batch = files.slice(0, MAX_IMAGES)
  const imageParts: Part[] = await Promise.all(
    batch.map(async (file) =>
      createPartFromBase64(
        Buffer.from(await file.arrayBuffer()).toString('base64'),
        file.type || 'image/jpeg'
      )
    )
  )

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [...imageParts, { text: PROMPT }] }],
      config: {
        // temperature 0: la misma foto debería dar la misma lectura. No lo
        // garantiza, pero es lo máximo que se puede pedir del lado del cliente.
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        httpOptions: { timeout: TIMEOUT_MS },
      },
    })

    const text = response.text
    if (!text) {
      return NextResponse.json({ error: NO_KNOBS_MESSAGE }, { status: 500 })
    }

    const parsed = JSON.parse(text) as { knobs?: ModelKnob[] }
    const knobs = normalize(parsed.knobs ?? [])

    if (knobs.length === 0) {
      return NextResponse.json({ error: NO_KNOBS_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({ knobs, framesUsed: batch.length })
  } catch (err) {
    return NextResponse.json({ error: messageForError(err) }, { status: 500 })
  }
}
