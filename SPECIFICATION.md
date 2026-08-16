# SPECIFICATION.md — eco-app

> Fuente de verdad para el agente. Ante cualquier ambigüedad, este archivo tiene prioridad.
>
> **Diseño (Figma):** https://www.figma.com/design/AebURRhSh0VGRnlkDrApKA/Prototipo---TP-final
>
> **Convención de anotaciones:** `> **Implementado:**` describe lo que el código ya hace y difiere de la spec.
> `> **Pendiente:**` describe un cambio ya decidido pero todavía no escrito. Al implementarlo, se cambia la
> etiqueta a `Implementado` con la fecha.

---

## 1. Descripción general

**Eco** es una PWA (Progressive Web App) de asistencia musical para músicos con discapacidad visual o ceguera.
Permite afinar instrumentos, leer partituras, identificar pedales de efecto y configurar preferencias de accesibilidad — todo con narración por voz y navegación por teclado completa.

**Plataforma primaria:** móvil (PWA instalable, mobile-first)
**Plataforma secundaria:** desktop (mismo código, layout adaptado)
**Idioma:** español (Argentina)
**Deployment:** Docker en Ubuntu Server local, expuesto vía Cloudflare Tunnel

---

## 2. Stack técnico

```
Next.js 15 (App Router) + TypeScript strict
├── @serwist/next          → service worker + PWA manifest
├── react-aria-components  → componentes accesibles (Adobe)
├── tailwindcss            → sistema de estilos
├── pitchfinder            → algoritmo YIN para detección de pitch
├── Web Speech API         → TTS nativo del browser (sin librería)
├── Web Audio API          → captura de micrófono (AudioContext)
└── MediaDevices API       → acceso a cámara (getUserMedia)

Backend (mismo contenedor):
└── /api/ocr/route.ts → child_process → oemer (Python 3)
```

> **Implementado:** `/api/ocr` usa **Tesseract OCR** (binario del sistema vía `child_process`), no oemer. oemer es un OMR y no reconoce cifrado de acordes, que es lo que esta pantalla necesita leer. Ver DECISIONS.md, entrada "Tesseract con whitelist de cifrado".

---

## 3. Estructura de archivos

```
eco-app/
├── app/
│   ├── layout.tsx                  # root layout: skip link, nav, PWA meta
│   ├── page.tsx                    # redirect a /afinador
│   ├── globals.css                 # CSS variables de tema + Tailwind base
│   ├── manifest.ts                 # PWA manifest dinámico
│   ├── afinador/
│   │   └── page.tsx
│   ├── partitura/
│   │   ├── page.tsx
│   │   └── metronomo/
│   │       └── page.tsx
│   ├── pedal/
│   │   └── page.tsx
│   ├── ajustes/
│   │   └── page.tsx
│   └── api/
│       └── ocr/
│           └── route.ts            # POST: recibe imagen → oemer → acordes
├── components/
│   ├── layout/
│   │   ├── Navigation.tsx          # bottom bar móvil / sidebar desktop
│   │   ├── PageHeader.tsx          # h1 + subtítulo de cada pantalla
│   │   └── SkipLink.tsx            # "Ir al contenido principal"
│   ├── tuner/
│   │   ├── TunerDisplay.tsx        # notas E A D G B E con activa resaltada
│   │   ├── PitchIndicator.tsx      # barra de centavos (aguja)
│   │   └── TunerEngine.tsx         # lógica: AudioContext + pitchfinder
│   ├── score/
│   │   ├── ScoreUpload.tsx         # botones "Subir archivo" y "Tomar foto"
│   │   ├── ScorePreview.tsx        # preview de la imagen cargada
│   │   └── HarmonyList.tsx         # lista de acordes detectados
│   ├── metronome/
│   │   └── Metronome.tsx           # BPM display + controles +/-/play
│   ├── pedal/
│   │   ├── CameraView.tsx          # stream de cámara + overlay bounding box
│   │   └── PedalInfo.tsx           # modelo, parámetros, estado LED
│   └── settings/
│       └── SettingCarousel.tsx     # control < valor > reutilizable
├── contexts/
│   └── SettingsContext.tsx         # tema, tamaño fuente, velocidad TTS
├── lib/
│   ├── pitch.ts                    # wrapper de pitchfinder + note detection
│   ├── tts.ts                      # wrapper de Web Speech API
│   ├── settings.ts                 # lectura/escritura localStorage
│   └── metronome.ts                # AudioContext beep + Vibration API
├── hooks/
│   ├── useMicrophone.ts            # getUserMedia audio
│   └── useCamera.ts                # getUserMedia video
├── public/
│   ├── icons/                      # íconos PWA (192x192, 512x512)
│   └── sw.js                       # generado por Serwist en build
├── Dockerfile
├── docker-compose.yml
├── .env.local.example
├── CLAUDE.md
└── SPECIFICATION.md
```

