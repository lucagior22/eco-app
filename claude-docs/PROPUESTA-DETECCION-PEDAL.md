# Propuesta — Rediseño de la detección de perillas en `/pedal`

Estado: **propuesta, sin implementar**. Fecha: 2026-07-28.

## Contexto y diagnóstico

La detección actual (OpenCV: HoughCircles + contraste angular + votación entre 5 capturas, `scripts/detect_knobs.py`) no alcanza calidad usable ni en condiciones ideales. El usuario reporta que con encuadre y luz perfectos sigue fallando, y las mediciones del propio proyecto (ver `PEDAL.md` y `DECISIONS.md`) lo respaldan:

- Techo medido de **~68% de consistencia por foto**, incluso después de tres rondas de arreglos medidos sobre 92 fotos reales.
- Con votación: responde el 80% de las veces con ~93% de acierto **simulado** — y la simulación usó fotos separadas por segundos, así que la mejora real con ráfaga de 400 ms es menor.
- Los límites restantes son **estructurales, no de calibración**:
  1. **Perspectiva**: la cara de la perilla se ve como elipse; produce un sesgo sistemático de ~1 hora que la votación no puede corregir (no es ruido aleatorio).
  2. **Heurísticas frágiles**: umbrales calibrados contra un solo pedal (`KNOB_MAX_MEAN = 70` asume perillas negras; el contraste lateral asume marca blanca pintada). Cualquier otro pedal degrada.
  3. **Cuantización brutal**: un error de 15° cambia la hora reportada; con tolerancia ±1 hora la consistencia salta de 67% a 85%, lo que muestra que gran parte del error es de exactamente una hora.

Conclusión del diagnóstico: seguir puliendo el pipeline clásico tiene retorno decreciente. Las tres opciones de abajo son los caminos viables.

---

## Opción A — Reemplazo completo: API de Claude con visión

### Arquitectura

El cliente mantiene el flujo actual (ráfaga de capturas → POST multipart a `/api/pedal/detect`), pero la route deja de spawnear Python y llama a la API de Claude con el SDK oficial de TypeScript.

```
Cliente (CameraView)
  └─ ráfaga de 2-3 capturas (en vez de 5)
       └─ POST /api/pedal/detect (multipart, igual que hoy)
            └─ @anthropic-ai/sdk → claude-opus-5 con visión
                 ├─ las 2-3 fotos como bloques image (base64)
                 ├─ prompt: leer perillas de pedal, hora de reloj 1-12,
                 │   etiqueta impresa si es legible, null si no hay confianza
                 └─ structured outputs (output_config.format con JSON schema)
                      → respuesta JSON garantizada parseable
            └─ NextResponse.json({ knobs: [...] })  (mismo contrato que hoy)
```

Puntos de diseño:

- **Structured outputs** (`output_config.format` con `json_schema`): la API garantiza que la respuesta valida contra el schema — no hay parsing frágil de texto libre. Schema propuesto por perilla: `{ position: string, printedLabel: string | null, value: number | null, confidence: "alta" | "baja" }`.
- **Se mantiene la abstención honesta**: el prompt instruye devolver `value: null` cuando la marca no se lee con confianza. La UI y el TTS siguen diciendo "no pude leerla con confianza" — este principio (una respuesta incorrecta dicha con seguridad es peor que la ausencia de respuesta) no cambia.
- **Nueva capacidad: etiquetas impresas**. El modelo puede leer "TONE", "LEVEL", "SUB", etc. Para un usuario ciego, "Tone a las 3" es estrictamente más útil que "Arriba izquierda a las 3". El pipeline OpenCV nunca va a poder dar esto.
- **Nueva capacidad implícita**: robustez ante perillas claras, marcas grabadas, layouts raros, perspectiva — todo lo que hoy rompe las heurísticas.
- **Ráfaga reducida a 2-3 fotos**: la redundancia extrema era para compensar la inestabilidad del detector clásico; un modelo de visión no la necesita en ese grado y cada foto cuesta tokens. Se puede pedir al modelo consistencia entre las fotos dentro del mismo prompt (todas van en la misma request).

### Cambios por archivo