---

## 4. Sistema de diseño

### Colores (tokens CSS en `globals.css`)

```css
:root {
  --color-bg: #f2f2f7; /* fondo general */
  --color-surface: #ffffff; /* cards y superficies */
  --color-text-primary: #000000;
  --color-text-secondary: #6b7280;
  --color-accent-green: #22c55e; /* afinado, éxito */
  --color-accent-blue: #3b82f6; /* nav activo */
  --color-accent-orange: #f97316; /* velocidad alta TTS */
  --color-border: #e5e5ea;
  --color-header-bg: #e5e5ea; /* fondo del header de cada pantalla */
}

[data-theme='dark'] {
  /* pendiente v2 */
}

[data-theme='high-contrast'] {
  --color-bg: #000000;
  --color-surface: #1a1a1a;
  --color-text-primary: #ffffff;
  --color-accent-green: #00ff00;
  --color-accent-blue: #00bfff;
}
```

### Tipografía

- Fuente: sistema (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Tamaños base por setting de fuente:
  - `sm`: 14px base
  - `md`: 16px base (default)
  - `lg`: 18px base
  - `xl`: 20px base
- Títulos de pantalla: bold, 28px (md), escala con setting
- Subtítulos: regular, 14px, color secondary

### Layout responsivo

- **Mobile (< 768px):** bottom tab bar fija (altura 72px), contenido en columna
- **Desktop (≥ 768px):** sidebar izquierda fija (ancho 80px), contenido en el resto

---

## 5. Navegación

### Componente Navigation

Cuatro ítems siempre visibles: Partitura, Pedal, Afinador, Ajustes.

```
Ícono    Etiqueta   Ruta
📄       Partitura  /partitura
🎛️       Pedal      /pedal
🎵       Afinador   /afinador
⚙️       Ajustes    /ajustes
```

- Ítem activo: subrayado azul (`--color-accent-blue`) debajo del ícono
- `aria-current="page"` en el ítem activo
- `aria-label="Navegación principal"` en el `<nav>`
- Todos los ítems accesibles por teclado

### Pantalla Metrónomo

- Mobile: ruta separada `/partitura/metronomo`, botón back con flecha ←
- Desktop: panel derecho inline dentro de `/partitura` (split 50/50)

> **Pendiente:** el metrónomo deja de depender de Partitura y se suma a la barra de navegación como quinto ítem, entre Partitura y Pedal (ver §6.3). Queda por verificar que los cinco ítems entren sin recortar el label en 375 px con la fuente en tamaño muy grande: el texto es el nombre accesible de cada ítem, así que el ajuste tiene que salir del ícono y el padding, nunca de truncar la palabra.

---

## 6. Pantallas

### 6.1 Afinador (`/afinador`)

**Propósito:** detectar la nota tocada por el instrumento y narrar si está afinada, baja o alta.

**Comportamiento:**

1. Al entrar a la pantalla, pedir permiso de micrófono automáticamente
2. Capturar audio continuo con `AudioContext` + `ScriptProcessorNode` o `AudioWorklet`

   > **Implementado:** se usa `AnalyserNode` + `requestAnimationFrame` en lugar de `ScriptProcessorNode`. `ScriptProcessorNode` entrega buffers zerizados intermitentemente en Chromium/Windows. Ver DECISIONS.md.

3. Procesar con `pitchfinder` (algoritmo YIN, buffer 2048)

   > **Implementado:** buffer de 4096 muestras (no 2048). A 44100 Hz da ~93 ms de latencia, aceptable para detección estable de E2 (82 Hz). YIN con `threshold: 0.15` (no el default 0.10) para mejorar la detección de la 6ª cuerda.

4. Detectar la nota más cercana en escala cromática (A4 = 440 Hz)

   > **Implementado:** la nota mostrada y narrada se deriva de la cuerda de guitarra más cercana (no de la escala cromática). Así "B ligeramente sostenida" sigue diciéndose "Si", no "Do". Ver DECISIONS.md.
5. Calcular desviación en centavos
6. Actualizar display y narrar via TTS:
   - Si |centavos| < 10: "Re. Afinado." (narrar máximo cada 3 segundos)
   - Si centavos > 10: "Re. Un poco alto."
   - Si centavos < -10: "Re. Un poco bajo."

   > **Implementado:** umbral con histéresis: entra en "afinado" con ≤10 cents, sale con >20 cents. Evita flip-flop en tocadas consecutivas cerca del umbral. La detección se pausa mientras el TTS habla para evitar que el micrófono capte la voz sintetizada.

   > **Pendiente:** el umbral pasa a ≤5 cents para entrar y >10 para salir. En el test de usabilidad los dos participantes con oído entrenado escucharon la cuerda todavía baja cuando la app ya anunciaba "afinado": con la histéresis actual el estado se sostiene hasta 20 cents, que es audible. La magnitud se sigue comunicando con palabras y no con el número de cents —un usuario no músico no sabe qué es un cent—, pero la escala verbal se afina cerca del punto justo para que el usuario perciba que se está acercando: se agrega un escalón "casi afinada" entre 5 y 12 cents, que es el que evita pasarse de largo. Ver INFORME.md §1.4.

7. En desktop: mostrar selector de micrófono (dropdown con `enumerateDevices`)

   > **Implementado:** también se agregó selección de cuerda individual (E A D G B E). El usuario puede tocar una cuerda para filtrar la detección a esa frecuencia; mejora la precisión, especialmente en la 6ª cuerda (E2).

**Elementos visuales:**

- Notas de guitarra: E A D G B E en fila horizontal, nota activa en verde y bold
- Estado textual: "Afinado!", "Un poco alto", "Un poco bajo"
- Frecuencia en Hz debajo del estado
- Barra de centavos: línea vertical central verde (afinado) o desplazada

**Accesibilidad específica:**

- `aria-live="polite"` en el display de nota y estado
- El display de frecuencia tiene `aria-label="Frecuencia: 146.83 hertz"`
- La barra de centavos tiene `aria-label="Desviación: 2 centavos alto"` (oculta visualmente si hay texto)
- Botón de pausa/inicio del micrófono con `aria-pressed`

---

### 6.2 Leer partitura (`/partitura`)

**Propósito:** leer una foto o archivo de partitura, detectar la armonía, y narrar los acordes.

**Comportamiento:**

1. Pantalla inicial: imagen de partitura (si hay una cargada) o placeholder
2. Botones de acción:
   - "Subir archivo": `<input type="file" accept="image/*,.pdf">`
   - "Tomar foto": `getUserMedia` con `facingMode: environment`
3. Al recibir imagen: POST a `/api/ocr` con la imagen como `FormData`
4. Durante procesamiento: loading state con mensaje "Analizando partitura..." + `aria-busy`
5. Al completar: mostrar lista de acordes detectados como texto
6. Botón "Metrónomo": navega a `/partitura/metronomo` (mobile) o muestra panel (desktop)

**Endpoint `/api/ocr`:**

- Método: POST, multipart/form-data, campo `image`
- Proceso: escribir imagen a `/tmp/score_[timestamp].[ext]`, ejecutar `python3 -m oemer [path]`, parsear output, limpiar tmp
- Timeout: 60 segundos
- Response exitosa: `{ chords: string[], rawText: string }`
- Response error: `{ error: string }`

> **Implementado:** el proceso es `tesseract <imagen> <base> --psm 4 -c tessedit_char_whitelist=... tsv`, no oemer. Se escribe la imagen a `/tmp`, se corre Tesseract con una whitelist restringida al alfabeto del cifrado (A-G, `#`, `b`, sufijos de calidad, dígitos, `/`), y se parsea la salida TSV. Cada token se valida contra un regex derivado de `CHORD_QUALITIES` (`lib/chords.ts`) y se descarta lo que tenga confianza menor a 40, de modo que las cabezas de nota y los restos de pentagrama no entren como acordes. Los acordes se devuelven **en orden de lectura** (por renglón y de izquierda a derecha) y **sin deduplicar**: para un guitarrista la secuencia es la información, y las repeticiones son parte de la progresión. Timeout de 30 s (Tesseract responde en segundos; los 60 s originales estaban dimensionados para oemer). Si se sube un PDF, se convierte su primera página a PNG a 300 dpi con `pdftoppm` antes del OCR. Ver DECISIONS.md y `claude-docs/OCR-PARTITURA.md` para la medición que respalda `--psm 4` y el umbral de confianza.

**Accesibilidad específica:**

- El estado de carga anuncia "Analizando partitura" via `aria-live="assertive"`
- La lista de acordes es un `<ul>` semántico con `aria-label="Acordes detectados"`
- Cada acorde es un `<li>` legible por screen reader
- Botones de "Subir" y "Tomar foto" tienen labels descriptivos

---

### 6.3 Metrónomo (`/partitura/metronomo`)

> **Pendiente:** el metrónomo pasa a ser una pantalla de primer nivel en `/metronomo`, con ícono propio en la barra de navegación y redirect permanente desde `/partitura/metronomo`. En el test de usabilidad los cinco participantes lo buscaron en la barra inferior antes que dentro de Partitura, y uno no lo encontró. Al dejar de ser una pantalla anidada, desaparecen el enlace "Ir al metrónomo" de `/partitura` y el botón "Volver" de la pantalla del metrónomo. Ver INFORME.md §1.4.

> **Pendiente:** se agrega el control de vibración dentro de la pantalla del metrónomo, además del que ya está en `/ajustes`. Es el mismo estado de `SettingsContext` expuesto en dos lugares: los cinco participantes lo buscaron acá y una participante abandonó la tarea sin encontrarlo.

**Propósito:** metrónomo con BPM ajustable, audio y háptico.

**Comportamiento:**

- BPM inicial: 120. Rango: 40–220.
- Botón `−`: decrementa 1 BPM. Hold: decrementa continuo cada 150ms
- Botón `+`: incrementa 1 BPM. Hold: incrementa continuo cada 150ms
- Botón Play/Stop: alterna estado
  - Play: genera beep via `AudioContext.createOscillator()` + `navigator.vibrate(50)` en cada beat
  - Stop: detiene beep y vibración
- Display BPM: número grande, actualiza en tiempo real

**Accesibilidad específica:**

- Display BPM: `aria-live="polite"` solo cuando cambia por +/−
- Botón Play: `aria-pressed="true/false"`, label "Iniciar metrónomo" / "Detener metrónomo"
- Botones +/−: `aria-label="Incrementar BPM"` / `aria-label="Decrementar BPM"`

> **Pendiente:** el valor visible del BPM se sigue actualizando en tiempo real, pero la región `aria-live` se actualiza con retardo (~500 ms sin cambios) y anuncia solo el valor final. Con el anuncio directo, bajar de 120 a 100 encadena veinte locuciones: en el test de usabilidad la participante con discapacidad visual lo describió como "veinte anuncios para bajar veinte pulsos" y no podía pensar mientras tanto. Un ajuste, un anuncio, sin importar su magnitud. Se agrega además un texto de ayuda referenciado por `aria-describedby` en los botones +/− que comunique que la pulsación sostenida acelera el cambio: hoy la función existe pero no se descubre. Ver INFORME.md §1.4.

---

### 6.4 Detectar pedal (`/pedal`)

**Propósito:** identificar un pedal de guitarra vía cámara y leer sus parámetros.

**Comportamiento (v1 — detección mockeada):**

1. Al entrar: pedir permiso de cámara automáticamente
   - Si se deniega: mostrar mensaje de error descriptivo en pantalla (no bloquear la UI entera)
2. Mostrar stream de cámara en tiempo real (el video nunca se congela)
3. Botón "Detectar pedal": al presionar, muestra overlay de bounding box rojo encima del video en vivo
4. Mostrar datos mockeados del pedal detectado:
   - Nombre: "BOSS DS-1"
   - Tone: 50%, Level: 50%, Dist: 50%
   - Check LED: OFF (en rojo)
5. Narrar via TTS automáticamente: "Pedal BOSS DS-1 detectado. Tone al 50%. Level al 50%. Distorsión al 50%. LED apagado."
6. El mismo botón cambia a "Detectar de nuevo" tras una detección; al presionarlo limpia el resultado y repite desde el paso 3

**Nota de implementación:** los datos del pedal son fijos en v1. La UI debe estar construida para recibir datos dinámicos en v2.

> **Implementado (v1):** detección manual únicamente (se eliminó la opción automática cada 2s). El stream permanece en vivo durante y después de la detección; el bounding box es un overlay CSS sobre el video. El botón "Detectar pedal" se reutiliza como "Detectar de nuevo" para evitar duplicar controles.

> **Implementado (v2):** se reemplazó la detección mockeada por detección real de perillas vía OpenCV (`scripts/detect_knobs.py`, invocado desde `/api/pedal/detect`). El alcance se redujo a detección GENÉRICA de perillas: el algoritmo ubica círculos en la foto y calcula hacia qué hora del reloj (1 a 12, ej. "a las 3") apunta la marca de cada una — jerga habitual entre músicos para describir la posición de una perilla — en vez de un porcentaje 0-100%. No identifica marca ni modelo de pedal ni lee texto/logos. Las perillas se etiquetan genéricamente como "Perilla 1", "Perilla 2"... ordenadas por fila (arriba a abajo) y, dentro de cada fila, de izquierda a derecha — necesario porque pedales reales suelen tener las perillas en grilla, no en una sola fila. La detección del estado del LED queda fuera de alcance de esta iteración y se removió de `PedalInfo`. Si no se detecta ningún círculo, o ninguno con marca de posición clara, se muestra un mensaje de error descriptivo (no se inventan valores). Se removió el overlay de bounding box rojo sobre el video (era un rectángulo decorativo fijo de v1, sin relación con la posición real de las perillas detectadas; mostrarlo en v2 sería información visual falsa). También se cambió el encuadre de la cámara: en vez de un recorte fijo 16:9 (`object-cover`), se usa `object-contain` sin aspect-ratio forzado para que el usuario vea el cuadro completo que captura la cámara y pueda encuadrar pedales más altos que anchos. Ver DECISIONS.md para la justificación de este recorte de alcance y del cambio de porcentaje a hora de reloj.

> **Implementado (v3, 2026-07-28):** la detección dejó de basarse en una sola foto. Al presionar "Detectar pedal" se toma una **ráfaga de 5 capturas separadas 400 ms** (el botón pasa por el estado "Tomando fotos…", anunciado por voz) y el script vota entre ellas. Una perilla se reporta solo si al menos 3 capturas coinciden; si no, se devuelve `value: null` y tanto la UI como el TTS dicen **"no pude leerla con confianza"** en vez de arriesgar un número. Medido sobre 92 fotos reales, la lectura de una sola foto acertaba ~68% y nunca se abstenía; con votación el sistema responde en el 80% de las perillas y acierta el 93% de esas veces. Además las etiquetas pasaron de índices ("Perilla 2") a posiciones del panel ("Arriba izquierda"), porque el índice no es una identidad estable cuando varía la cantidad de perillas detectadas. Ver DECISIONS.md y `claude-docs/PEDAL.md` para las mediciones y los tres arreglos del detector.

> **Implementado (v2.1):** se agregó un botón "Encender flash" / "Apagar flash" en `CameraView` para mejorar la iluminación en la detección (la poca luz y las sombras sobre las perillas degradan la consistencia del algoritmo). Usa la extensión no estándar `torch` de `MediaStreamTrack.applyConstraints`, soportada en Chromium/Android pero no en Safari/WebKit (iOS) — el botón solo se muestra si `track.getCapabilities().torch` confirma soporte real en el dispositivo, para no exponer un control que no funciona. Cuando el flash está disponible, el TTS de "cámara lista" menciona explícitamente la opción ("si hay poca luz, presioná el botón Encender flash...") ya que el usuario no puede ver el botón en pantalla.

**Accesibilidad específica:**

- El stream de cámara tiene `aria-label="Vista de cámara para detección de pedal"`
- Los valores (Tone, Level, Dist) están en una `<dl>` semántica
- El estado del LED tiene texto explícito además del color
- Botón de detección: `aria-label="Detectar pedal con la cámara"`

---

### 6.5 Ajustes (`/ajustes`)

**Propósito:** configurar preferencias de accesibilidad persistentes.

**Tres configuraciones, cada una con control carrusel `< valor >`:**

| Setting                | Opciones                                 | Default |
| ---------------------- | ---------------------------------------- | ------- |
| Color (tema)           | Claro → Oscuro → Alto contraste → Claro  | Claro   |
| Tamaño de fuente       | Pequeño → Normal → Grande → Extra grande | Normal  |
| Velocidad del narrador | Lenta → Normal → Alta → Muy alta         | Normal  |

**Persistencia:**

```typescript
// localStorage key: "eco-settings"
interface EcoSettings {
  theme: 'light' | 'dark' | 'high-contrast'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  ttsSpeed: 'slow' | 'normal' | 'fast' | 'very-fast' // mapea a 0.75, 1, 1.25, 1.5 en SpeechSynthesis.rate
}
```

- Cambios se aplican inmediatamente (via SettingsContext + CSS variables en `<html>`)
- Se leen en el layout raíz para evitar flash de contenido sin estilo

**Accesibilidad específica del control carrusel:**

- Rol: `group` con `aria-labelledby` apuntando al título
- Botones `<` y `>`: `aria-label="Tema anterior"` / `aria-label="Siguiente tema"`
- Valor actual: `aria-live="polite"` para anunciar el cambio
- Teclado: flechas izquierda/derecha también cambian el valor

---

## 7. PWA

```typescript
// app/manifest.ts
{
  name: "Eco — Asistente musical accesible",
  short_name: "Eco",
  start_url: "/afinador",
  display: "standalone",
  background_color: "#F2F2F7",
  theme_color: "#F2F2F7",
  orientation: "portrait-primary",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
  ]
}
```

> **Implementado:** los íconos son SVG, no PNG — `/icons/icon-192.svg` y `/icons/icon-512.svg`, declarados con `type: "image/svg+xml"`. El resto del manifest coincide con este ejemplo.

Serwist: precachear páginas y assets estáticos. Audio y cámara no se cachean.

---

## 8. Docker

> **Implementado:** Se cambió la imagen base de `node:20-alpine` a `node:20-bookworm-slim` (Debian), porque los wheels de PyPI que necesita el proyecto son manylinux (glibc) y en Alpine (musl libc) pip no puede instalarlos. Ver DECISIONS.md entrada "Imagen base Debian Bookworm".
>
> **Implementado (2026-07-28):** ya no se instalan `oemer` ni `onnxruntime` — se removieron junto con el cambio a Tesseract. El Dockerfile instala `tesseract-ocr` y `poppler-utils` (para `/api/ocr`) más `opencv-python-headless` y `numpy` (para `/api/pedal/detect`). La imagen resultante es considerablemente más liviana.

```dockerfile
# Dockerfile
FROM node:20-alpine

# Python + oemer
RUN apk add --no-cache python3 py3-pip gcc musl-dev libffi-dev
RUN pip3 install oemer --break-system-packages

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
services:
  eco-app:
    build: .
    ports:
      - '3000:3000'
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

Cloudflare Tunnel apunta al puerto 3000.

---

## 9. Variables de entorno

```bash
# .env.local.example
NEXT_PUBLIC_APP_URL=http://localhost:3000   # reemplazar con URL de Cloudflare Tunnel en producción
```

---

## 10. Requisitos WCAG 2.2 para validación

La app debe pasar:

- **Lighthouse Accessibility:** ≥ 95
- **WAVE (WebAIM):** cero errores, mínimo de alertas justificadas
- **axe DevTools:** cero violaciones críticas o serias

Validación manual requerida:

- Navegación solo teclado (Tab completo por toda la app)
- Con VoiceOver (iOS Safari) — pantalla Afinador y Ajustes
- Con NVDA (Windows + Chrome) — pantalla Partitura
- Con CSS deshabilitado — todas las pantallas
- Con JS deshabilitado — todas las pantallas (SSR)
- En viewport 375px (iPhone SE) y 390px (iPhone 14)
- En viewport 1280px (desktop estándar)