| Archivo | Cambio |
| --- | --- |
| `app/api/pedal/detect/route.ts` | Reescritura: reemplazar `execFile('python3', ...)` por llamada al SDK. Mantener el contrato de respuesta (`knobs`, error 400/500 con mensaje descriptivo). Nuevo caso de error: sin API key / sin conexión → mensaje claro narrable ("La detección de pedal necesita conexión a internet"). |
| `components/pedal/CameraView.tsx` | `BURST_FRAMES` 5 → 3 (o 2). Nada más. |
| `components/pedal/PedalInfo.tsx` + `PedalScreen.tsx` | Mostrar/narrar `printedLabel` cuando existe, caer a posición espacial cuando no. |
| `scripts/detect_knobs.py` | Se elimina (queda en el historial de git como evidencia del TFI). |
| `Dockerfile` | Quitar `opencv-python-headless`, `numpy` y Python del stage de runtime → imagen considerablemente más liviana. Agregar `ANTHROPIC_API_KEY` como variable esperada (documentada, nunca hardcodeada). |
| `package.json` | + `@anthropic-ai/sdk`. |
| Docs | Entrada en `DECISIONS.md` (por qué se abandonó OpenCV, con las mediciones de la v3 como evidencia), reescritura de `PEDAL.md`, nota `> **Implementado (v4)**` en `SPECIFICATION.md`, actualización de `README.md` y de la tabla de stack en `CLAUDE.md`. |

### Costos y operación

- Modelo: `claude-opus-5` — $5/M tokens entrada, $25/M salida. Una foto de celular en alta resolución consume hasta ~4.800 tokens de entrada; con 3 fotos + prompt + salida corta, cada detección ronda **USD 0,02–0,08**. Para una acción puntual (no continua) es despreciable; si el costo importara, bajar la resolución de captura reduce tokens de imagen ~3×.
- Latencia esperable: **3–8 s** por detección (hoy: ~1,6 s de ráfaga + hasta 45 s de timeout del script). El botón ya tiene estado "Tomando fotos…" anunciado por voz; se agrega "Analizando…".
- Requiere `ANTHROPIC_API_KEY` en el entorno del contenedor y salida a internet desde el server (compatible con el deployment Docker + Cloudflare Tunnel actual).

### Riesgos

- **Dependencia de red y de un tercero** para esta pantalla. Sin conexión, la función no anda (con mensaje claro). El afinador y el metrónomo — lo crítico en vivo — siguen 100% locales.
- **Los modelos de visión también se equivocan en lecturas finas de ángulo.** No es magia: la precisión en "¿a qué hora apunta?" hay que validarla contra el pedal real antes de dar la migración por buena (criterio de éxito abajo). La expectativa razonable es superar con comodidad el 68% actual y sumar las etiquetas, no llegar al 100%.
- **Privacidad**: las fotos salen del dispositivo hacia la API. Para fotos de un pedal es un riesgo menor, pero rompe la propiedad "todo se procesa localmente" y merece una línea en el README.

### Esfuerzo estimado

**~1 día** de implementación + validación con el pedal físico.

---

## Opción B — Híbrido: API con fallback local

### Arquitectura

Igual que la Opción A, pero `detect_knobs.py` y su pipeline **no se eliminan**: si la llamada a la API falla (sin conexión, sin key, timeout), la route cae al detector OpenCV actual y lo señala en la respuesta (`source: "local"`), para que la UI/TTS puedan advertir "lectura local, menos confiable".

### Qué agrega y qué cuesta

- **A favor**: la pantalla nunca queda muerta sin internet; preserva la narrativa "local first" del TFI.
- **En contra**:
  - Se mantienen **dos pipelines** con dos contratos levemente distintos (el local no da `printedLabel`), dos superficies de bugs y toda la dependencia Python/OpenCV en la imagen Docker que la Opción A eliminaba.
  - El fallback es exactamente el detector que motiva este documento: **cuando actúe, va a andar mal**. Un fallback que responde con ~68% de acierto a un usuario que no puede verificar visualmente es de valor dudoso — posiblemente peor que decir "sin conexión no puedo leer el pedal".
  - Contra el principio de simplicidad de `CLAUDE.md` ("¿un senior diría que es demasiado?" — acá probablemente sí).

### Esfuerzo estimado

**~1,5–2 días** (todo lo de A + la rama de fallback + distinguir fuentes en UI/TTS + testear ambos caminos).

---

## Opción C — Seguir local: rectificación de perspectiva

### Arquitectura

Atacar la limitación estructural #1 del pipeline actual: antes de Hough, detectar el rectángulo del cuerpo del pedal (contorno dominante / minAreaRect sobre bordes), estimar la homografía a vista frontal y rectificar la imagen. Sobre la imagen rectificada, las perillas vuelven a ser círculos y el sesgo de ~1 hora por elipse desaparece. Complementos posibles: ajustar elipse por perilla en vez de círculo, y refinar el ángulo con subpíxel.

### Potencial y límites

- La doc muestra que con tolerancia ±1 hora la consistencia sube de 67% a 85% → si la rectificación elimina el sesgo de una hora, el techo realista es **~80–85% por foto**, que con votación podría acercarse a ~95% *cuando responde*.
- **No arregla** la fragilidad ante otros pedales (perillas claras, marcas grabadas), ni agrega etiquetas, ni elimina la dependencia de umbrales calibrados a mano.
- Detectar el contorno del pedal es en sí frágil (fondo de madera, glare, pedal que no llena el cuadro): se agrega una etapa nueva que también puede fallar, y cuando falla, todo lo de atrás falla con ella.
- Es más de lo mismo que ya se hizo tres veces: calibrar visión clásica contra el pedal de prueba. El riesgo concreto es invertir varios días y quedar en un 80% que sigue sin sentirse confiable.

### Cambios por archivo

Solo `scripts/detect_knobs.py` (etapa de rectificación + recalibración de umbrales sobre imágenes rectificadas) y las mediciones correspondientes en `PEDAL.md`/`DECISIONS.md`.

### Esfuerzo estimado

**3–5 días**, con incertidumbre alta (es investigación, no implementación).

---

## Opción D — Modelo propio entrenado (detección + ángulo)

### Viabilidad de hardware (medida en la máquina de desarrollo, 2026-07-28)

| Recurso | Disponible | Veredicto |
| --- | --- | --- |
| GPU | NVIDIA RTX 3050, 6 GB VRAM | Suficiente para fine-tune de YOLOv8/v11 nano/small (batch 16 @ 640px). Un entrenamiento de ~100 épocas sobre cientos de imágenes: 10–30 min. |
| CPU / RAM | Ryzen 5 8400F (6c/12t), 16 GB | Bien para el pipeline de datos. La **inferencia** no necesita GPU: YOLO-nano en ONNX corre en 50–150 ms/foto en CPU, dentro del Docker actual. |
| Disco | ~21 GB libres en /home | Justo pero suficiente (dataset + checkpoints ~5 GB). |

**El hardware no es el cuello de botella; el dataset sí.**

### Arquitectura

Dos tareas entrenables:

1. **Detección de perillas** (bounding boxes): fine-tune de YOLO-nano con 200–400 fotos anotadas (~1–2 h de anotación en CVAT/Roboflow; las 92 fotos de `tmp/debug_captures/` son la semilla). Parte fácil, precisión altísima esperable.
2. **Ángulo de la marca**: keypoints (centro + punta de la marca, variante pose de YOLO) o regresión de sin/cos sobre el crop de cada perilla. El modelo aprende perspectiva, glare y reflejos de los datos — exactamente las tres fragilidades estructurales del pipeline OpenCV.

Clave de viabilidad: **el ángulo se etiqueta barato** fotografiando el pedal con las perillas en posiciones conocidas ("todas a las 12", "todas a las 3"...) más augmentation agresiva (rotaciones con etiqueta ajustada, perspectiva, brillo). Objetivo realista: ±15° (una hora de reloj).

Integración: export a ONNX, inferencia en `/api/pedal/detect` vía `onnxruntime` (mismo patrón de proceso hijo que hoy, o `onnxruntime-node`). Reemplaza a `detect_knobs.py`; se puede conservar la votación entre capturas.

### Límites

- **Entrenado solo con el pedal propio**: precisión muy alta esperable (>90% con ±1 hora), pero es de nuevo un sistema calibrado a un pedal — ahora con aprendizaje en vez de umbrales. Para el caso de uso real (leer el propio pedal) puede ser aceptable; generalizar a cualquier pedal exige diversidad de datos que no existe hoy (buscar datasets públicos en Roboflow Universe antes de descartarlo).
- No lee etiquetas impresas ("Tone", "Level") — exclusivo de las opciones con API.
- Revierte parcialmente el descarte de `DECISIONS.md` (2026-06-30, "entrenar está fuera de alcance"): aquel descarte asumía que hacía falta un dataset de pedales *conocidos* para clasificación; para detección + ángulo el dataset se fabrica en casa.

### Esfuerzo estimado

**4–7 días**: 1–2 de dataset (sesión de fotos sistemática + anotación), 1–2 de entrenamiento e iteración (los entrenamientos son de minutos; iterar augmentation/evaluación es lo que lleva tiempo), ~1 de export + integración. Con curva de aprendizaje extra si no se entrenaron modelos antes. Como material de TFI, un modelo entrenado con métricas documentadas es evidencia valiosa.

---

## Comparación

| Criterio | A — API Claude | B — Híbrido | C — Rectificación local | D — Modelo entrenado |
| --- | --- | --- | --- | --- |
| Precisión esperada | Alta (a validar con pedal real) | = A con red; ~68-93% sin red | ~80-85% por foto, techo incierto | >90% ±1h sobre el pedal propio |
| Lee etiquetas ("Tone", "Level") | ✅ | ✅ solo con red | ❌ | ❌ |
| Robustez ante otros pedales | ✅ | ✅ solo con red | ❌ (sigue calibrado a uno) | ❌ salvo dataset diverso |
| Funciona sin internet | ❌ (mensaje claro) | ✅ (mal) | ✅ | ✅ |
| Complejidad resultante | Baja (borra ~400 líneas de Python) | Alta (dos pipelines) | Media-alta (más visión clásica) | Media (modelo ONNX + pipeline de entrenamiento aparte) |
| Imagen Docker | Más liviana (sin OpenCV/numpy) | Igual que hoy | Igual que hoy | Similar (onnxruntime en vez de OpenCV) |
| Costo operativo | ~USD 0,02–0,08 por detección | Ídem con red | $0 | $0 |
| Esfuerzo | ~1 día | ~1,5–2 días | 3–5 días, resultado incierto | 4–7 días |
| Riesgo principal | Precisión de ángulo del modelo; dependencia de red | Mantener el fallback malo | Invertir días y quedar corto | Tiempo de dataset; generaliza solo al pedal propio |

## Recomendación

**Opción A.** Resuelve de un golpe las tres fragilidades estructurales, agrega las etiquetas impresas (la mejora de accesibilidad más grande disponible), simplifica el sistema y es la más barata en esfuerzo. La pérdida de "todo local" queda acotada a una función puntual donde 5 segundos de latencia y conexión son aceptables; lo crítico en vivo (afinador, metrónomo) sigue local.

La Opción B solo tiene sentido si el enunciado del TFI exige explícitamente funcionamiento sin conexión para *todas* las pantallas — y aun así conviene discutir si un fallback con ~68% de acierto para un usuario que no puede verificar es mejor que una abstención honesta. La Opción C es el camino corto si la restricción "sin servicios externos" es dura, pero entre las opciones locales la **D domina a la C**: por 1-2 días más de esfuerzo, el modelo entrenado ataca las tres fragilidades estructurales a la vez (la rectificación solo ataca una), el hardware disponible lo permite sin fricción, y deja evidencia de TFI más rica (dataset, métricas, curvas de entrenamiento). Si la prioridad es "100% local y que ande bien con MI pedal", la D es la mejor opción local.

### Criterio de éxito propuesto (para la opción que se elija)

Sobre el pedal físico de prueba (TC Electronic Sub'n'Up), 10 detecciones con las perillas en posiciones conocidas y variadas:

- ≥ 9/10 detecciones reportan las 4 perillas.
- ≥ 90% de las horas reportadas correctas con tolerancia ±1 hora; ninguna lectura incorrecta por más de 1 hora **dicha con confianza** (las dudosas deben venir en `null`).
- (Solo A/B) etiquetas impresas correctas cuando son legibles en la foto.
- Sin conexión / sin API key: mensaje de error claro, narrado, sin excepción cruda.
